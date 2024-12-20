"""
Core module initializer for the Porfin platform.

This module provides centralized security, logging, rate limiting, and error handling
functionality with comprehensive thread safety and performance monitoring.

Version: 1.0.0
"""

# Internal imports
from app.core.exceptions import (
    PorfinBaseException as PorfinException,
    AuthenticationError
)
from app.core.logging import (
    setup_logging,
    get_logger
)
from app.core.security import (
    verify_token,
    create_access_token,
    RBAC
)
from app.core.middleware import setup_middleware
from app.core.rate_limiter import TokenBucket

# Configure module logger
logger = get_logger(__name__)

# Module version
__version__ = '1.0.0'

# Initialize core components with security context
try:
    # Setup logging with security monitoring
    setup_logging()
    logger.info(
        "Core logging initialized",
        extra={"component": "core", "version": __version__}
    )

    # Initialize RBAC system
    rbac = RBAC()
    logger.info(
        "RBAC system initialized",
        extra={"component": "core", "security_context": rbac.security_context}
    )

    # Initialize rate limiter
    rate_limiter = TokenBucket()
    logger.info(
        "Rate limiter initialized",
        extra={"component": "core", "rate_limiter_metrics": rate_limiter.monitor_usage()}
    )

    # Setup secure middleware stack
    setup_middleware()
    logger.info(
        "Middleware stack configured",
        extra={"component": "core", "security_enabled": True}
    )

except Exception as e:
    logger.critical(
        f"Failed to initialize core module: {str(e)}",
        extra={"component": "core", "error": str(e)},
        exc_info=True
    )
    raise

# Export core components with security context
__all__ = [
    # Version info
    '__version__',
    
    # Exception handling
    'PorfinException',
    'AuthenticationError',
    
    # Logging
    'setup_logging',
    'get_logger',
    
    # Security
    'verify_token',
    'create_access_token',
    'RBAC',
    
    # Middleware
    'setup_middleware',
    
    # Rate limiting
    'TokenBucket'
]

logger.info(
    "Core module initialization complete",
    extra={
        "component": "core",
        "version": __version__,
        "exports": __all__
    }
)