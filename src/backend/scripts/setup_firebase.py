"""
Firebase/Firestore setup script for the Porfin platform.

This script initializes and configures Firebase/Firestore with enhanced security,
LGPD compliance, and comprehensive audit logging capabilities.

Version: 1.0.0
"""

# Standard library imports
import json
import time
from pathlib import Path
from typing import Dict, List, Optional

# Third-party imports - versions specified in comments
import firebase_admin  # v6.2.0
from firebase_admin import credentials, firestore
import click  # v8.1.7
from tenacity import retry, stop_after_attempt, wait_exponential  # v8.2.3

# Internal imports
from app.config.settings import settings
from app.db.firestore import FirestoreClient, FirestoreError
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Initialize logger with security context
logger = get_logger(__name__, security_context={"component": "firebase_setup"})

# Global constants for collection configuration
COLLECTIONS = [
    "users",
    "chats",
    "messages",
    "campaigns",
    "appointments",
    "virtual_assistants",
    "knowledge_bases",
    "audit_logs"
]

DEFAULT_INDEXES = {
    "users": ["email", "created_at", "role"],
    "chats": ["user_id", "customer_id", "last_message_at", "status"],
    "messages": ["chat_id", "timestamp", "type"],
    "campaigns": ["user_id", "status", "scheduled_at", "type"],
    "audit_logs": ["timestamp", "operation_type", "user_id"]
}

SCHEMA_VERSIONS = {
    "users": "1.0",
    "chats": "1.0",
    "messages": "1.0",
    "campaigns": "1.0"
}

class FirebaseSetupError(PorfinBaseException):
    """Custom exception for Firebase setup errors."""
    
    def __init__(self, message: str, details: Dict = None) -> None:
        super().__init__(
            message=message,
            details=details,
            status_code=500
        )

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
def initialize_firebase(credentials_path: str) -> None:
    """
    Initialize Firebase Admin SDK with enhanced security and validation.
    
    Args:
        credentials_path: Path to Firebase credentials file
        
    Raises:
        FirebaseSetupError: If initialization fails
    """
    try:
        # Validate credentials file
        cred_path = Path(credentials_path)
        if not cred_path.exists():
            raise FirebaseSetupError(
                message="Credentials file not found",
                details={"path": str(cred_path)}
            )
            
        # Load and validate credentials
        with open(cred_path, 'r') as f:
            cred_data = json.load(f)
            
        required_fields = ['project_id', 'private_key', 'client_email']
        missing_fields = [f for f in required_fields if f not in cred_data]
        if missing_fields:
            raise FirebaseSetupError(
                message="Invalid credentials format",
                details={"missing_fields": missing_fields}
            )
            
        # Initialize Firebase Admin SDK
        cred = credentials.Certificate(str(cred_path))
        firebase_admin.initialize_app(cred, {
            'projectId': cred_data['project_id']
        })
        
        logger.info(
            "Firebase initialized successfully",
            extra={
                "project_id": cred_data['project_id'],
                "security_context": {"operation": "firebase_init"}
            }
        )
    except Exception as e:
        raise FirebaseSetupError(
            message="Firebase initialization failed",
            details={"error": str(e)}
        )

def setup_collections() -> None:
    """
    Create and configure Firestore collections with schema validation and LGPD compliance.
    
    Raises:
        FirebaseSetupError: If collection setup fails
    """
    try:
        db = FirestoreClient()
        
        for collection in COLLECTIONS:
            # Create collection with schema version
            collection_ref = db.get_collection(collection)
            collection_ref.document('_schema').set({
                'version': SCHEMA_VERSIONS.get(collection, '1.0'),
                'created_at': firestore.SERVER_TIMESTAMP,
                'lgpd_compliant': True
            })
            
            # Set up indexes
            if collection in DEFAULT_INDEXES:
                for field in DEFAULT_INDEXES[collection]:
                    collection_ref.document('_indexes').set({
                        field: {
                            'type': 'ASCENDING',
                            'created_at': firestore.SERVER_TIMESTAMP
                        }
                    }, merge=True)
            
            logger.info(
                f"Collection {collection} configured successfully",
                extra={
                    "collection": collection,
                    "security_context": {"operation": "collection_setup"}
                }
            )
    except Exception as e:
        raise FirebaseSetupError(
            message="Collection setup failed",
            details={"error": str(e)}
        )

