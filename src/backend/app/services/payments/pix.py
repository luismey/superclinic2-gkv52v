"""
PIX payment integration module for Brazilian healthcare practices.

This module implements secure PIX payment processing with enhanced security features,
QR code generation, and webhook handling for real-time payment status updates.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import logging
import base64
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Optional, Callable, Any

# Third-party imports
import httpx  # v0.24.1
import qrcode  # v7.4.2
from cryptography.fernet import Fernet  # v41.0.0
from tenacity import retry, stop_after_attempt, wait_exponential

# Internal imports
from app.models.payments import PaymentModel, PAYMENT_STATUSES
from app.utils.brazilian import format_currency
from app.utils.validators import validate_document
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Configure logging
logger = get_logger(__name__)

# Constants
PIX_API_TIMEOUT = 30  # seconds
PIX_WEBHOOK_EVENTS = ['CREATED', 'CONFIRMED', 'EXPIRED', 'CANCELLED']
PIX_MAX_AMOUNT = Decimal('100000.00')  # R$ 100,000.00
PIX_RATE_LIMIT = 100  # requests per minute
PIX_QR_ERROR_CORRECTION = 'H'  # High error correction for QR codes
PIX_EXPIRATION_HOURS = 24

class RateLimiter:
    """Rate limiter implementation for PIX API requests."""
    
    def __init__(self, limit: int, window: int = 60):
        self.limit = limit
        self.window = window
        self.tokens = limit
        self.last_update = datetime.utcnow()
        
    async def acquire(self) -> bool:
        """
        Attempt to acquire a rate limit token.
        
        Returns:
            bool: True if token acquired, False if rate limit exceeded
        """
        now = datetime.utcnow()
        time_passed = (now - self.last_update).total_seconds()
        
        # Replenish tokens based on time passed
        self.tokens = min(
            self.limit,
            self.tokens + int((time_passed * self.limit) / self.window)
        )
        self.last_update = now
        
        if self.tokens > 0:
            self.tokens -= 1
            return True
        return False

class PixPaymentProcessor:
    """
    Enhanced PIX payment processor implementing secure payment processing,
    QR code generation, and webhook handling with improved security and monitoring.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize PIX payment processor with enhanced security configuration.
        
        Args:
            config: Configuration dictionary containing API credentials and settings
        
        Raises:
            ValueError: If required configuration is missing
        """
        # Validate configuration
        required_fields = ['api_key', 'merchant_id', 'webhook_secret']
        missing_fields = [f for f in required_fields if f not in config]
        if missing_fields:
            raise ValueError(f"Missing required configuration: {', '.join(missing_fields)}")
        
        # Initialize HTTP client with security settings
        self._client = httpx.AsyncClient(
            timeout=PIX_API_TIMEOUT,
            verify=True,  # Enforce SSL verification
            headers={
                'Authorization': f"Bearer {config['api_key']}",
                'X-Merchant-Id': config['merchant_id'],
                'User-Agent': 'Porfin/1.0.0'
            }
        )
        
        # Initialize encryption for sensitive data
        self._fernet = Fernet(config['webhook_secret'].encode())
        
        # Store configuration securely
        self._api_config = {
            'base_url': config.get('api_url', 'https://api.pix.example.com/v1'),
            'merchant_id': config['merchant_id']
        }
        
        # Initialize rate limiter
        self._rate_limiter = RateLimiter(PIX_RATE_LIMIT)
        
        # Initialize webhook handlers
        self._webhook_handlers = {}
        self._webhook_secret = config['webhook_secret'].encode()
        
        logger.info("PIX payment processor initialized", 
                   extra={"merchant_id": config['merchant_id']})

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def process_payment(self, payment: PaymentModel) -> PaymentModel:
        """
        Process a PIX payment request with enhanced validation and security.
        
        Args:
            payment: Payment model instance with transaction details
            
        Returns:
            Updated payment model with PIX details
            
        Raises:
            ValidationError: If payment validation fails
            httpx.HTTPError: If API request fails
        """
        # Validate payment amount
        if payment.amount > PIX_MAX_AMOUNT:
            raise ValidationError(
                message="Payment amount exceeds maximum limit",
                details={"max_amount": format_currency(PIX_MAX_AMOUNT)}
            )
        
        # Apply rate limiting
        if not await self._rate_limiter.acquire():
            raise ValidationError(
                message="Rate limit exceeded",
                details={"retry_after": "60 seconds"}
            )
        
        try:
            # Generate PIX payload
            pix_payload = {
                "transaction_id": payment.id,
                "amount": str(payment.amount),
                "description": f"Healthcare payment - {payment.id}",
                "expiration": int((datetime.utcnow() + 
                                 timedelta(hours=PIX_EXPIRATION_HOURS)).timestamp())
            }
            
            # Create PIX charge via API
            async with self._client as client:
                response = await client.post(
                    f"{self._api_config['base_url']}/charges",
                    json=pix_payload
                )
                response.raise_for_status()
                pix_data = response.json()
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=getattr(qrcode.constants, f'ERROR_CORRECT_{PIX_QR_ERROR_CORRECTION}'),
                box_size=10,
                border=4,
            )
            qr.add_data(pix_data['qr_code_data'])
            qr.make(fit=True)
            
            # Convert QR code to base64
            qr_image = qr.make_image(fill_color="black", back_color="white")
            qr_base64 = base64.b64encode(qr_image.tobytes()).decode()
            
            # Update payment model
            await payment.update_status(
                new_status="PROCESSING",
                metadata={
                    "pix_id": pix_data['pix_id'],
                    "qr_code": qr_base64,
                    "expiration": pix_data['expiration'],
                    "key": pix_data['key']
                }
            )
            
            # Start expiration monitoring
            asyncio.create_task(self._monitor_expiration(payment))
            
            logger.info(
                "PIX payment processed",
                extra={
                    "payment_id": payment.id,
                    "amount": str(payment.amount),
                    "pix_id": pix_data['pix_id']
                }
            )
            
            return payment
            
        except httpx.HTTPError as e:
            logger.error(
                "PIX API error",
                extra={
                    "payment_id": payment.id,
                    "error": str(e),
                    "status_code": getattr(e.response, 'status_code', None)
                }
            )
            raise
            
        except Exception as e:
            logger.error(
                "PIX processing error",
                extra={
                    "payment_id": payment.id,
                    "error": str(e)
                }
            )
            raise ValidationError(
                message="Failed to process PIX payment",
                details={"error": str(e)}
            )

    async def handle_webhook(self, webhook_data: Dict[str, Any], 
                           signature: str) -> bool:
        """
        Handle PIX payment webhooks with enhanced security and validation.
        
        Args:
            webhook_data: Webhook payload
            signature: Webhook signature for verification
            
        Returns:
            bool: True if webhook processed successfully
            
        Raises:
            ValidationError: If webhook validation fails
        """
        try:
            # Verify webhook signature
            expected_signature = hmac.new(
                self._webhook_secret,
                json.dumps(webhook_data, sort_keys=True).encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                raise ValidationError(
                    message="Invalid webhook signature",
                    details={"event_type": webhook_data.get("event_type")}
                )
            
            # Validate webhook payload
            if "event_type" not in webhook_data or "pix_id" not in webhook_data:
                raise ValidationError(
                    message="Invalid webhook payload",
                    details={"missing_fields": ["event_type", "pix_id"]}
                )
            
            event_type = webhook_data["event_type"]
            if event_type not in PIX_WEBHOOK_EVENTS:
                raise ValidationError(
                    message="Invalid event type",
                    details={"event_type": event_type}
                )
            
            # Process webhook based on event type
            handler = self._webhook_handlers.get(event_type)
            if handler:
                await handler(webhook_data)
            
            logger.info(
                "Webhook processed",
                extra={
                    "event_type": event_type,
                    "pix_id": webhook_data["pix_id"]
                }
            )
            
            return True
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(
                "Webhook processing error",
                extra={
                    "error": str(e),
                    "webhook_data": webhook_data
                }
            )
            return False

    async def _monitor_expiration(self, payment: PaymentModel) -> None:
        """
        Monitor PIX payment expiration and update status accordingly.
        
        Args:
            payment: Payment model instance to monitor
        """
        try:
            expiration = datetime.fromtimestamp(
                payment.metadata.get("expiration", 0)
            )
            
            # Calculate sleep duration
            now = datetime.utcnow()
            if expiration > now:
                await asyncio.sleep((expiration - now).total_seconds())
                
                # Check if payment is still pending
                if payment.status == "PROCESSING":
                    await payment.update_status(
                        new_status="EXPIRED",
                        metadata={"expired_at": datetime.utcnow().isoformat()}
                    )
                    
                    logger.info(
                        "PIX payment expired",
                        extra={"payment_id": payment.id}
                    )
                    
        except Exception as e:
            logger.error(
                "Expiration monitoring error",
                extra={
                    "payment_id": payment.id,
                    "error": str(e)
                }
            )

    def register_webhook_handler(self, event_type: str, 
                               handler: Callable[[Dict[str, Any]], Any]) -> None:
        """
        Register a webhook handler for a specific event type.
        
        Args:
            event_type: PIX event type to handle
            handler: Async callback function to handle the event
        
        Raises:
            ValueError: If event type is invalid
        """
        if event_type not in PIX_WEBHOOK_EVENTS:
            raise ValueError(f"Invalid event type: {event_type}")
        
        self._webhook_handlers[event_type] = handler
        logger.info(f"Registered webhook handler for {event_type}")

    async def close(self) -> None:
        """Clean up resources on shutdown."""
        await self._client.aclose()