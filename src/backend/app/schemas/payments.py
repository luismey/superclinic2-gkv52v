"""
Payment schemas for Brazilian payment processing with enhanced validation.
Implements secure payment data handling with PCI DSS compliance and
Brazilian-specific payment method support.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, Dict

# Third-party imports - pydantic v2.0.0
from pydantic import BaseModel, Field, field_validator, computed_field

# Internal imports
from ..models.payments import PAYMENT_STATUSES, PAYMENT_METHODS
from ..utils.brazilian import format_currency
from ..utils.validators import validate_document

class PaymentBase(BaseModel):
    """
    Base Pydantic model for payment data validation with enhanced Brazilian payment requirements.
    """
    
    id: UUID = Field(
        description="Unique payment identifier"
    )
    user_id: str = Field(
        min_length=1,
        max_length=128,
        description="ID of the healthcare provider"
    )
    customer_id: str = Field(
        min_length=1,
        max_length=128,
        description="ID of the customer making the payment"
    )
    amount: Decimal = Field(
        gt=Decimal('0'),
        max_digits=10,
        decimal_places=2,
        description="Payment amount in BRL"
    )
    currency: str = Field(
        default="BRL",
        description="Payment currency (BRL only)"
    )
    payment_method: str = Field(
        description="Brazilian payment method (PIX/Credit Card/Boleto)"
    )
    status: str = Field(
        default="PENDING",
        description="Payment status"
    )
    metadata: Dict = Field(
        default_factory=dict,
        description="Additional payment metadata"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Payment creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )

    @field_validator('currency')
    def validate_currency(cls, value: str) -> str:
        """Enhanced validation ensuring only BRL currency is accepted."""
        if value.upper() != "BRL":
            raise ValueError("Only BRL currency is supported")
        return value.upper()

    @field_validator('payment_method')
    def validate_payment_method(cls, value: str) -> str:
        """Enhanced validation for Brazilian payment methods including PIX."""
        value = value.upper()
        if value not in PAYMENT_METHODS:
            raise ValueError(f"Invalid payment method. Must be one of: {', '.join(PAYMENT_METHODS)}")
        return value

    @field_validator('status')
    def validate_status(cls, value: str) -> str:
        """Validates payment status with Brazilian-specific states."""
        value = value.upper()
        if value not in PAYMENT_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(PAYMENT_STATUSES)}")
        return value

    class Config:
        """Pydantic model configuration."""
        str_strip_whitespace = True
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
            UUID: str
        }

class PaymentCreate(BaseModel):
    """
    Schema for creating new payment records with enhanced validation.
    """
    
    customer_id: str = Field(
        min_length=1,
        max_length=128,
        description="Customer ID for payment"
    )
    amount: Decimal = Field(
        gt=Decimal('0'),
        max_digits=10,
        decimal_places=2,
        description="Payment amount in BRL"
    )
    payment_method: str = Field(
        description="Brazilian payment method"
    )
    metadata: Dict = Field(
        default_factory=dict,
        description="Additional payment data"
    )

    @field_validator('amount')
    def validate_amount(cls, value: Decimal) -> Decimal:
        """Enhanced amount validation for Brazilian currency."""
        # Check decimal places
        if value.as_tuple().exponent < -2:
            raise ValueError("Amount cannot have more than 2 decimal places")
        
        # Validate minimum amount
        if value < Decimal('0.01'):
            raise ValueError("Amount must be at least R$ 0,01")
        
        # Validate maximum amount
        if value > Decimal('999999.99'):
            raise ValueError("Amount exceeds maximum allowed value")
            
        return value

    class Config:
        """Pydantic model configuration."""
        str_strip_whitespace = True
        json_encoders = {
            Decimal: str
        }

class PaymentUpdate(BaseModel):
    """
    Schema for updating payment records with enhanced validation.
    """
    
    status: str = Field(
        description="New payment status"
    )
    metadata: Optional[Dict] = Field(
        default=None,
        description="Updated payment metadata"
    )

    class Config:
        """Pydantic model configuration."""
        str_strip_whitespace = True

class PaymentResponse(BaseModel):
    """
    Enhanced schema for payment API responses with Brazilian formatting.
    """
    
    id: UUID = Field(
        description="Payment identifier"
    )
    user_id: str = Field(
        description="Healthcare provider ID"
    )
    customer_id: str = Field(
        description="Customer ID"
    )
    amount_formatted: str = Field(
        description="Formatted amount in BRL"
    )
    payment_method: str = Field(
        description="Payment method used"
    )
    status: str = Field(
        description="Current payment status"
    )
    metadata: Dict = Field(
        description="Payment metadata"
    )
    created_at: datetime = Field(
        description="Creation timestamp"
    )
    updated_at: datetime = Field(
        description="Last update timestamp"
    )

    @computed_field
    def format_amount(payment: 'PaymentBase') -> str:
        """Enhanced Brazilian currency formatting with R$ symbol."""
        return format_currency(payment.amount)

    class Config:
        """Pydantic model configuration."""
        str_strip_whitespace = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: str
        }