"""
High-performance WhatsApp message handlers for the Porfin platform.

This module implements enterprise-grade message processing with AI integration,
comprehensive monitoring, rate limiting, and error handling for the WhatsApp
Business API integration.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime
from typing import Dict, Optional, Any
import uuid

# Third-party imports
import orjson  # v3.9.0
from tenacity import (  # v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from circuitbreaker import circuit  # v1.4.0
from prometheus_client import Counter, Histogram, Gauge  # v0.17.0

# Internal imports
from app.services.whatsapp.client import WhatsAppClient
from app.services.whatsapp.message_queue import WhatsAppMessageQueue
from app.services.ai.intent_classifier import IntentClassifier
from app.core.logging import get_logger

# Configure logger
logger = get_logger(__name__)

# Constants
MAX_RETRIES = 3
RETRY_DELAY = 1.0
AI_CONFIDENCE_THRESHOLD = 0.85
MAX_BATCH_SIZE = 100
RATE_LIMIT_PER_SECOND = 100
CIRCUIT_BREAKER_THRESHOLD = 0.5

# Prometheus metrics
METRICS_PREFIX = "porfin_whatsapp"
message_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total WhatsApp message operations",
    ["operation_type", "status"]
)
message_latency = Histogram(
    f"{METRICS_PREFIX}_operation_latency_seconds",
    "Message operation latency",
    ["operation_type"]
)
ai_operations = Counter(
    f"{METRICS_PREFIX}_ai_operations_total",
    "AI processing operations",
    ["operation_type", "status"]
)
active_connections = Gauge(
    f"{METRICS_PREFIX}_active_connections",
    "Number of active WhatsApp connections"
)

class WhatsAppMessageHandler:
    """High-performance handler for WhatsApp messages with AI integration."""
    
    def __init__(
        self,
        whatsapp_client: WhatsAppClient,
        message_queue: WhatsAppMessageQueue,
        intent_classifier: IntentClassifier
    ) -> None:
        """
        Initialize message handler with required services.

        Args:
            whatsapp_client: WhatsApp client instance
            message_queue: Message queue for rate limiting
            intent_classifier: AI intent classifier
        """
        self._client = whatsapp_client
        self._queue = message_queue
        self._intent_classifier = intent_classifier
        
        # Initialize rate limiter
        self._rate_limiter = asyncio.Semaphore(RATE_LIMIT_PER_SECOND)
        
        # Initialize metrics
        self._metrics = {
            "messages_processed": 0,
            "ai_responses": 0,
            "errors": 0,
            "average_latency": 0.0
        }
        
        logger.info("WhatsApp message handler initialized")

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    @circuit(
        failure_threshold=CIRCUIT_BREAKER_THRESHOLD,
        recovery_timeout=30,
        name="whatsapp_handler"
    )
    async def handle_incoming_message(
        self,
        message_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process incoming WhatsApp message with AI integration.

        Args:
            message_data: Raw message data from webhook

        Returns:
            Dict containing processing result and status

        Raises:
            Exception: If message processing fails
        """
        start_time = datetime.now()
        correlation_id = str(uuid.uuid4())
        
        try:
            # Extract message details
            message = message_data.get("messages", [{}])[0]
            sender_id = message.get("from")
            message_type = message.get("type")
            message_text = message.get("text", {}).get("body", "")
            
            logger.info(
                "Processing incoming message",
                extra={
                    "correlation_id": correlation_id,
                    "sender_id": sender_id,
                    "message_type": message_type
                }
            )
            
            # Rate limiting check
            async with self._rate_limiter:
                # Classify message intent
                intent_result = await self._intent_classifier.classify_intent(
                    message_text,
                    context={
                        "sender_id": sender_id,
                        "message_type": message_type
                    }
                )
                
                ai_operations.labels(
                    operation_type="classify",
                    status="success"
                ).inc()
                
                # Generate AI response if confidence is high
                response_text = None
                if intent_result["confidence"] >= AI_CONFIDENCE_THRESHOLD:
                    # Queue AI response
                    response_text = await self._generate_ai_response(
                        message_text,
                        intent_result,
                        sender_id
                    )
                    
                    if response_text:
                        # Queue response message
                        await self._queue.enqueue_message(
                            recipient_id=sender_id,
                            message_type="text",
                            content={"text": response_text}
                        )
                
                # Update metrics
                duration = (datetime.now() - start_time).total_seconds()
                self._metrics["messages_processed"] += 1
                if response_text:
                    self._metrics["ai_responses"] += 1
                self._metrics["average_latency"] = (
                    (self._metrics["average_latency"] * 
                     (self._metrics["messages_processed"] - 1) +
                     duration) / self._metrics["messages_processed"]
                )
                
                # Record Prometheus metrics
                message_operations.labels(
                    operation_type="process",
                    status="success"
                ).inc()
                message_latency.labels(
                    operation_type="process"
                ).observe(duration)
                
                return {
                    "status": "success",
                    "correlation_id": correlation_id,
                    "intent": intent_result["intent"],
                    "confidence": intent_result["confidence"],
                    "ai_response": bool(response_text),
                    "processing_time": duration
                }
                
        except Exception as e:
            self._metrics["errors"] += 1
            message_operations.labels(
                operation_type="process",
                status="error"
            ).inc()
            
            logger.error(
                "Message processing failed",
                extra={
                    "correlation_id": correlation_id,
                    "error": str(e),
                    "message_data": message_data
                },
                exc_info=True
            )
            raise

    async def _generate_ai_response(
        self,
        message_text: str,
        intent_result: Dict[str, Any],
        sender_id: str
    ) -> Optional[str]:
        """
        Generate AI response based on message intent.

        Args:
            message_text: Original message text
            intent_result: Intent classification result
            sender_id: Message sender ID

        Returns:
            Optional[str]: Generated response text or None
        """
        try:
            # Get conversation context
            context = {
                "intent": intent_result["intent"],
                "confidence": intent_result["confidence"],
                "entities": intent_result.get("entities", {}),
                "sender_id": sender_id
            }
            
            # Generate response using GPT service
            response = await self._intent_classifier._gpt_service.generate_response(
                message_text,
                [],  # No conversation history needed
                context
            )
            
            ai_operations.labels(
                operation_type="generate",
                status="success"
            ).inc()
            
            return response
            
        except Exception as e:
            logger.error(
                "AI response generation failed",
                extra={
                    "sender_id": sender_id,
                    "intent": intent_result["intent"],
                    "error": str(e)
                }
            )
            ai_operations.labels(
                operation_type="generate",
                status="error"
            ).inc()
            return None

    async def handle_status_update(
        self,
        status_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process message status updates.

        Args:
            status_data: Status update data

        Returns:
            Dict containing processing result
        """
        try:
            # Extract status details
            status = status_data.get("statuses", [{}])[0]
            message_id = status.get("id")
            status_type = status.get("status")
            recipient_id = status.get("recipient_id")
            
            logger.info(
                "Processing status update",
                extra={
                    "message_id": message_id,
                    "status": status_type,
                    "recipient_id": recipient_id
                }
            )
            
            # Record metrics
            message_operations.labels(
                operation_type="status_update",
                status="success"
            ).inc()
            
            return {
                "status": "success",
                "message_id": message_id,
                "status_type": status_type,
                "recipient_id": recipient_id
            }
            
        except Exception as e:
            message_operations.labels(
                operation_type="status_update",
                status="error"
            ).inc()
            
            logger.error(
                "Status update processing failed",
                extra={"error": str(e), "status_data": status_data},
                exc_info=True
            )
            raise

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get handler performance metrics.

        Returns:
            Dict containing performance metrics
        """
        return {
            "messages": {
                "processed": self._metrics["messages_processed"],
                "ai_responses": self._metrics["ai_responses"],
                "errors": self._metrics["errors"]
            },
            "performance": {
                "average_latency": self._metrics["average_latency"],
                "success_rate": (
                    (self._metrics["messages_processed"] - self._metrics["errors"]) /
                    self._metrics["messages_processed"]
                    if self._metrics["messages_processed"] > 0 else 0
                )
            }
        }

# Export handler class
__all__ = ["WhatsAppMessageHandler"]