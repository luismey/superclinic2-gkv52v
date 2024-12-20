"""
Analytics schema module for Porfin platform.
Provides high-performance data validation and serialization for analytics data
with comprehensive validation rules and performance optimizations.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Dict, List, Optional, Union, Any
from enum import Enum

# Third-party imports - pydantic v2.0.0
from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator
)

# Internal imports
from app.utils.validators import validate_date_range
from app.utils.formatters import format_percentage

# Constants for analytics validation
METRIC_TYPES = [
    'conversion',
    'response_time',
    'message_volume',
    'ai_usage',
    'error_rate',
    'latency'
]

CONVERSION_TYPES = [
    'lead',
    'appointment',
    'payment',
    'follow_up',
    'referral'
]

MESSAGE_TYPES = [
    'text',
    'media',
    'template',
    'quick_reply',
    'location',
    'contact'
]

MAX_BATCH_SIZE = 1000
MAX_DATE_RANGE_DAYS = 365

class MetricType(str, Enum):
    """Enumeration of valid metric types for type safety."""
    CONVERSION = 'conversion'
    RESPONSE_TIME = 'response_time'
    MESSAGE_VOLUME = 'message_volume'
    AI_USAGE = 'ai_usage'
    ERROR_RATE = 'error_rate'
    LATENCY = 'latency'

class ConversionType(str, Enum):
    """Enumeration of valid conversion types."""
    LEAD = 'lead'
    APPOINTMENT = 'appointment'
    PAYMENT = 'payment'
    FOLLOW_UP = 'follow_up'
    REFERRAL = 'referral'

class MessageType(str, Enum):
    """Enumeration of valid message types."""
    TEXT = 'text'
    MEDIA = 'media'
    TEMPLATE = 'template'
    QUICK_REPLY = 'quick_reply'
    LOCATION = 'location'
    CONTACT = 'contact'

class BaseAnalyticsSchema(BaseModel):
    """
    Base schema for analytics data with enhanced validation and performance optimizations.
    """
    model_config = ConfigDict(
        frozen=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "user_id": "usr_123",
                "timestamp": "2023-12-01T10:00:00Z",
                "metric_type": "conversion",
                "value": 1.0,
                "metadata": {"source": "whatsapp"},
                "environment": "production"
            }
        }
    )

    user_id: str = Field(..., min_length=3, max_length=50)
    timestamp: datetime = Field(..., description="UTC timestamp of the event")
    metric_type: MetricType = Field(..., description="Type of metric being tracked")
    value: float = Field(..., ge=0, description="Metric value")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    environment: str = Field(
        default="production",
        pattern="^(production|staging|development)$"
    )
    tags: Dict[str, str] = Field(default_factory=dict)

    @field_validator('timestamp')
    def validate_timestamp(cls, v: datetime) -> datetime:
        """Validate timestamp is not in future and has timezone info."""
        if v.tzinfo is None:
            raise ValueError("Timestamp must be timezone-aware")
        if v > datetime.now(v.tzinfo):
            raise ValueError("Timestamp cannot be in the future")
        return v

    @model_validator(mode='after')
    def validate_metadata(self) -> 'BaseAnalyticsSchema':
        """Validate metadata structure and content."""
        if len(self.metadata) > 50:  # Limit metadata size
            raise ValueError("Metadata exceeds maximum allowed fields")
        return self

class ConversionSchema(BaseAnalyticsSchema):
    """
    Enhanced schema for conversion tracking with detailed analytics.
    """
    model_config = ConfigDict(
        frozen=True,
        json_schema_extra={
            "example": {
                "user_id": "usr_123",
                "timestamp": "2023-12-01T10:00:00Z",
                "metric_type": "conversion",
                "conversion_type": "lead",
                "value": 1.0,
                "conversion_value": 500.0,
                "lead_id": "lead_123",
                "touchpoints": ["whatsapp", "website"],
                "metadata": {"source": "campaign_123"}
            }
        }
    )

    conversion_type: ConversionType = Field(..., description="Type of conversion")
    conversion_value: float = Field(
        default=0.0,
        ge=0,
        description="Monetary value of conversion"
    )
    lead_id: str = Field(..., min_length=3, max_length=50)
    touchpoints: List[str] = Field(
        default_factory=list,
        max_items=20,
        description="Customer interaction points"
    )
    attribution_data: Dict[str, float] = Field(
        default_factory=dict,
        description="Attribution weights for touchpoints"
    )
    roi_impact: Optional[float] = Field(
        default=None,
        description="Calculated ROI impact"
    )

    @field_validator('touchpoints')
    def validate_touchpoints(cls, v: List[str]) -> List[str]:
        """Validate touchpoint data."""
        if not v:
            raise ValueError("At least one touchpoint required")
        if len(set(v)) != len(v):
            raise ValueError("Duplicate touchpoints not allowed")
        return v

    @model_validator(mode='after')
    def validate_attribution(self) -> 'ConversionSchema':
        """Validate attribution data consistency."""
        if self.attribution_data:
            total_weight = sum(self.attribution_data.values())
            if not 0.99 <= total_weight <= 1.01:  # Allow small floating point variance
                raise ValueError("Attribution weights must sum to 1.0")
        return self

    def calculate_roi(self, cost: float) -> float:
        """
        Calculate ROI for the conversion with confidence scoring.
        
        Args:
            cost: Cost associated with conversion
            
        Returns:
            Calculated ROI value
        """
        if cost <= 0:
            raise ValueError("Cost must be positive")
            
        roi = ((self.conversion_value - cost) / cost) * 100
        return float(format_percentage(roi, decimal_places=2).rstrip('%'))

class MessageAnalyticsSchema(BaseAnalyticsSchema):
    """
    Schema for message-related analytics with performance metrics.
    """
    message_type: MessageType = Field(..., description="Type of message")
    response_time: Optional[float] = Field(
        default=None,
        ge=0,
        description="Response time in seconds"
    )
    ai_processed: bool = Field(
        default=False,
        description="Whether message was processed by AI"
    )
    performance_metrics: Dict[str, float] = Field(
        default_factory=dict,
        description="Message processing performance metrics"
    )

    @field_validator('response_time')
    def validate_response_time(cls, v: Optional[float]) -> Optional[float]:
        """Validate response time is within acceptable range."""
        if v is not None and v > 300:  # 5 minutes max
            raise ValueError("Response time exceeds maximum threshold")
        return v

class BatchAnalyticsOperation:
    """
    Utility class for efficient batch processing of analytics data.
    """
    @staticmethod
    def validate_batch(items: List[Dict[str, Any]]) -> tuple[List[Any], List[Dict[str, Any]]]:
        """
        Validate a batch of analytics items efficiently.
        
        Args:
            items: List of analytics items to validate
            
        Returns:
            Tuple of valid items and validation errors
        """
        if len(items) > MAX_BATCH_SIZE:
            raise ValueError(f"Batch size exceeds maximum of {MAX_BATCH_SIZE}")
            
        valid_items = []
        errors = []
        
        for item in items:
            try:
                if item.get('metric_type') == 'conversion':
                    validated = ConversionSchema(**item)
                else:
                    validated = BaseAnalyticsSchema(**item)
                valid_items.append(validated)
            except Exception as e:
                errors.append({
                    'item': item,
                    'error': str(e)
                })
                
        return valid_items, errors

# Export schemas and utilities
__all__ = [
    'BaseAnalyticsSchema',
    'ConversionSchema',
    'MessageAnalyticsSchema',
    'BatchAnalyticsOperation',
    'MetricType',
    'ConversionType',
    'MessageType',
    'METRIC_TYPES',
    'CONVERSION_TYPES',
    'MESSAGE_TYPES'
]