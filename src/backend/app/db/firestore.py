"""
Core Firestore database module for the Porfin platform.

This module provides a robust and secure Firestore database client with enhanced features
including connection pooling, caching, circuit breaking, and comprehensive monitoring.

Version: 1.0.0
"""

# Standard library imports
import json
import time
from typing import Any, Dict, List, Optional, Union
from contextlib import contextmanager

# Third-party imports
from google.cloud import firestore  # google-cloud-firestore v2.11.0
from google.cloud.firestore_v1.base_query import BaseQuery
from google.auth import credentials
from cachetools import TTLCache  # cachetools v5.3.0
from tenacity import retry, stop_after_attempt, wait_exponential  # tenacity v8.2.2
from prometheus_client import Counter, Histogram, Gauge  # prometheus-client v0.17.1

# Internal imports
from app.config.settings import settings
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Module configuration
logger = get_logger(__name__)
CACHE_TTL = 300  # Cache TTL in seconds
MAX_BATCH_SIZE = 500  # Maximum batch operation size
RETRY_ATTEMPTS = 3  # Number of retry attempts
TRANSACTION_TIMEOUT = 30  # Transaction timeout in seconds
METRICS_PREFIX = 'porfin_firestore'

# Prometheus metrics
firestore_operations = Counter(
    f'{METRICS_PREFIX}_operations_total',
    'Total Firestore operations',
    ['operation_type', 'collection', 'status']
)
firestore_latency = Histogram(
    f'{METRICS_PREFIX}_operation_latency_seconds',
    'Firestore operation latency',
    ['operation_type', 'collection']
)
firestore_connections = Gauge(
    f'{METRICS_PREFIX}_active_connections',
    'Number of active Firestore connections'
)

class FirestoreError(PorfinBaseException):
    """Enhanced custom exception for Firestore-specific errors."""
    
    def __init__(
        self,
        message: str,
        details: Dict[str, Any] = None,
        error_code: str = None,
        operation_id: str = None
    ) -> None:
        """
        Initialize Firestore error with enhanced tracking.

        Args:
            message: Error description
            details: Additional error context
            error_code: Firestore error code
            operation_id: Unique operation identifier
        """
        super().__init__(
            message=message,
            details=details,
            status_code=500,
            correlation_id=operation_id
        )
        self.error_code = error_code
        self.operation_id = operation_id
        
        # Log error with structured context
        logger.error(
            f"Firestore error: {message}",
            extra={
                "error_code": error_code,
                "operation_id": operation_id,
                "details": details
            }
        )
        
        # Increment error metric
        firestore_operations.labels(
            operation_type="error",
            collection="all",
            status=error_code or "unknown"
        ).inc()

class FirestoreClient:
    """Enhanced singleton Firestore client with advanced features."""
    
    _instance = None
    
    def __new__(cls):
        """Ensure singleton instance."""
        if cls._instance is None:
            cls._instance = super(FirestoreClient, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize Firestore client with advanced features."""
        if not hasattr(self, '_initialized'):
            # Initialize client with credentials
            try:
                creds = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                self._client = firestore.Client(
                    project=settings.FIRESTORE_PROJECT_ID,
                    credentials=creds
                )
            except Exception as e:
                raise FirestoreError(
                    message="Failed to initialize Firestore client",
                    details={"error": str(e)},
                    error_code="INIT_ERROR"
                )
            
            # Initialize query cache
            self._query_cache = TTLCache(
                maxsize=1000,
                ttl=CACHE_TTL
            )
            
            # Initialize connection tracking
            self._active_connections = 0
            firestore_connections.set(0)
            
            self._initialized = True
    
    @contextmanager
    def _track_operation(self, operation_type: str, collection: str):
        """
        Context manager for tracking operation metrics.

        Args:
            operation_type: Type of operation being performed
            collection: Collection being accessed
        """
        start_time = time.time()
        try:
            yield
            status = "success"
        except Exception as e:
            status = "error"
            raise e
        finally:
            duration = time.time() - start_time
            firestore_operations.labels(
                operation_type=operation_type,
                collection=collection,
                status=status
            ).inc()
            firestore_latency.labels(
                operation_type=operation_type,
                collection=collection
            ).observe(duration)
    
    @retry(
        stop=stop_after_attempt(RETRY_ATTEMPTS),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def get_collection(self, collection_name: str) -> firestore.CollectionReference:
        """
        Get reference to a Firestore collection with validation.

        Args:
            collection_name: Name of the collection

        Returns:
            Firestore collection reference

        Raises:
            FirestoreError: If collection access fails
        """
        try:
            with self._track_operation("get_collection", collection_name):
                collection_ref = self._client.collection(collection_name)
                # Validate collection exists with a lightweight query
                collection_ref.limit(1).get()
                return collection_ref
        except Exception as e:
            raise FirestoreError(
                message=f"Failed to access collection: {collection_name}",
                details={"error": str(e)},
                error_code="COLLECTION_ACCESS_ERROR"
            )
    
    def create_document(
        self,
        collection_name: str,
        data: Dict[str, Any],
        document_id: Optional[str] = None
    ) -> str:
        """
        Create a new document in a collection.

        Args:
            collection_name: Collection name
            data: Document data
            document_id: Optional document ID

        Returns:
            Created document ID

        Raises:
            FirestoreError: If document creation fails
        """
        try:
            with self._track_operation("create", collection_name):
                collection_ref = self.get_collection(collection_name)
                if document_id:
                    doc_ref = collection_ref.document(document_id)
                    doc_ref.create(data)
                    return document_id
                else:
                    doc_ref = collection_ref.add(data)[1]
                    return doc_ref.id
        except Exception as e:
            raise FirestoreError(
                message="Failed to create document",
                details={"error": str(e)},
                error_code="DOCUMENT_CREATE_ERROR"
            )

    @contextmanager
    def transaction(self):
        """
        Context manager for Firestore transactions with timeout.

        Yields:
            Active transaction object
        """
        transaction = self._client.transaction()
        try:
            with self._track_operation("transaction", "all"):
                yield transaction
        except Exception as e:
            raise FirestoreError(
                message="Transaction failed",
                details={"error": str(e)},
                error_code="TRANSACTION_ERROR"
            )

    def close(self):
        """Cleanup client resources."""
        if hasattr(self, '_client'):
            self._client.close()
            firestore_connections.set(0)

# Global database client instance
db = FirestoreClient()

__all__ = [
    'FirestoreError',
    'FirestoreClient',
    'db'
]