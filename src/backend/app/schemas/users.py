"""
Pydantic schemas for user data validation and serialization.
Implements LGPD-compliant user data models with enhanced security features
for the Brazilian healthcare context.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Dict, Optional, Any

# Third-party imports
from pydantic import BaseModel, Field, EmailStr, model_validator, field_validator  # pydantic v2.0.0
import pytz  # pytz v2023.3

# Internal imports
from app.models.users import USER_ROLES, HEALTHCARE_ROLES
from app.utils.validators import (
    validate_email,
    validate_password,
    validate_professional_id
)

# Constants
PASSWORD_MIN_LENGTH = 12
BRAZIL_TIMEZONE = "America/Sao_Paulo"
MAX_FAILED_ATTEMPTS = 5

class UserBase(BaseModel):
    """Base Pydantic model for LGPD-compliant user data validation."""
    
    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["medico@clinica.com.br"]
    )
    full_name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="User's full name",
        examples=["Dr. João Silva"]
    )
    role: str = Field(
        default="secretary",
        description="User's role in the system"
    )
    is_active: bool = Field(
        default=True,
        description="Whether the user account is active"
    )
    lgpd_consent: bool = Field(
        default=False,
        description="LGPD data processing consent status"
    )
    professional_id: Optional[str] = Field(
        None,
        description="Healthcare professional registration number (CRM/CRO)",
        examples=["CRM/SP 123456"]
    )
    phone: Optional[str] = Field(
        None,
        description="User's phone number",
        examples=["+55 11 98765-4321"]
    )
    permissions: Dict[str, Any] = Field(
        default_factory=dict,
        description="User's granular permissions"
    )
    consent_date: datetime = Field(
        default_factory=lambda: datetime.now(pytz.timezone(BRAZIL_TIMEZONE)),
        description="Timestamp of LGPD consent"
    )

    @field_validator('email')
    def validate_email_format(cls, value: str) -> str:
        """Validates email format with Brazilian healthcare domain rules."""
        if not validate_email(value):
            raise ValueError("Invalid email format or domain")
        return value.lower()

    @field_validator('role')
    def validate_role_permissions(cls, value: str, values: Dict[str, Any]) -> str:
        """Validates user role and sets appropriate permissions."""
        if value not in USER_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(USER_ROLES)}")

        # Validate professional ID for healthcare roles
        if value in HEALTHCARE_ROLES and not values.get('professional_id'):
            raise ValueError("Professional ID required for healthcare roles")

        # Set default permissions based on role
        values['permissions'] = {
            'admin': {'can_manage_users': True, 'can_configure_ai': True},
            'manager': {'can_manage_campaigns': True, 'can_view_analytics': True},
            'secretary': {'can_manage_appointments': True, 'can_chat': True}
        }.get(value, {})

        return value

class UserCreate(UserBase):
    """Schema for user creation with enhanced security validation."""
    
    password: str = Field(
        ...,
        min_length=PASSWORD_MIN_LENGTH,
        description="User's password (must meet security requirements)"
    )
    lgpd_consent: bool = Field(
        ...,
        description="Explicit LGPD consent required for account creation"
    )
    professional_id: Optional[str] = None

    @field_validator('password')
    def validate_password_strength(cls, value: str) -> str:
        """Validates password strength and security requirements."""
        is_valid, error_message = validate_password(value)
        if not is_valid:
            raise ValueError(error_message or "Invalid password")
        return value

    @model_validator(mode='before')
    def validate_lgpd_requirements(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validates LGPD compliance requirements."""
        if not values.get('lgpd_consent'):
            raise ValueError("LGPD consent is required for account creation")
        
        values['consent_date'] = datetime.now(pytz.timezone(BRAZIL_TIMEZONE))
        return values

class UserUpdate(BaseModel):
    """Schema for user updates with audit trail."""
    
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    professional_id: Optional[str] = None
    phone: Optional[str] = None
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(pytz.timezone(BRAZIL_TIMEZONE))
    )

    @model_validator(mode='before')
    def validate_update_data(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validates update data and maintains audit trail."""
        if not any(values.values()):
            raise ValueError("At least one field must be provided for update")

        # Track field changes for audit
        values['audit_trail'] = {
            'timestamp': datetime.now(pytz.timezone(BRAZIL_TIMEZONE)),
            'updated_fields': [k for k, v in values.items() if v is not None],
            'previous_values': {}  # To be filled by service layer
        }

        return values

class UserInDB(UserBase):
    """Enhanced database schema with security features."""
    
    id: str = Field(..., description="User's unique identifier")
    created_at: datetime
    updated_at: datetime
    hashed_password: str
    failed_login_attempts: int = Field(default=0)
    last_login: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None
    audit_trail: Dict[str, Any] = Field(default_factory=dict)
    security_log: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        """Pydantic model configuration."""
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }