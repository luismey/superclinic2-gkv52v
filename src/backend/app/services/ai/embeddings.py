"""
Enhanced embedding service module for Porfin platform.

This module provides optimized text embedding generation and similarity search capabilities
using OpenAI's embedding models with advanced caching, batching, and security features.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime

# Third-party imports - version specified as per IE2
import numpy as np  # numpy v1.24.0
import openai  # openai v1.0.0
from tenacity import (  # tenacity v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import redis  # redis v4.5.0
from prometheus_client import Counter, Histogram, Gauge

# Internal imports
from app.core.logging import get_logger
from app.db.firestore import FirestoreClient
from app.core.exceptions import PorfinBaseException

# Module configuration
logger = get_logger(__name__)

# Constants
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536
COLLECTION_NAME = "embeddings"
MAX_SEARCH_RESULTS = 5
BATCH_SIZE = 100
CACHE_TTL = 3600  # 1 hour
MAX_RETRIES = 3
RETRY_DELAY = 1

# Prometheus metrics
METRICS_PREFIX = "porfin_embeddings"
embedding_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total embedding operations",
    ["operation_type", "status"]
)
embedding_latency = Histogram(
    f"{METRICS_PREFIX}_operation_latency_seconds",
    "Embedding operation latency",
    ["operation_type"]
)
embedding_cache_hits = Counter(
    f"{METRICS_PREFIX}_cache_hits_total",
    "Total embedding cache hits"
)

class EmbeddingError(PorfinBaseException):
    """Custom exception for embedding-related errors with enhanced tracking."""
    
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
        
        # Log error with context
        logger.error(
            f"Embedding error: {message}",
            extra={
                "error_code": error_code,
                "operation_id": operation_id,
                "details": details
            }
        )

class EmbeddingService:
    """Enhanced service for managing text embeddings with advanced features."""
    
    _instance = None
    
    def __new__(cls):
        """Ensure singleton instance."""
        if cls._instance is None:
            cls._instance = super(EmbeddingService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize service with enhanced clients and monitoring."""
        if not hasattr(self, '_initialized'):
            # Initialize OpenAI client
            self._openai_client = openai.Client()
            
            # Initialize Firestore client
            self._db_client = FirestoreClient()
            
            # Initialize Redis cache
            self._cache_client = redis.Redis(
                host="localhost",
                port=6379,
                db=0,
                decode_responses=True
            )
            
            # Initialize rate limiter
            self._rate_limiter = {}
            
            self._initialized = True
            logger.info("Embedding service initialized")
    
    @staticmethod
    @np.vectorize
    def cosine_similarity(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
        """
        Calculate optimized cosine similarity between vectors.
        
        Args:
            vector_a: First embedding vector
            vector_b: Second embedding vector
            
        Returns:
            float: Similarity score between 0 and 1
        """
        try:
            # Validate dimensions
            if vector_a.shape != vector_b.shape:
                raise ValueError("Vector dimensions do not match")
                
            # Calculate similarity using optimized numpy operations
            dot_product = np.dot(vector_a, vector_b)
            norm_a = np.linalg.norm(vector_a)
            norm_b = np.linalg.norm(vector_b)
            
            # Handle zero division
            if norm_a == 0 or norm_b == 0:
                return 0.0
                
            return float(dot_product / (norm_a * norm_b))
            
        except Exception as e:
            logger.error(f"Similarity calculation error: {str(e)}")
            return 0.0
    
    def _get_cache_key(self, text: str, category: str) -> str:
        """Generate secure cache key for embeddings."""
        return f"embedding:{category}:{hash(text)}"
    
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY),
        retry=retry_if_exception_type(openai.APIError)
    )
    async def generate_embedding(
        self,
        text: str,
        category: str,
        use_cache: bool = True
    ) -> np.ndarray:
        """
        Generate embedding vector with enhanced caching and security.
        
        Args:
            text: Input text for embedding
            category: Content category for organization
            use_cache: Whether to use cache
            
        Returns:
            numpy.ndarray: Generated embedding vector
            
        Raises:
            EmbeddingError: If embedding generation fails
        """
        start_time = datetime.now()
        cache_key = self._get_cache_key(text, category)
        
        try:
            # Check cache if enabled
            if use_cache:
                cached_vector = self._cache_client.get(cache_key)
                if cached_vector:
                    embedding_cache_hits.inc()
                    return np.frombuffer(cached_vector, dtype=np.float32)
            
            # Generate embedding
            response = await self._openai_client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text
            )
            
            # Convert to numpy array
            vector = np.array(response.data[0].embedding, dtype=np.float32)
            
            # Store in cache if enabled
            if use_cache:
                self._cache_client.setex(
                    cache_key,
                    CACHE_TTL,
                    vector.tobytes()
                )
            
            # Record metrics
            duration = (datetime.now() - start_time).total_seconds()
            embedding_operations.labels(
                operation_type="generate",
                status="success"
            ).inc()
            embedding_latency.labels(
                operation_type="generate"
            ).observe(duration)
            
            return vector
            
        except Exception as e:
            embedding_operations.labels(
                operation_type="generate",
                status="error"
            ).inc()
            raise EmbeddingError(
                message="Failed to generate embedding",
                details={"error": str(e)},
                error_code="EMBEDDING_GENERATION_ERROR"
            )
    
    async def batch_generate_embeddings(
        self,
        texts: List[str],
        category: str,
        batch_size: int = BATCH_SIZE
    ) -> List[np.ndarray]:
        """
        Generate embeddings for multiple texts with optimized batching.
        
        Args:
            texts: List of input texts
            category: Content category
            batch_size: Size of processing batches
            
        Returns:
            List[numpy.ndarray]: List of embedding vectors
        """
        results = []
        
        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            tasks = [
                self.generate_embedding(text, category)
                for text in batch
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle any failures
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Batch embedding error: {str(result)}")
                    results.append(None)
                else:
                    results.append(result)
        
        return results
    
    async def search_similar(
        self,
        query_embedding: np.ndarray,
        category: str,
        limit: int = MAX_SEARCH_RESULTS,
        similarity_threshold: float = 0.7
    ) -> List[Dict]:
        """
        Find similar texts using vector similarity search.
        
        Args:
            query_embedding: Query vector
            category: Content category to search
            limit: Maximum number of results
            similarity_threshold: Minimum similarity score
            
        Returns:
            List[Dict]: Similar texts with scores and metadata
        """
        try:
            # Query stored embeddings
            stored_embeddings = await self._db_client.query_documents(
                COLLECTION_NAME,
                filters={"category": category}
            )
            
            # Calculate similarities
            similarities = []
            for doc in stored_embeddings:
                vector = np.array(doc.get("vector"), dtype=np.float32)
                score = self.cosine_similarity(query_embedding, vector)
                
                if score >= similarity_threshold:
                    similarities.append({
                        "text": doc.get("text"),
                        "score": float(score),
                        "metadata": doc.get("metadata", {}),
                        "category": category
                    })
            
            # Sort by similarity score
            similarities.sort(key=lambda x: x["score"], reverse=True)
            
            return similarities[:limit]
            
        except Exception as e:
            raise EmbeddingError(
                message="Failed to search similar embeddings",
                details={"error": str(e)},
                error_code="SIMILARITY_SEARCH_ERROR"
            )

# Export service class
__all__ = ["EmbeddingService"]