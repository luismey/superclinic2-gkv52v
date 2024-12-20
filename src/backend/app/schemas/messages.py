"""
Pydantic schemas for message data validation and serialization in the Porfin platform.

This module provides comprehensive schema definitions for WhatsApp message handling,
supporting AI-powered communications and detailed message tracking.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Optional, Dict, List

# Third-party imports - pydantic v2.0.0
from pydantic import BaseModel, Field, constr

# Internal imports
from app.models.messages import (
    MessageType,
    MessageDirection,
    MessageStatus
)

class MessageCreate(BaseModel):
    """
    Schema for creating new messages with comprehensive validation.
    
    Supports all WhatsApp message types and includes AI-specific metadata fields
    for virtual assistant integration.
    """
    
    chat_id: str = Field(
        ...,  # Required field
        description="Unique identifier of the chat",
        min_length=1,
        max_length=128
    )
    
    type: MessageType = Field(
        ...,
        description="Type of WhatsApp message"
    )
    
    direction: MessageDirection = Field(
        ...,
        description="Message flow direction (inbound/outbound)"
    )
    
    content: constr(min_length=1, max_length=4096) = Field(
        ...,
        description="Message content text or template identifier"
    )
    
    media_url: Optional[str] = Field(
        None,
        description="URL for media content (images, documents, etc.)",
        max_length=2048
    )
    
    media_type: Optional[str] = Field(
        None,
        description="MIME type of media content",
        max_length=128
    )
    
    metadata: Optional[Dict] = Field(
        default_factory=dict,
        description="Additional message metadata and tracking information"
    )
    
    is_ai_generated: bool = Field(
        default=False,
        description="Flag indicating if message was generated by AI assistant"
    )
    
    ai_context: Optional[Dict] = Field(
        default_factory=dict,
        description="Context information for AI-generated messages"
    )
    
    referenced_messages: Optional[List[str]] = Field(
        default_factory=list,
        description="List of referenced message IDs in conversation thread"
    )
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "chat_id": "chat_123456",
                "type": "TEXT",
                "direction": "OUTBOUND",
                "content": "Hello! How can I help you today?",
                "is_ai_generated": True,
                "ai_context": {
                    "intent": "greeting",
                    "confidence": 0.95
                }
            }
        }

class MessageUpdate(BaseModel):
    """
    Schema for updating message delivery status and timestamps.
    
    Supports WhatsApp message status tracking and delivery confirmation.
    """
    
    status: Optional[MessageStatus] = Field(
        None,
        description="Updated message delivery status"
    )
    
    delivered_at: Optional[datetime] = Field(
        None,
        description="Timestamp when message was delivered"
    )
    
    read_at: Optional[datetime] = Field(
        None,
        description="Timestamp when message was read"
    )
    
    failed_at: Optional[datetime] = Field(
        None,
        description="Timestamp when message delivery failed"
    )
    
    failure_reason: Optional[str] = Field(
        None,
        description="Reason for message delivery failure",
        max_length=512
    )
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "status": "DELIVERED",
                "delivered_at": "2023-12-20T10:30:00Z"
            }
        }

class MessageResponse(BaseModel):
    """
    Schema for complete message response data including all metadata.
    
    Provides comprehensive message details for API responses.
    """
    
    id: str = Field(
        ...,
        description="Unique message identifier"
    )
    
    chat_id: str = Field(
        ...,
        description="Associated chat identifier"
    )
    
    type: MessageType = Field(
        ...,
        description="Message type"
    )
    
    direction: MessageDirection = Field(
        ...,
        description="Message direction"
    )
    
    status: MessageStatus = Field(
        ...,
        description="Current message status"
    )
    
    content: str = Field(
        ...,
        description="Message content"
    )
    
    media_url: Optional[str] = Field(
        None,
        description="Media content URL"
    )
    
    media_type: Optional[str] = Field(
        None,
        description="Media content type"
    )
    
    metadata: Optional[Dict] = Field(
        default_factory=dict,
        description="Message metadata"
    )
    
    is_ai_generated: bool = Field(
        ...,
        description="AI generation flag"
    )
    
    ai_context: Optional[Dict] = Field(
        default_factory=dict,
        description="AI processing context"
    )
    
    sent_at: datetime = Field(
        ...,
        description="Message sent timestamp"
    )
    
    delivered_at: Optional[datetime] = Field(
        None,
        description="Message delivered timestamp"
    )
    
    read_at: Optional[datetime] = Field(
        None,
        description="Message read timestamp"
    )
    
    failed_at: Optional[datetime] = Field(
        None,
        description="Message failure timestamp"
    )
    
    failure_reason: Optional[str] = Field(
        None,
        description="Failure reason if applicable"
    )
    
    created_at: datetime = Field(
        ...,
        description="Record creation timestamp"
    )
    
    updated_at: datetime = Field(
        ...,
        description="Record last update timestamp"
    )
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "msg_123456",
                "chat_id": "chat_123456",
                "type": "TEXT",
                "direction": "OUTBOUND",
                "status": "DELIVERED",
                "content": "Hello! How can I help you today?",
                "is_ai_generated": True,
                "sent_at": "2023-12-20T10:30:00Z",
                "delivered_at": "2023-12-20T10:30:02Z",
                "created_at": "2023-12-20T10:30:00Z",
                "updated_at": "2023-12-20T10:30:02Z"
            }
        }

class MessageList(BaseModel):
    """
    Schema for paginated message list responses with cursor-based pagination.
    
    Supports efficient message history retrieval with pagination metadata.
    """
    
    items: List[MessageResponse] = Field(
        ...,
        description="List of messages in current page"
    )
    
    total: int = Field(
        ...,
        description="Total number of messages matching query",
        ge=0
    )
    
    next_cursor: Optional[str] = Field(
        None,
        description="Cursor for fetching next page of results"
    )
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "msg_123456",
                        "chat_id": "chat_123456",
                        "type": "TEXT",
                        "direction": "OUTBOUND",
                        "status": "DELIVERED",
                        "content": "Hello! How can I help you today?",
                        "is_ai_generated": True,
                        "sent_at": "2023-12-20T10:30:00Z",
                        "delivered_at": "2023-12-20T10:30:02Z",
                        "created_at": "2023-12-20T10:30:00Z",
                        "updated_at": "2023-12-20T10:30:02Z"
                    }
                ],
                "total": 1,
                "next_cursor": "next_page_token"
            }
        }