"""
Core GPT service module for AI-powered virtual assistant functionality.

This module provides enterprise-grade integration with OpenAI's GPT-4 model,
including context management, prompt engineering, response generation, and
validation with comprehensive error handling and performance optimization.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from functools import lru_cache

# Third-party imports
import openai  # v1.0.0
import tiktoken  # v0.5.0
from tenacity import (  # v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import langdetect  # v1.0.9
import redis  # v4.0.0
from prometheus_client import Counter, Histogram, Gauge

# Internal imports
from app.core.logging import get_logger
from app.config.settings import settings
from app.services.ai.knowledge_base import KnowledgeBaseService
from app.core.exceptions import PorfinBaseException

# Module configuration
logger = get_logger(__name__)

# Constants
MAX_TOKENS = 4096
TEMPERATURE = 0.7
SYSTEM_PROMPT = """
Você é um assistente profissional de saúde ajudando a gerenciar comunicações 
com pacientes em português brasileiro. Mantenha um tom profissional e empático,
seguindo todas as diretrizes de privacidade e regulamentações de saúde.
"""

# Retry configuration
RETRY_CONFIG = {
    "wait": wait_exponential(multiplier=1, min=4, max=10),
    "stop": stop_after_attempt(3),
    "retry": retry_if_exception_type(openai.APIError)
}

# Cache configuration
CACHE_TTL = 300  # 5 minutes

# Prometheus metrics
METRICS_PREFIX = "porfin_gpt"
gpt_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total GPT operations",
    ["operation_type", "status"]
)
gpt_latency = Histogram(
    f"{METRICS_PREFIX}_operation_latency_seconds",
    "GPT operation latency",
    ["operation_type"]
)
gpt_tokens = Counter(
    f"{METRICS_PREFIX}_tokens_total",
    "Total tokens processed",
    ["operation_type"]
)

class GPTError(PorfinBaseException):
    """Custom exception for GPT-related errors."""
    
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
            f"GPT error: {message}",
            extra={
                "error_code": error_code,
                "operation_id": operation_id,
                "details": details
            }
        )

class GPTService:
    """Service for managing GPT model interactions with optimization and monitoring."""
    
    _instance = None
    
    def __new__(cls):
        """Ensure singleton instance."""
        if cls._instance is None:
            cls._instance = super(GPTService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize GPT service with configuration and monitoring."""
        if not hasattr(self, '_initialized'):
            # Initialize OpenAI client
            self._api_key = settings.OPENAI_API_KEY
            openai.api_key = self._api_key
            
            # Initialize services
            self._knowledge_base = KnowledgeBaseService()
            
            # Initialize Redis cache
            self._cache = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                ssl=settings.REDIS_SSL_ENABLED,
                decode_responses=True
            )
            
            # Initialize performance tracking
            self._performance_metrics = {
                "total_requests": 0,
                "cache_hits": 0,
                "average_latency": 0
            }
            
            self._initialized = True
            logger.info("GPT service initialized")
    
    @staticmethod
    @lru_cache(maxsize=1000)
    def count_tokens(text: str) -> int:
        """Count tokens in text using tiktoken with caching."""
        try:
            encoder = tiktoken.encoding_for_model("gpt-4")
            return len(encoder.encode(text))
        except Exception as e:
            logger.error(f"Token counting error: {str(e)}")
            return len(text.split()) * 2  # Fallback approximation
    
    @staticmethod
    def truncate_context(
        messages: List[Dict],
        max_tokens: int = MAX_TOKENS - 1000
    ) -> List[Dict]:
        """Truncate conversation history to fit within token limits."""
        if not messages:
            return []
        
        # Ensure system prompt remains
        system_msg = next(
            (msg for msg in messages if msg.get("role") == "system"),
            {"role": "system", "content": SYSTEM_PROMPT}
        )
        
        # Sort messages by importance and recency
        other_msgs = [
            msg for msg in messages 
            if msg.get("role") != "system"
        ]
        other_msgs.reverse()  # Most recent first
        
        truncated = [system_msg]
        current_tokens = GPTService.count_tokens(system_msg["content"])
        
        for msg in other_msgs:
            msg_tokens = GPTService.count_tokens(msg["content"])
            if current_tokens + msg_tokens <= max_tokens:
                truncated.append(msg)
                current_tokens += msg_tokens
            else:
                break
        
        return list(reversed(truncated))
    
    async def build_context(
        self,
        message: str,
        context: Dict[str, Any]
    ) -> str:
        """Build optimized context for GPT model from various sources."""
        try:
            # Get relevant knowledge base information
            kb_results = await self._knowledge_base.search_knowledge_base(
                query=message,
                assistant_id=context.get("assistant_id"),
                limit=3
            )
            
            # Format context components
            kb_context = "\n".join([
                f"Informação relevante: {result['text']}"
                for result in kb_results
            ])
            
            user_context = f"""
            Perfil do profissional:
            - Especialidade: {context.get('specialty', 'Não especificada')}
            - Tipo de prática: {context.get('practice_type', 'Não especificada')}
            
            Contexto do paciente:
            - Histórico: {context.get('patient_history', 'Não disponível')}
            - Última interação: {context.get('last_interaction', 'Primeira interação')}
            """
            
            # Combine context elements
            full_context = f"{SYSTEM_PROMPT}\n\n{user_context}\n\n{kb_context}"
            
            return full_context
            
        except Exception as e:
            raise GPTError(
                message="Failed to build context",
                details={"error": str(e)},
                error_code="CONTEXT_BUILD_ERROR"
            )
    
    def validate_response(self, response_text: str) -> str:
        """Validate and clean GPT response with language checking."""
        try:
            # Check response length
            if not response_text or len(response_text.strip()) < 10:
                raise GPTError(
                    message="Response too short",
                    error_code="VALIDATION_ERROR"
                )
            
            # Validate Portuguese language
            try:
                lang = langdetect.detect(response_text)
                if lang != "pt":
                    raise GPTError(
                        message=f"Invalid language detected: {lang}",
                        error_code="LANGUAGE_ERROR"
                    )
            except langdetect.LangDetectException as e:
                logger.warning(f"Language detection failed: {str(e)}")
            
            # Clean formatting
            response_text = response_text.strip()
            response_text = response_text.replace("\n\n\n", "\n\n")
            
            return response_text
            
        except Exception as e:
            if not isinstance(e, GPTError):
                raise GPTError(
                    message="Response validation failed",
                    details={"error": str(e)},
                    error_code="VALIDATION_ERROR"
                )
            raise e
    
    @retry(**RETRY_CONFIG)
    async def generate_response(
        self,
        message: str,
        conversation_history: List[Dict],
        context: Dict[str, Any]
    ) -> str:
        """Generate AI response for user message with optimizations."""
        start_time = datetime.now()
        
        try:
            # Check cache
            cache_key = f"gpt_response:{hash(message)}:{hash(str(context))}"
            cached_response = self._cache.get(cache_key)
            if cached_response:
                self._performance_metrics["cache_hits"] += 1
                gpt_operations.labels(
                    operation_type="cache_hit",
                    status="success"
                ).inc()
                return cached_response
            
            # Build context and prepare messages
            context_text = await self.build_context(message, context)
            messages = [
                {"role": "system", "content": context_text},
                *conversation_history,
                {"role": "user", "content": message}
            ]
            
            # Truncate context if needed
            messages = self.truncate_context(messages)
            
            # Call GPT-4 API
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=messages,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                top_p=0.9,
                frequency_penalty=0.6,
                presence_penalty=0.1
            )
            
            # Extract and validate response
            response_text = response.choices[0].message.content
            validated_response = self.validate_response(response_text)
            
            # Cache valid response
            self._cache.setex(
                cache_key,
                CACHE_TTL,
                validated_response
            )
            
            # Update metrics
            duration = (datetime.now() - start_time).total_seconds()
            self._performance_metrics["total_requests"] += 1
            self._performance_metrics["average_latency"] = (
                (self._performance_metrics["average_latency"] * 
                 (self._performance_metrics["total_requests"] - 1) +
                 duration) / self._performance_metrics["total_requests"]
            )
            
            gpt_operations.labels(
                operation_type="generate",
                status="success"
            ).inc()
            gpt_latency.labels(
                operation_type="generate"
            ).observe(duration)
            gpt_tokens.labels(
                operation_type="total"
            ).inc(self.count_tokens(str(messages) + validated_response))
            
            return validated_response
            
        except Exception as e:
            gpt_operations.labels(
                operation_type="generate",
                status="error"
            ).inc()
            if not isinstance(e, GPTError):
                raise GPTError(
                    message="Failed to generate response",
                    details={"error": str(e)},
                    error_code="GENERATION_ERROR"
                )
            raise e

# Export service class
__all__ = ["GPTService"]