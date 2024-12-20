"""
WhatsApp webhook endpoint handlers for the Porfin platform.

This module implements secure webhook processing for WhatsApp Business API integration,
including message handling, status updates, and comprehensive monitoring with rate
limiting and signature validation.

Version: 1.0.0
"""

# Standard library imports
import uuid
from datetime import datetime
from typing import Dict, Optional

# Third-party imports - version specified as per IE2
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from circuitbreaker import circuit  # v1.4.0
from prometheus_client import Counter, Histogram  # v0.17.0

# Internal imports
from app.services.whatsapp.handlers import WhatsAppMessageHandler
from app.services.whatsapp.client import WhatsAppClient
from app.core.logging import get_logger
from app.core.security import RateLimiter, WebhookValidator

# Configure logger
logger = get_logger(__name__)

# Configure router
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Initialize services
rate_limiter = RateLimiter()
webhook_validator = WebhookValidator()

# Prometheus metrics
METRICS_PREFIX = "porfin_webhook"
webhook_requests = Counter(
    f"{METRICS_PREFIX}_requests_total",
    "Total webhook requests",
    ["endpoint", "status"]
)
webhook_latency = Histogram(
    f"{METRICS_PREFIX}_latency_seconds",
    "Webhook processing latency",
    ["endpoint"]
)

@router.get("/whatsapp")
@rate_limiter.limit("100/minute")
async def verify_whatsapp_webhook(
    hub_mode: str,
    hub_verify_token: str,
    hub_challenge: str,
    request: Request,
    response: Response
) -> int:
    """
    Verify WhatsApp webhook subscription with enhanced security validation.

    Args:
        hub_mode: Verification mode from WhatsApp
        hub_verify_token: Token to verify webhook subscription
        hub_challenge: Challenge string to return
        request: FastAPI request object
        response: FastAPI response object

    Returns:
        int: Challenge token for successful verification

    Raises:
        HTTPException: If verification fails
    """
    correlation_id = str(uuid.uuid4())
    start_time = datetime.utcnow()

    try:
        logger.info(
            "Processing webhook verification",
            extra={
                "correlation_id": correlation_id,
                "hub_mode": hub_mode,
                "client_ip": request.client.host
            }
        )

        # Validate hub_mode
        if hub_mode != "subscribe":
            raise HTTPException(
                status_code=400,
                detail="Invalid hub_mode parameter"
            )

        # Verify token
        if not webhook_validator.validate_signature(hub_verify_token):
            raise HTTPException(
                status_code=403,
                detail="Invalid verify token"
            )

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Correlation-ID"] = correlation_id

        # Record metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        webhook_requests.labels(
            endpoint="verify",
            status="success"
        ).inc()
        webhook_latency.labels(
            endpoint="verify"
        ).observe(duration)

        logger.info(
            "Webhook verification successful",
            extra={
                "correlation_id": correlation_id,
                "duration": duration
            }
        )

        return int(hub_challenge)

    except Exception as e:
        webhook_requests.labels(
            endpoint="verify",
            status="error"
        ).inc()

        logger.error(
            "Webhook verification failed",
            extra={
                "correlation_id": correlation_id,
                "error": str(e),
                "client_ip": request.client.host
            }
        )
        raise

@router.post("/whatsapp")
@rate_limiter.limit("100/second")
@circuit(failure_threshold=5, recovery_timeout=60)
async def handle_whatsapp_webhook(
    request: Request,
    message_handler: WhatsAppMessageHandler = Depends(),
    response: Response = None
) -> Dict:
    """
    Process incoming WhatsApp webhook events with enhanced security and monitoring.

    Args:
        request: FastAPI request object
        message_handler: WhatsApp message handler service
        response: FastAPI response object

    Returns:
        Dict: Processing result status with metrics

    Raises:
        HTTPException: If webhook processing fails
    """
    correlation_id = str(uuid.uuid4())
    start_time = datetime.utcnow()

    try:
        # Extract and validate signature
        signature = request.headers.get("X-Hub-Signature-256")
        if not signature:
            raise HTTPException(
                status_code=401,
                detail="Missing webhook signature"
            )

        # Read raw request body
        body = await request.body()
        if not body:
            raise HTTPException(
                status_code=400,
                detail="Empty request body"
            )

        # Verify webhook signature
        if not webhook_validator.validate_signature(signature):
            raise HTTPException(
                status_code=403,
                detail="Invalid webhook signature"
            )

        # Parse webhook payload
        webhook_data = await request.json()
        
        # Add security headers
        if response:
            response.headers.update({
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "X-Correlation-ID": correlation_id
            })

        # Determine event type
        entry = webhook_data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        event_type = changes.get("value", {}).get("type")

        logger.info(
            "Processing webhook event",
            extra={
                "correlation_id": correlation_id,
                "event_type": event_type,
                "client_ip": request.client.host
            }
        )

        # Route to appropriate handler
        result = None
        if event_type == "message":
            result = await message_handler.handle_incoming_message(webhook_data)
        elif event_type == "status":
            result = await message_handler.handle_status_update(webhook_data)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported event type: {event_type}"
            )

        # Record metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        webhook_requests.labels(
            endpoint="process",
            status="success"
        ).inc()
        webhook_latency.labels(
            endpoint="process"
        ).observe(duration)

        logger.info(
            "Webhook processing successful",
            extra={
                "correlation_id": correlation_id,
                "duration": duration,
                "event_type": event_type
            }
        )

        return {
            "status": "success",
            "correlation_id": correlation_id,
            "event_type": event_type,
            "processing_time": duration,
            "result": result
        }

    except Exception as e:
        webhook_requests.labels(
            endpoint="process",
            status="error"
        ).inc()

        logger.error(
            "Webhook processing failed",
            extra={
                "correlation_id": correlation_id,
                "error": str(e),
                "client_ip": request.client.host
            }
        )
        raise