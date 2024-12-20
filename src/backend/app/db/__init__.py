"""
Database initialization module for the Porfin platform.

This module provides secure, monitored, and high-performance global access to Firestore
and Redis database clients with comprehensive error handling, monitoring, and security features.

Version: 1.0.0
"""

# Standard library imports
import threading
from typing import Tuple, Optional

# Third-party imports
from tenacity import retry, stop_after_attempt  # v8.0.1

# Internal imports
from app.db.firestore import FirestoreClient
from app.db.redis import RedisClient, get_redis_client
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError

# Configure module logger with security context
logger = get_logger(__name__)

# Global database client instances with thread-safe initialization
_lock = threading.Lock()
firestore_client: Optional[FirestoreClient] = None
redis_client: Optional[RedisClient] = None

@retry(stop=stop_after_attempt(3))
def get_firestore() -> FirestoreClient:
    """
    Get or create thread-safe singleton instance of FirestoreClient with monitoring
    and security features.

    Returns:
        FirestoreClient: Configured Firestore client instance with enhanced monitoring

    Raises:
        DatabaseError: If client initialization fails after retries
    """
    global firestore_client

    try:
        with _lock:
            if firestore_client is None:
                logger.info("Initializing Firestore client with security monitoring")
                firestore_client = FirestoreClient()
                
                # Validate connection
                firestore_client.get_collection("health_check").limit(1).get()
                logger.info("Successfully initialized Firestore client")

            return firestore_client

    except Exception as e:
        logger.error(
            "Failed to initialize Firestore client",
            extra={
                "error": str(e),
                "retry_count": 3,
                "service": "firestore"
            }
        )
        raise DatabaseError(
            message="Failed to initialize Firestore client",
            details={"error": str(e)},
            error_code="FIRESTORE_INIT_ERROR"
        )

@retry(stop=stop_after_attempt(3))
def get_redis() -> RedisClient:
    """
    Get or create thread-safe singleton instance of RedisClient with monitoring
    and security features.

    Returns:
        RedisClient: Configured Redis client instance with enhanced monitoring

    Raises:
        DatabaseError: If client initialization fails after retries
    """
    global redis_client

    try:
        with _lock:
            if redis_client is None:
                logger.info("Initializing Redis client with security monitoring")
                redis_client = get_redis_client()
                
                # Validate connection
                redis_client.ping()
                logger.info("Successfully initialized Redis client")

            return redis_client

    except Exception as e:
        logger.error(
            "Failed to initialize Redis client",
            extra={
                "error": str(e),
                "retry_count": 3,
                "service": "redis"
            }
        )
        raise DatabaseError(
            message="Failed to initialize Redis client",
            details={"error": str(e)},
            error_code="REDIS_INIT_ERROR"
        )

def init_db() -> Tuple[FirestoreClient, RedisClient]:
    """
    Initialize all database connections with enhanced security and monitoring.
    Performs connection warmup and validates secure connections.

    Returns:
        tuple: (FirestoreClient, RedisClient) - Initialized database clients

    Raises:
        DatabaseError: If initialization of any client fails
    """
    try:
        logger.info("Starting database initialization")

        # Initialize Firestore with connection pooling
        fs_client = get_firestore()
        logger.info("Firestore client initialized successfully")

        # Initialize Redis with connection pooling
        redis_client = get_redis()
        logger.info("Redis client initialized successfully")

        # Perform client warmup
        _warmup_clients(fs_client, redis_client)
        logger.info("Database clients warmed up successfully")

        # Validate secure connections
        _validate_connections(fs_client, redis_client)
        logger.info("Database connections validated successfully")

        return fs_client, redis_client

    except Exception as e:
        logger.error(
            "Database initialization failed",
            extra={
                "error": str(e),
                "service": "database_init"
            }
        )
        raise DatabaseError(
            message="Failed to initialize database connections",
            details={"error": str(e)},
            error_code="DB_INIT_ERROR"
        )

def cleanup_db() -> None:
    """
    Gracefully cleanup database connections and resources.
    Ensures proper handling of in-flight operations and connection pool cleanup.
    """
    global firestore_client, redis_client

    try:
        logger.info("Starting database cleanup")

        # Cleanup Firestore
        if firestore_client:
            firestore_client.close()
            firestore_client = None
            logger.info("Firestore client cleaned up successfully")

        # Cleanup Redis
        if redis_client:
            redis_client.close()
            redis_client = None
            logger.info("Redis client cleaned up successfully")

    except Exception as e:
        logger.error(
            "Database cleanup failed",
            extra={
                "error": str(e),
                "service": "database_cleanup"
            }
        )
        # Don't raise here as this is cleanup code

def _warmup_clients(fs_client: FirestoreClient, redis_client: RedisClient) -> None:
    """
    Perform connection warmup to ensure optimal performance.

    Args:
        fs_client: Firestore client instance
        redis_client: Redis client instance
    """
    try:
        # Warmup Firestore connection pool
        fs_client.get_collection("health_check").limit(1).get()

        # Warmup Redis connection pool
        redis_client.ping()

    except Exception as e:
        logger.warning(
            "Client warmup encountered issues",
            extra={
                "error": str(e),
                "service": "client_warmup"
            }
        )

def _validate_connections(fs_client: FirestoreClient, redis_client: RedisClient) -> None:
    """
    Validate secure connections to all database services.

    Args:
        fs_client: Firestore client instance
        redis_client: Redis client instance

    Raises:
        DatabaseError: If connection validation fails
    """
    try:
        # Validate Firestore connection
        fs_client.get_collection("health_check").limit(1).get()

        # Validate Redis connection
        redis_client.ping()

    except Exception as e:
        logger.error(
            "Connection validation failed",
            extra={
                "error": str(e),
                "service": "connection_validation"
            }
        )
        raise DatabaseError(
            message="Database connection validation failed",
            details={"error": str(e)},
            error_code="CONNECTION_VALIDATION_ERROR"
        )

__all__ = [
    'get_firestore',
    'get_redis', 
    'init_db',
    'cleanup_db'
]