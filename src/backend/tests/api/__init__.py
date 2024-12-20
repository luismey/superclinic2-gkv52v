"""
API test suite initialization module for the Porfin platform.

This module provides comprehensive test utilities, security contexts, and shared test
constants for API endpoint testing across all versions with monitoring and isolation.

Version: 1.0.0
"""

# Standard library imports
import uuid
from typing import Dict, Any

# Third-party imports
import pytest  # v7.0.0

# Internal imports
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Configure test logger with security context
logger = get_logger(__name__, {"environment": "test", "component": "api_tests"})

# API test constants
API_TEST_PREFIX = "/api"

# Enhanced default headers for API test requests
TEST_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-API-Version": "v1",
    "X-Request-ID": f"test-{uuid.uuid4()}",
    "X-Security-Context": "test",
    "X-Rate-Limit-Group": "test"
}

# Security context configuration for test isolation
TEST_SECURITY_CONTEXT = {
    "environment": "test",
    "isolation_level": "strict",
    "cleanup_required": True,
    "test_suite": "api",
    "monitoring_enabled": True
}

@pytest.fixture
def setup_test_headers(request: pytest.FixtureRequest, security_context: Dict[str, Any]) -> Dict[str, str]:
    """
    Creates enhanced default headers for API test requests with security context
    and monitoring support.

    Args:
        request: Pytest fixture request
        security_context: Security context for the test

    Returns:
        Dict[str, str]: Enhanced headers for API test requests
    """
    # Generate unique correlation ID for request tracing
    correlation_id = str(uuid.uuid4())
    
    # Create base headers with security context
    headers = TEST_HEADERS.copy()
    headers.update({
        "X-Correlation-ID": correlation_id,
        "X-Test-Name": request.node.name,
        "X-Test-Module": request.module.__name__,
        "X-Security-Context": json.dumps(security_context)
    })

    # Add monitoring headers
    if TEST_SECURITY_CONTEXT["monitoring_enabled"]:
        headers.update({
            "X-Monitor-Test": "true",
            "X-Monitor-Suite": "api",
            "X-Monitor-Start-Time": str(time.time())
        })

    logger.debug(
        "Created test headers",
        extra={
            "correlation_id": correlation_id,
            "test_name": request.node.name,
            "security_context": security_context
        }
    )

    return headers

@pytest.fixture(autouse=True)
async def cleanup_test_context(request: pytest.FixtureRequest) -> None:
    """
    Ensures proper cleanup of test data and security contexts after test execution.
    Automatically applied to all API tests.

    Args:
        request: Pytest fixture request

    Returns:
        None

    Raises:
        PorfinBaseException: If cleanup fails
    """
    # Record test start in monitoring
    start_time = time.time()
    correlation_id = str(uuid.uuid4())
    
    logger.info(
        "Starting API test",
        extra={
            "correlation_id": correlation_id,
            "test_name": request.node.name,
            "test_module": request.module.__name__
        }
    )

    try:
        # Execute test
        yield

        # Calculate test duration
        duration = time.time() - start_time

        # Log test completion
        logger.info(
            "API test completed",
            extra={
                "correlation_id": correlation_id,
                "test_name": request.node.name,
                "duration": duration,
                "status": "success"
            }
        )

    except Exception as e:
        # Log test failure
        logger.error(
            "API test failed",
            extra={
                "correlation_id": correlation_id,
                "test_name": request.node.name,
                "error": str(e),
                "status": "failed"
            }
        )
        raise

    finally:
        try:
            # Clean up test data if required
            if TEST_SECURITY_CONTEXT["cleanup_required"]:
                # Clean up test database records
                await request.getfixturevalue("test_db").cleanup()
                
                # Clean up test cache entries
                await request.getfixturevalue("test_cache").cleanup()

                logger.debug(
                    "Test cleanup completed",
                    extra={
                        "correlation_id": correlation_id,
                        "test_name": request.node.name
                    }
                )

        except Exception as cleanup_error:
            logger.error(
                "Test cleanup failed",
                extra={
                    "correlation_id": correlation_id,
                    "test_name": request.node.name,
                    "error": str(cleanup_error)
                }
            )
            raise PorfinBaseException(
                message="API test cleanup failed",
                details={"error": str(cleanup_error)},
                correlation_id=correlation_id
            )

# Export commonly used test utilities
__all__ = [
    "API_TEST_PREFIX",
    "TEST_HEADERS",
    "TEST_SECURITY_CONTEXT",
    "setup_test_headers",
    "cleanup_test_context"
]