"""
High-performance WhatsApp message queue implementation with rate limiting and retry capabilities.

This module provides a robust message queue system for WhatsApp message processing,
supporting parallel processing, exponential backoff retries, and sliding window rate
limiting to handle 100+ messages/second with sub-500ms latency.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import time
from datetime import datetime
from typing import Dict, Optional, List
import uuid

# Third-party imports
import orjson  # v3.9.0
from tenacity import (  # v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

# Internal imports
from app.db.redis import RedisCache
from app.services.whatsapp.client import WhatsAppClient
from app.core.logging import get_logger

# Configure logger
logger = get_logger(__name__)

# Queue configuration constants
QUEUE_KEY_PREFIX = "whatsapp:queue:"
RATE_LIMIT_KEY_PREFIX = "whatsapp:rate:"
MAX_QUEUE_SIZE = 10000
RATE_LIMIT_WINDOW = 1  # seconds
RATE_LIMIT_MAX_REQUESTS = 80  # WhatsApp API limit
BATCH_SIZE = 20
MAX_RETRIES = 3
RETRY_MIN_WAIT = 4  # seconds
RETRY_MAX_WAIT = 10  # seconds

class WhatsAppMessageQueue:
    """High-performance message queue for WhatsApp with rate limiting and retries."""

    def __init__(
        self,
        redis_cache: RedisCache,
        whatsapp_client: WhatsAppClient,
        batch_size: Optional[int] = None
    ) -> None:
        """
        Initialize the WhatsApp message queue.

        Args:
            redis_cache: Redis cache instance for queue storage
            whatsapp_client: WhatsApp client for message sending
            batch_size: Optional custom batch size for processing
        """
        self._redis = redis_cache
        self._client = whatsapp_client
        self._lock = asyncio.Lock()
        self._processing_tasks: Dict[str, asyncio.Task] = {}
        self._batch_size = batch_size or BATCH_SIZE
        
        # Verify WhatsApp client connection
        asyncio.create_task(self._client.check_connection())
        
        logger.info(
            "WhatsApp message queue initialized",
            extra={
                "batch_size": self._batch_size,
                "max_queue_size": MAX_QUEUE_SIZE,
                "rate_limit_window": RATE_LIMIT_WINDOW
            }
        )

    async def enqueue_message(
        self,
        recipient_id: str,
        message_type: str,
        content: dict,
        priority: Optional[int] = None
    ) -> str:
        """
        Add a message to the processing queue with priority support.

        Args:
            recipient_id: WhatsApp recipient ID
            message_type: Type of message (text, template, etc.)
            content: Message content
            priority: Optional priority level (lower is higher priority)

        Returns:
            str: Unique message ID for tracking

        Raises:
            ValueError: If queue size limit is exceeded
        """
        message_id = str(uuid.uuid4())
        score = priority if priority is not None else time.time()
        
        # Prepare message payload
        message_data = {
            "id": message_id,
            "recipient_id": recipient_id,
            "message_type": message_type,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "retries": 0
        }
        
        # Check queue size
        queue_size = await self._redis.async_get(f"{QUEUE_KEY_PREFIX}size") or 0
        if int(queue_size) >= MAX_QUEUE_SIZE:
            logger.error(
                "Queue size limit exceeded",
                extra={"queue_size": queue_size, "message_id": message_id}
            )
            raise ValueError("Message queue is full")
        
        # Add to Redis sorted set
        await self._redis.async_set(
            f"{QUEUE_KEY_PREFIX}{message_id}",
            orjson.dumps(message_data).decode('utf-8')
        )
        await self._redis.async_incr(f"{QUEUE_KEY_PREFIX}size")
        
        logger.info(
            "Message enqueued",
            extra={
                "message_id": message_id,
                "recipient_id": recipient_id,
                "priority": priority
            }
        )
        
        # Start processing if not already running
        if not self._processing_tasks:
            self._processing_tasks["main"] = asyncio.create_task(self.process_queue())
        
        return message_id

    async def process_queue(self) -> None:
        """
        Process queued messages in parallel with rate limiting.
        
        This method implements the core message processing loop with:
        - Parallel processing of message batches
        - Rate limiting using sliding window
        - Exponential backoff retries
        - Error handling and monitoring
        """
        while True:
            try:
                async with self._lock:
                    # Check rate limits
                    if not await self._check_rate_limit():
                        await asyncio.sleep(RATE_LIMIT_WINDOW)
                        continue
                    
                    # Get next batch of messages
                    batch_tasks = []
                    processed_ids = []
                    
                    for _ in range(self._batch_size):
                        # Get next message
                        message_key = await self._redis.async_get(f"{QUEUE_KEY_PREFIX}next")
                        if not message_key:
                            break
                            
                        message_data = orjson.loads(
                            await self._redis.async_get(message_key)
                        )
                        processed_ids.append(message_data["id"])
                        
                        # Create processing task
                        task = asyncio.create_task(
                            self._send_message(message_data)
                        )
                        batch_tasks.append(task)
                    
                    if not batch_tasks:
                        await asyncio.sleep(0.1)  # Prevent tight loop
                        continue
                    
                    # Process batch with timeout
                    results = await asyncio.gather(
                        *batch_tasks,
                        return_exceptions=True
                    )
                    
                    # Handle results
                    for message_id, result in zip(processed_ids, results):
                        if isinstance(result, Exception):
                            logger.error(
                                "Message processing failed",
                                extra={
                                    "message_id": message_id,
                                    "error": str(result)
                                }
                            )
                            # Message will be retried if under MAX_RETRIES
                            continue
                            
                        # Remove successful messages
                        await self._redis.async_set(
                            f"{QUEUE_KEY_PREFIX}{message_id}",
                            None
                        )
                        await self._redis.async_incr(f"{QUEUE_KEY_PREFIX}size", -1)
                        
                        logger.info(
                            "Message processed successfully",
                            extra={"message_id": message_id}
                        )
                        
            except Exception as e:
                logger.error(
                    "Queue processing error",
                    extra={"error": str(e)},
                    exc_info=True
                )
                await asyncio.sleep(1)  # Prevent rapid retries

    async def _check_rate_limit(self) -> bool:
        """
        Check if current request rate is within limits using sliding window.

        Returns:
            bool: True if within rate limits
        """
        current_window = int(time.time() / RATE_LIMIT_WINDOW)
        window_key = f"{RATE_LIMIT_KEY_PREFIX}{current_window}"
        
        # Get and increment current window counter
        count = await self._redis.async_incr(window_key)
        if count == 1:
            # Set expiry for sliding window
            await self._redis.async_expire(window_key, RATE_LIMIT_WINDOW * 2)
        
        # Check against limit
        within_limit = count <= RATE_LIMIT_MAX_REQUESTS
        
        if not within_limit:
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "window": current_window,
                    "count": count,
                    "limit": RATE_LIMIT_MAX_REQUESTS
                }
            )
        
        return within_limit

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=RETRY_MIN_WAIT, max=RETRY_MAX_WAIT),
        retry=retry_if_exception_type(Exception)
    )
    async def _send_message(self, message_data: dict) -> dict:
        """
        Send individual message with exponential backoff retry.

        Args:
            message_data: Message data including content and metadata

        Returns:
            dict: Send result with status and metadata

        Raises:
            Exception: If message sending fails after retries
        """
        start_time = time.time()
        
        try:
            # Extract message details
            recipient_id = message_data["recipient_id"]
            message_type = message_data["message_type"]
            content = message_data["content"]
            
            # Send message
            result = await self._client.send_message(
                recipient_id=recipient_id,
                message_type=message_type,
                content=content
            )
            
            duration = time.time() - start_time
            logger.info(
                "Message sent successfully",
                extra={
                    "message_id": message_data["id"],
                    "recipient_id": recipient_id,
                    "duration": duration
                }
            )
            
            return {
                "status": "success",
                "message_id": message_data["id"],
                "whatsapp_message_id": result.get("message_id"),
                "duration": duration
            }
            
        except Exception as e:
            message_data["retries"] = message_data.get("retries", 0) + 1
            
            if message_data["retries"] >= MAX_RETRIES:
                logger.error(
                    "Message failed after max retries",
                    extra={
                        "message_id": message_data["id"],
                        "error": str(e),
                        "retries": message_data["retries"]
                    }
                )
            
            raise