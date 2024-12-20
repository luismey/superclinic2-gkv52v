"""
Pydantic schemas for chat data validation and serialization in the Porfin platform.

This module provides comprehensive schema definitions for WhatsApp chat management,
ensuring LGPD compliance and healthcare-specific data protection requirements.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Optional, List, Dict

# Third-party imports - pydantic v2.0.0
from pydantic import BaseModel, Field, constr

# Internal imports
from app.models.chats import ChatStatus
from app.schemas.messages import MessageResponse

class ChatCreate(BaseModel):
    """
    Schema for creating new chats with LGPD compliance and healthcare validation.
    """
    
    provider_id: str = Field(
        ...,
        description="Healthcare provider unique identifier",
        min_length=1,
        max_length=128
    )
    
    customer_phone: constr(
        min_length=10,
        max_length=15,
        regex=r'^\+55\d{10,11}$'
    ) = Field(
        ...,
        description="Customer WhatsApp phone number (Brazilian format)"
    )
    
    customer_name: constr(min_length=1, max_length=100) = Field(
        ...,
        description="Customer full name"
    )
    
    customer_email: Optional[constr(
        max_length=255,
        regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )] = Field(
        None,
        description="Customer email address"
    )
    
    metadata: Optional[Dict] = Field(
        default_factory=dict,
        description="Additional chat metadata"
    )
    
    ai_enabled: bool = Field(
        default=True,
        description="Enable AI virtual assistant for chat"
    )
    
    healthcare_context: Optional[Dict] = Field(
        default_factory=dict,
        description="Healthcare-specific context and requirements"
    )
    
    consent_data: Optional[Dict] = Field(
        default_factory=lambda: {
            "lgpd_consent": False,
            "consent_timestamp": None,
            "data_usage_accepted": False,
            "marketing_consent": False
        },
        description="LGPD consent tracking data"
    )
    
    security_metadata: Optional[Dict] = Field(
        default_factory=lambda: {
            "data_classification": "PHI",
            "encryption_required": True,
            "retention_period_days": 365
        },
        description="Security and compliance metadata"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "provider_id": "provider_123",
                "customer_phone": "+5511999999999",
                "customer_name": "Maria Silva",
                "customer_email": "maria.silva@email.com",
                "ai_enabled": True,
                "healthcare_context": {
                    "specialty": "dental",
                    "appointment_type": "initial_consultation"
                }
            }
        }

class ChatUpdate(BaseModel):
    """
    Schema for updating chat properties with enhanced security and LGPD compliance.
    """
    
    customer_name: Optional[constr(max_length=100)] = None
    
    customer_email: Optional[constr(
        max_length=255,
        regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )] = None
    
    status: Optional[ChatStatus] = Field(
        None,
        description="Chat status (active/archived/blocked)"
    )
    
    ai_enabled: Optional[bool] = Field(
        None,
        description="Toggle AI virtual assistant"
    )
    
    metadata: Optional[Dict] = Field(
        None,
        description="Additional chat metadata"
    )
    
    healthcare_context: Optional[Dict] = Field(
        None,
        description="Healthcare-specific context updates"
    )
    
    consent_data: Optional[Dict] = Field(
        None,
        description="LGPD consent updates"
    )
    
    security_metadata: Optional[Dict] = Field(
        None,
        description="Security configuration updates"
    )
    
    audit_data: Optional[Dict] = Field(
        None,
        description="Audit trail updates"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "customer_name": "Maria Silva Santos",
                "status": "ARCHIVED",
                "ai_enabled": False
            }
        }

class ChatResponse(BaseModel):
    """
    Schema for chat response data with comprehensive LGPD compliance and healthcare context.
    """
    
    id: str = Field(..., description="Chat unique identifier")
    provider_id: str = Field(..., description="Healthcare provider ID")
    customer_phone: str = Field(..., description="Customer phone number")
    customer_name: str = Field(..., description="Customer name")
    customer_email: Optional[str] = Field(None, description="Customer email")
    status: ChatStatus = Field(..., description="Current chat status")
    ai_enabled: bool = Field(..., description="AI assistant status")
    metadata: Optional[Dict] = Field(default_factory=dict)
    
    last_message: Optional[MessageResponse] = Field(
        None,
        description="Most recent message in chat"
    )
    
    message_count: int = Field(
        default=0,
        description="Total number of messages",
        ge=0
    )
    
    last_message_at: datetime = Field(
        ...,
        description="Last message timestamp"
    )
    
    created_at: datetime = Field(
        ...,
        description="Chat creation timestamp"
    )
    
    updated_at: datetime = Field(
        ...,
        description="Last update timestamp"
    )
    
    healthcare_context: Optional[Dict] = Field(
        default_factory=dict,
        description="Healthcare-specific data"
    )
    
    consent_data: Optional[Dict] = Field(
        default_factory=dict,
        description="LGPD consent information"
    )
    
    security_metadata: Optional[Dict] = Field(
        default_factory=dict,
        description="Security configuration"
    )
    
    audit_trail: Optional[Dict] = Field(
        default_factory=dict,
        description="Audit history"
    )
    
    data_retention: Optional[Dict] = Field(
        default_factory=lambda: {
            "retention_period_days": 365,
            "deletion_date": None,
            "legal_hold": False
        },
        description="Data retention policy"
    )
    
    access_control: Optional[Dict] = Field(
        default_factory=lambda: {
            "restricted": False,
            "authorized_roles": ["admin", "manager", "secretary"],
            "access_log": []
        },
        description="Access control configuration"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "chat_123",
                "provider_id": "provider_123",
                "customer_phone": "+5511999999999",
                "customer_name": "Maria Silva",
                "status": "ACTIVE",
                "ai_enabled": True,
                "message_count": 10,
                "last_message_at": "2023-12-20T10:30:00Z",
                "created_at": "2023-12-20T10:00:00Z",
                "updated_at": "2023-12-20T10:30:00Z"
            }
        }

class ChatList(BaseModel):
    """
    Schema for paginated chat list responses with enhanced filtering and sorting.
    """
    
    items: List[ChatResponse] = Field(
        ...,
        description="List of chats in current page"
    )
    
    total: int = Field(
        ...,
        description="Total number of chats matching query",
        ge=0
    )
    
    next_cursor: Optional[str] = Field(
        None,
        description="Cursor for next page of results"
    )
    
    filters_applied: Optional[Dict] = Field(
        default_factory=dict,
        description="Active filters in current query"
    )
    
    sort_criteria: Optional[Dict] = Field(
        default_factory=dict,
        description="Applied sorting criteria"
    )
    
    access_metadata: Optional[Dict] = Field(
        default_factory=lambda: {
            "requester_role": None,
            "access_timestamp": datetime.utcnow().isoformat(),
            "filtered_fields": []
        },
        description="Access control metadata"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "chat_123",
                        "provider_id": "provider_123",
                        "customer_name": "Maria Silva",
                        "status": "ACTIVE",
                        "message_count": 10
                    }
                ],
                "total": 1,
                "next_cursor": "next_page_token"
            }
        }