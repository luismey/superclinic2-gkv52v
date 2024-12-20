"""
Pydantic schemas for WhatsApp marketing campaigns with enhanced validation and security.
Provides data validation, serialization and security checks for campaign operations.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID

# Third-party imports - pydantic v2.0+
from pydantic import (
    BaseModel,
    Field,
    validator,
    constr,
    conlist,
    HttpUrl
)

# Internal imports
from app.models.campaigns import (
    CAMPAIGN_STATUSES,
    TARGET_TYPES,
    MESSAGE_TEMPLATE_TYPES
)
from app.utils.validators import validate_date_range, validate_url
from app.core.exceptions import ValidationError

class MessageTemplateSchema(BaseModel):
    """Enhanced Pydantic schema for campaign message template validation."""
    
    type: str = Field(
        ...,  # Required field
        description="Message template type",
        examples=["text", "image", "document"]
    )
    
    content: str = Field(
        ...,
        description="Template content with variables",
        min_length=1,
        max_length=4096  # WhatsApp message limit
    )
    
    media_url: Optional[HttpUrl] = Field(
        None,
        description="URL for media attachments (images, documents, etc)"
    )
    
    variables: Dict[str, str] = Field(
        default_factory=dict,
        description="Template variable mappings"
    )
    
    security_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Security context and validation metadata"
    )
    
    @validator("type")
    def validate_template_type(cls, v: str) -> str:
        """Validate template type against allowed types."""
        if v not in MESSAGE_TEMPLATE_TYPES:
            raise ValidationError(
                message=f"Invalid template type: {v}",
                details={"allowed_types": MESSAGE_TEMPLATE_TYPES}
            )
        return v
    
    @validator("content")
    def validate_template_content(cls, v: str, values: Dict[str, Any]) -> str:
        """Validate template content with security checks."""
        # Check for malicious patterns
        security_risks = ["<script", "javascript:", "data:"]
        if any(risk in v.lower() for risk in security_risks):
            raise ValidationError(
                message="Template contains unsafe content",
                details={"security_risk": True}
            )
            
        # Validate template variables
        if "{{" in v:
            variables = [
                var.strip("{}") for var in 
                v.split("{{")[1:]
            ]
            valid_vars = {"name", "phone", "date", "time", "custom"}
            invalid_vars = [var for var in variables if var not in valid_vars]
            if invalid_vars:
                raise ValidationError(
                    message="Invalid template variables",
                    details={"invalid_vars": invalid_vars}
                )
                
        return v
    
    @validator("media_url")
    def validate_media_url(cls, v: Optional[HttpUrl], values: Dict[str, Any]) -> Optional[HttpUrl]:
        """Validate media URL if present."""
        if v is None:
            if values.get("type") in ["image", "document", "audio", "video"]:
                raise ValidationError(
                    message="Media URL required for media templates",
                    details={"template_type": values.get("type")}
                )
            return None
            
        # Validate URL security
        if not validate_url(str(v)):
            raise ValidationError(
                message="Invalid or unsafe media URL",
                details={"url": str(v)}
            )
            
        return v

class CampaignBaseSchema(BaseModel):
    """Enhanced base Pydantic schema for campaign data."""
    
    name: constr(min_length=3, max_length=100) = Field(
        ...,
        description="Campaign name",
        example="December Promotion"
    )
    
    description: Optional[constr(max_length=500)] = Field(
        None,
        description="Campaign description"
    )
    
    user_id: UUID = Field(
        ...,
        description="ID of user creating/owning the campaign"
    )
    
    status: str = Field(
        default="draft",
        description="Campaign status"
    )
    
    target_type: str = Field(
        ...,
        description="Target audience type"
    )
    
    target_audience_ids: conlist(str, min_items=1) = Field(
        ...,
        description="List of target audience member IDs"
    )
    
    message_template: MessageTemplateSchema = Field(
        ...,
        description="Campaign message template"
    )
    
    scheduled_at: Optional[datetime] = Field(
        None,
        description="Scheduled campaign start time"
    )
    
    security_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Security and audit context"
    )
    
    @validator("status")
    def validate_status(cls, v: str) -> str:
        """Validate campaign status."""
        if v not in CAMPAIGN_STATUSES:
            raise ValidationError(
                message=f"Invalid campaign status: {v}",
                details={"allowed_statuses": CAMPAIGN_STATUSES}
            )
        return v
    
    @validator("target_type")
    def validate_target_type(cls, v: str) -> str:
        """Validate target audience type."""
        if v not in TARGET_TYPES:
            raise ValidationError(
                message=f"Invalid target type: {v}",
                details={"allowed_types": TARGET_TYPES}
            )
        return v
    
    @validator("scheduled_at")
    def validate_schedule(cls, v: Optional[datetime]) -> Optional[datetime]:
        """Validate campaign schedule."""
        if v is not None:
            if not validate_date_range(
                start_date=datetime.now().astimezone(),
                end_date=v,
                max_range_days=365
            ):
                raise ValidationError(
                    message="Invalid campaign schedule",
                    details={"max_range_days": 365}
                )
        return v
    
    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        schema_extra = {
            "example": {
                "name": "December Promotion",
                "description": "End of year promotional campaign",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "draft",
                "target_type": "active_patients",
                "target_audience_ids": ["user1", "user2"],
                "message_template": {
                    "type": "text",
                    "content": "Hello {{name}}, check our special offer!",
                    "variables": {"name": "customer_name"}
                },
                "scheduled_at": "2023-12-01T10:00:00Z"
            }
        }

def validate_campaign_status(current_status: str, new_status: str) -> bool:
    """
    Validate campaign status transition with security checks.
    
    Args:
        current_status: Current campaign status
        new_status: New status to transition to
        
    Returns:
        bool: True if status transition is valid
    """
    # Validate status values
    if current_status not in CAMPAIGN_STATUSES or new_status not in CAMPAIGN_STATUSES:
        return False
        
    # Define valid status transitions
    valid_transitions = {
        "draft": ["scheduled", "cancelled"],
        "scheduled": ["active", "cancelled"],
        "active": ["paused", "completed", "failed"],
        "paused": ["active", "cancelled"],
        "completed": [],  # Terminal state
        "cancelled": [],  # Terminal state
        "failed": ["draft"]  # Can retry failed campaigns
    }
    
    return new_status in valid_transitions.get(current_status, [])

# Export schemas and validation functions
__all__ = [
    "MessageTemplateSchema",
    "CampaignBaseSchema",
    "validate_campaign_status"
]