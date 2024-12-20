"""
Pydantic schemas for AI virtual assistant data validation and serialization.

This module provides comprehensive schema definitions for validating and serializing
AI virtual assistant data with enhanced healthcare compliance and performance optimizations.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Dict, List, Optional, Any

# Third-party imports - version specified as per IE2
from pydantic import BaseModel, Field, validator, constr  # pydantic v2.0.0

# Internal imports
from app.models.assistants import ASSISTANT_TYPES

# Constants for validation
MAX_NAME_LENGTH = 100
MIN_TEMPERATURE = 0.0
MAX_TEMPERATURE = 1.0
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 2048
MIN_MAX_TOKENS = 100
MAX_MAX_TOKENS = 4096

class KnowledgeBaseSchema(BaseModel):
    """Enhanced schema for assistant knowledge base configuration with healthcare compliance."""
    
    source_type: constr(strip_whitespace=True) = Field(
        ...,
        description="Type of knowledge base source (e.g., 'documents', 'api')"
    )
    document_urls: List[str] = Field(
        default_factory=list,
        description="List of document URLs in the knowledge base"
    )
    embedding_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Configuration for embedding generation"
    )
    last_updated: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of last knowledge base update"
    )
    compliance_metadata: Dict[str, str] = Field(
        default_factory=dict,
        description="LGPD compliance metadata for healthcare data"
    )

    @validator('source_type')
    def validate_source_type(cls, value: str) -> str:
        """Validate knowledge base source type with healthcare compliance."""
        valid_types = {'documents', 'api', 'structured_data'}
        if value not in valid_types:
            raise ValueError(f"Invalid source type. Must be one of: {valid_types}")
        return value

    @validator('document_urls')
    def validate_document_urls(cls, urls: List[str]) -> List[str]:
        """Validate document URLs for security and compliance."""
        for url in urls:
            if not url.startswith('https://'):
                raise ValueError("All document URLs must use HTTPS")
        return urls

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        validate_assignment = True

class AssistantBaseSchema(BaseModel):
    """Enhanced base schema with healthcare-specific fields."""
    
    name: constr(min_length=1, max_length=MAX_NAME_LENGTH) = Field(
        ...,
        description="Assistant name"
    )
    assistant_type: str = Field(
        ...,
        description="Type of assistant (e.g., 'sales', 'support')"
    )
    user_id: str = Field(
        ...,
        description="ID of the healthcare professional owning the assistant"
    )
    model_version: str = Field(
        default="gpt-4",
        description="OpenAI model version"
    )
    temperature: float = Field(
        default=DEFAULT_TEMPERATURE,
        ge=MIN_TEMPERATURE,
        le=MAX_TEMPERATURE,
        description="Model temperature for response generation"
    )
    max_tokens: int = Field(
        default=DEFAULT_MAX_TOKENS,
        ge=MIN_MAX_TOKENS,
        le=MAX_MAX_TOKENS,
        description="Maximum tokens for model responses"
    )
    knowledge_base: Optional[KnowledgeBaseSchema] = Field(
        default=None,
        description="Assistant's knowledge base configuration"
    )
    behavior_settings: Dict[str, Any] = Field(
        default_factory=dict,
        description="Custom behavior configuration"
    )
    security_metadata: Dict[str, str] = Field(
        default_factory=dict,
        description="Security and compliance metadata"
    )

    @validator('assistant_type')
    def validate_assistant_type(cls, value: str) -> str:
        """Validate assistant type for healthcare context."""
        if value not in ASSISTANT_TYPES:
            raise ValueError(f"Invalid assistant type. Must be one of: {ASSISTANT_TYPES}")
        return value

    @validator('behavior_settings')
    def validate_behavior_settings(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        """Validate behavior settings for healthcare compliance."""
        required_settings = {'language_style', 'privacy_level', 'medical_terminology'}
        missing = required_settings - set(value.keys())
        if missing:
            raise ValueError(f"Missing required behavior settings: {missing}")
        return value

    class Config:
        """Pydantic model configuration."""
        validate_assignment = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class AssistantCreateSchema(BaseModel):
    """Schema for creating a new assistant with enhanced validation."""
    
    name: constr(min_length=1, max_length=MAX_NAME_LENGTH)
    assistant_type: str
    user_id: str
    model_version: Optional[str] = "gpt-4"
    temperature: Optional[float] = DEFAULT_TEMPERATURE
    max_tokens: Optional[int] = DEFAULT_MAX_TOKENS
    knowledge_base: Optional[KnowledgeBaseSchema] = None
    behavior_settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    security_metadata: Optional[Dict[str, str]] = Field(default_factory=dict)

    @validator('security_metadata')
    def validate_security_metadata(cls, value: Dict[str, str]) -> Dict[str, str]:
        """Validate security metadata for LGPD compliance."""
        required_fields = {'data_classification', 'retention_policy', 'access_level'}
        missing = required_fields - set(value.keys())
        if missing:
            raise ValueError(f"Missing required security metadata: {missing}")
        return value

class AssistantUpdateSchema(BaseModel):
    """Schema for updating an existing assistant with compliance checks."""
    
    name: Optional[constr(min_length=1, max_length=MAX_NAME_LENGTH)] = None
    assistant_type: Optional[str] = None
    model_version: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    knowledge_base: Optional[KnowledgeBaseSchema] = None
    behavior_settings: Optional[Dict[str, Any]] = None
    security_metadata: Optional[Dict[str, str]] = None

    @validator('temperature')
    def validate_temperature(cls, value: Optional[float]) -> Optional[float]:
        """Validate temperature range if provided."""
        if value is not None and not MIN_TEMPERATURE <= value <= MAX_TEMPERATURE:
            raise ValueError(
                f"Temperature must be between {MIN_TEMPERATURE} and {MAX_TEMPERATURE}"
            )
        return value

class AssistantResponseSchema(BaseModel):
    """Enhanced schema for assistant response data with performance metrics."""
    
    id: str = Field(..., description="Unique assistant identifier")
    name: str
    assistant_type: str
    user_id: str
    model_version: str
    temperature: float
    max_tokens: int
    knowledge_base: KnowledgeBaseSchema
    behavior_settings: Dict[str, Any]
    security_metadata: Dict[str, str]
    created_at: datetime
    updated_at: datetime
    performance_metrics: Dict[str, float] = Field(
        default_factory=lambda: {
            "average_response_time": 0.0,
            "success_rate": 100.0,
            "cache_hit_rate": 0.0
        }
    )

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        validate_assignment = True
        orm_mode = True

# Export schemas
__all__ = [
    "KnowledgeBaseSchema",
    "AssistantBaseSchema",
    "AssistantCreateSchema",
    "AssistantUpdateSchema",
    "AssistantResponseSchema"
]