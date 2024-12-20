"""
Main FastAPI router configuration module for the Porfin platform.

This module implements secure API routing with enhanced monitoring, LGPD compliance,
and comprehensive security features for healthcare communications.

Version: 1.0.0
"""

# Standard library imports
from typing import Callable, Dict, Any

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, Request  # fastapi v0.100.0
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram  # prometheus-client v0.17.1

# Internal imports
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.chats import router as chats_router
from app.core.rate_limiter import RateLimiter, RateLimitExceeded
from app.core.security import SecurityContext
from app.core.logging import AuditLogger
from app.core.exceptions import (
    PorfinBaseException,
    http_exception_handler,
    porfin_exception_handler
)

# Initialize main v1 router
router = APIRouter(prefix="/api/v1")

# Initialize core components
rate_limiter = RateLimiter()
security_context = SecurityContext()
audit_logger = AuditLogger()

# Prometheus metrics
api_requests = Counter(
    'porfin_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)

api_latency = Histogram(
    'porfin_api_latency_seconds',
    'API request latency',
    ['method', 'endpoint']
)

async def check_rate_limit(request: Request, security_context: SecurityContext = Depends()) -> bool:
    """
    Enhanced dependency function to check API rate limits with security context.

    Args:
        request: FastAPI request object
        security_context: Security context from dependency injection

    Returns:
        bool: True if within limits

    Raises:
        HTTPException: If rate limit exceeded
    """
    try:
        # Extract client info
        client_ip = request.client.host
        user_id = security_context.get_user_id(request)

        # Log request attempt
        audit_logger.log_request(
            request_id=request.state.request_id,
            client_ip=client_ip,
            user_id=user_id,
            path=request.url.path
        )

        # Check rate limit
        if not rate_limiter.check_rate_limit(client_ip, user_id):
            api_requests.labels(
                method=request.method,
                endpoint=request.url.path,
                status="rate_limited"
            ).inc()

            raise HTTPException(
                status_code=429,
                detail="Taxa de requisições excedida. Tente novamente em alguns minutos."
            )

        return True

    except Exception as e:
        audit_logger.log_error(
            error=str(e),
            request_id=request.state.request_id,
            security_event="rate_limit_check_failed"
        )
        raise

def setup_middleware(router: APIRouter) -> None:
    """
    Configure router middleware stack with security and monitoring.

    Args:
        router: FastAPI router to configure
    """
    @router.middleware("http")
    async def security_middleware(request: Request, call_next: Callable) -> JSONResponse:
        """Add security headers and context tracking."""
        # Initialize security context
        request.state.security_context = security_context.initialize(request)
        
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response

    @router.middleware("http")
    async def lgpd_compliance_middleware(request: Request, call_next: Callable) -> JSONResponse:
        """Add LGPD compliance headers."""
        response = await call_next(request)
        
        response.headers["X-LGPD-Consent"] = "required"
        response.headers["X-Data-Usage"] = "healthcare-operations"
        response.headers["X-Data-Retention"] = "365-days"
        
        return response

    @router.middleware("http")
    async def audit_logging_middleware(request: Request, call_next: Callable) -> JSONResponse:
        """Log request and response with security context."""
        # Log request
        request_id = audit_logger.log_request(request)
        request.state.request_id = request_id
        
        response = await call_next(request)
        
        # Log response
        audit_logger.log_response(
            request_id=request_id,
            status_code=response.status_code,
            response_time=request.state.response_time
        )
        
        return response

    @router.middleware("http")
    async def metrics_middleware(request: Request, call_next: Callable) -> JSONResponse:
        """Collect API metrics."""
        api_requests.labels(
            method=request.method,
            endpoint=request.url.path,
            status="started"
        ).inc()
        
        response = await call_next(request)
        
        api_requests.labels(
            method=request.method,
            endpoint=request.url.path,
            status=str(response.status_code)
        ).inc()
        
        return response

# Configure error handlers
router.add_exception_handler(HTTPException, http_exception_handler)
router.add_exception_handler(PorfinBaseException, porfin_exception_handler)
router.add_exception_handler(RateLimitExceeded, http_exception_handler)

# Include routers with rate limiting
router.include_router(
    auth_router,
    dependencies=[Depends(check_rate_limit)]
)
router.include_router(
    analytics_router,
    dependencies=[Depends(check_rate_limit)]
)
router.include_router(
    chats_router,
    dependencies=[Depends(check_rate_limit)]
)

# Health check endpoint
@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "healthy"}

# Configure middleware stack
setup_middleware(router)

# Export router
__all__ = ["router"]