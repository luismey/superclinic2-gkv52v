"""
Main services initialization module for the Porfin platform.

This module provides a unified interface for all core services including WhatsApp,
AI, analytics, calendar, and payment processing with comprehensive service lifecycle
management, health monitoring, dependency injection, and performance tracking.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime
from typing import Dict, Optional, Any
import logging

# Third-party imports
from opentelemetry import trace  # v1.20.0
from opentelemetry.trace import Status, StatusCode
from prometheus_client import Counter, Histogram, Gauge  # v0.17.1

# Internal imports
from app.services.whatsapp import WhatsAppService
from app.services.ai import AIService
from app.services.analytics import AnalyticsService
from app.core.logging import get_logger
from app.core.exceptions import PorfinBaseException

# Module version
VERSION = '1.0.0'

# Configure logger
logger = get_logger(__name__)

# Service configuration defaults
SERVICES_CONFIG = {
    'whatsapp': {
        'enabled': True,
        'health_check_interval': 60,  # seconds
        'retry_attempts': 3
    },
    'ai': {
        'enabled': True,
        'health_check_interval': 30,
        'retry_attempts': 3
    },
    'analytics': {
        'enabled': True,
        'health_check_interval': 120,
        'retry_attempts': 3
    }
}

# Prometheus metrics
service_operations = Counter(
    'porfin_service_operations_total',
    'Total service operations',
    ['service', 'operation', 'status']
)
service_health = Gauge(
    'porfin_service_health',
    'Service health status',
    ['service']
)
service_latency = Histogram(
    'porfin_service_latency_seconds',
    'Service operation latency',
    ['service', 'operation']
)

class ServiceInitializationError(PorfinBaseException):
    """Custom exception for service initialization failures."""
    pass

class ServiceManager:
    """
    Main service manager class that handles initialization, lifecycle management,
    health monitoring, and access to all core services.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize service manager with core service instances and monitoring setup.

        Args:
            config: Optional configuration overrides
        """
        # Initialize service instances
        self._whatsapp_service: Optional[WhatsAppService] = None
        self._ai_service: Optional[AIService] = None
        self._analytics_service: Optional[AnalyticsService] = None

        # Service tracking
        self._initialized_services: Dict[str, bool] = {
            'whatsapp': False,
            'ai': False,
            'analytics': False
        }
        self._service_health_metrics: Dict[str, float] = {}
        
        # Load configuration
        self._config = {**SERVICES_CONFIG, **(config or {})}
        
        # Initialize tracer
        self._tracer = trace.get_tracer(__name__)
        
        logger.info("Service manager initialized", extra={"config": self._config})

    async def initialize_services(self) -> Dict[str, bool]:
        """
        Initialize all enabled services with retry mechanism and health validation.

        Returns:
            Dict[str, bool]: Service initialization status map
        """
        with self._tracer.start_as_current_span("initialize_services") as span:
            try:
                initialization_results = {}

                # Initialize WhatsApp service if enabled
                if self._config['whatsapp']['enabled']:
                    for attempt in range(self._config['whatsapp']['retry_attempts']):
                        try:
                            self._whatsapp_service = WhatsAppService()
                            await self._whatsapp_service.initialize()
                            self._initialized_services['whatsapp'] = True
                            initialization_results['whatsapp'] = True
                            service_operations.labels(
                                service='whatsapp',
                                operation='initialize',
                                status='success'
                            ).inc()
                            break
                        except Exception as e:
                            logger.error(f"WhatsApp service initialization attempt {attempt + 1} failed: {str(e)}")
                            if attempt == self._config['whatsapp']['retry_attempts'] - 1:
                                initialization_results['whatsapp'] = False
                                service_operations.labels(
                                    service='whatsapp',
                                    operation='initialize',
                                    status='error'
                                ).inc()

                # Initialize AI service if enabled
                if self._config['ai']['enabled']:
                    for attempt in range(self._config['ai']['retry_attempts']):
                        try:
                            self._ai_service = AIService()
                            await self._ai_service.initialize_services()
                            self._initialized_services['ai'] = True
                            initialization_results['ai'] = True
                            service_operations.labels(
                                service='ai',
                                operation='initialize',
                                status='success'
                            ).inc()
                            break
                        except Exception as e:
                            logger.error(f"AI service initialization attempt {attempt + 1} failed: {str(e)}")
                            if attempt == self._config['ai']['retry_attempts'] - 1:
                                initialization_results['ai'] = False
                                service_operations.labels(
                                    service='ai',
                                    operation='initialize',
                                    status='error'
                                ).inc()

                # Initialize Analytics service if enabled
                if self._config['analytics']['enabled']:
                    for attempt in range(self._config['analytics']['retry_attempts']):
                        try:
                            self._analytics_service = AnalyticsService()
                            await self._analytics_service.initialize()
                            self._initialized_services['analytics'] = True
                            initialization_results['analytics'] = True
                            service_operations.labels(
                                service='analytics',
                                operation='initialize',
                                status='success'
                            ).inc()
                            break
                        except Exception as e:
                            logger.error(f"Analytics service initialization attempt {attempt + 1} failed: {str(e)}")
                            if attempt == self._config['analytics']['retry_attempts'] - 1:
                                initialization_results['analytics'] = False
                                service_operations.labels(
                                    service='analytics',
                                    operation='initialize',
                                    status='error'
                                ).inc()

                # Start health monitoring for initialized services
                for service_name, initialized in self._initialized_services.items():
                    if initialized:
                        asyncio.create_task(
                            self.monitor_service_health(service_name)
                        )

                span.set_status(Status(StatusCode.OK))
                return initialization_results

            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logger.error(f"Service initialization failed: {str(e)}")
                raise ServiceInitializationError(
                    message="Failed to initialize services",
                    details={"error": str(e)}
                )

    async def shutdown_services(self) -> None:
        """Gracefully shutdown all initialized services with proper cleanup."""
        with self._tracer.start_as_current_span("shutdown_services") as span:
            try:
                # Shutdown WhatsApp service
                if self._initialized_services['whatsapp']:
                    await self._whatsapp_service.shutdown()
                    self._initialized_services['whatsapp'] = False
                    service_operations.labels(
                        service='whatsapp',
                        operation='shutdown',
                        status='success'
                    ).inc()

                # Shutdown AI service
                if self._initialized_services['ai']:
                    await self._ai_service.shutdown_services()
                    self._initialized_services['ai'] = False
                    service_operations.labels(
                        service='ai',
                        operation='shutdown',
                        status='success'
                    ).inc()

                # Shutdown Analytics service
                if self._initialized_services['analytics']:
                    await self._analytics_service.shutdown()
                    self._initialized_services['analytics'] = False
                    service_operations.labels(
                        service='analytics',
                        operation='shutdown',
                        status='success'
                    ).inc()

                span.set_status(Status(StatusCode.OK))
                logger.info("All services shut down successfully")

            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logger.error(f"Service shutdown failed: {str(e)}")
                raise

    async def monitor_service_health(self, service_name: str) -> None:
        """
        Continuously monitor service health and collect metrics.

        Args:
            service_name: Name of service to monitor
        """
        while self._initialized_services[service_name]:
            try:
                start_time = datetime.utcnow()
                
                # Get service instance
                service = getattr(self, f"_{service_name}_service")
                if not service:
                    continue

                # Perform health check
                health_status = await service.health_check()
                
                # Update metrics
                duration = (datetime.utcnow() - start_time).total_seconds()
                self._service_health_metrics[service_name] = duration
                
                service_health.labels(service=service_name).set(
                    1 if health_status.get('healthy', False) else 0
                )
                service_latency.labels(
                    service=service_name,
                    operation='health_check'
                ).observe(duration)

                # Log health status
                logger.info(
                    f"{service_name} service health check",
                    extra={
                        "service": service_name,
                        "status": health_status,
                        "duration": duration
                    }
                )

                # Wait for next check interval
                await asyncio.sleep(
                    self._config[service_name]['health_check_interval']
                )

            except Exception as e:
                logger.error(
                    f"Health check failed for {service_name}",
                    extra={"error": str(e)}
                )
                service_operations.labels(
                    service=service_name,
                    operation='health_check',
                    status='error'
                ).inc()
                await asyncio.sleep(5)  # Short delay before retry

# Export version and service manager
__all__ = ['ServiceManager', 'VERSION']