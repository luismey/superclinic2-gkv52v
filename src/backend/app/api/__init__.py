"""
Main API package initializer for the Porfin platform.

This module configures the FastAPI application with comprehensive middleware setup,
security features, monitoring, and Brazilian Portuguese localization.

Version: 1.0.0
"""

# Standard library imports
import locale
from typing import Dict, Any

# Third-party imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from prometheus_fastapi_instrumentator import PrometheusMiddleware
from slowapi import RateLimitMiddleware

# Internal imports
from app.api.v1.router import router as v1_router
from app.core.middleware import (
    AuthenticationMiddleware,
    LoggingMiddleware
)
from app.core.exceptions import (
    PorfinBaseException,
    http_exception_handler,
    porfin_exception_handler
)

# Initialize FastAPI application with enhanced configuration
app = FastAPI(
    title="Porfin API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    default_response_class=ORJSONResponse
)

# CORS configuration
CORS_ORIGINS = [
    "http://localhost:3000",  # Development
    "https://app.porfin.com.br"  # Production
]

# Rate limiting configuration
RATE_LIMIT = "100/minute"  # 100 requests per minute per user

# Timezone configuration
DEFAULT_TIMEZONE = "America/Sao_Paulo"

def configure_middleware() -> None:
    """
    Configure comprehensive application middleware chain for security,
    monitoring, and performance.
    """
    # CORS middleware with strict origin policy
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset"
        ]
    )

    # Authentication middleware with JWT validation
    app.add_middleware(
        AuthenticationMiddleware,
        request_id_header="X-Request-ID"
    )

    # Rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        rate_limit=RATE_LIMIT
    )

    # Prometheus metrics middleware
    app.add_middleware(
        PrometheusMiddleware,
        group_paths=True,
        buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
        filter_unhandled_paths=True
    )

    # Request/response logging middleware
    app.add_middleware(
        LoggingMiddleware,
        request_id_header="X-Request-ID"
    )

def configure_routers() -> None:
    """Configure API routers with versioning and documentation."""
    # Mount v1 API router
    app.include_router(
        v1_router,
        prefix="/api/v1"
    )

    # Add health check endpoint
    @app.get("/health")
    async def health_check() -> Dict[str, str]:
        """Basic health check endpoint."""
        return {"status": "healthy"}

    # Add metrics endpoint
    @app.get("/metrics")
    async def metrics() -> Dict[str, Any]:
        """Prometheus metrics endpoint."""
        return {"metrics": "Prometheus metrics endpoint"}

    # Configure error handlers
    app.add_exception_handler(PorfinBaseException, porfin_exception_handler)
    app.add_exception_handler(Exception, http_exception_handler)

def configure_locale() -> None:
    """Configure Brazilian Portuguese locale and timezone settings."""
    try:
        # Set Brazilian Portuguese locale
        locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
    except locale.Error:
        # Fallback if locale not available
        locale.setlocale(locale.LC_ALL, '')

    # Configure timezone
    import pytz
    import datetime
    datetime.datetime.now(pytz.timezone(DEFAULT_TIMEZONE))

# Configure application components
configure_middleware()
configure_routers()
configure_locale()

# Export application instance
__all__ = ["app"]