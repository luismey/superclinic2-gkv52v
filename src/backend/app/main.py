"""
Main FastAPI application entry point for the Porfin platform.

This module configures and initializes the backend server with comprehensive security,
monitoring, and compliance features for healthcare communications in Brazil.

Version: 1.0.0
"""

# Standard library imports
import logging
from typing import Dict, Any

# Third-party imports
from fastapi import FastAPI, Request, Response  # fastapi v0.100.0
from fastapi.middleware.cors import CORSMiddleware  # fastapi v0.100.0
from prometheus_client import Counter, Histogram  # prometheus-client v0.17.0
import structlog  # structlog v23.1.0
from prometheus_fastapi_instrumentator import PrometheusFastAPIInstrumentator  # v5.9.1

# Internal imports
from app.api.v1.router import auth_router, analytics_router, chats_router
from app.config.settings import settings
from app.core.exceptions import (
    PorfinBaseException,
    http_exception_handler,
    porfin_exception_handler
)
from app.core.rate_limiter import RateLimitMiddleware
from app.core.logging import get_logger

# Initialize logger with security context
logger = get_logger(__name__)

# Initialize metrics
request_counter = Counter(
    "porfin_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

request_latency = Histogram(
    "porfin_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"]
)

def create_application() -> FastAPI:
    """
    Create and configure FastAPI application with enhanced security and monitoring.

    Returns:
        FastAPI: Configured application instance
    """
    # Initialize FastAPI with configuration
    app = FastAPI(
        title=settings.PROJECT_NAME,
        debug=settings.DEBUG,
        docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
        redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc"
    )

    # Configure security middleware
    configure_security(app)

    # Configure monitoring and observability
    configure_monitoring(app)

    # Configure Brazilian localization
    configure_localization(app)

    # Configure LGPD compliance
    configure_compliance(app)

    # Include routers
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")
    app.include_router(chats_router, prefix="/api/v1")

    # Configure exception handlers
    app.add_exception_handler(PorfinBaseException, porfin_exception_handler)
    app.add_exception_handler(Exception, http_exception_handler)

    return app

def configure_security(app: FastAPI) -> None:
    """Configure comprehensive security middleware stack."""
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"]
    )

    # Configure rate limiting
    app.add_middleware(
        RateLimitMiddleware,
        rate_limit=settings.RATE_LIMIT_CONFIG["requests_per_minute"],
        window_seconds=60,
        burst_multiplier=1.5
    )

    # Add security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response

def configure_monitoring(app: FastAPI) -> None:
    """Configure monitoring and observability stack."""
    
    # Initialize Prometheus metrics
    PrometheusFastAPIInstrumentator().instrument(app).expose(app)

    # Add request tracking middleware
    @app.middleware("http")
    async def track_requests(request: Request, call_next) -> Response:
        # Track request metrics
        request_counter.labels(
            method=request.method,
            endpoint=request.url.path,
            status="started"
        ).inc()

        # Track latency
        with request_latency.labels(
            method=request.method,
            endpoint=request.url.path
        ).time():
            response = await call_next(request)

        # Update status metrics
        request_counter.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        return response

def configure_localization(app: FastAPI) -> None:
    """Configure Brazilian Portuguese localization."""
    import locale
    try:
        locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
    except locale.Error:
        logger.warning("Brazilian locale not available, falling back to default")

    # Add locale middleware
    @app.middleware("http")
    async def add_locale_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["Content-Language"] = "pt-BR"
        return response

def configure_compliance(app: FastAPI) -> None:
    """Configure LGPD and healthcare compliance features."""
    
    # Add compliance headers middleware
    @app.middleware("http")
    async def add_compliance_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-LGPD-Consent-Required"] = "true"
        response.headers["X-Healthcare-Data-Protection"] = "enabled"
        response.headers["X-Data-Retention-Days"] = "365"
        return response

    # Add audit logging middleware
    @app.middleware("http")
    async def audit_logging(request: Request, call_next) -> Response:
        # Log request with security context
        logger.info(
            "Incoming request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host,
                "user_agent": request.headers.get("user-agent")
            }
        )
        
        response = await call_next(request)
        
        # Log response
        logger.info(
            "Outgoing response",
            extra={
                "status_code": response.status_code,
                "path": request.url.path
            }
        )
        
        return response

# Create application instance
app = create_application()

# Export application
__all__ = ["app"]