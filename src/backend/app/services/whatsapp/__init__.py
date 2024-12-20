"""
WhatsApp service initialization module for the Porfin platform.

This module provides a high-performance WhatsApp service coordinator with enhanced
monitoring, health checks, and graceful shutdown capabilities for enterprise-grade
message processing.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime
from typing import Dict, Optional

# Third-party imports
from prometheus_client import Counter, Histogram, Gauge  # v0.17.1
import structlog  # v23.1.0

# Internal imports
from app.services.whatsapp.client import WhatsAppClient
from app.services.whatsapp.handlers import MessageHandler
from app.services.whatsapp.message_queue import WhatsAppMessageQueue

# Module constants
VERSION = '1.0.0'
WHATSAPP_SERVICE_NAME = 'porfin-whatsapp-service'
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 5
HEALTH_CHECK_INTERVAL = 30

# Prometheus metrics
whatsapp_operations = Counter(
    'porfin_whatsapp_operations_total',
    'Total WhatsApp service operations',
    ['operation_type', 'status']
)
whatsapp_latency = Histogram(
    'porfin_whatsapp_latency_seconds',
    'WhatsApp operation latency',
    ['operation_type']
)
whatsapp_health = Gauge(
    'porfin_whatsapp_health_status',
    'WhatsApp service health status',
    ['component']
)

class WhatsAppService:
    """
    Main WhatsApp service coordinator with enhanced monitoring and health checks.
    """

    def __init__(
        self,
        client: WhatsAppClient,
        handler: MessageHandler,
        queue: WhatsAppMessageQueue
    ) -> None:
        """
        Initialize WhatsApp service with required components and monitoring setup.

        Args:
            client: WhatsApp client instance
            handler: Message handler instance
            queue: Message queue instance
        """
        # Initialize structured logger with correlation ID
        self._logger = structlog.get_logger(__name__).bind(
            service=WHATSAPP_SERVICE_NAME,
            version=VERSION
        )

        # Store component instances
        self._client = client
        self._handler = handler
        self._queue = queue

        # Initialize state
        self._initialized = False
        self._health_check_task: Optional[asyncio.Task] = None

        # Initialize metrics
        self._metrics = {
            "uptime_start": None,
            "message_count": 0,
            "error_count": 0,
            "last_health_check": None,
            "component_status": {
                "client": False,
                "handler": False,
                "queue": False
            }
        }

        self._logger.info("WhatsApp service initialized")

    async def initialize(self) -> bool:
        """
        Initialize WhatsApp service and all components with retry mechanism.

        Returns:
            bool: Initialization success status
        """
        self._logger.info("Starting WhatsApp service initialization")
        start_time = datetime.utcnow()

        try:
            # Initialize client with retry
            for attempt in range(MAX_RETRY_ATTEMPTS):
                try:
                    # Connect WhatsApp client
                    connection_status = await self._client.connect()
                    if not connection_status:
                        raise ConnectionError("Failed to connect WhatsApp client")

                    self._metrics["component_status"]["client"] = True
                    whatsapp_health.labels(component="client").set(1)
                    break

                except Exception as e:
                    self._logger.warning(
                        "Connection attempt failed",
                        attempt=attempt + 1,
                        error=str(e)
                    )
                    if attempt == MAX_RETRY_ATTEMPTS - 1:
                        raise
                    await asyncio.sleep(RETRY_DELAY_SECONDS)

            # Start message queue processing
            await self._queue.start_processing()
            self._metrics["component_status"]["queue"] = True
            whatsapp_health.labels(component="queue").set(1)

            # Initialize metrics collection
            self._metrics["uptime_start"] = start_time
            self._metrics["last_health_check"] = datetime.utcnow()

            # Start health check task
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            self._initialized = True

            # Record successful initialization
            duration = (datetime.utcnow() - start_time).total_seconds()
            whatsapp_operations.labels(
                operation_type="initialize",
                status="success"
            ).inc()
            whatsapp_latency.labels(
                operation_type="initialize"
            ).observe(duration)

            self._logger.info(
                "WhatsApp service initialization completed",
                duration=duration
            )
            return True

        except Exception as e:
            self._logger.error(
                "WhatsApp service initialization failed",
                error=str(e)
            )
            whatsapp_operations.labels(
                operation_type="initialize",
                status="error"
            ).inc()
            return False

    async def shutdown(self) -> None:
        """
        Gracefully shutdown WhatsApp service with resource cleanup.
        """
        self._logger.info("Starting WhatsApp service shutdown")
        start_time = datetime.utcnow()

        try:
            # Cancel health check task
            if self._health_check_task:
                self._health_check_task.cancel()
                try:
                    await self._health_check_task
                except asyncio.CancelledError:
                    pass

            # Stop metrics collection
            for component in self._metrics["component_status"]:
                whatsapp_health.labels(component=component).set(0)

            # Stop message queue processing
            if self._metrics["component_status"]["queue"]:
                await self._queue.stop_processing()
                self._metrics["component_status"]["queue"] = False

            # Disconnect WhatsApp client
            if self._metrics["component_status"]["client"]:
                await self._client.disconnect()
                self._metrics["component_status"]["client"] = False

            self._initialized = False

            # Record successful shutdown
            duration = (datetime.utcnow() - start_time).total_seconds()
            whatsapp_operations.labels(
                operation_type="shutdown",
                status="success"
            ).inc()
            whatsapp_latency.labels(
                operation_type="shutdown"
            ).observe(duration)

            self._logger.info(
                "WhatsApp service shutdown completed",
                duration=duration
            )

        except Exception as e:
            self._logger.error(
                "WhatsApp service shutdown failed",
                error=str(e)
            )
            whatsapp_operations.labels(
                operation_type="shutdown",
                status="error"
            ).inc()

    async def _health_check_loop(self) -> None:
        """
        Periodic health check loop for service components.
        """
        while True:
            try:
                health_status = await self.health_check()
                self._metrics["last_health_check"] = datetime.utcnow()

                # Update component health metrics
                for component, status in health_status["components"].items():
                    self._metrics["component_status"][component] = status
                    whatsapp_health.labels(component=component).set(1 if status else 0)

                # Log health status
                self._logger.info(
                    "Health check completed",
                    status=health_status
                )

                await asyncio.sleep(HEALTH_CHECK_INTERVAL)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(
                    "Health check failed",
                    error=str(e)
                )
                await asyncio.sleep(HEALTH_CHECK_INTERVAL)

    async def health_check(self) -> Dict:
        """
        Perform comprehensive health check of service components.

        Returns:
            Dict containing health status of all components
        """
        start_time = datetime.utcnow()

        try:
            # Check client connection
            client_status = await self._client.get_connection_status()

            # Check handler metrics
            handler_metrics = self._handler.get_handler_metrics()
            handler_status = handler_metrics.get("status", False)

            # Check queue status
            queue_metrics = self._queue.get_queue_metrics()
            queue_status = queue_metrics.get("status", False)

            # Prepare health status
            health_status = {
                "healthy": all([client_status, handler_status, queue_status]),
                "timestamp": datetime.utcnow().isoformat(),
                "uptime": (datetime.utcnow() - self._metrics["uptime_start"]).total_seconds() if self._metrics["uptime_start"] else 0,
                "components": {
                    "client": client_status,
                    "handler": handler_status,
                    "queue": queue_status
                },
                "metrics": {
                    "message_count": self._metrics["message_count"],
                    "error_count": self._metrics["error_count"],
                    "handler": handler_metrics,
                    "queue": queue_metrics
                }
            }

            # Record health check metrics
            duration = (datetime.utcnow() - start_time).total_seconds()
            whatsapp_operations.labels(
                operation_type="health_check",
                status="success"
            ).inc()
            whatsapp_latency.labels(
                operation_type="health_check"
            ).observe(duration)

            return health_status

        except Exception as e:
            self._logger.error(
                "Health check failed",
                error=str(e)
            )
            whatsapp_operations.labels(
                operation_type="health_check",
                status="error"
            ).inc()
            return {
                "healthy": False,
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }

# Export WhatsApp service class
__all__ = ["WhatsAppService"]