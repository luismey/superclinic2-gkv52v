"""
WhatsApp message operations endpoint handlers for the Porfin platform.

This module provides high-performance async handlers for message operations including
sending, receiving, listing, and managing messages with AI integration.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Optional, List, Dict, Any
import asyncio

# Third-party imports
from fastapi import APIRouter, Depends, Query, Path, HTTPException, BackgroundTasks
from fastapi_limiter.depends import RateLimiter  # v0.1.5
from circuitbreaker import circuit  # v1.4.0
from prometheus_client import Counter, Histogram  # v0.17.1
import redis.asyncio as redis  # v4.0.0

# Internal imports
from app.models.messages import Message, MessageType, MessageDirection, MessageStatus
from app.core.exceptions import WhatsAppError, ValidationError
from app.core.logging import get_logger
from app.config.settings import settings
from app.db.firestore import FirestoreError

# Configure router
router = APIRouter(prefix="/messages", tags=["messages"])

# Configure logger
logger = get_logger(__name__)

# Prometheus metrics
message_processing_latency = Histogram(
    'message_processing_latency_seconds',
    'Message processing latency in seconds',
    ['operation', 'status']
)
message_delivery_counter = Counter(
    'message_delivery_total',
    'Total message delivery attempts',
    ['status']
)

# Redis client for caching
redis_client = redis.Redis.from_url(
    settings.get_redis_url(),
    encoding="utf-8",
    decode_responses=True
)

# Circuit breaker configuration
@circuit(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=WhatsAppError
)
async def send_whatsapp_message(message_data: Dict[str, Any]) -> bool:
    """
    Send message to WhatsApp with circuit breaker protection.
    
    Args:
        message_data: Message data to send
        
    Returns:
        bool: Success status
        
    Raises:
        WhatsAppError: If message delivery fails
    """
    try:
        # Implementation would integrate with WhatsApp Business API
        return True
    except Exception as e:
        raise WhatsAppError(
            message="Failed to deliver WhatsApp message",
            details={"error": str(e)},
            integration_context={"message_data": message_data}
        )

@router.get(
    "/{chat_id}",
    response_model=Dict[str, Any],
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def get_messages(
    chat_id: str = Path(..., description="Chat ID to retrieve messages for"),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    background_tasks: BackgroundTasks = None
) -> Dict[str, Any]:
    """
    Get paginated list of messages for a chat with caching and monitoring.
    
    Args:
        chat_id: Chat identifier
        limit: Maximum number of messages to return
        cursor: Pagination cursor
        background_tasks: Background tasks runner
        
    Returns:
        Dict containing messages and pagination info
        
    Raises:
        ValidationError: If parameters are invalid
        HTTPException: If chat not found or other errors occur
    """
    start_time = datetime.utcnow()
    
    try:
        # Check cache first
        cache_key = f"messages:{chat_id}:{cursor}:{limit}"
        cached_result = await redis_client.get(cache_key)
        
        if cached_result:
            return {
                "messages": cached_result,
                "cursor": cursor,
                "cached": True
            }
        
        # Query messages from database
        messages = await Message.get_chat_messages(
            chat_id=chat_id,
            limit=limit,
            cursor=cursor
        )
        
        # Process messages
        processed_messages = []
        for msg in messages:
            processed_messages.append({
                "id": msg.id,
                "type": msg.type.value,
                "direction": msg.direction.value,
                "content": msg.content,
                "status": msg.status.value,
                "sent_at": msg.sent_at.isoformat(),
                "is_ai_generated": msg.is_ai_generated
            })
            
        # Cache results for 5 minutes
        if processed_messages:
            background_tasks.add_task(
                redis_client.setex,
                cache_key,
                300,  # 5 minutes TTL
                processed_messages
            )
            
        # Calculate and record metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        message_processing_latency.labels(
            operation="get_messages",
            status="success"
        ).observe(duration)
        
        return {
            "messages": processed_messages,
            "cursor": messages[-1].id if messages else None,
            "cached": False
        }
        
    except ValidationError as e:
        message_processing_latency.labels(
            operation="get_messages",
            status="validation_error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        raise HTTPException(status_code=422, detail=str(e))
        
    except FirestoreError as e:
        message_processing_latency.labels(
            operation="get_messages",
            status="database_error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        raise HTTPException(status_code=500, detail="Database error occurred")
        
    except Exception as e:
        message_processing_latency.labels(
            operation="get_messages",
            status="error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        logger.error(
            "Error retrieving messages",
            extra={
                "chat_id": chat_id,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post(
    "/",
    response_model=Dict[str, Any],
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def send_message(
    message_data: Dict[str, Any],
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Send a new message with AI integration and delivery tracking.
    
    Args:
        message_data: Message data including content and metadata
        background_tasks: Background tasks runner
        
    Returns:
        Dict containing created message details
        
    Raises:
        ValidationError: If message data is invalid
        WhatsAppError: If message delivery fails
        HTTPException: For other errors
    """
    start_time = datetime.utcnow()
    
    try:
        # Create message instance
        message = await Message.create({
            "chat_id": message_data["chat_id"],
            "type": message_data["type"],
            "direction": MessageDirection.OUTBOUND,
            "content": message_data["content"],
            "is_ai_generated": message_data.get("is_ai_generated", False),
            "ai_context": message_data.get("ai_context")
        })
        
        # Send message to WhatsApp in background
        background_tasks.add_task(
            send_whatsapp_message,
            message_data
        )
        
        # Record metrics
        message_delivery_counter.labels(status="initiated").inc()
        duration = (datetime.utcnow() - start_time).total_seconds()
        message_processing_latency.labels(
            operation="send_message",
            status="success"
        ).observe(duration)
        
        return {
            "message_id": message.id,
            "status": MessageStatus.QUEUED.value,
            "sent_at": message.sent_at.isoformat()
        }
        
    except ValidationError as e:
        message_processing_latency.labels(
            operation="send_message",
            status="validation_error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        raise HTTPException(status_code=422, detail=str(e))
        
    except WhatsAppError as e:
        message_processing_latency.labels(
            operation="send_message",
            status="delivery_error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        raise HTTPException(status_code=503, detail=str(e))
        
    except Exception as e:
        message_processing_latency.labels(
            operation="send_message",
            status="error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        logger.error(
            "Error sending message",
            extra={
                "message_data": message_data,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Internal server error")

@router.patch(
    "/{message_id}/status",
    response_model=Dict[str, Any],
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def update_message_status(
    message_id: str = Path(..., description="Message ID to update"),
    status: MessageStatus = Query(..., description="New message status"),
    failure_reason: Optional[str] = Query(None, description="Failure reason if applicable")
) -> Dict[str, Any]:
    """
    Update message delivery status with validation and monitoring.
    
    Args:
        message_id: Message identifier
        status: New message status
        failure_reason: Optional failure reason
        
    Returns:
        Dict containing updated status details
        
    Raises:
        ValidationError: If status update is invalid
        HTTPException: For other errors
    """
    start_time = datetime.utcnow()
    
    try:
        # Update message status
        success = await Message.update_status(
            message_id=message_id,
            status=status,
            failure_reason=failure_reason
        )
        
        if not success:
            raise ValidationError("Message not found or status update failed")
            
        # Record metrics
        message_delivery_counter.labels(status=status.value).inc()
        duration = (datetime.utcnow() - start_time).total_seconds()
        message_processing_latency.labels(
            operation="update_status",
            status="success"
        ).observe(duration)
        
        return {
            "message_id": message_id,
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except ValidationError as e:
        message_processing_latency.labels(
            operation="update_status",
            status="validation_error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        raise HTTPException(status_code=422, detail=str(e))
        
    except Exception as e:
        message_processing_latency.labels(
            operation="update_status",
            status="error"
        ).observe((datetime.utcnow() - start_time).total_seconds())
        logger.error(
            "Error updating message status",
            extra={
                "message_id": message_id,
                "status": status.value,
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Internal server error")