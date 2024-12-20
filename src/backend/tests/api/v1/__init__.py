"""
API v1 test suite initialization module for the Porfin platform.

This module provides comprehensive test configuration, utilities, and fixtures for validating
API endpoints, request/response patterns, and security contexts.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import uuid
from typing import Dict, Any, Optional
from datetime import datetime

# Third-party imports
import pytest  # v7.0.0
import pytest_asyncio  # v0.20.0
from prometheus_client import Counter, Histogram  # v0.17.1

# Internal imports
from tests.conftest import (
    test_db,
    test_cache,
    test_client,
    test_security_context
)
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Configure test logger
logger = get_logger(__name__, {"environment": "test"})

# Constants
API_V1_TEST_PREFIX = "/api/v1"
TEST_DATABASE_URL = "postgresql://test:test@localhost:5432/test_db"
TEST_REDIS_URL = "redis://localhost:6379/1"

# Test metrics
api_test_operations = Counter(
    'porfin_api_test_operations_total',
    'Total API test operations',
    ['endpoint', 'method', 'status']
)

api_test_latency = Histogram(
    'porfin_api_test_latency_seconds',
    'API test execution latency',
    ['endpoint', 'method']
)

class TestContext:
    """Context manager for API test execution environment."""

    def __init__(self, test_name: str, test_config: Dict[str, Any]) -> None:
        """
        Initialize test context with configuration and monitoring.

        Args:
            test_name: Name of the test being executed
            test_config: Test-specific configuration
        """
        self.test_id = str(uuid.uuid4())
        self.test_name = test_name
        self.config = test_config
        self.start_time = None
        self.metrics = {
            'operations': 0,
            'assertions': 0,
            'cleanup_operations': 0
        }
        self.logger = get_logger(
            f"api_test.{test_name}",
            {
                "test_id": self.test_id,
                "test_name": test_name
            }
        )
        self.logger.info(f"Initializing test context for {test_name}")

    async def setup(self) -> None:
        """
        Set up test context with required test data and mocks.
        """
        self.start_time = datetime.utcnow()
        self.logger.info("Setting up test context")
        
        try:
            # Initialize test data
            await self._setup_test_data()
            
            # Configure mock services
            await self._setup_mock_services()
            
            # Initialize security context
            await self._setup_security_context()
            
            self.metrics['operations'] += 1
            self.logger.info("Test context setup completed")
            
        except Exception as e:
            self.logger.error(f"Test context setup failed: {str(e)}")
            raise PorfinBaseException(
                message="Test setup failed",
                details={"error": str(e)},
                correlation_id=self.test_id
            )

    async def cleanup(self) -> None:
        """
        Clean up test context and record metrics.
        """
        try:
            self.logger.info("Cleaning up test context")
            
            # Clean up test data
            await self._cleanup_test_data()
            
            # Remove mock services
            await self._cleanup_mock_services()
            
            # Clear security context
            await self._cleanup_security_context()
            
            # Record metrics
            duration = (datetime.utcnow() - self.start_time).total_seconds()
            api_test_latency.labels(
                endpoint=self.config.get('endpoint', 'unknown'),
                method=self.config.get('method', 'unknown')
            ).observe(duration)
            
            self.metrics['cleanup_operations'] += 1
            self.logger.info(
                "Test context cleanup completed",
                extra={"metrics": self.metrics}
            )
            
        except Exception as e:
            self.logger.error(f"Test context cleanup failed: {str(e)}")
            raise PorfinBaseException(
                message="Test cleanup failed",
                details={"error": str(e)},
                correlation_id=self.test_id
            )

    async def _setup_test_data(self) -> None:
        """Initialize test data in database."""
        self.logger.debug("Setting up test data")
        # Implementation will be provided by specific test modules

    async def _setup_mock_services(self) -> None:
        """Configure mock services for testing."""
        self.logger.debug("Setting up mock services")
        # Implementation will be provided by specific test modules

    async def _setup_security_context(self) -> None:
        """Initialize security context for test."""
        self.logger.debug("Setting up security context")
        # Implementation will be provided by specific test modules

    async def _cleanup_test_data(self) -> None:
        """Remove test data from database."""
        self.logger.debug("Cleaning up test data")
        # Implementation will be provided by specific test modules

    async def _cleanup_mock_services(self) -> None:
        """Remove mock service configurations."""
        self.logger.debug("Cleaning up mock services")
        # Implementation will be provided by specific test modules

    async def _cleanup_security_context(self) -> None:
        """Clear security context after test."""
        self.logger.debug("Cleaning up security context")
        # Implementation will be provided by specific test modules

@pytest.fixture(scope="session")
def setup_test_suite():
    """
    Initialize test suite with required configuration and utilities.
    """
    logger.info("Initializing API v1 test suite")
    
    # Configure test environment
    pytest.API_V1_TEST_PREFIX = API_V1_TEST_PREFIX
    pytest.TEST_DATABASE_URL = TEST_DATABASE_URL
    pytest.TEST_REDIS_URL = TEST_REDIS_URL
    
    # Initialize metrics
    api_test_operations.labels(
        endpoint="all",
        method="all",
        status="initialized"
    ).inc()

@pytest.fixture(scope="session", autouse=True)
async def cleanup_test_suite():
    """
    Perform cleanup after test suite execution.
    """
    yield
    
    logger.info("Cleaning up API v1 test suite")
    try:
        # Clean up test database
        await test_db.cleanup()
        
        # Clear test cache
        await test_cache.cleanup()
        
        # Record final metrics
        api_test_operations.labels(
            endpoint="all",
            method="all",
            status="completed"
        ).inc()
        
    except Exception as e:
        logger.error(f"Test suite cleanup failed: {str(e)}")
        raise PorfinBaseException(
            message="Test suite cleanup failed",
            details={"error": str(e)}
        )

__all__ = [
    'API_V1_TEST_PREFIX',
    'TestContext',
    'setup_test_suite',
    'cleanup_test_suite'
]