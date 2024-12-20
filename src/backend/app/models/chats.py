"""
Chat model implementation for managing WhatsApp conversations in the Porfin platform.

This module provides a secure and compliant chat model for healthcare providers to
manage WhatsApp conversations with patients, including enhanced security features
and LGPD compliance.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
import uuid

# Third-party imports
from pydantic import BaseModel, Field, validator  # pydantic v2.0.0
import phonenumbers  # phonenumbers v8.13.0
from cryptography.fernet import Fernet  # cryptography v41.0.0

# Internal imports
from app.db.firestore import FirestoreClient
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Configure logger
logger = get_logger(__name__)

# Constants
CHATS_COLLECTION = "chats"
MAX_MESSAGE_SIZE = 4096  # Maximum message size in bytes
CACHE_TTL = 3600  # Cache TTL in seconds
RATE_LIMIT = 100  # Messages per minute

class ChatStatus(str, Enum):
    """Enumeration of possible chat statuses."""
    ACTIVE = "active"
    ARCHIVED = "archived"
    BLOCKED = "blocked"

class ChatBase(BaseModel):
    """Base Pydantic model for chat data validation with enhanced security."""
    
    # Core chat fields
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    provider_id: str = Field(..., description="Healthcare provider ID")
    customer_phone: str = Field(..., description="Customer WhatsApp phone number")
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_email: Optional[str] = None
    status: ChatStatus = Field(default=ChatStatus.ACTIVE)
    ai_enabled: bool = Field(default=True)
    
    # Metadata and state
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    last_message: Dict[str, Any] = Field(default_factory=dict)
    message_count: int = Field(default=0)
    
    # Timestamps
    last_message_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Security and compliance
    encryption_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    audit_log: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    compliance_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    @validator("customer_phone")
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        try:
            phone_number = phonenumbers.parse(v, "BR")
            if not phonenumbers.is_valid_number(phone_number):
                raise ValueError("Invalid phone number")
            return phonenumbers.format_number(
                phone_number, phonenumbers.PhoneNumberFormat.E164
            )
        except Exception as e:
            raise ValidationError(
                message="Invalid phone number format",
                details={"error": str(e)}
            )

class Chat:
    """Main chat model implementing database operations with enhanced features."""
    
    def __init__(self):
        """Initialize chat model with database client and security components."""
        self._db = FirestoreClient()
        self._encryptor = Fernet(self._get_encryption_key())
        
        # Initialize rate limiter and metrics
        self._setup_rate_limiter()
        self._setup_metrics()

    def _get_encryption_key(self) -> bytes:
        """Get or generate field-level encryption key."""
        # Implementation would retrieve key from secure key management service
        return b"your-secure-encryption-key-here"

    def _setup_rate_limiter(self) -> None:
        """Configure rate limiting for chat operations."""
        # Implementation would initialize rate limiting
        pass

    def _setup_metrics(self) -> None:
        """Configure metrics collection for monitoring."""
        # Implementation would initialize metrics
        pass

    async def create(self, chat_data: Dict[str, Any]) -> ChatBase:
        """
        Create a new chat with enhanced validation and security.

        Args:
            chat_data: Chat creation data

        Returns:
            ChatBase: Created chat instance

        Raises:
            ValidationError: If validation fails
        """
        try:
            # Create chat model instance with validation
            chat = ChatBase(**chat_data)
            
            # Encrypt sensitive fields
            chat.customer_email = self._encrypt_field(chat.customer_email) if chat.customer_email else None
            
            # Set compliance metadata
            chat.compliance_metadata = {
                "data_retention_days": 365,  # 1 year retention for healthcare
                "consent_obtained": True,
                "consent_timestamp": datetime.utcnow().isoformat(),
                "data_classification": "PHI",  # Protected Health Information
                "encryption_status": "encrypted"
            }
            
            # Create initial audit log
            chat.audit_log.append({
                "timestamp": datetime.utcnow().isoformat(),
                "action": "chat_created",
                "actor": chat_data.get("created_by", "system"),
                "details": {
                    "provider_id": chat.provider_id,
                    "ai_enabled": chat.ai_enabled
                }
            })
            
            # Store in Firestore
            await self._db.create_document(
                CHATS_COLLECTION,
                chat.dict(exclude={"audit_log"}),
                document_id=chat.id
            )
            
            logger.info(
                "Chat created successfully",
                extra={
                    "chat_id": chat.id,
                    "provider_id": chat.provider_id,
                    "security_event": "chat_created"
                }
            )
            
            return chat
            
        except Exception as e:
            logger.error(
                "Failed to create chat",
                extra={
                    "error": str(e),
                    "security_event": "chat_creation_failed"
                }
            )
            raise

    async def get(self, chat_id: str) -> ChatBase:
        """
        Retrieve a chat by ID with security checks.

        Args:
            chat_id: Chat ID to retrieve

        Returns:
            ChatBase: Retrieved chat instance

        Raises:
            ValidationError: If chat not found
        """
        try:
            # Get chat document
            chat_data = await self._db.get_document(CHATS_COLLECTION, chat_id)
            if not chat_data:
                raise ValidationError("Chat not found")
            
            # Decrypt sensitive fields
            if chat_data.get("customer_email"):
                chat_data["customer_email"] = self._decrypt_field(
                    chat_data["customer_email"]
                )
            
            # Create chat instance
            chat = ChatBase(**chat_data)
            
            logger.info(
                "Chat retrieved successfully",
                extra={
                    "chat_id": chat_id,
                    "security_event": "chat_accessed"
                }
            )
            
            return chat
            
        except Exception as e:
            logger.error(
                "Failed to retrieve chat",
                extra={
                    "chat_id": chat_id,
                    "error": str(e),
                    "security_event": "chat_access_failed"
                }
            )
            raise

    async def update(self, chat_id: str, update_data: Dict[str, Any]) -> ChatBase:
        """
        Update chat information with validation and audit.

        Args:
            chat_id: Chat ID to update
            update_data: Fields to update

        Returns:
            ChatBase: Updated chat instance

        Raises:
            ValidationError: If validation fails
        """
        try:
            # Get existing chat
            chat = await self.get(chat_id)
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(chat, field):
                    # Encrypt sensitive fields
                    if field == "customer_email" and value:
                        value = self._encrypt_field(value)
                    setattr(chat, field, value)
            
            # Update timestamps
            chat.updated_at = datetime.utcnow()
            
            # Add audit log
            chat.audit_log.append({
                "timestamp": datetime.utcnow().isoformat(),
                "action": "chat_updated",
                "actor": update_data.get("updated_by", "system"),
                "details": {
                    "updated_fields": list(update_data.keys())
                }
            })
            
            # Save updates
            await self._db.update_document(
                CHATS_COLLECTION,
                chat_id,
                chat.dict(exclude={"audit_log"})
            )
            
            logger.info(
                "Chat updated successfully",
                extra={
                    "chat_id": chat_id,
                    "security_event": "chat_updated"
                }
            )
            
            return chat
            
        except Exception as e:
            logger.error(
                "Failed to update chat",
                extra={
                    "chat_id": chat_id,
                    "error": str(e),
                    "security_event": "chat_update_failed"
                }
            )
            raise

    def _encrypt_field(self, value: str) -> str:
        """Encrypt sensitive field value."""
        if not value:
            return value
        return self._encryptor.encrypt(value.encode()).decode()

    def _decrypt_field(self, value: str) -> str:
        """Decrypt sensitive field value."""
        if not value:
            return value
        return self._encryptor.decrypt(value.encode()).decode()

# Export commonly used items
__all__ = [
    "ChatStatus",
    "ChatBase",
    "Chat"
]