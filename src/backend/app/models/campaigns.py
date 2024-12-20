"""
Campaign data model and business logic for WhatsApp marketing campaigns.
Handles campaign creation, management, execution, and performance tracking
with comprehensive validation and security measures.

Version: 1.0.0
"""

# Standard library imports
from dataclasses import dataclass, field
from datetime import datetime
import uuid
from typing import Dict, List, Optional, Any

# Third-party imports
import pytz  # v2023.3
import redis  # v4.5.4

# Internal imports
from app.db.firestore import FirestoreClient
from app.utils.validators import validate_date_range, validate_url
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Initialize logger
logger = get_logger(__name__)

# Constants
CAMPAIGN_STATUSES = [
    'draft', 'scheduled', 'active', 'paused', 
    'completed', 'cancelled', 'failed'
]

TARGET_TYPES = [
    'new_leads', 'active_patients', 'post_treatment', 
    'all', 'custom'
]

MESSAGE_TEMPLATE_TYPES = [
    'text', 'image', 'document', 'audio', 
    'video', 'location', 'contact'
]

COLLECTION_NAME = 'campaigns'
MAX_BATCH_SIZE = 500
CACHE_TTL = 3600  # 1 hour

# Initialize Firestore client
db = FirestoreClient()

@dataclass
class Campaign:
    """Campaign data model with comprehensive validation and tracking."""
    
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = field(default="")
    description: str = field(default="")
    user_id: str = field(default="")
    status: str = field(default="draft")
    target_type: str = field(default="all")
    target_audience_ids: List[str] = field(default_factory=list)
    message_template: Dict[str, Any] = field(default_factory=dict)
    scheduled_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(pytz.UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(pytz.UTC))
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    validation_state: Dict[str, bool] = field(default_factory=dict)
    error_messages: List[str] = field(default_factory=list)

    def __post_init__(self):
        """Initialize campaign with validation and defaults."""
        # Initialize performance metrics
        self.performance_metrics = {
            'sent': 0,
            'delivered': 0,
            'read': 0,
            'responded': 0,
            'failed': 0,
            'conversion_rate': 0.0
        }
        
        # Initialize validation state
        self.validation_state = {
            'name': False,
            'target': False,
            'template': False,
            'schedule': False
        }
        
        # Validate initial data
        self.validate()
        
        # Ensure timezone-aware timestamps
        if self.created_at.tzinfo is None:
            self.created_at = pytz.UTC.localize(self.created_at)
        if self.updated_at.tzinfo is None:
            self.updated_at = pytz.UTC.localize(self.updated_at)

    def validate(self) -> bool:
        """
        Comprehensive campaign data validation.
        
        Returns:
            bool: True if campaign is valid
        """
        self.error_messages.clear()
        
        # Validate required fields
        if not self.name or len(self.name) < 3:
            self.error_messages.append("Campaign name must be at least 3 characters")
            self.validation_state['name'] = False
        else:
            self.validation_state['name'] = True
            
        # Validate status
        if self.status not in CAMPAIGN_STATUSES:
            self.error_messages.append(f"Invalid status: {self.status}")
            
        # Validate target type and audience
        if self.target_type not in TARGET_TYPES:
            self.error_messages.append(f"Invalid target type: {self.target_type}")
            self.validation_state['target'] = False
        elif self.target_type == 'custom' and not self.target_audience_ids:
            self.error_messages.append("Custom target requires audience IDs")
            self.validation_state['target'] = False
        else:
            self.validation_state['target'] = True
            
        # Validate message template
        template_valid, template_errors = validate_message_template(self.message_template)
        if not template_valid:
            self.error_messages.extend(template_errors)
            self.validation_state['template'] = False
        else:
            self.validation_state['template'] = True
            
        # Validate schedule if present
        if self.scheduled_at:
            if not validate_date_range(
                start_date=datetime.now(pytz.UTC),
                end_date=self.scheduled_at,
                max_range_days=365
            ):
                self.error_messages.append("Invalid schedule date")
                self.validation_state['schedule'] = False
            else:
                self.validation_state['schedule'] = True
                
        return len(self.error_messages) == 0

    def save(self) -> 'Campaign':
        """
        Save campaign to database with validation.
        
        Returns:
            Campaign: Updated campaign instance
            
        Raises:
            ValidationError: If campaign validation fails
        """
        if not self.validate():
            raise ValidationError(
                message="Campaign validation failed",
                details={"errors": self.error_messages}
            )
            
        self.updated_at = datetime.now(pytz.UTC)
        
        try:
            campaign_data = {
                'id': self.id,
                'name': self.name,
                'description': self.description,
                'user_id': self.user_id,
                'status': self.status,
                'target_type': self.target_type,
                'target_audience_ids': self.target_audience_ids,
                'message_template': self.message_template,
                'scheduled_at': self.scheduled_at,
                'created_at': self.created_at,
                'updated_at': self.updated_at,
                'performance_metrics': self.performance_metrics
            }
            
            db.create_document(
                collection_name=COLLECTION_NAME,
                document_id=self.id,
                data=campaign_data
            )
            
            logger.info(
                f"Campaign saved successfully: {self.id}",
                extra={"campaign_id": self.id, "user_id": self.user_id}
            )
            
            return self
            
        except Exception as e:
            logger.error(
                f"Error saving campaign: {str(e)}",
                extra={"campaign_id": self.id, "user_id": self.user_id}
            )
            raise

    def update(self, data: Dict[str, Any]) -> 'Campaign':
        """
        Update campaign attributes with validation.
        
        Args:
            data: Dictionary of attributes to update
            
        Returns:
            Campaign: Updated campaign instance
        """
        # Update allowed fields
        allowed_fields = {
            'name', 'description', 'status', 'target_type',
            'target_audience_ids', 'message_template', 'scheduled_at'
        }
        
        for field, value in data.items():
            if field in allowed_fields:
                setattr(self, field, value)
                
        # Validate and save updates
        if not self.validate():
            raise ValidationError(
                message="Campaign update validation failed",
                details={"errors": self.error_messages}
            )
            
        return self.save()

    def delete(self) -> bool:
        """
        Delete campaign if allowed.
        
        Returns:
            bool: True if deleted successfully
        """
        if self.status not in ['draft', 'cancelled', 'completed']:
            raise ValidationError(
                message="Cannot delete active or scheduled campaign",
                details={"status": self.status}
            )
            
        try:
            db.delete_document(
                collection_name=COLLECTION_NAME,
                document_id=self.id
            )
            
            logger.info(
                f"Campaign deleted: {self.id}",
                extra={"campaign_id": self.id, "user_id": self.user_id}
            )
            
            return True
            
        except Exception as e:
            logger.error(
                f"Error deleting campaign: {str(e)}",
                extra={"campaign_id": self.id, "user_id": self.user_id}
            )
            raise

    def update_metrics(self, metrics: Dict[str, Any]) -> bool:
        """
        Update campaign performance metrics.
        
        Args:
            metrics: Dictionary of metrics to update
            
        Returns:
            bool: True if updated successfully
        """
        try:
            # Validate metrics data
            valid_metrics = {
                'sent', 'delivered', 'read', 
                'responded', 'failed', 'conversion_rate'
            }
            
            for key, value in metrics.items():
                if key in valid_metrics:
                    self.performance_metrics[key] = value
                    
            self.updated_at = datetime.now(pytz.UTC)
            
            # Save updated metrics
            db.update_document(
                collection_name=COLLECTION_NAME,
                document_id=self.id,
                data={'performance_metrics': self.performance_metrics}
            )
            
            return True
            
        except Exception as e:
            logger.error(
                f"Error updating metrics: {str(e)}",
                extra={"campaign_id": self.id, "metrics": metrics}
            )
            return False

