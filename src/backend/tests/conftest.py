"""
Pytest configuration file for the Porfin platform's backend test suite.

This module provides comprehensive test fixtures and configurations with enhanced
security monitoring, database isolation, and cleanup capabilities.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import uuid
from typing import AsyncGenerator, Dict, Any
from datetime import datetime

# Third-party imports
import pytest  # v7.3.1
import httpx  # v0.24.0
from faker import Faker  # v19.3.0
from prometheus_client import Counter, Histogram  # v0.17.1

# Internal imports
from app.db.firestore import FirestoreClient
from app.db.redis import RedisCache
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Configure test logger
logger = get_logger(__name__, {"environment": "test"})

# Constants
TEST_DB_PREFIX = "test_"
TEST_CACHE_PREFIX = "test_cache_"

# Initialize test data generator
faker = Faker('pt_BR')  # Brazilian Portuguese locale for test data

# Test metrics
test_operations = Counter(
    'porfin_test_operations_total',
    'Total test operations',
    ['operation_type', 'status']
)

test_duration = Histogram(
    'porfin_test_duration_seconds',
    'Test execution duration',
    ['test_type']
)

class TestFirestore:
    """Enhanced Firestore test client with isolation and monitoring."""

    def __init__(self):
        """Initialize test Firestore client with monitoring."""
        self._client = FirestoreClient()
        self._test_prefix = f"{TEST_DB_PREFIX}{uuid.uuid4().hex[:8]}_"
        self._active_collections = set()
        logger.info(f"Initialized test Firestore client with prefix: {self._test_prefix}")

    def get_test_collection(self, collection_name: str) -> str:
        """
        Get isolated test collection with monitoring.

        Args:
            collection_name: Base collection name

        Returns:
            Prefixed test collection name
        """
        test_collection = f"{self._test_prefix}{collection_name}"
        self._active_collections.add(test_collection)
        test_operations.labels(
            operation_type="collection_create",
            status="success"
        ).inc()
        return test_collection

    async def cleanup(self):
        """Clean up test collections with verification."""
        try:
            for collection in self._active_collections:
                await self._client.delete_collection(collection)
                logger.debug(f"Cleaned up test collection: {collection}")
            
            test_operations.labels(
                operation_type="cleanup",
                status="success"
            ).inc()
        except Exception as e:
            logger.error(f"Test cleanup failed: {str(e)}")
            test_operations.labels(
                operation_type="cleanup",
                status="error"
            ).inc()
            raise

class TestRedis:
    """Enhanced Redis test client with isolation and monitoring."""

    def __init__(self):
        """Initialize test Redis client with monitoring."""
        self._client = RedisCache()
        self._test_prefix = f"{TEST_CACHE_PREFIX}{uuid.uuid4().hex[:8]}_"
        self._active_keys = set()
        logger.info(f"Initialized test Redis client with prefix: {self._test_prefix}")

    def get_test_key(self, key: str) -> str:
        """
        Get isolated test key with monitoring.

        Args:
            key: Base key name

        Returns:
            Prefixed test key
        """
        test_key = f"{self._test_prefix}{key}"
        self._active_keys.add(test_key)
        test_operations.labels(
            operation_type="key_create",
            status="success"
        ).inc()
        return test_key

    async def cleanup(self):
        """Clean up test keys with verification."""
        try:
            for key in self._active_keys:
                await self._client.delete_pattern(f"{key}*")
                logger.debug(f"Cleaned up test key: {key}")
            
            test_operations.labels(
                operation_type="cleanup",
                status="success"
            ).inc()
        except Exception as e:
            logger.error(f"Test cleanup failed: {str(e)}")
            test_operations.labels(
                operation_type="cleanup",
                status="error"
            ).inc()
            raise

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_db() -> AsyncGenerator[TestFirestore, None]:
    """
    Provide isolated Firestore test database with monitoring.

    Yields:
        TestFirestore instance
    """
    db = TestFirestore()
    yield db
    await db.cleanup()

@pytest.fixture(scope="session")
async def test_cache() -> AsyncGenerator[TestRedis, None]:
    """
    Provide isolated Redis test cache with monitoring.

    Yields:
        TestRedis instance
    """
    cache = TestRedis()
    yield cache
    await cache.cleanup()

@pytest.fixture
async def test_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    Provide configured test client with monitoring.

    Yields:
        Async HTTP client for testing
    """
    async with httpx.AsyncClient(
        base_url="http://test",
        headers={"X-Test-ID": str(uuid.uuid4())},
        timeout=30.0
    ) as client:
        yield client

@pytest.fixture(autouse=True)
def test_metrics():
    """Record test metrics and timing."""
    start_time = datetime.now()
    yield
    duration = (datetime.now() - start_time).total_seconds()
    test_duration.labels(
        test_type=pytest.current_test.__name__
    ).observe(duration)

@pytest.fixture
def test_security_context() -> Dict[str, Any]:
    """
    Provide test security context for audit logging.

    Returns:
        Security context dictionary
    """
    return {
        "test_id": str(uuid.uuid4()),
        "environment": "test",
        "user_id": faker.uuid4(),
        "timestamp": datetime.utcnow().isoformat()
    }

@pytest.fixture(autouse=True)
async def cleanup_test_data(test_db: TestFirestore, test_cache: TestRedis):
    """
    Clean up test data after each test with verification.

    Args:
        test_db: TestFirestore instance
        test_cache: TestRedis instance
    """
    yield
    try:
        await test_db.cleanup()
        await test_cache.cleanup()
        logger.info("Test data cleanup completed successfully")
    except Exception as e:
        logger.error(f"Test data cleanup failed: {str(e)}")
        raise PorfinBaseException(
            message="Test cleanup failed",
            details={"error": str(e)},
            correlation_id=str(uuid.uuid4())
        )

def pytest_configure(config):
    """Configure test environment and logging."""
    logger.info("Configuring test environment")
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers",
        "security: mark test as security test"
    )

def pytest_collection_modifyitems(items):
    """Add test type markers for metrics collection."""
    for item in items:
        if "integration" in item.keywords:
            test_operations.labels(
                operation_type="integration_test",
                status="collected"
            ).inc()
        elif "security" in item.keywords:
            test_operations.labels(
                operation_type="security_test",
                status="collected"
            ).inc()
        else:
            test_operations.labels(
                operation_type="unit_test",
                status="collected"
            ).inc()