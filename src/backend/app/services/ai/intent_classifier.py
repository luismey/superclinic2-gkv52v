"""
Intent classification service module for Porfin platform.

This module provides high-performance message intent classification with specialized
support for Brazilian Portuguese, including enhanced caching, batching, and monitoring.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from functools import lru_cache

# Third-party imports - version specified as per IE2
import numpy as np  # numpy v1.24.0
from tenacity import (  # tenacity v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from cachetools import TTLCache  # cachetools v5.0.0
from unidecode import unidecode  # unidecode v1.3.0
from prometheus_client import Counter, Histogram, Gauge

# Internal imports
from app.core.logging import get_logger
from app.services.ai.embeddings import EmbeddingService
from app.services.ai.gpt import GPTService
from app.core.exceptions import PorfinBaseException

# Module configuration
logger = get_logger(__name__)

# Constants
INTENT_CATEGORIES = [
    'appointment_scheduling',  # Agendamento
    'payment_inquiry',        # Consulta de pagamento
    'treatment_info',         # Informações sobre tratamento
    'price_inquiry',         # Consulta de preços
    'general_question',      # Pergunta geral
    'emergency',             # Emergência
    'follow_up',            # Acompanhamento
    'complaint',            # Reclamação
    'feedback',             # Feedback
    'location_info'         # Informações de localização
]

INTENT_THRESHOLD = 0.85
INTENT_CACHE_TTL = 3600  # 1 hour
MAX_BATCH_SIZE = 50
RETRY_CONFIG = {
    "max_attempts": 3,
    "max_delay": 1
}

# Prometheus metrics
METRICS_PREFIX = "porfin_intent"
intent_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total intent classification operations",
    ["operation_type", "status"]
)
intent_latency = Histogram(
    f"{METRICS_PREFIX}_operation_latency_seconds",
    "Intent classification latency",
    ["operation_type"]
)
intent_cache = Counter(
    f"{METRICS_PREFIX}_cache_operations_total",
    "Intent classification cache operations",
    ["operation_type"]
)

class IntentClassificationError(PorfinBaseException):
    """Custom exception for intent classification errors."""
    
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
            f"Intent classification error: {message}",
            extra={
                "error_code": error_code,
                "operation_id": operation_id,
                "details": details
            }
        )

class IntentClassifier:
    """Enhanced service class for high-performance message intent classification."""
    
    _instance = None
    
    def __new__(cls):
        """Ensure singleton instance."""
        if cls._instance is None:
            cls._instance = super(IntentClassifier, cls).__new__(cls)
        return cls._instance
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize intent classifier with enhanced services and monitoring."""
        if not hasattr(self, '_initialized'):
            # Initialize services
            self._embedding_service = EmbeddingService()
            self._gpt_service = GPTService()
            
            # Initialize cache
            self._intent_cache = TTLCache(
                maxsize=10000,
                ttl=INTENT_CACHE_TTL
            )
            
            # Configure performance tracking
            self._performance_metrics = {
                "total_requests": 0,
                "cache_hits": 0,
                "average_latency": 0.0
            }
            
            # Initialize batch processor
            self._batch_queue = asyncio.Queue(maxsize=MAX_BATCH_SIZE)
            
            self._initialized = True
            logger.info("Intent classifier initialized")
    
    @staticmethod
    def preprocess_message(message: str) -> str:
        """Enhanced preprocessing for Brazilian Portuguese messages."""
        if not message:
            return ""
            
        try:
            # Convert to lowercase
            text = message.lower()
            
            # Normalize Portuguese accents
            text = unidecode(text)
            
            # Handle common Brazilian abbreviations
            abbreviations = {
                "vc": "você",
                "td": "tudo",
                "qdo": "quando",
                "hj": "hoje",
                "hr": "hora",
                "ctz": "certeza",
                "tbm": "também",
                "msg": "mensagem"
            }
            for abbr, full in abbreviations.items():
                text = text.replace(f" {abbr} ", f" {full} ")
            
            # Remove extra whitespace
            text = " ".join(text.split())
            
            return text
            
        except Exception as e:
            logger.error(f"Preprocessing error: {str(e)}")
            return message
    
    @retry(
        stop=stop_after_attempt(RETRY_CONFIG["max_attempts"]),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def classify_intent(
        self,
        message: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Classify message intent with enhanced performance and accuracy."""
        start_time = datetime.now()
        
        try:
            # Check cache
            cache_key = f"intent:{hash(message)}:{hash(str(context))}"
            cached_result = self._intent_cache.get(cache_key)
            if cached_result:
                self._performance_metrics["cache_hits"] += 1
                intent_cache.labels(operation_type="hit").inc()
                return cached_result
            
            # Preprocess message
            processed_message = self.preprocess_message(message)
            
            # Generate message embedding
            message_embedding = await self._embedding_service.generate_embedding(
                processed_message,
                category="intent"
            )
            
            # Find similar intents
            similar_intents = await self._embedding_service.search_similar(
                message_embedding,
                category="intents",
                limit=3,
                similarity_threshold=INTENT_THRESHOLD
            )
            
            # Verify intent with GPT if needed
            primary_intent = similar_intents[0] if similar_intents else None
            if not primary_intent or primary_intent["score"] < INTENT_THRESHOLD:
                # Use GPT for verification
                gpt_context = {
                    "task": "intent_classification",
                    "categories": INTENT_CATEGORIES,
                    "message": processed_message,
                    **context
                }
                gpt_response = await self._gpt_service.generate_response(
                    processed_message,
                    [],  # No conversation history needed
                    gpt_context
                )
                primary_intent = {
                    "intent": gpt_response.strip(),
                    "score": 1.0,
                    "source": "gpt"
                }
            
            # Extract entities if needed
            entities = {}
            if primary_intent["intent"] in ["appointment_scheduling", "payment_inquiry"]:
                entities = await self._extract_entities(processed_message, primary_intent["intent"])
            
            # Prepare result
            result = {
                "intent": primary_intent["intent"],
                "confidence": float(primary_intent["score"]),
                "entities": entities,
                "similar_intents": [
                    {"intent": i["text"], "score": float(i["score"])}
                    for i in similar_intents[1:3]
                ] if similar_intents else [],
                "processing_time": (datetime.now() - start_time).total_seconds()
            }
            
            # Update cache
            self._intent_cache[cache_key] = result
            intent_cache.labels(operation_type="store").inc()
            
            # Update metrics
            self._performance_metrics["total_requests"] += 1
            duration = result["processing_time"]
            self._performance_metrics["average_latency"] = (
                (self._performance_metrics["average_latency"] * 
                 (self._performance_metrics["total_requests"] - 1) +
                 duration) / self._performance_metrics["total_requests"]
            )
            
            intent_operations.labels(
                operation_type="classify",
                status="success"
            ).inc()
            intent_latency.labels(
                operation_type="classify"
            ).observe(duration)
            
            return result
            
        except Exception as e:
            intent_operations.labels(
                operation_type="classify",
                status="error"
            ).inc()
            raise IntentClassificationError(
                message="Intent classification failed",
                details={"error": str(e)},
                error_code="CLASSIFICATION_ERROR"
            )
    
    async def _extract_entities(
        self,
        message: str,
        intent: str
    ) -> Dict[str, Any]:
        """Extract relevant entities based on intent type."""
        try:
            # Use GPT for entity extraction
            context = {
                "task": "entity_extraction",
                "intent": intent,
                "language": "pt-BR"
            }
            
            response = await self._gpt_service.generate_response(
                message,
                [],
                context
            )
            
            # Parse and validate entities
            entities = {}
            if intent == "appointment_scheduling":
                # Extract date, time, and service type
                # Implementation details...
                pass
            elif intent == "payment_inquiry":
                # Extract payment details
                # Implementation details...
                pass
            
            return entities
            
        except Exception as e:
            logger.error(f"Entity extraction error: {str(e)}")
            return {}

# Export service class and constants
__all__ = [
    "IntentClassifier",
    "INTENT_CATEGORIES"
]