def get_campaign(campaign_id: str) -> Optional[Campaign]:
    """
    Retrieve campaign by ID.
    
    Args:
        campaign_id: Campaign ID to retrieve
        
    Returns:
        Optional[Campaign]: Campaign instance if found
    """
    try:
        doc = db.get_document(
            collection_name=COLLECTION_NAME,
            document_id=campaign_id
        )
        
        if not doc:
            return None
            
        return Campaign(**doc)
        
    except Exception as e:
        logger.error(
            f"Error retrieving campaign: {str(e)}",
            extra={"campaign_id": campaign_id}
        )
        return None

def list_campaigns(
    user_id: str,
    status: Optional[str] = None,
    target_type: Optional[str] = None,
    page_size: Optional[int] = 50,
    page_token: Optional[str] = None
) -> tuple[List[Campaign], Optional[str]]:
    """
    List campaigns with filters and pagination.
    
    Args:
        user_id: User ID to filter by
        status: Optional status filter
        target_type: Optional target type filter
        page_size: Number of campaigns per page
        page_token: Token for pagination
        
    Returns:
        Tuple of campaign list and next page token
    """
    try:
        # Build query filters
        filters = [('user_id', '==', user_id)]
        if status:
            filters.append(('status', '==', status))
        if target_type:
            filters.append(('target_type', '==', target_type))
            
        # Query with pagination
        docs, next_token = db.query_documents(
            collection_name=COLLECTION_NAME,
            filters=filters,
            order_by=['-created_at'],
            page_size=min(page_size, MAX_BATCH_SIZE),
            page_token=page_token
        )
        
        # Convert to Campaign instances
        campaigns = [Campaign(**doc) for doc in docs]
        
        return campaigns, next_token
        
    except Exception as e:
        logger.error(
            f"Error listing campaigns: {str(e)}",
            extra={"user_id": user_id, "filters": filters}
        )
        return [], None

def validate_message_template(template: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate campaign message template with media checks.
    
    Args:
        template: Message template dictionary
        
    Returns:
        Tuple of validation result and error messages
    """
    errors = []
    
    # Check required fields
    if not template.get('type'):
        errors.append("Template type is required")
        return False, errors
        
    if template['type'] not in MESSAGE_TEMPLATE_TYPES:
        errors.append(f"Invalid template type: {template['type']}")
        return False, errors
        
    # Validate content based on type
    if not template.get('content'):
        errors.append("Template content is required")
        return False, errors
        
    # Validate media URL if present
    if template['type'] in ['image', 'document', 'audio', 'video']:
        media_url = template.get('media_url')
        if not media_url:
            errors.append("Media URL is required for media messages")
            return False, errors
            
        if not validate_url(media_url):
            errors.append("Invalid media URL")
            return False, errors
            
    # Validate template variables
    if '{{' in template['content']:
        variables = [
            var.strip('{}') for var in 
            template['content'].split('{{')[1:]
        ]
        
        valid_vars = {'name', 'phone', 'date', 'time', 'custom'}
        for var in variables:
            if var not in valid_vars:
                errors.append(f"Invalid template variable: {var}")
                
    return len(errors) == 0, errors