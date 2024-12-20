"""
FastAPI router endpoints for WhatsApp marketing campaign management.
Implements secure campaign creation, management, and execution with LGPD compliance.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import List, Optional

# Third-party imports - v0.100+
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import SecurityScopes
from pydantic import BaseModel, Field, validator

# Internal imports
from app.models.campaigns import Campaign
from app.core.security import verify_token
from app.core.logging import get_logger
from app.core.exceptions import ValidationError, AuthorizationError
from app.utils.validators import validate_url, validate_date_range

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/campaigns",
    tags=["campaigns"]
)

# Initialize logger
logger = get_logger(__name__)

# Schema definitions
class CampaignTargetSchema(BaseModel):
    """Target audience configuration schema with LGPD compliance."""
    target_type: str = Field(
        ...,
        description="Target audience type",
        example="new_leads"
    )
    target_audience_ids: Optional[List[str]] = Field(
        default=[],
        description="List of target audience IDs for custom targeting"
    )

    @validator("target_type")
    def validate_target_type(cls, v):
        valid_types = ["new_leads", "active_patients", "post_treatment", "all", "custom"]
        if v not in valid_types:
            raise ValueError(f"Invalid target type. Must be one of: {', '.join(valid_types)}")
        return v

class CampaignTemplateSchema(BaseModel):
    """Message template schema with content validation."""
    type: str = Field(
        ...,
        description="Template message type",
        example="text"
    )
    content: str = Field(
        ...,
        description="Template content with variables",
        max_length=2000
    )
    media_url: Optional[str] = Field(
        None,
        description="URL for media attachments"
    )

    @validator("type")
    def validate_type(cls, v):
        valid_types = ["text", "image", "document", "audio", "video", "location", "contact"]
        if v not in valid_types:
            raise ValueError(f"Invalid template type. Must be one of: {', '.join(valid_types)}")
        return v

    @validator("media_url")
    def validate_media_url(cls, v, values):
        if v and values.get("type") in ["image", "document", "audio", "video"]:
            if not validate_url(v):
                raise ValueError("Invalid media URL")
        return v

class CampaignCreateSchema(BaseModel):
    """Campaign creation schema with comprehensive validation."""
    name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Campaign name"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Campaign description"
    )
    target: CampaignTargetSchema
    message_template: CampaignTemplateSchema
    scheduled_at: Optional[datetime] = Field(
        None,
        description="Scheduled execution time"
    )

    @validator("scheduled_at")
    def validate_schedule(cls, v):
        if v and not validate_date_range(
            start_date=datetime.now(),
            end_date=v,
            max_range_days=365
        ):
            raise ValueError("Invalid schedule date")
        return v

class CampaignResponseSchema(BaseModel):
    """Campaign response schema with security headers."""
    id: str
    name: str
    status: str
    target_type: str
    created_at: datetime
    updated_at: datetime
    performance_metrics: dict = Field(default_factory=dict)

async def get_current_user(
    security_scopes: SecurityScopes,
    token: str = Depends(verify_token)
) -> dict:
    """Validate user authentication and authorization."""
    required_scopes = security_scopes.scopes
    if not token:
        raise AuthenticationError("Not authenticated")

    # Verify required scopes
    user_scopes = token.get("scopes", [])
    for scope in required_scopes:
        if scope not in user_scopes:
            raise AuthorizationError(
                message="Insufficient permissions",
                details={"required_scopes": required_scopes}
            )
    return token

@router.post(
    "/",
    response_model=CampaignResponseSchema,
    status_code=status.HTTP_201_CREATED,
    response_description="Campaign created successfully"
)
async def create_campaign(
    campaign_data: CampaignCreateSchema,
    current_user: dict = Security(
        get_current_user,
        scopes=["campaigns:write"]
    )
) -> CampaignResponseSchema:
    """
    Create a new WhatsApp marketing campaign with security validation.

    Args:
        campaign_data: Campaign configuration data
        current_user: Authenticated user with required permissions

    Returns:
        Created campaign details

    Raises:
        ValidationError: If campaign data is invalid
        AuthorizationError: If user lacks required permissions
    """
    try:
        # Create campaign instance
        campaign = Campaign(
            name=campaign_data.name,
            description=campaign_data.description,
            user_id=current_user["sub"],
            target_type=campaign_data.target.target_type,
            target_audience_ids=campaign_data.target.target_audience_ids,
            message_template=campaign_data.message_template.dict(),
            scheduled_at=campaign_data.scheduled_at
        )

        # Validate and save campaign
        saved_campaign = campaign.save()

        logger.info(
            "Campaign created successfully",
            extra={
                "user_id": current_user["sub"],
                "campaign_id": saved_campaign.id,
                "target_type": saved_campaign.target_type
            }
        )

        return CampaignResponseSchema(
            id=saved_campaign.id,
            name=saved_campaign.name,
            status=saved_campaign.status,
            target_type=saved_campaign.target_type,
            created_at=saved_campaign.created_at,
            updated_at=saved_campaign.updated_at,
            performance_metrics=saved_campaign.performance_metrics
        )

    except ValidationError as e:
        logger.warning(
            "Campaign validation failed",
            extra={
                "user_id": current_user["sub"],
                "errors": e.details
            }
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

    except Exception as e:
        logger.error(
            "Error creating campaign",
            extra={
                "user_id": current_user["sub"],
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get(
    "/{campaign_id}",
    response_model=CampaignResponseSchema,
    response_description="Campaign details retrieved successfully"
)
async def get_campaign(
    campaign_id: str,
    current_user: dict = Security(
        get_current_user,
        scopes=["campaigns:read"]
    )
) -> CampaignResponseSchema:
    """
    Retrieve campaign details with security validation.

    Args:
        campaign_id: Campaign identifier
        current_user: Authenticated user with required permissions

    Returns:
        Campaign details if found and authorized

    Raises:
        HTTPException: If campaign not found or access denied
    """
    try:
        campaign = Campaign.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found"
            )

        # Verify ownership
        if campaign.user_id != current_user["sub"]:
            raise AuthorizationError(
                message="Access denied",
                details={"campaign_id": campaign_id}
            )

        return CampaignResponseSchema(
            id=campaign.id,
            name=campaign.name,
            status=campaign.status,
            target_type=campaign.target_type,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
            performance_metrics=campaign.performance_metrics
        )

    except AuthorizationError as e:
        logger.warning(
            "Unauthorized campaign access attempt",
            extra={
                "user_id": current_user["sub"],
                "campaign_id": campaign_id
            }
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )

    except Exception as e:
        logger.error(
            "Error retrieving campaign",
            extra={
                "user_id": current_user["sub"],
                "campaign_id": campaign_id,
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

# Export router
__all__ = ["router"]