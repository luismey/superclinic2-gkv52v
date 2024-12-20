"""
API version 1 initialization module for the Porfin platform.

This module configures the main API router with comprehensive security features,
monitoring, and LGPD compliance for Brazilian healthcare communications.

Version: 1.0.0
"""

# Standard library imports
from typing import Dict, Any

# Third-party imports
from fastapi import APIRouter  # fastapi v0.100.0
from prometheus_client import Counter, Histogram  # prometheus-client v0.17.0

# Internal imports
from app.api.v1.router import router as api_router
from app.core.security import SecurityContext
from app.core.logging import get_logger

# Configure module logger
logger = get_logger(__name__)

# Global constants
API_VERSION = "v1"
DEFAULT_LOCALE = "pt_BR"

# Prometheus metrics
api_requests = Counter(
    'porfin_api_requests_total',
    'Total API requests',
    ['version', 'method', 'endpoint', 'status']
)

api_latency = Histogram(
    'porfin_api_latency_seconds',
    'API request latency',
    ['version', 'method', 'endpoint']
)

def initialize_security(router: APIRouter) -> APIRouter:
    """
    Initialize security middleware and LGPD compliance settings.

    Args:
        router: FastAPI router to configure

    Returns:
        APIRouter: Configured router with security middleware
    """
    security_context = SecurityContext()

    @router.middleware("http")
    async def security_middleware(request, call_next):
        """Add security headers and context tracking."""
        # Initialize security context
        request.state.security_context = security_context.initialize(request)
        
        response = await call_next(request)
        
        # Add security headers
        response.headers.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        })
        
        return response

    @router.middleware("http")
    async def lgpd_compliance_middleware(request, call_next):
        """Add LGPD compliance headers and tracking."""
        response = await call_next(request)
        
        # Add LGPD compliance headers
        response.headers.update({
            "X-LGPD-Consent": "required",
            "X-Data-Usage": "healthcare-operations",
            "X-Data-Retention": "365-days",
            "X-Data-Protection": "encrypted",
            "X-Healthcare-Context": "medical-communications"
        })
        
        return response

    return router

def setup_monitoring(router: APIRouter) -> APIRouter:
    """
    Configure performance monitoring and metrics collection.

    Args:
        router: FastAPI router to configure

    Returns:
        APIRouter: Router with monitoring middleware
    """
    @router.middleware("http")
    async def metrics_middleware(request, call_next):
        """Collect API metrics and monitor performance."""
        method = request.method
        path = request.url.path
        
        # Track request
        api_requests.labels(
            version=API_VERSION,
            method=method,
            endpoint=path,
            status="started"
        ).inc()
        
        # Track latency
        with api_latency.labels(
            version=API_VERSION,
            method=method,
            endpoint=path
        ).time():
            response = await call_next(request)
        
        # Update metrics with response status
        api_requests.labels(
            version=API_VERSION,
            method=method,
            endpoint=path,
            status=str(response.status_code)
        ).inc()
        
        return response

    @router.middleware("http")
    async def performance_monitoring(request, call_next):
        """Monitor API performance and log slow requests."""
        import time
        start_time = time.time()
        
        response = await call_next(request)
        
        # Calculate request duration
        duration = time.time() - start_time
        
        # Log slow requests (>500ms)
        if duration > 0.5:
            logger.warning(
                "Slow API request detected",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "duration": duration,
                    "security_context": getattr(request.state, "security_context", {})
                }
            )
        
        # Add timing header
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        
        return response

    return router

# Initialize and configure main API router
api_router = initialize_security(api_router)
api_router = setup_monitoring(api_router)

# Log API initialization
logger.info(
    "API v1 initialized successfully",
    extra={
        "version": API_VERSION,
        "security_enabled": True,
        "monitoring_enabled": True
    }
)

# Export configured router
__all__ = ["api_router"]