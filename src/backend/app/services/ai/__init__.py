"""
AI service initialization module for Porfin platform.

This module provides a unified interface for AI-powered virtual assistant capabilities
with enhanced async support, connection pooling, and performance optimizations.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import contextlib
from typing import Dict, List, Optional, Any, AsyncGenerator
from datetime import datetime

# Third-party imports - version specified
import openai  # v1.0.0
from prometheus_client import Counter, Histogram, Gauge

# Internal imports
from app.services.ai.gpt import GPTService
from app.services.ai.embeddings import EmbeddingService
from app.services.ai.intent_classifier import IntentClassifier
from app.services.ai.knowledge_base import KnowledgeBaseService
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Module configuration
logger = get_logger(__name__)

# Constants
VERSION = "1.0.0"
DEFAULT_POOL_SIZE = 10
MAX_RETRIES = 3
RETRY_DELAY = 0.1

# Prometheus metrics
METRICS_PREFIX = "porfin_ai_service"
ai_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total AI service operations",
    ["operation_type", "status"]
)
ai_latency = Histogram(
    f"{METRICS_PREFIX}_operation_latency_seconds",
    "AI operation latency",
    ["operation_type"]
)
ai_pool_size = Gauge(
    f"{METRICS_PREFIX}_connection_pool_size",
    "Size of AI service connection pool"
)

class AIServiceError(PorfinBaseException):
    """Custom exception for AI service operations."""
    
    def __init__(
        self,
        message: str,
        details: Dict = None,
        error_code: str = None,
        operation_id: str = None
    ) -> None:
        super().__init__(
            message=message,
            details=details,
            status_code=500,
            correlation_id=operation_id
        )
        self.error_code = error_code
        
        logger.error(
            f"AI service error: {message}",
            extra={
                "error_code": error_code,
                "operation_id": operation_id,
                "details": details
            }
        )

@contextlib.asynccontextmanager
class AIService:
    """Main service class that orchestrates all AI-related operations."""
    
    def __init__(self, pool_size: int = DEFAULT_POOL_SIZE, config: Dict[str, Any] = None):
        """Initialize AI service with connection pooling and configuration."""
        # Initialize service components
        self._gpt_service = GPTService()
        self._embedding_service = EmbeddingService()
        self._intent_classifier = IntentClassifier()
        self._knowledge_base_service = KnowledgeBaseService()
        
        # Initialize connection pool
        self._pool_lock = asyncio.Lock()
        self._connection_pool = {}
        self._pool_size = pool_size
        self._config = config or {}
        self._is_healthy = True
        
        # Update pool size metric
        ai_pool_size.set(pool_size)
        
        logger.info(
            "AI service initialized",
            extra={"pool_size": pool_size, "config": self._config}
        )

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self._cleanup_pool()

    async def _acquire_connection(self) -> Dict[str, Any]:
        """Acquire a connection from the pool with retry logic."""
        async with self._pool_lock:
            for _ in range(MAX_RETRIES):
                for conn_id, conn in self._connection_pool.items():
                    if not conn["in_use"]:
                        conn["in_use"] = True
                        return conn
                
                if len(self._connection_pool) < self._pool_size:
                    conn_id = f"conn_{len(self._connection_pool)}"
                    conn = {
                        "id": conn_id,
                        "in_use": True,
                        "created_at": datetime.utcnow()
                    }
                    self._connection_pool[conn_id] = conn
                    return conn
                
                await asyncio.sleep(RETRY_DELAY)
            
            raise AIServiceError(
                message="Failed to acquire connection from pool",
                error_code="POOL_EXHAUSTED"
            )

    async def _release_connection(self, conn: Dict[str, Any]) -> None:
        """Release a connection back to the pool."""
        async with self._pool_lock:
            if conn["id"] in self._connection_pool:
                self._connection_pool[conn["id"]]["in_use"] = False

    async def _cleanup_pool(self) -> None:
        """Cleanup connection pool resources."""
        async with self._pool_lock:
            self._connection_pool.clear()
            ai_pool_size.set(0)

    async def process_message(
        self,
        message: str,
        conversation_history: List[Dict],
        context: Dict,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """Process a user message through the complete AI pipeline."""
        start_time = datetime.now()
        conn = None
        
        try:
            # Acquire connection from pool
            conn = await self._acquire_connection()
            
            # Classify message intent
            intent_result = await asyncio.wait_for(
                self._intent_classifier.classify_intent(message, context),
                timeout=timeout
            )
            
            # Search knowledge base in parallel
            kb_task = asyncio.create_task(
                self._knowledge_base_service.search_knowledge_base(
                    message,
                    context.get("assistant_id"),
                    limit=3
                )
            )
            
            # Process message with GPT
            context.update({
                "intent": intent_result["intent"],
                "confidence": intent_result["confidence"],
                "entities": intent_result["entities"]
            })
            
            gpt_result = await self._gpt_service.generate_response(
                message,
                conversation_history,
                context
            )
            
            # Wait for knowledge base results
            kb_results = await kb_task
            
            # Calculate performance metrics
            duration = (datetime.now() - start_time).total_seconds()
            
            result = {
                "response": gpt_result,
                "intent": intent_result,
                "knowledge_base_results": kb_results,
                "performance": {
                    "total_time": duration,
                    "intent_time": intent_result["processing_time"]
                }
            }
            
            # Update metrics
            ai_operations.labels(
                operation_type="process_message",
                status="success"
            ).inc()
            ai_latency.labels(
                operation_type="process_message"
            ).observe(duration)
            
            return result
            
        except Exception as e:
            ai_operations.labels(
                operation_type="process_message",
                status="error"
            ).inc()
            raise AIServiceError(
                message="Failed to process message",
                details={"error": str(e)},
                error_code="PROCESSING_ERROR"
            )
        finally:
            if conn:
                await self._release_connection(conn)

    async def stream_response(
        self,
        message: str,
        conversation_history: List[Dict],
        context: Dict,
        timeout: Optional[float] = None
    ) -> AsyncGenerator[str, None]:
        """Stream AI response in real-time with enhanced error handling."""
        conn = None
        start_time = datetime.now()
        
        try:
            # Acquire connection
            conn = await self._acquire_connection()
            
            # Process intent and knowledge base in parallel
            intent_task = asyncio.create_task(
                self._intent_classifier.classify_intent(message, context)
            )
            kb_task = asyncio.create_task(
                self._knowledge_base_service.search_knowledge_base(
                    message,
                    context.get("assistant_id"),
                    limit=3
                )
            )
            
            # Wait for background tasks
            intent_result, kb_results = await asyncio.gather(intent_task, kb_task)
            
            # Update context with results
            context.update({
                "intent": intent_result["intent"],
                "knowledge_base": kb_results
            })
            
            # Stream GPT response
            async for chunk in self._gpt_service.stream_response(
                message,
                conversation_history,
                context,
                timeout
            ):
                yield chunk
            
            # Record metrics
            duration = (datetime.now() - start_time).total_seconds()
            ai_operations.labels(
                operation_type="stream_response",
                status="success"
            ).inc()
            ai_latency.labels(
                operation_type="stream_response"
            ).observe(duration)
            
        except Exception as e:
            ai_operations.labels(
                operation_type="stream_response",
                status="error"
            ).inc()
            raise AIServiceError(
                message="Failed to stream response",
                details={"error": str(e)},
                error_code="STREAMING_ERROR"
            )
        finally:
            if conn:
                await self._release_connection(conn)

    async def health_check(self) -> Dict[str, bool]:
        """Perform health check on all AI services."""
        try:
            health_status = {
                "gpt": await self._gpt_service.health_check(),
                "embeddings": self._embedding_service is not None,
                "intent_classifier": self._intent_classifier is not None,
                "knowledge_base": self._knowledge_base_service is not None,
                "pool": len(self._connection_pool) <= self._pool_size
            }
            
            self._is_healthy = all(health_status.values())
            return health_status
            
        except Exception as e:
            self._is_healthy = False
            raise AIServiceError(
                message="Health check failed",
                details={"error": str(e)},
                error_code="HEALTH_CHECK_ERROR"
            )

# Export version and service class
__all__ = ["AIService", "VERSION"]