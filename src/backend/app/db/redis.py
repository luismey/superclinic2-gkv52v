"""
Redis database client module for the Porfin platform.

This module provides secure, scalable Redis connection management and core caching operations
with comprehensive monitoring and error handling.

Version: 1.0.0
"""

# Standard library imports
import json
import zlib
from typing import Any, Dict, Optional, Union

# Third-party imports
import redis  # v4.5.0
from redis.asyncio import Redis as AsyncRedis  # v2.0.0
from cryptography.fernet import Fernet  # v3.4.0

# Internal imports
from app.config.settings import REDIS_HOST, REDIS_PORT
from app.core.logging import get_logger

# Configure module logger
logger = get_logger(__name__)

# Constants
CACHE_TTL = 3600  # Default cache TTL in seconds
COMPRESSION_THRESHOLD = 1024  # Bytes threshold for compression
MAX_POOL_SIZE = 100  # Maximum connections in pool
RETRY_ATTEMPTS = 3  # Number of retry attempts for Redis operations

def get_redis_client(ssl_config: Optional[Dict] = None) -> redis.Redis:
    """
    Get or create a Redis client instance with connection pooling and SSL/TLS support.

    Args:
        ssl_config: Optional SSL configuration dictionary

    Returns:
        Configured Redis client instance with connection pool

    Raises:
        redis.ConnectionError: If unable to establish connection
    """
    try:
        connection_pool = redis.ConnectionPool(
            host=REDIS_HOST,
            port=REDIS_PORT,
            max_connections=MAX_POOL_SIZE,
            retry_on_timeout=True,
            ssl=True if ssl_config else False,
            ssl_cert_reqs=ssl_config.get('cert_reqs') if ssl_config else None,
            ssl_ca_certs=ssl_config.get('ca_certs') if ssl_config else None,
            decode_responses=True
        )

        client = redis.Redis(
            connection_pool=connection_pool,
            socket_timeout=5.0,
            socket_connect_timeout=2.0,
            retry=redis.Retry(RETRY_ATTEMPTS)
        )

        # Test connection
        client.ping()
        logger.info("Successfully established Redis connection")
        return client

    except redis.ConnectionError as e:
        logger.error(f"Failed to establish Redis connection: {str(e)}")
        raise

async def get_async_redis_client(ssl_config: Optional[Dict] = None) -> AsyncRedis:
    """
    Get or create an async Redis client instance with connection pooling and SSL/TLS support.

    Args:
        ssl_config: Optional SSL configuration dictionary

    Returns:
        Configured async Redis client instance with connection pool

    Raises:
        redis.ConnectionError: If unable to establish connection
    """
    try:
        connection_pool = redis.asyncio.ConnectionPool(
            host=REDIS_HOST,
            port=REDIS_PORT,
            max_connections=MAX_POOL_SIZE,
            retry_on_timeout=True,
            ssl=True if ssl_config else False,
            ssl_cert_reqs=ssl_config.get('cert_reqs') if ssl_config else None,
            ssl_ca_certs=ssl_config.get('ca_certs') if ssl_config else None,
            decode_responses=True
        )

        client = AsyncRedis(
            connection_pool=connection_pool,
            socket_timeout=5.0,
            socket_connect_timeout=2.0,
            retry=redis.Retry(RETRY_ATTEMPTS)
        )

        # Test connection
        await client.ping()
        logger.info("Successfully established async Redis connection")
        return client

    except redis.ConnectionError as e:
        logger.error(f"Failed to establish async Redis connection: {str(e)}")
        raise

