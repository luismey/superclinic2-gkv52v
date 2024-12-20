"""
Payment processor factory and abstract base classes for Brazilian payment methods.
Implements secure payment processing with PCI DSS compliance, monitoring, and audit logging.

Version: 1.0.0
"""

# Standard library imports
import abc
import logging
from typing import Dict, Type, Optional, Any
from datetime import datetime

# Third-party imports
from tenacity import (  # v8.2.2
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from cryptography.fernet import Fernet  # v41.0.0

# Internal imports
from .pix import PixPaymentProcessor
from ...models.payments import PaymentModel, PAYMENT_STATUSES, PAYMENT_METHODS
from ...core.exceptions import ValidationError
from ...core.logging import get_logger

# Configure logging with PCI compliant masking
logger = get_logger(__name__)

# Constants
SUPPORTED_PAYMENT_METHODS = {
    'PIX': PixPaymentProcessor
}

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 5

class PaymentProcessor(abc.ABC):
    """
    Enhanced abstract base class for payment processors with security features
    and PCI DSS compliance.
    """
    
    def __init__(self, config: Dict[str, Any]) -> None:
        """
        Initialize payment processor with security configuration.
        
        Args:
            config: Configuration dictionary containing credentials and settings
            
        Raises:
            ValidationError: If configuration is invalid
        """
        # Validate required configuration
        required_fields = ['api_key', 'merchant_id', 'webhook_secret']
        missing_fields = [f for f in required_fields if f not in config]
        if missing_fields:
            raise ValidationError(
                message="Missing required configuration fields",
                details={"missing_fields": missing_fields}
            )
        
        # Initialize secure configuration storage
        self._config = {
            'merchant_id': config['merchant_id'],
            'api_url': config.get('api_url', 'https://api.payment.example.com/v1')
        }
        
        # Initialize encryption for sensitive data
        self._fernet = Fernet(config['webhook_secret'].encode())
        
        # Initialize webhook handlers
        self._webhook_handlers = {}
        
        logger.info(
            "Payment processor initialized",
            extra={
                "processor_type": self.__class__.__name__,
                "merchant_id": config['merchant_id']
            }
        )

    @abc.abstractmethod
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=RETRY_DELAY, max=RETRY_DELAY * 2),
        retry=retry_if_exception_type(ValidationError)
    )
    async def process_payment(self, payment: PaymentModel) -> PaymentModel:
        """
        Process a payment with enhanced security and monitoring.
        
        Args:
            payment: Payment model instance to process
            
        Returns:
            Updated payment model with processing details
            
        Raises:
            ValidationError: If payment processing fails
        """
        pass

    @abc.abstractmethod
    async def handle_webhook(self, webhook_data: Dict[str, Any], 
                           signature: str) -> bool:
        """
        Handle payment webhooks with signature verification.
        
        Args:
            webhook_data: Webhook payload
            signature: Webhook signature for verification
            
        Returns:
            bool: True if webhook processed successfully
            
        Raises:
            ValidationError: If webhook validation fails
        """
        pass

    def _encrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt sensitive payment data for secure storage.
        
        Args:
            data: Dictionary containing payment data
            
        Returns:
            Dictionary with sensitive fields encrypted
        """
        sensitive_fields = ['card_number', 'cvv', 'token']
        encrypted_data = data.copy()
        
        for field in sensitive_fields:
            if field in encrypted_data:
                encrypted_data[field] = self._fernet.encrypt(
                    str(encrypted_data[field]).encode()
                ).decode()
        
        return encrypted_data

    def _decrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt sensitive payment data for processing.
        
        Args:
            data: Dictionary containing encrypted payment data
            
        Returns:
            Dictionary with sensitive fields decrypted
        """
        encrypted_fields = ['card_number', 'cvv', 'token']
        decrypted_data = data.copy()
        
        for field in encrypted_fields:
            if field in decrypted_data:
                decrypted_data[field] = self._fernet.decrypt(
                    decrypted_data[field].encode()
                ).decode()
        
        return decrypted_data

class PaymentProcessorFactory:
    """
    Factory class for creating payment processor instances with caching
    and validation.
    """
    
    _processor_cache: Dict[str, PaymentProcessor] = {}
    
    def __init__(self) -> None:
        """Private constructor to prevent instantiation."""
        raise TypeError("PaymentProcessorFactory cannot be instantiated")

    @staticmethod
    def create_processor(
        payment_method: str,
        config: Dict[str, Any]
    ) -> PaymentProcessor:
        """
        Create and return appropriate payment processor instance.
        
        Args:
            payment_method: Payment method identifier
            config: Processor configuration
            
        Returns:
            Configured payment processor instance
            
        Raises:
            ValidationError: If payment method is not supported
        """
        # Validate payment method
        if payment_method not in SUPPORTED_PAYMENT_METHODS:
            raise ValidationError(
                message=f"Unsupported payment method: {payment_method}",
                details={"supported_methods": list(SUPPORTED_PAYMENT_METHODS.keys())}
            )
        
        # Check processor cache
        cache_key = f"{payment_method}:{config['merchant_id']}"
        if cache_key in PaymentProcessorFactory._processor_cache:
            return PaymentProcessorFactory._processor_cache[cache_key]
        
        try:
            # Create new processor instance
            processor_class = SUPPORTED_PAYMENT_METHODS[payment_method]
            processor = processor_class(config)
            
            # Cache processor instance
            PaymentProcessorFactory._processor_cache[cache_key] = processor
            
            logger.info(
                f"Created payment processor",
                extra={
                    "payment_method": payment_method,
                    "merchant_id": config['merchant_id']
                }
            )
            
            return processor
            
        except Exception as e:
            logger.error(
                "Failed to create payment processor",
                extra={
                    "error": str(e),
                    "payment_method": payment_method,
                    "merchant_id": config['merchant_id']
                }
            )
            raise ValidationError(
                message="Failed to initialize payment processor",
                details={"error": str(e)}
            )