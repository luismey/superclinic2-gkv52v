"""
High-performance WhatsApp client implementation for the Porfin platform.

This module provides an asynchronous WhatsApp client with robust error handling,
connection pooling, rate limiting, and comprehensive monitoring capabilities.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime
from typing import Dict, Optional, Any
import json

# Third-party imports - versions specified in requirements.txt
import aiohttp  # v3.8.0
import backoff  # v2.2.1
import orjson  # v3.9.0
from baileys import WhatsAppClient as BaileysClient  # v1.0.0

# Internal imports
from app.core.logging import get_logger
from app.core.security import verify_token
from app.core.exceptions import WhatsAppError

# Configure logger with security context
logger = get_logger(__name__)

# Constants
API_VERSION = "v16.0"
MAX_RETRIES = 3
RETRY_DELAY = 1.0
MAX_CONNECTIONS = 100
RATE_LIMIT_MESSAGES = 100
RATE_LIMIT_WINDOW = 1
WEBHOOK_TIMEOUT = 5.0

class WhatsAppClient:
    """
    High-performance WhatsApp client with async message operations, connection pooling,
    rate limiting, and secure webhook handling.
    """

    def __init__(
        self,
        api_key: str,
        phone_number_id: str,
        webhook_secret: str,
        config: Optional[Dict] = None
    ) -> None:
        """
        Initialize WhatsApp client with enhanced connection management and monitoring.

        Args:
            api_key: WhatsApp Business API key
            phone_number_id: WhatsApp Business phone number ID
            webhook_secret: Webhook verification secret
            config: Optional configuration overrides
        """
        self._api_key = api_key
        self._phone_number_id = phone_number_id
        self._webhook_secret = webhook_secret
        self._base_url = f"https://graph.facebook.com/{API_VERSION}/{phone_number_id}"
        
        # Initialize connection pool
        self._session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                limit=config.get('max_connections', MAX_CONNECTIONS),
                ttl_dns_cache=300,
                ssl=True
            ),
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )

        # Initialize rate limiter
        self._rate_limit = asyncio.Semaphore(
            config.get('rate_limit_messages', RATE_LIMIT_MESSAGES)
        )
        self._message_queue = {}
        
        # Initialize metrics
        self._metrics = {
            "messages_sent": 0,
            "messages_failed": 0,
            "webhooks_processed": 0,
            "rate_limit_hits": 0,
            "errors": {}
        }

        logger.info(
            "WhatsApp client initialized",
            extra={
                "phone_number_id": phone_number_id,
                "max_connections": config.get('max_connections', MAX_CONNECTIONS),
                "rate_limit": config.get('rate_limit_messages', RATE_LIMIT_MESSAGES)
            }
        )

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self._session.close()

    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, WhatsAppError),
        max_tries=MAX_RETRIES,
        max_time=30
    )
    async def send_message(
        self,
        recipient_id: str,
        message_type: str,
        content: dict,
        options: Optional[Dict] = None
    ) -> dict:
        """
        Send WhatsApp message with rate limiting and connection pooling.

        Args:
            recipient_id: Recipient's WhatsApp ID
            message_type: Type of message (text, template, media, etc.)
            content: Message content
            options: Optional message parameters

        Returns:
            dict: API response with detailed message status

        Raises:
            WhatsAppError: If message sending fails
        """
        start_time = datetime.utcnow()
        
        try:
            # Apply rate limiting
            async with self._rate_limit:
                # Prepare message payload
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": recipient_id,
                    "type": message_type,
                    message_type: content
                }
                
                if options:
                    payload.update(options)

                # Send message with connection pooling
                async with self._session.post(
                    f"{self._base_url}/messages",
                    json=payload
                ) as response:
                    if response.status == 429:
                        self._metrics["rate_limit_hits"] += 1
                        raise WhatsAppError(
                            "Rate limit exceeded",
                            details={"recipient_id": recipient_id}
                        )
                        
                    response_data = await response.json()
                    
                    if response.status != 200:
                        raise WhatsAppError(
                            "Failed to send message",
                            details={
                                "status_code": response.status,
                                "response": response_data
                            }
                        )

                    # Update metrics
                    self._metrics["messages_sent"] += 1
                    duration = (datetime.utcnow() - start_time).total_seconds()
                    
                    logger.info(
                        "Message sent successfully",
                        extra={
                            "recipient_id": recipient_id,
                            "message_type": message_type,
                            "duration": duration,
                            "status_code": response.status
                        }
                    )

                    return response_data

        except Exception as e:
            self._metrics["messages_failed"] += 1
            error_type = type(e).__name__
            self._metrics["errors"][error_type] = self._metrics["errors"].get(error_type, 0) + 1
            
            logger.error(
                "Error sending message",
                extra={
                    "error": str(e),
                    "recipient_id": recipient_id,
                    "message_type": message_type
                },
                exc_info=True
            )
            raise

    async def handle_webhook(
        self,
        webhook_data: dict,
        signature: str,
        context: Optional[Dict] = None
    ) -> dict:
        """
        Process webhooks with enhanced security and monitoring.

        Args:
            webhook_data: Webhook payload
            signature: Webhook signature for verification
            context: Optional processing context

        Returns:
            dict: Processed webhook data with validation status

        Raises:
            WhatsAppError: If webhook processing fails
        """
        start_time = datetime.utcnow()
        
        try:
            # Verify webhook signature
            if not verify_token(signature, self._webhook_secret):
                raise WhatsAppError("Invalid webhook signature")

            # Process webhook data
            processed_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": webhook_data.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {}).get("type"),
                "status": "processed",
                "processing_time": None
            }

            # Handle different webhook types
            if processed_data["event_type"] == "message":
                await self._handle_message_webhook(webhook_data, processed_data)
            elif processed_data["event_type"] == "status":
                await self._handle_status_webhook(webhook_data, processed_data)

            # Update metrics
            self._metrics["webhooks_processed"] += 1
            duration = (datetime.utcnow() - start_time).total_seconds()
            processed_data["processing_time"] = duration

            logger.info(
                "Webhook processed successfully",
                extra={
                    "event_type": processed_data["event_type"],
                    "duration": duration,
                    "context": context
                }
            )

            return processed_data

        except Exception as e:
            error_type = type(e).__name__
            self._metrics["errors"][error_type] = self._metrics["errors"].get(error_type, 0) + 1
            
            logger.error(
                "Error processing webhook",
                extra={
                    "error": str(e),
                    "webhook_type": webhook_data.get("type"),
                    "context": context
                },
                exc_info=True
            )
            raise

    async def _handle_message_webhook(self, webhook_data: dict, processed_data: dict) -> None:
        """Handle message-type webhooks."""
        message = webhook_data["entry"][0]["changes"][0]["value"].get("messages", [{}])[0]
        processed_data.update({
            "message_id": message.get("id"),
            "from": message.get("from"),
            "timestamp": message.get("timestamp"),
            "type": message.get("type")
        })

    async def _handle_status_webhook(self, webhook_data: dict, processed_data: dict) -> None:
        """Handle status-type webhooks."""
        status = webhook_data["entry"][0]["changes"][0]["value"].get("statuses", [{}])[0]
        processed_data.update({
            "message_id": status.get("id"),
            "recipient_id": status.get("recipient_id"),
            "status": status.get("status"),
            "timestamp": status.get("timestamp")
        })

    def get_metrics(self) -> dict:
        """
        Get client metrics and statistics.

        Returns:
            dict: Current metrics and performance statistics
        """
        return {
            "messages": {
                "sent": self._metrics["messages_sent"],
                "failed": self._metrics["messages_failed"],
                "success_rate": (
                    (self._metrics["messages_sent"] / 
                     (self._metrics["messages_sent"] + self._metrics["messages_failed"])) * 100
                    if (self._metrics["messages_sent"] + self._metrics["messages_failed"]) > 0
                    else 0
                )
            },
            "webhooks": {
                "processed": self._metrics["webhooks_processed"]
            },
            "rate_limiting": {
                "hits": self._metrics["rate_limit_hits"]
            },
            "errors": self._metrics["errors"]
        }