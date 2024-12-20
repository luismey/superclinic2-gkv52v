"""
FastAPI endpoints for Brazilian payment processing with PCI DSS compliance.
Implements secure payment operations, PIX instant payments, and comprehensive audit logging.

Version: 1.0.0
"""

# Standard library imports
from typing import Dict, Optional
from datetime import datetime
import uuid

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status  # v0.100+
from tenacity import retry, stop_after_attempt, retry_if_exception_type  # v8.2.2

# Internal imports
from ....models.payments import PaymentModel
from ....schemas.payments import PaymentCreate, PaymentUpdate, PaymentResponse
from ....services.payments.processors import PaymentProcessorFactory
from ....core.logging import AuditLogger
from ....core.exceptions import ValidationError
from ....utils.brazilian import format_currency

# Initialize router with security dependencies
router = APIRouter(
    prefix="/payments",
    tags=["payments"],
    dependencies=[Depends(verify_api_key), Depends(rate_limiter)]
)

# Initialize audit logger
logger = AuditLogger(__name__)

# Constants
PAYMENT_RATE_LIMIT = "100/minute"

@router.post("/", 
            response_model=PaymentResponse,
            status_code=status.HTTP_201_CREATED)
@retry(
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(ConnectionError)
)
async def create_payment(
    payment_data: PaymentCreate,
    current_user = Depends(get_current_user)
) -> PaymentResponse:
    """
    Create a new payment with PCI DSS compliance and Brazilian payment validation.
    
    Args:
        payment_data: Validated payment creation data
        current_user: Authenticated user making the request
        
    Returns:
        PaymentResponse: Created payment details with masked sensitive data
        
    Raises:
        HTTPException: If payment creation fails
        ValidationError: If payment data is invalid
    """
    try:
        # Log payment attempt with security context
        logger.log_payment_event(
            event_type="PAYMENT_ATTEMPT",
            user_id=current_user.id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method
        )

        # Create payment record
        payment = await PaymentModel.create({
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "customer_id": payment_data.customer_id,
            "amount": payment_data.amount,
            "currency": "BRL",
            "payment_method": payment_data.payment_method,
            "metadata": payment_data.metadata
        })

        # Get appropriate payment processor
        processor = PaymentProcessorFactory.create_processor(
            payment_method=payment_data.payment_method,
            config={
                "api_key": current_user.payment_credentials.api_key,
                "merchant_id": current_user.payment_credentials.merchant_id,
                "webhook_secret": current_user.payment_credentials.webhook_secret
            }
        )

        # Process payment
        processed_payment = await processor.process_payment(payment)

        # Log successful payment creation
        logger.log_payment_event(
            event_type="PAYMENT_CREATED",
            payment_id=processed_payment.id,
            user_id=current_user.id,
            amount=processed_payment.amount,
            payment_method=processed_payment.payment_method
        )

        return PaymentResponse(
            id=processed_payment.id,
            user_id=processed_payment.user_id,
            customer_id=processed_payment.customer_id,
            amount_formatted=format_currency(processed_payment.amount),
            payment_method=processed_payment.payment_method,
            status=processed_payment.status,
            metadata=processed_payment.metadata,
            created_at=processed_payment.created_at,
            updated_at=processed_payment.updated_at
        )

    except ValidationError as e:
        logger.log_payment_event(
            event_type="PAYMENT_VALIDATION_ERROR",
            user_id=current_user.id,
            error=str(e),
            details=e.details
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.log_payment_event(
            event_type="PAYMENT_ERROR",
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process payment"
        )

@router.post("/webhook",
            status_code=status.HTTP_200_OK)
@verify_webhook_signature
async def handle_webhook(
    webhook_data: Dict,
    signature: str = Depends(get_webhook_signature)
) -> Dict:
    """
    Handle payment gateway webhooks with secure signature verification.
    
    Args:
        webhook_data: Webhook payload from payment gateway
        signature: Webhook signature for verification
        
    Returns:
        Dict: Webhook processing confirmation
        
    Raises:
        HTTPException: If webhook processing fails
    """
    try:
        # Get payment record
        payment = await PaymentModel.get(webhook_data.get("payment_id"))
        if not payment:
            raise ValidationError("Payment not found")

        # Get appropriate processor
        processor = PaymentProcessorFactory.create_processor(
            payment_method=payment.payment_method,
            config={
                "api_key": payment.user.payment_credentials.api_key,
                "merchant_id": payment.user.payment_credentials.merchant_id,
                "webhook_secret": payment.user.payment_credentials.webhook_secret
            }
        )

        # Process webhook
        success = await processor.handle_webhook(webhook_data, signature)
        if not success:
            raise ValidationError("Webhook processing failed")

        # Update payment status
        new_status = webhook_data.get("status")
        if new_status:
            await payment.update_status(
                new_status=new_status,
                metadata=webhook_data.get("metadata", {})
            )

        # Log webhook processing
        logger.log_payment_event(
            event_type="WEBHOOK_PROCESSED",
            payment_id=payment.id,
            webhook_type=webhook_data.get("event_type"),
            new_status=new_status
        )

        return {
            "status": "success",
            "payment_id": payment.id,
            "processed_at": datetime.utcnow().isoformat()
        }

    except ValidationError as e:
        logger.log_payment_event(
            event_type="WEBHOOK_VALIDATION_ERROR",
            error=str(e),
            details=e.details
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.log_payment_event(
            event_type="WEBHOOK_ERROR",
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook"
        )