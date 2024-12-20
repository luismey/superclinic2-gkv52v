"""
Database migrations package for the Porfin platform.

This module provides comprehensive migration management functionality for Firestore schema
versioning, progressive updates, and safe transaction handling with rollback support.

Version: 1.0.0
"""

# Standard library imports
import importlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Callable

# Internal imports
from app.db.firestore import FirestoreClient
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Configure logger
logger = get_logger(__name__)

# Constants
MIGRATIONS_REGISTRY: Dict[str, Dict[str, Any]] = {}
MIGRATIONS_PATH = Path(__file__).parent / 'versions'
MIGRATION_LOCK_KEY = 'migration_lock'
VERSION_PATTERN = re.compile(r'^\d+\.\d+\.\d+$')
MIGRATION_METADATA_COLLECTION = '_migrations'

class MigrationError(PorfinBaseException):
    """Custom exception for migration-related errors with enhanced tracking."""
    
    def __init__(
        self,
        message: str,
        details: Dict[str, Any] = None,
        version: str = None,
        correlation_id: str = None
    ) -> None:
        """
        Initialize migration error with version tracking.

        Args:
            message: Error description
            details: Additional error context
            version: Migration version that failed
            correlation_id: Request correlation ID
        """
        super().__init__(
            message=message,
            details=details,
            correlation_id=correlation_id,
            security_context={"migration_version": version}
        )
        self.version = version