class RedisCache:
    """Redis cache manager with encryption, compression, and monitoring capabilities."""

    def __init__(self, ssl_config: Optional[Dict] = None, encryption_key: Optional[bytes] = None):
        """
        Initialize Redis cache manager with security and monitoring.

        Args:
            ssl_config: Optional SSL configuration dictionary
            encryption_key: Optional encryption key for sensitive data
        """
        self._client = get_redis_client(ssl_config)
        self._async_client = None  # Lazy initialization for async client
        self._cipher = Fernet(encryption_key) if encryption_key else None
        self._metrics = {
            'hits': 0,
            'misses': 0,
            'compression_savings': 0,
            'total_operations': 0
        }
        logger.info("Initialized RedisCache with encryption and monitoring")

    async def _get_async_client(self) -> AsyncRedis:
        """Lazy initialization of async Redis client."""
        if self._async_client is None:
            self._async_client = await get_async_redis_client(ssl_config=None)
        return self._async_client

    def _compress_value(self, value: str) -> tuple[bytes, bool]:
        """Compress value if it exceeds threshold."""
        encoded = value.encode('utf-8')
        if len(encoded) > COMPRESSION_THRESHOLD:
            compressed = zlib.compress(encoded)
            self._metrics['compression_savings'] += len(encoded) - len(compressed)
            return compressed, True
        return encoded, False

    def _decompress_value(self, value: bytes, is_compressed: bool) -> str:
        """Decompress value if it was compressed."""
        if is_compressed:
            return zlib.decompress(value).decode('utf-8')
        return value.decode('utf-8')

    async def get(self, key: str) -> Optional[Any]:
        """
        Get and decrypt value from cache with monitoring.

        Args:
            key: Cache key to retrieve

        Returns:
            Decrypted cached value or None

        Raises:
            redis.RedisError: If cache operation fails
        """
        try:
            self._metrics['total_operations'] += 1
            
            # Get value from Redis
            result = await (await self._get_async_client()).get(key)
            
            if result is None:
                self._metrics['misses'] += 1
                logger.debug(f"Cache miss for key: {key}")
                return None

            self._metrics['hits'] += 1
            
            # Parse metadata and value
            metadata, value = json.loads(result)
            
            # Decompress if needed
            if metadata.get('compressed'):
                value = self._decompress_value(value.encode('utf-8'), True)
            
            # Decrypt if needed
            if metadata.get('encrypted') and self._cipher:
                value = self._cipher.decrypt(value.encode('utf-8')).decode('utf-8')
            
            # Deserialize
            return json.loads(value)

        except redis.RedisError as e:
            logger.error(f"Cache get operation failed for key {key}: {str(e)}")
            raise

    async def set(self, key: str, value: Any, ttl: int = CACHE_TTL) -> bool:
        """
        Encrypt and set value in cache with compression.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds

        Returns:
            Success status

        Raises:
            redis.RedisError: If cache operation fails
        """
        try:
            self._metrics['total_operations'] += 1
            
            # Serialize value
            serialized = json.dumps(value)
            
            # Compress if needed
            compressed_value, is_compressed = self._compress_value(serialized)
            
            # Encrypt if cipher available
            if self._cipher:
                compressed_value = self._cipher.encrypt(compressed_value)
                is_encrypted = True
            else:
                is_encrypted = False
            
            # Prepare metadata
            metadata = {
                'compressed': is_compressed,
                'encrypted': is_encrypted,
                'timestamp': json.dumps(value)
            }
            
            # Store with metadata
            cache_value = json.dumps([metadata, compressed_value.decode('utf-8')])
            
            # Set in Redis with TTL
            return await (await self._get_async_client()).setex(key, ttl, cache_value)

        except redis.RedisError as e:
            logger.error(f"Cache set operation failed for key {key}: {str(e)}")
            raise

    def get_metrics(self) -> Dict[str, Union[int, float]]:
        """
        Retrieve cache performance metrics.

        Returns:
            Dictionary containing cache metrics
        """
        total = self._metrics['hits'] + self._metrics['misses']
        hit_ratio = self._metrics['hits'] / total if total > 0 else 0
        
        return {
            'hit_ratio': hit_ratio,
            'hits': self._metrics['hits'],
            'misses': self._metrics['misses'],
            'compression_savings_bytes': self._metrics['compression_savings'],
            'total_operations': self._metrics['total_operations']
        }

__all__ = ['RedisCache', 'get_redis_client', 'get_async_redis_client']