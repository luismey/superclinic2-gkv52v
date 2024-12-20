"""
Core message model implementation for WhatsApp message handling in the Porfin platform.

This module provides comprehensive message handling with support for all WhatsApp message types,
AI-generated responses, and detailed status tracking with Firestore persistence.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List
import uuid

# Internal imports
from app.db.firestore import FirestoreClient, FirestoreError
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Configure logger
logger = get_logger(__name__)

class MessageType(str, Enum):
    """Enumeration of supported WhatsApp message types."""
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"
    LOCATION = "location"
    CONTACT = "contact"
    TEMPLATE = "template"
    INTERACTIVE = "interactive"

class MessageDirection(str, Enum):
    """Enumeration for message flow direction."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"

class MessageStatus(str, Enum):
    """Enhanced enumeration for message delivery status tracking."""
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    EXPIRED = "expired"

class Message:
    """Enhanced message model with AI support and detailed status tracking."""

    COLLECTION_NAME = "messages"

    def __init__(
        self,
        chat_id: str,
        type: MessageType,
        direction: MessageDirection,
        content: str,
        media_url: Optional[str] = None,
        media_type: Optional[str] = None,
        metadata: Optional[Dict] = None,
        is_ai_generated: bool = False,
        ai_context: Optional[Dict] = None,
        tags: Optional[Dict] = None,
        referenced_messages: Optional[List[str]] = None
    ) -> None:
        """
        Initialize a new message instance with enhanced validation.

        Args:
            chat_id: Associated chat identifier
            type: Message type (text, image, etc.)
            direction: Message direction (inbound/outbound)
            content: Message content
            media_url: Optional URL for media content
            media_type: Optional MIME type for media content
            metadata: Optional additional message metadata
            is_ai_generated: Flag indicating AI-generated content
            ai_context: Optional AI processing context
            tags: Optional message tags for categorization
            referenced_messages: Optional list of referenced message IDs
        """
        self.id = str(uuid.uuid4())
        self.chat_id = chat_id
        self.type = type
        self.direction = direction
        self.status = MessageStatus.PENDING
        self.content = content
        self.media_url = media_url
        self.media_type = media_type
        self.metadata = metadata or {}
        self.is_ai_generated = is_ai_generated
        self.ai_context = ai_context or {}
        self.sent_at = datetime.utcnow()
        self.delivered_at = None
        self.read_at = None
        self.failed_at = None
        self.failure_reason = None
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.tags = tags or {}
        self.referenced_messages = referenced_messages or []

        # Validate message data
        self._validate()

    def _validate(self) -> None:
        """
        Validate message data completeness and consistency.

        Raises:
            ValidationError: If validation fails
        """
        if not self.chat_id:
            raise ValidationError("chat_id is required")

        if not self.content and self.type != MessageType.INTERACTIVE:
            raise ValidationError("content is required for non-interactive messages")

        if self.type in [MessageType.IMAGE, MessageType.AUDIO, MessageType.VIDEO, MessageType.DOCUMENT]:
            if not self.media_url:
                raise ValidationError(f"media_url is required for {self.type} messages")
            if not self.media_type:
                raise ValidationError(f"media_type is required for {self.type} messages")

        if self.is_ai_generated and not self.ai_context:
            raise ValidationError("ai_context is required for AI-generated messages")

    @classmethod
    async def create(cls, data: Dict) -> "Message":
        """
        Create a new message in Firestore with validation.

        Args:
            data: Message data dictionary

        Returns:
            Created message instance

        Raises:
            ValidationError: If data validation fails
            FirestoreError: If database operation fails
        """
        try:
            # Create message instance
            message = cls(
                chat_id=data["chat_id"],
                type=MessageType(data["type"]),
                direction=MessageDirection(data["direction"]),
                content=data.get("content", ""),
                media_url=data.get("media_url"),
                media_type=data.get("media_type"),
                metadata=data.get("metadata"),
                is_ai_generated=data.get("is_ai_generated", False),
                ai_context=data.get("ai_context"),
                tags=data.get("tags"),
                referenced_messages=data.get("referenced_messages")
            )

            # Store in Firestore
            db = FirestoreClient()
            async with db.transaction() as transaction:
                await transaction.create_document(
                    cls.COLLECTION_NAME,
                    message.to_dict(),
                    document_id=message.id
                )

            logger.info(
                f"Created message {message.id}",
                extra={
                    "message_id": message.id,
                    "chat_id": message.chat_id,
                    "type": message.type.value,
                    "direction": message.direction.value
                }
            )

            return message

        except (ValidationError, FirestoreError) as e:
            logger.error(
                f"Failed to create message: {str(e)}",
                extra={"data": data}
            )
            raise

    async def update_status(
        self,
        status: MessageStatus,
        timestamp: Optional[datetime] = None,
        failure_reason: Optional[str] = None
    ) -> bool:
        """
        Update message delivery status with transaction support.

        Args:
            status: New message status
            timestamp: Optional status update timestamp
            failure_reason: Optional failure reason if status is FAILED

        Returns:
            bool: Update success status

        Raises:
            FirestoreError: If database operation fails
        """
        try:
            timestamp = timestamp or datetime.utcnow()
            db = FirestoreClient()

            async with db.transaction() as transaction:
                # Update status-specific timestamps
                if status == MessageStatus.DELIVERED:
                    self.delivered_at = timestamp
                elif status == MessageStatus.READ:
                    self.read_at = timestamp
                elif status == MessageStatus.FAILED:
                    self.failed_at = timestamp
                    self.failure_reason = failure_reason

                self.status = status
                self.updated_at = timestamp

                # Update in Firestore
                await transaction.update_document(
                    self.COLLECTION_NAME,
                    self.id,
                    self.to_dict()
                )

            logger.info(
                f"Updated message {self.id} status to {status.value}",
                extra={
                    "message_id": self.id,
                    "status": status.value,
                    "timestamp": timestamp.isoformat()
                }
            )

            return True

        except FirestoreError as e:
            logger.error(
                f"Failed to update message status: {str(e)}",
                extra={
                    "message_id": self.id,
                    "status": status.value
                }
            )
            raise

    def to_dict(self) -> Dict:
        """
        Convert message to dictionary with enhanced formatting.

        Returns:
            Dict: Message data dictionary
        """
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "type": self.type.value,
            "direction": self.direction.value,
            "status": self.status.value,
            "content": self.content,
            "media_url": self.media_url,
            "media_type": self.media_type,
            "metadata": self.metadata,
            "is_ai_generated": self.is_ai_generated,
            "ai_context": self.ai_context,
            "sent_at": self.sent_at.isoformat(),
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "failed_at": self.failed_at.isoformat() if self.failed_at else None,
            "failure_reason": self.failure_reason,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "tags": self.tags,
            "referenced_messages": self.referenced_messages
        }