class MigrationManager:
    """Manages database schema migrations with comprehensive version control and safety features."""
    
    def __init__(self, db_client: FirestoreClient, dry_run: bool = False) -> None:
        """
        Initialize migration manager with enhanced safety features.

        Args:
            db_client: Firestore client instance
            dry_run: If True, simulates migration without applying changes
        """
        self._db_client = db_client
        self._dry_run = dry_run
        self._current_version = None
        self._migrations = {}
        self._dependencies = {}
        self._is_locked = False
        
        # Create migrations collection if it doesn't exist
        self._ensure_migrations_collection()
    
    def _ensure_migrations_collection(self) -> None:
        """Ensure migrations metadata collection exists."""
        try:
            self._db_client.get_collection(MIGRATION_METADATA_COLLECTION)
        except Exception as e:
            logger.info(f"Creating migrations collection: {MIGRATION_METADATA_COLLECTION}")
            self._db_client.create_document(
                MIGRATION_METADATA_COLLECTION,
                {"initialized_at": datetime.utcnow().isoformat()}
            )
    
    async def _acquire_lock(self) -> bool:
        """
        Acquire migration lock with timeout.

        Returns:
            bool: True if lock acquired, False otherwise
        """
        try:
            with self._db_client.transaction() as transaction:
                lock_doc = self._db_client.get_collection(MIGRATION_METADATA_COLLECTION).document(MIGRATION_LOCK_KEY)
                lock_data = lock_doc.get(transaction=transaction)
                
                if lock_data and lock_data.exists:
                    return False
                
                transaction.set(lock_doc, {
                    "locked_at": datetime.utcnow().isoformat(),
                    "locked_by": "migration_manager"
                })
                self._is_locked = True
                return True
        except Exception as e:
            logger.error(f"Failed to acquire migration lock: {str(e)}")
            return False
    
    async def _release_lock(self) -> None:
        """Release migration lock."""
        if self._is_locked:
            try:
                lock_doc = self._db_client.get_collection(MIGRATION_METADATA_COLLECTION).document(MIGRATION_LOCK_KEY)
                lock_doc.delete()
                self._is_locked = False
            except Exception as e:
                logger.error(f"Failed to release migration lock: {str(e)}")
    
    def register_migration(
        self,
        version: str,
        migration_func: Callable,
        dependencies: Optional[List[str]] = None
    ) -> None:
        """
        Register a new migration with enhanced validation and dependency tracking.

        Args:
            version: Migration version number (format: X.Y.Z)
            migration_func: Migration function to execute
            dependencies: Optional list of version dependencies

        Raises:
            MigrationError: If version is invalid or conflicts exist
        """
        # Validate version format
        if not VERSION_PATTERN.match(version):
            raise MigrationError(
                message=f"Invalid version format: {version}. Must match X.Y.Z pattern.",
                version=version
            )
        
        # Check for version conflicts
        if version in self._migrations:
            raise MigrationError(
                message=f"Migration version {version} already registered",
                version=version
            )
        
        # Register migration with metadata
        self._migrations[version] = {
            "func": migration_func,
            "dependencies": dependencies or [],
            "registered_at": datetime.utcnow().isoformat()
        }
        
        # Update dependency graph
        if dependencies:
            self._dependencies[version] = set(dependencies)
            
            # Validate dependencies exist
            missing_deps = [dep for dep in dependencies if dep not in self._migrations]
            if missing_deps:
                raise MigrationError(
                    message=f"Missing dependencies: {', '.join(missing_deps)}",
                    version=version,
                    details={"missing_dependencies": missing_deps}
                )
        
        logger.info(
            f"Registered migration {version}",
            extra={
                "version": version,
                "dependencies": dependencies,
                "migration_count": len(self._migrations)
            }
        )
    
    async def apply_migrations(self) -> bool:
        """
        Apply pending migrations with comprehensive safety checks and rollback support.

        Returns:
            bool: True if migrations successful, False otherwise
        """
        if not await self._acquire_lock():
            raise MigrationError(
                message="Could not acquire migration lock. Another migration might be in progress."
            )
        
        try:
            # Get current version
            current_version = await self._get_current_version()
            pending_migrations = self._get_pending_migrations(current_version)
            
            if not pending_migrations:
                logger.info("No pending migrations to apply")
                return True
            
            logger.info(
                f"Applying {len(pending_migrations)} migrations",
                extra={"pending_count": len(pending_migrations)}
            )
            
            # Sort migrations by dependencies
            sorted_migrations = self._sort_migrations(pending_migrations)
            
            # Apply migrations in transaction
            for version, migration in sorted_migrations:
                if self._dry_run:
                    logger.info(f"Dry run: Would apply migration {version}")
                    continue
                
                try:
                    with self._db_client.transaction() as transaction:
                        # Execute migration
                        await migration["func"](transaction)
                        
                        # Update version metadata
                        self._update_version_metadata(transaction, version)
                        
                        logger.info(
                            f"Successfully applied migration {version}",
                            extra={"version": version}
                        )
                except Exception as e:
                    raise MigrationError(
                        message=f"Migration {version} failed: {str(e)}",
                        version=version,
                        details={"error": str(e)}
                    )
            
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            raise
        finally:
            await self._release_lock()
    
    async def _get_current_version(self) -> str:
        """
        Get current schema version from database.

        Returns:
            str: Current version or '0.0.0' if none set
        """
        try:
            version_doc = self._db_client.get_collection(MIGRATION_METADATA_COLLECTION).document('current_version').get()
            if version_doc.exists:
                return version_doc.get('version')
        except Exception as e:
            logger.warning(f"Failed to get current version: {str(e)}")
        return '0.0.0'
    
    def _get_pending_migrations(self, current_version: str) -> List[Tuple[str, Dict[str, Any]]]:
        """
        Get list of pending migrations sorted by version.

        Args:
            current_version: Current schema version

        Returns:
            List of (version, migration) tuples pending application
        """
        return [
            (version, migration) 
            for version, migration in sorted(self._migrations.items())
            if self._compare_versions(version, current_version) > 0
        ]
    
    @staticmethod
    def _compare_versions(version1: str, version2: str) -> int:
        """
        Compare two version strings.

        Args:
            version1: First version
            version2: Second version

        Returns:
            int: -1 if version1 < version2, 0 if equal, 1 if version1 > version2
        """
        v1_parts = [int(x) for x in version1.split('.')]
        v2_parts = [int(x) for x in version2.split('.')]
        
        for i in range(3):
            if v1_parts[i] != v2_parts[i]:
                return -1 if v1_parts[i] < v2_parts[i] else 1
        return 0
    
    def _sort_migrations(
        self,
        migrations: List[Tuple[str, Dict[str, Any]]]
    ) -> List[Tuple[str, Dict[str, Any]]]:
        """
        Sort migrations by dependencies using topological sort.

        Args:
            migrations: List of (version, migration) tuples

        Returns:
            Sorted list of migrations respecting dependencies

        Raises:
            MigrationError: If circular dependencies detected
        """
        sorted_migrations = []
        visited = set()
        temp_visited = set()
        
        def visit(version: str) -> None:
            """DFS helper for topological sort."""
            if version in temp_visited:
                raise MigrationError(
                    message="Circular dependency detected",
                    details={"cycle_detected_at": version}
                )
            
            if version not in visited:
                temp_visited.add(version)
                
                # Visit dependencies first
                for dep in self._dependencies.get(version, set()):
                    visit(dep)
                
                temp_visited.remove(version)
                visited.add(version)
                
                # Add migration to sorted list if it's pending
                migration = next(
                    (m for v, m in migrations if v == version),
                    None
                )
                if migration:
                    sorted_migrations.append((version, migration))
        
        # Sort all migrations
        for version, _ in migrations:
            visit(version)
        
        return sorted_migrations
    
    def _update_version_metadata(self, transaction: Any, version: str) -> None:
        """
        Update version metadata in database.

        Args:
            transaction: Active database transaction
            version: New version number
        """
        version_doc = self._db_client.get_collection(MIGRATION_METADATA_COLLECTION).document('current_version')
        transaction.set(version_doc, {
            'version': version,
            'updated_at': datetime.utcnow().isoformat(),
            'dry_run': self._dry_run
        })

def load_migrations() -> None:
    """
    Load and validate all migration modules with enhanced safety checks.
    
    Raises:
        MigrationError: If migration loading fails
    """
    try:
        # Create migrations directory if it doesn't exist
        MIGRATIONS_PATH.mkdir(parents=True, exist_ok=True)
        
        # Load all migration modules
        for migration_file in sorted(MIGRATIONS_PATH.glob('*.py')):
            if migration_file.name == '__init__.py':
                continue
                
            try:
                # Import migration module
                module_path = f"app.db.migrations.versions.{migration_file.stem}"
                importlib.import_module(module_path)
                
                logger.debug(f"Loaded migration module: {module_path}")
            except Exception as e:
                raise MigrationError(
                    message=f"Failed to load migration {migration_file.name}",
                    details={"error": str(e)}
                )
        
        logger.info(
            f"Loaded {len(MIGRATIONS_REGISTRY)} migrations",
            extra={"migrations_count": len(MIGRATIONS_REGISTRY)}
        )
    except Exception as e:
        logger.error(f"Failed to load migrations: {str(e)}")
        raise

# Export public interface
__all__ = [
    'MigrationManager',
    'MigrationError',
    'load_migrations',
    'MIGRATIONS_REGISTRY'
]