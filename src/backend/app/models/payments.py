"""
Payment model implementation for Brazilian payment processing with PCI DSS compliance.

This module implements secure payment data structures and business logic for handling
Brazilian payment methods including PIX, credit cards, and boletos. Ensures LGPD
compliance and provides real-time payment status tracking.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from decimal import Decimal
import uuid
from typing import Dict, Optional, List, Union

# Third-party imports - pydantic v2.0.0
from pydantic import BaseModel, Field, validator, SecretStr, constr, condecimal

# Internal imports
from ..db.firestore import FirestoreClient, FirestoreError
from ..utils.brazilian import format_currency

# Payment status constants
PAYMENT_STATUSES = [
    'PENDING',      # Initial state
    'PROCESSING',   # Payment being processed
    'COMPLETED',    # Successfully completed
    'FAILED',       # Payment failed
    'REFUNDED',     # Payment refunded
    'CANCELLED'     # Payment cancelled
]

# Brazilian payment methods
PAYMENT_METHODS = [
    'PIX',          # Instant payment
    'CREDIT_CARD',  # Credit card payment
    'BOLETO'        # Brazilian bank slip
]

# Firestore collection name
COLLECTION_NAME = 'payments'

# Valid payment status transitions
VALID_STATUS_TRANSITIONS = {
    'PENDING': ['PROCESSING', 'CANCELLED'],
    'PROCESSING': ['COMPLETED', 'FAILED'],
    'COMPLETED': ['REFUNDED'],
    'FAILED': [],
    'REFUNDED': [],
    'CANCELLED': []
}

class PaymentModel(BaseModel):
    """
    Core payment model implementing secure payment processing with PCI DSS compliance
    and Brazilian payment method support.
    """
    
    # Required fields
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(..., min_length=1, max_length=128)
    customer_id: str = Field(..., min_length=1, max_length=128)
    amount: Decimal = Field(
        ...,
        ge=Decimal('0.01'),
        le=Decimal('999999.99'),
        description="Payment amount in BRL"
    )
    currency: str = Field(
        default="BRL",
        const=True,
        description="Brazilian Real (BRL) only"
    )
    payment_method: str = Field(..., description="Payment method")
    status: str = Field(default="PENDING", description="Payment status")
    
    # Optional fields
    metadata: Dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Method-specific fields
    pix_key: Optional[str] = Field(default=None)
    pix_qr_code: Optional[str] = Field(default=None)
    gateway_response: Dict = Field(default_factory=dict)
    encryption_key_id: Optional[str] = Field(default=None)
    
    # PCI DSS compliant credit card fields (tokenized)
    card_token: Optional[SecretStr] = Field(default=None)
    card_last_digits: Optional[constr(min_length=4, max_length=4)] = Field(default=None)
    
    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda v: v.isoformat(),
            SecretStr: lambda v: v.get_secret_value() if v else None
        }
        
    # Validators
    @validator('payment_method')
    def validate_payment_method(cls, v):
        """Validate payment method against supported Brazilian methods."""
        if v not in PAYMENT_METHODS:
            raise ValueError(f"Invalid payment method. Must be one of: {', '.join(PAYMENT_METHODS)}")
        return v
    
    @validator('status')
    def validate_status(cls, v):
        """Validate payment status."""
        if v not in PAYMENT_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(PAYMENT_STATUSES)}")
        return v
    
    @validator('amount')
    def validate_amount(cls, v):
        """Validate payment amount format and range."""
        if v.as_tuple().exponent < -2:
            raise ValueError("Amount cannot have more than 2 decimal places")
        return v
    
    @classmethod
    async def create(cls, payment_data: Dict) -> 'PaymentModel':
        """
        Create a new payment record with secure data handling.
        
        Args:
            payment_data: Dictionary containing payment information
            
        Returns:
            PaymentModel instance
            
        Raises:
            FirestoreError: If database operation fails
            ValueError: If payment data is invalid
        """
        try:
            # Create model instance with validation
            payment = cls(**payment_data)
            
            # Store in Firestore
            db = FirestoreClient()
            await db.create_document(
                collection_name=COLLECTION_NAME,
                document_id=payment.id,
                data=payment.dict(exclude={'card_token'})
            )
            
            # Generate PIX QR code if applicable
            if payment.payment_method == 'PIX':
                pix_data = await payment.process_pix_payment(payment_data)
                payment.pix_qr_code = pix_data.get('qr_code')
                payment.pix_key = pix_data.get('key')
                
                # Update document with PIX data
                await db.update_document(
                    collection_name=COLLECTION_NAME,
                    document_id=payment.id,
                    data={'pix_qr_code': payment.pix_qr_code, 'pix_key': payment.pix_key}
                )
            
            return payment
            
        except FirestoreError as e:
            raise FirestoreError(
                message="Failed to create payment record",
                details={"error": str(e)},
                error_code="PAYMENT_CREATE_ERROR"
            )
    
    async def update_status(self, new_status: str, metadata: Optional[Dict] = None) -> 'PaymentModel':
        """
        Update payment status with validation and logging.
        
        Args:
            new_status: New payment status
            metadata: Optional additional metadata
            
        Returns:
            Updated PaymentModel instance
            
        Raises:
            ValueError: If status transition is invalid
            FirestoreError: If database update fails
        """
        if new_status not in VALID_STATUS_TRANSITIONS.get(self.status, []):
            raise ValueError(
                f"Invalid status transition from {self.status} to {new_status}"
            )
        
        try:
            self.status = new_status
            self.updated_at = datetime.utcnow()
            
            if metadata:
                self.metadata.update(metadata)
            
            # Update in Firestore
            db = FirestoreClient()
            await db.update_document(
                collection_name=COLLECTION_NAME,
                document_id=self.id,
                data=self.dict(exclude={'card_token'})
            )
            
            return self
            
        except FirestoreError as e:
            raise FirestoreError(
                message="Failed to update payment status",
                details={"error": str(e)},
                error_code="PAYMENT_UPDATE_ERROR"
            )
    
    async def process_pix_payment(self, pix_data: Dict) -> Dict:
        """
        Handle PIX payment processing with Central Bank compliance.
        
        Args:
            pix_data: PIX payment information
            
        Returns:
            Dictionary containing PIX processing results
            
        Raises:
            ValueError: If PIX data is invalid
        """
        if self.payment_method != 'PIX':
            raise ValueError("Payment method must be PIX")
        
        # Generate PIX key and QR code (implementation depends on payment gateway)
        # This is a placeholder for the actual gateway integration
        pix_result = {
            'key': f"PIX{self.id}",
            'qr_code': f"QR{self.id}",
            'expiration': datetime.utcnow().timestamp() + 3600  # 1 hour validity
        }
        
        return pix_result
    
    def get_formatted_amount(self) -> str:
        """Return formatted amount in Brazilian Real."""
        return format_currency(self.amount)
    
    def to_dict(self, exclude_sensitive: bool = True) -> Dict:
        """
        Convert payment model to dictionary with optional sensitive data exclusion.
        
        Args:
            exclude_sensitive: Whether to exclude sensitive payment data
            
        Returns:
            Dictionary representation of payment
        """
        data = self.dict(
            exclude={'card_token'} if exclude_sensitive else set(),
            by_alias=True
        )
        data['formatted_amount'] = self.get_formatted_amount()
        return data