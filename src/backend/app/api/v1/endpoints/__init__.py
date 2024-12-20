"""
Package initializer for the API endpoints module.
Provides centralized access to all API endpoint routers for the v1 API version
with enhanced security, monitoring, and performance optimizations.

Version: 1.0.0
"""

# Standard library imports
from typing import Dict, List, Optional

# Third-party imports
from fastapi import APIRouter  # fastapi v0.100+
from prometheus_client import Counter, Histogram  # prometheus-client v0.17.1

# Internal imports
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.appointments import router as appointments_router
from app.api.v1.endpoints.assistants import router as assistants_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.campaigns import router as campaigns_router
from app.api.v1.endpoints.chats import router as chats_router
from app.api.v1.endpoints.messages import router as messages_router
from app.api.v1.endpoints.payments import router as payments_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.webhooks import router as webhooks_router
from app.core.logging import get_logger

# Initialize logger
logger = get_logger(__name__)

# Prometheus metrics for router monitoring
METRICS_PREFIX = "porfin_api"
router_requests = Counter(
    f"{METRICS_PREFIX}_requests_total",
    "Total API requests",
    ["router", "method", "status"]
)
router_latency = Histogram(
    f"{METRICS_PREFIX}_request_latency_seconds",
    "API request latency",
    ["router", "method"]
)

def validate_router_config(router: APIRouter) -> bool:
    """
    Validates router configuration for security and performance requirements.

    Args:
        router: APIRouter instance to validate

    Returns:
        bool: True if configuration is valid
    """
    try:
        # Validate router has required attributes
        if not hasattr(router, "prefix") or not hasattr(router, "tags"):
            logger.warning(
                "Router missing required attributes",
                extra={"router": str(router)}
            )
            return False

        # Validate route handlers have security dependencies
        for route in router.routes:
            if not route.dependencies:
                logger.warning(
                    "Route missing security dependencies",
                    extra={"path": route.path, "router": str(router)}
                )
                return False

        return True

    except Exception as e:
        logger.error(
            "Router validation error",
            extra={"error": str(e), "router": str(router)}
        )
        return False

def setup_router_monitoring(router: APIRouter) -> APIRouter:
    """
    Configures monitoring and metrics collection for router.

    Args:
        router: APIRouter instance to configure

    Returns:
        APIRouter: Configured router with monitoring
    """
    # Add metrics middleware to all routes
    @router.middleware("http")
    async def metrics_middleware(request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        # Record metrics
        router_requests.labels(
            router=router.prefix,
            method=request.method,
            status=response.status_code
        ).inc()

        router_latency.labels(
            router=router.prefix,
            method=request.method
        ).observe(duration)

        return response

    return router

# Router configuration with security and monitoring
ROUTER_CONFIG = {
    "prefix": "/v1",
    "tags": ["v1"],
    "dependencies": [],
    "responses": {
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        429: {"description": "Too Many Requests"}
    }
}

# Rate limiting configuration
RATE_LIMIT_CONFIG = {
    "rate_limit": 100,  # requests per timeframe
    "burst_limit": 200,  # burst limit
    "timeframe": 60  # seconds
}

# Validate and configure all routers
routers = [
    analytics_router,
    appointments_router,
    assistants_router,
    auth_router,
    campaigns_router,
    chats_router,
    messages_router,
    payments_router,
    users_router,
    webhooks_router
]

# Setup monitoring for all routers
monitored_routers = [
    setup_router_monitoring(router)
    for router in routers
    if validate_router_config(router)
]

# Export all routers for API registration
__all__ = [
    "analytics_router",
    "appointments_router",
    "assistants_router", 
    "auth_router",
    "campaigns_router",
    "chats_router",
    "messages_router",
    "payments_router",
    "users_router",
    "webhooks_router",
    "ROUTER_CONFIG",
    "RATE_LIMIT_CONFIG"
]