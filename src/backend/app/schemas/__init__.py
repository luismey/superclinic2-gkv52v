"""
Central initialization module for Pydantic schemas in the Porfin platform.

This module provides a unified export point for all data validation schemas with
enhanced security features, LGPD compliance, and high-performance validation for
healthcare data processing.

Version: 1.0.0
"""

# Internal imports - version specified as per IE2
from app.schemas.analytics import (  # v1.0.0
    ConversionSchema,
    MessageMetricsSchema,
    PerformanceMetricsSchema,
    InsightSchema
)
from app.schemas.appointments import (  # v1.0.0
    AppointmentBase,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse
)
from app.schemas.assistants import (  # v1.0.0
    KnowledgeBaseConfigSchema,
    AssistantCreateSchema,
    AssistantUpdateSchema,
    AssistantResponseSchema
)

# Package metadata
__version__ = "1.0.0"
__author__ = "Porfin Development Team"

# Export all schemas with validation functions
__all__ = [
    # Analytics schemas
    "ConversionSchema",
    "MessageMetricsSchema",
    "PerformanceMetricsSchema",
    "InsightSchema",
    
    # Appointment schemas
    "AppointmentBase",
    "AppointmentCreate",
    "AppointmentUpdate",
    "AppointmentResponse",
    
    # Assistant schemas
    "KnowledgeBaseConfigSchema",
    "AssistantCreateSchema",
    "AssistantUpdateSchema",
    "AssistantResponseSchema",
    
    # Package metadata
    "__version__",
    "__author__"
]

# Schema validation functions
def validate_conversion_type(conversion_type: str) -> bool:
    """
    Validate conversion type against allowed values.
    
    Args:
        conversion_type: Type of conversion to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return ConversionSchema.validate_conversion_type(conversion_type)

def validate_message_type(message_type: str) -> bool:
    """
    Validate message type for metrics tracking.
    
    Args:
        message_type: Type of message to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return MessageMetricsSchema.validate_message_type(message_type)

def validate_metric_type(metric_type: str) -> bool:
    """
    Validate performance metric type.
    
    Args:
        metric_type: Type of metric to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return PerformanceMetricsSchema.validate_metric_type(metric_type)

def validate_insight_type(insight_type: str) -> bool:
    """
    Validate business insight type with security context.
    
    Args:
        insight_type: Type of insight to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return InsightSchema.validate_insight_type(insight_type)

def validate_time_slot(start_time: str, end_time: str) -> bool:
    """
    Validate appointment time slot with business rules.
    
    Args:
        start_time: Appointment start time
        end_time: Appointment end time
        
    Returns:
        bool: True if valid, False otherwise
    """
    return AppointmentBase.validate_time_slot(start_time, end_time)

def validate_urls(urls: list) -> bool:
    """
    Validate knowledge base URLs with security checks.
    
    Args:
        urls: List of URLs to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return KnowledgeBaseConfigSchema.validate_urls(urls)

def validate_assistant_type(assistant_type: str) -> bool:
    """
    Validate AI assistant type with healthcare context.
    
    Args:
        assistant_type: Type of assistant to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return AssistantCreateSchema.validate_assistant_type(assistant_type)

def validate_temperature(temperature: float) -> bool:
    """
    Validate AI model temperature parameter.
    
    Args:
        temperature: Temperature value to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return AssistantUpdateSchema.validate_temperature(temperature)