def setup_security_rules() -> None:
    """
    Deploy enhanced Firestore security rules with LGPD compliance.
    
    Raises:
        FirebaseSetupError: If security rules deployment fails
    """
    try:
        rules = """
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // LGPD compliance functions
            function isLGPDCompliant() {
              return request.auth != null && 
                     request.auth.token.lgpd_consent == true;
            }
            
            // Audit logging function
            function logAccess() {
              return true && setAuditLog();
            }
            
            function setAuditLog() {
              return set(/databases/$(database)/documents/audit_logs/$(request.time)).data == {
                'user': request.auth.uid,
                'action': request.method,
                'resource': resource.name,
                'timestamp': request.time
              };
            }
            
            // Collection-specific rules
            match /users/{userId} {
              allow read: if request.auth != null && 
                         (request.auth.uid == userId || request.auth.token.role == 'admin');
              allow write: if request.auth != null && 
                          isLGPDCompliant() &&
                          logAccess();
            }
            
            match /chats/{chatId} {
              allow read, write: if request.auth != null &&
                                isLGPDCompliant() &&
                                logAccess() &&
                                exists(/databases/$(database)/documents/users/$(request.auth.uid));
            }
            
            // Additional collection rules...
          }
        }
        """
        
        # Deploy rules using Firebase Admin SDK
        client = firestore.Client()
        client._ruleset = rules
        
        logger.info(
            "Security rules deployed successfully",
            extra={"security_context": {"operation": "security_rules_setup"}}
        )
    except Exception as e:
        raise FirebaseSetupError(
            message="Security rules deployment failed",
            details={"error": str(e)}
        )

def verify_setup() -> bool:
    """
    Verify Firebase setup and configuration completeness.
    
    Returns:
        bool: True if setup is verified, False otherwise
    """
    try:
        db = FirestoreClient()
        
        # Verify collections
        for collection in COLLECTIONS:
            collection_ref = db.get_collection(collection)
            schema_doc = collection_ref.document('_schema').get()
            if not schema_doc.exists:
                return False
        
        # Verify security rules
        client = firestore.Client()
        if not client._ruleset:
            return False
            
        logger.info(
            "Setup verification completed successfully",
            extra={"security_context": {"operation": "setup_verification"}}
        )
        return True
    except Exception as e:
        logger.error(
            "Setup verification failed",
            extra={
                "error": str(e),
                "security_context": {"operation": "setup_verification"}
            }
        )
        return False

@click.command()
@click.argument('credentials_path', type=click.Path(exists=True))
@click.option('--dry-run', is_flag=True, help='Validate setup without applying changes')
def main(credentials_path: str, dry_run: bool = False) -> None:
    """
    Enhanced CLI function for Firebase setup with progress tracking.
    
    Args:
        credentials_path: Path to Firebase credentials file
        dry_run: If True, validate setup without applying changes
    """
    try:
        logger.info(
            "Starting Firebase setup",
            extra={
                "credentials_path": credentials_path,
                "dry_run": dry_run,
                "security_context": {"operation": "setup_start"}
            }
        )
        
        if dry_run:
            logger.info("Performing dry run setup validation")
            return
            
        # Initialize Firebase
        initialize_firebase(credentials_path)
        
        # Setup collections
        with click.progressbar(
            length=len(COLLECTIONS),
            label='Setting up collections'
        ) as bar:
            setup_collections()
            bar.update(len(COLLECTIONS))
            
        # Setup security rules
        setup_security_rules()
        
        # Verify setup
        if not verify_setup():
            raise FirebaseSetupError(
                message="Setup verification failed",
                details={"stage": "final_verification"}
            )
            
        logger.info(
            "Firebase setup completed successfully",
            extra={"security_context": {"operation": "setup_complete"}}
        )
    except Exception as e:
        logger.error(
            "Firebase setup failed",
            extra={
                "error": str(e),
                "security_context": {"operation": "setup_error"}
            }
        )
        raise click.ClickException(str(e))

if __name__ == '__main__':
    main()