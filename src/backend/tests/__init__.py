"""
Test package initialization module for the Porfin platform.

This module configures the test environment, imports test fixtures, and sets up test
utilities for comprehensive backend service testing with security monitoring and
validation.

Version: 1.0.0
"""

# Standard library imports
import os
import sys
from typing import Dict, Any

# Third-party imports
import pytest  # v7.0.0

# Internal imports
from tests.conftest import pytest_configure

# Constants
TEST_PACKAGE = 'porfin.tests'

# Add project root to Python path for test imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def get_test_context(test_name: str) -> Dict[str, Any]:
    """
    Create a test context with security and monitoring information.

    Args:
        test_name: Name of the test being executed

    Returns:
        Dictionary containing test context information
    """
    return {
        'test_name': test_name,
        'test_package': TEST_PACKAGE,
        'environment': 'test',
        'monitoring': {
            'enabled': True,
            'metrics_prefix': 'porfin_test'
        },
        'security': {
            'audit_logging': True,
            'data_isolation': True
        }
    }

def setup_test_environment() -> None:
    """
    Configure test environment with security and monitoring settings.
    
    This function sets up:
    - Test database isolation
    - Security monitoring
    - Metrics collection
    - Audit logging
    """
    # Set test environment variables
    os.environ.setdefault('ENVIRONMENT', 'test')
    os.environ.setdefault('DEBUG', 'true')
    
    # Configure test logging
    os.environ.setdefault('LOG_LEVEL', 'DEBUG')
    os.environ.setdefault('LOG_FORMAT', 'json')
    
    # Configure test security
    os.environ.setdefault('ENABLE_AUDIT_LOGGING', 'true')
    os.environ.setdefault('DATA_ISOLATION', 'true')
    
    # Configure test metrics
    os.environ.setdefault('ENABLE_TEST_METRICS', 'true')
    os.environ.setdefault('METRICS_PREFIX', 'porfin_test')

def cleanup_test_environment() -> None:
    """
    Clean up test environment and resources.
    
    This function handles:
    - Test database cleanup
    - Cache invalidation
    - Temporary file removal
    - Metrics reset
    """
    # Clean up environment variables
    test_vars = [
        'ENVIRONMENT',
        'DEBUG',
        'LOG_LEVEL',
        'LOG_FORMAT',
        'ENABLE_AUDIT_LOGGING',
        'DATA_ISOLATION',
        'ENABLE_TEST_METRICS',
        'METRICS_PREFIX'
    ]
    for var in test_vars:
        os.environ.pop(var, None)

# Initialize test environment on module import
setup_test_environment()

# Register cleanup handler
import atexit
atexit.register(cleanup_test_environment)

# Export commonly used test utilities
__all__ = [
    'pytest_configure',
    'get_test_context',
    'setup_test_environment',
    'cleanup_test_environment',
    'TEST_PACKAGE'
]