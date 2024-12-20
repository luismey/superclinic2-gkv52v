"""
Test suite initialization module for backend services providing comprehensive test fixtures,
utilities, and configurations for testing AI, analytics, calendar, payments and WhatsApp integrations.

Version: 1.0.0
"""

# Standard library imports
import logging
from typing import Dict, Any, Optional
from datetime import datetime

# Third-party imports - version specified as per IE2
import pytest  # v7.0.0

# Internal imports
from app.core.logging import get_logger, JsonFormatter
from app.utils.validators import validate_date_range
from .test_ai import TestAIFixtures
from .test_analytics import TestMetricsService

# Test constants
TEST_USER_ID = "test-user-123"
TEST_LEAD_ID = "lead-456"
TEST_CONVERSION_TYPE = "appointment"
TEST_METADATA = {
    "source": "whatsapp",
    "campaign": "test-campaign"
}

# Performance thresholds from technical specifications
PERFORMANCE_THRESHOLDS = {
    "message_processing": 500,  # 500ms latency target
    "ai_response": 1000,       # 1 second for AI processing
    "database_query": 100      # 100ms for database operations
}

# Initialize test logger
TEST_LOGGER = get_logger("porfin.tests")

def configure_test_logging(log_level: int = logging.INFO) -> None:
    """
    Configure logging for test execution with appropriate log levels and handlers.
    
    Args:
        log_level: Logging level to use for tests
        
    Returns:
        None: Configures logging globally
    """
    # Create test logger
    logger = logging.getLogger("porfin.tests")
    logger.setLevel(log_level)
    
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    
    # Create JSON formatter with test context
    formatter = JsonFormatter(
        format_string="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        default_fields={
            "environment": "test",
            "version": "1.0.0"
        },
        security_context={
            "test_mode": True,
            "sanitize_data": True
        }
    )
    
    # Add formatter to handler
    console_handler.setFormatter(formatter)
    
    # Add handler to logger
    logger.addHandler(console_handler)
    
    # Log configuration completion
    logger.info(
        "Test logging configured",
        extra={
            "log_level": logging.getLevelName(log_level),
            "handlers": ["console"],
            "formatter": "json"
        }
    )

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """
    Global test environment setup fixture.
    Configures logging, sets up test database, and initializes test services.
    """
    # Configure test logging
    configure_test_logging(logging.DEBUG)
    
    # Log test session start
    TEST_LOGGER.info(
        "Starting test session",
        extra={
            "performance_thresholds": PERFORMANCE_THRESHOLDS,
            "test_constants": {
                "user_id": TEST_USER_ID,
                "lead_id": TEST_LEAD_ID
            }
        }
    )
    
    yield
    
    # Log test session end
    TEST_LOGGER.info("Test session completed")

@pytest.fixture
def test_context() -> Dict[str, Any]:
    """
    Provides common test context with user and security information.
    
    Returns:
        Dict containing test context data
    """
    return {
        "user_id": TEST_USER_ID,
        "lead_id": TEST_LEAD_ID,
        "conversion_type": TEST_CONVERSION_TYPE,
        "metadata": TEST_METADATA,
        "security_context": {
            "test_mode": True,
            "permissions": ["read", "write"],
            "role": "healthcare_provider"
        },
        "performance_thresholds": PERFORMANCE_THRESHOLDS
    }

@pytest.fixture
def mock_datetime(monkeypatch) -> datetime:
    """
    Provides a fixed datetime for consistent testing.
    
    Args:
        monkeypatch: PyTest monkeypatch fixture
        
    Returns:
        Fixed datetime object
    """
    fixed_dt = datetime(2023, 12, 1, 12, 0, 0)
    
    class MockDatetime:
        @classmethod
        def now(cls, tz=None):
            return fixed_dt
        
        @classmethod
        def utcnow(cls):
            return fixed_dt
    
    monkeypatch.setattr("datetime.datetime", MockDatetime)
    return fixed_dt

# Export test fixtures and utilities
__all__ = [
    "TEST_USER_ID",
    "TEST_LEAD_ID",
    "TEST_CONVERSION_TYPE",
    "TEST_METADATA",
    "PERFORMANCE_THRESHOLDS",
    "TestAIFixtures",
    "TestMetricsService",
    "configure_test_logging",
    "test_context",
    "mock_datetime"
]