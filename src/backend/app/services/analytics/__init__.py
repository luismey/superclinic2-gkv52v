"""
Analytics service initialization module for the Porfin platform.
Provides secure, high-performance, and LGPD-compliant analytics functionality
with comprehensive metrics tracking, reporting, and AI-powered insights.

Version: 1.0.0
"""

# Standard library imports
from typing import Dict, Optional, Any
from functools import wraps
import time

# Third-party imports
from prometheus_client import Counter, Histogram  # version: 0.17.1

# Internal imports
from app.services.analytics.metrics import MetricsService
from app.services.analytics.reports import ReportService
from app.services.analytics.insights import InsightsService
from app.core.security import SecurityContext
from app.core.logging import get_logger
from app.core.exceptions import ValidationError

# Initialize logger
logger = get_logger(__name__)

# Version information
VERSION = "1.0.0"

# Module configuration
ANALYTICS_MODULES = ["metrics", "reports", "insights"]
PERFORMANCE_THRESHOLDS = {
    "max_latency_ms": 500,
    "min_throughput_msgs": 100
}

# Prometheus metrics
METRICS_PREFIX = "porfin_analytics"
analytics_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total analytics operations",
    ["module", "operation", "status"]
)
analytics_latency = Histogram(
    f"{METRICS_PREFIX}_operation_latency_seconds",
    "Analytics operation latency",
    ["module", "operation"]
)

def performance_monitored(func):
    """Decorator for monitoring operation performance."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        module = args[0].__class__.__name__ if args else "unknown"
        operation = func.__name__
        
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Record metrics
            analytics_operations.labels(
                module=module,
                operation=operation,
                status="success"
            ).inc()
            analytics_latency.labels(
                module=module,
                operation=operation
            ).observe(duration)
            
            # Check performance thresholds
            if duration * 1000 > PERFORMANCE_THRESHOLDS["max_latency_ms"]:
                logger.warning(
                    f"Operation exceeded latency threshold",
                    extra={
                        "module": module,
                        "operation": operation,
                        "duration_ms": duration * 1000
                    }
                )
            
            return result
            
        except Exception as e:
            analytics_operations.labels(
                module=module,
                operation=operation,
                status="error"
            ).inc()
            raise e
            
    return wrapper

def audit_logged(func):
    """Decorator for audit logging of analytics operations."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        module = args[0].__class__.__name__ if args else "unknown"
        operation = func.__name__
        
        logger.info(
            f"Analytics operation started",
            extra={
                "module": module,
                "operation": operation,
                "parameters": str(kwargs)
            }
        )
        
        try:
            result = await func(*args, **kwargs)
            
            logger.info(
                f"Analytics operation completed",
                extra={
                    "module": module,
                    "operation": operation,
                    "status": "success"
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(
                f"Analytics operation failed",
                extra={
                    "module": module,
                    "operation": operation,
                    "error": str(e)
                }
            )
            raise e
            
    return wrapper

class AnalyticsService:
    """
    Enhanced analytics service providing secure, high-performance access to all
    analytics functionality with LGPD compliance.
    """
    
    def __init__(self, security_context: SecurityContext):
        """
        Initialize analytics service with security context and performance monitoring.

        Args:
            security_context: Security context for LGPD compliance validation
        """
        # Validate LGPD compliance
        if not security_context.validate_lgpd_compliance():
            raise ValidationError(
                message="Security context does not meet LGPD requirements",
                details={"context": "analytics_service_init"}
            )
        
        self._security_context = security_context
        self._metrics_service = MetricsService()
        self._report_service = ReportService(self._metrics_service)
        self._insights_service = InsightsService()
        
        # Initialize performance metrics
        self._performance_metrics = {
            "total_operations": 0,
            "average_latency": 0,
            "error_count": 0
        }
        
        logger.info(
            "Analytics service initialized",
            extra={"modules": ANALYTICS_MODULES}
        )

    @performance_monitored
    @audit_logged
    async def get_metrics_service(self) -> MetricsService:
        """
        Returns the secure metrics service instance with performance monitoring.

        Returns:
            MetricsService: Secure metrics service instance
        """
        # Validate security context
        if not self._security_context.validate_lgpd_compliance():
            raise ValidationError(
                message="Invalid security context for metrics access",
                details={"service": "metrics"}
            )
        
        return self._metrics_service

    @performance_monitored
    @audit_logged
    async def get_report_service(self) -> ReportService:
        """
        Returns the secure report service instance with performance monitoring.

        Returns:
            ReportService: Secure report service instance
        """
        # Validate security context
        if not self._security_context.validate_lgpd_compliance():
            raise ValidationError(
                message="Invalid security context for report access",
                details={"service": "reports"}
            )
        
        return self._report_service

    @performance_monitored
    @audit_logged
    async def get_insights_service(self) -> InsightsService:
        """
        Returns the secure insights service instance with performance monitoring.

        Returns:
            InsightsService: Secure insights service instance
        """
        # Validate security context
        if not self._security_context.validate_lgpd_compliance():
            raise ValidationError(
                message="Invalid security context for insights access",
                details={"service": "insights"}
            )
        
        return self._insights_service

    @performance_monitored
    async def check_health(self) -> Dict[str, Any]:
        """
        Performs health check on all analytics services.

        Returns:
            Dict containing health status of all services
        """
        health_status = {
            "status": "healthy",
            "services": {},
            "performance": self._performance_metrics
        }
        
        try:
            # Check metrics service
            metrics_status = await self._metrics_service.check_health()
            health_status["services"]["metrics"] = metrics_status
            
            # Check report service
            report_status = await self._report_service.check_health()
            health_status["services"]["reports"] = report_status
            
            # Check insights service
            insights_status = await self._insights_service.check_health()
            health_status["services"]["insights"] = insights_status
            
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
            
            logger.error(
                "Analytics health check failed",
                extra={"error": str(e)}
            )
        
        return health_status

# Export version and performance thresholds
__all__ = [
    "AnalyticsService",
    "VERSION",
    "PERFORMANCE_THRESHOLDS"
]