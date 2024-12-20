"""
Firestore schema migrations version management module.

This module provides a robust versioning system for managing Firestore schema migrations
with validation, transaction support, and audit logging for safe database evolution.

Version: 1.0.0
"""

# Standard library imports
import re
import importlib
import inspect
from typing import Dict, Callable, Optional, List
from datetime import datetime

# Internal imports
from app.db.firestore import FirestoreClient, FirestoreError
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Configure logger
logger = get_logger(__name__)

# Global registry for migration versions
VERSION_REGISTRY: Dict[str, Callable[[FirestoreClient], None]] = {}

# Migration version format constants
MIGRATION_PREFIX: str = 'V'  # Prefix for migration version files
VERSION_PATTERN: re.Pattern = re.compile(r'^V\d{3}_[a-z0-9_]+$')  # Regex pattern for version validation

class MigrationError(PorfinBaseException):
    """Custom exception for migration-related errors."""
    
    def __init__(
        self,
        message: str,
        details: Optional[dict] = None,
        version: Optional[str] = None
    ) -> None:
        """
        Initialize migration error with version context.

        Args:
            message: Error description
            details: Additional error context
            version: Migration version where error occurred
        """
        super().__init__(
            message=message,
            details=details,
            status_code=500,
            security_context={"migration_version": version}
        )

def validate_version_format(version: str) -> bool:
    """
    Validates migration version string format.

    Args:
        version: Version string to validate (e.g., 'V001_initial_schema')

    Returns:
        bool: True if version format is valid

    Raises:
        MigrationError: If version format is invalid
    """
    if not VERSION_PATTERN.match(version):
        raise MigrationError(
            message=f"Invalid version format: {version}",
            details={"expected_format": "V[0-9]{3}_[a-z0-9_]+"},
            version=version
        )
    
    # Extract version number
    version_num = int(version[1:4])
    if not (1 <= version_num <= 999):
        raise MigrationError(
            message=f"Version number out of range: {version_num}",
            details={"valid_range": "001-999"},
            version=version
        )
    
    return True

def register_version(version: str) -> Callable:
    """
    Decorator to register a migration version with validation and error handling.

    Args:
        version: Migration version identifier (e.g., 'V001_initial_schema')

    Returns:
        Callable: Decorated migration function with transaction support

    Raises:
        MigrationError: If version is invalid or already registered
    """
    def decorator(func: Callable[[FirestoreClient], None]) -> Callable:
        # Validate version format
        validate_version_format(version)
        
        # Check for duplicate versions
        if version in VERSION_REGISTRY:
            raise MigrationError(
                message=f"Duplicate migration version: {version}",
                details={"existing_function": VERSION_REGISTRY[version].__name__},
                version=version
            )
        
        # Validate function signature
        sig = inspect.signature(func)
        if len(sig.parameters) != 1:
            raise MigrationError(
                message=f"Invalid migration function signature: {func.__name__}",
                details={"expected": "func(db: FirestoreClient)"},
                version=version
            )
        
        def wrapped_migration(db: FirestoreClient) -> None:
            """Wraps migration function with transaction and error handling."""
            try:
                # Log migration start
                logger.info(
                    f"Starting migration {version}",
                    extra={
                        "migration_version": version,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                
                # Execute migration in transaction
                with db.transaction() as transaction:
                    func(db)
                    
                    # Record migration in migrations collection
                    migration_ref = db.get_collection("migrations").document(version)
                    migration_ref.set({
                        "version": version,
                        "executed_at": datetime.utcnow(),
                        "status": "completed",
                        "description": func.__doc__ or ""
                    })
                
                # Log migration completion
                logger.info(
                    f"Completed migration {version}",
                    extra={
                        "migration_version": version,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                
            except Exception as e:
                # Log migration failure
                logger.error(
                    f"Migration {version} failed",
                    extra={
                        "migration_version": version,
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    },
                    exc_info=True
                )
                raise MigrationError(
                    message=f"Migration failed: {str(e)}",
                    details={"original_error": str(e)},
                    version=version
                )
        
        # Register wrapped migration
        VERSION_REGISTRY[version] = wrapped_migration
        return wrapped_migration
    
    return decorator

def get_version_modules() -> Dict[str, Callable]:
    """
    Get all registered migration version modules in sorted order.

    Returns:
        Dict[str, callable]: Sorted dictionary of version numbers to migration functions
    """
    # Create copy of registry to avoid modification during iteration
    versions = VERSION_REGISTRY.copy()
    
    # Sort versions by number component
    sorted_versions = dict(
        sorted(
            versions.items(),
            key=lambda x: int(x[0][1:4])  # Extract numeric portion of version
        )
    )
    
    return sorted_versions

def get_pending_migrations(db: FirestoreClient) -> List[str]:
    """
    Get list of pending migrations that haven't been executed.

    Args:
        db: FirestoreClient instance

    Returns:
        List[str]: List of pending migration versions
    """
    # Get all registered versions
    registered_versions = set(VERSION_REGISTRY.keys())
    
    # Get executed migrations from database
    executed_versions = set()
    migrations_ref = db.get_collection("migrations")
    for doc in migrations_ref.stream():
        executed_versions.add(doc.id)
    
    # Return sorted list of pending migrations
    return sorted(list(registered_versions - executed_versions))

__all__ = [
    "register_version",
    "VERSION_REGISTRY",
    "get_version_modules",
    "validate_version_format",
    "get_pending_migrations",
    "MigrationError"
]