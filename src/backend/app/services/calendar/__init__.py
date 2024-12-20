"""
Calendar service initialization module for Porfin platform.

This module provides comprehensive appointment management functionality with Google Calendar
integration, featuring enhanced security, performance optimization, and Brazilian healthcare
compliance.

Version: 1.0.0
"""

# Standard library imports
from typing import Dict, Optional
import functools

# Third-party imports
import pytz  # version: 2023.3
import structlog  # version: 23.1.0
from tenacity import retry, stop_after_attempt, wait_exponential

# Internal imports
from app.services.calendar.google import GoogleCalendarClient
from app.services.calendar.scheduler import AppointmentScheduler
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Configure module logger
logger = get_logger(__name__)

# Module constants
CALENDAR_SERVICE_VERSION = 'v1'
BRAZIL_TIMEZONE = pytz.timezone('America/Sao_Paulo')
MAX_RETRY_ATTEMPTS = 3
CACHE_EXPIRY_SECONDS = 300

# Default business hours for Brazilian healthcare practices
DEFAULT_BUSINESS_HOURS = {
    'start': '08:00',
    'end': '18:00',
    'break_start': '12:00',
    'break_end': '13:00',
    'timezone': 'America/Sao_Paulo'
}

def validate_config(func):
    """
    Decorator to validate calendar service configuration.
    
    Args:
        func: Function to wrap
        
    Returns:
        Wrapped function with configuration validation
    """
    @functools.wraps(func)
    def wrapper(config: Dict, credentials: Dict, *args, **kwargs):
        # Validate required configuration
        required_fields = ['calendar_id', 'business_hours']
        missing_fields = [field for field in required_fields if field not in config]
        if missing_fields:
            raise ValidationError(
                message="Missing required calendar configuration fields",
                details={"missing_fields": missing_fields}
            )
            
        # Validate credentials
        if not credentials or 'client_email' not in credentials:
            raise ValidationError(
                message="Invalid Google Calendar credentials",
                details={"error": "Missing required credential fields"}
            )
            
        return func(config, credentials, *args, **kwargs)
    return wrapper

@retry(
    stop=stop_after_attempt(MAX_RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
@validate_config
def initialize_calendar_service(
    config: Dict,
    credentials: Dict
) -> 'CalendarService':
    """
    Initialize calendar service with proper configuration and security checks.
    
    Args:
        config: Calendar service configuration including:
            - calendar_id: Google Calendar ID
            - business_hours: Business hours configuration
            - cache_config: Optional caching configuration
        credentials: Google Calendar API credentials
        
    Returns:
        Initialized calendar service instance
        
    Raises:
        ValidationError: If configuration is invalid
    """
    try:
        # Initialize logging with security context
        structured_logger = structlog.get_logger(__name__).bind(
            service="calendar",
            version=CALENDAR_SERVICE_VERSION
        )
        
        # Set up Google Calendar client with retry logic
        calendar_client = GoogleCalendarClient(
            calendar_id=config['calendar_id'],
            business_hours=config.get('business_hours', DEFAULT_BUSINESS_HOURS)
        )
        
        # Initialize appointment scheduler with caching
        scheduler = AppointmentScheduler(
            calendar_id=config['calendar_id'],
            business_hours=config.get('business_hours', DEFAULT_BUSINESS_HOURS),
            cache_config=config.get('cache_config', {
                'ttl': CACHE_EXPIRY_SECONDS,
                'max_size': 1000
            })
        )
        
        # Verify Brazil timezone settings
        if BRAZIL_TIMEZONE.zone != 'America/Sao_Paulo':
            raise ValidationError(
                message="Invalid timezone configuration",
                details={"required_timezone": "America/Sao_Paulo"}
            )
            
        structured_logger.info(
            "Calendar service initialized successfully",
            calendar_id=config['calendar_id']
        )
        
        return CalendarService(
            calendar_client=calendar_client,
            scheduler=scheduler,
            config=config,
            logger=structured_logger
        )
        
    except Exception as e:
        logger.error(
            "Failed to initialize calendar service",
            extra={
                "error": str(e),
                "calendar_id": config.get('calendar_id')
            }
        )
        raise ValidationError(
            message="Calendar service initialization failed",
            details={"error": str(e)}
        )

class CalendarService:
    """
    Calendar service class providing comprehensive appointment management.
    """
    
    def __init__(
        self,
        calendar_client: GoogleCalendarClient,
        scheduler: AppointmentScheduler,
        config: Dict,
        logger: structlog.BoundLogger
    ):
        """
        Initialize calendar service with required components.
        
        Args:
            calendar_client: Configured Google Calendar client
            scheduler: Appointment scheduler instance
            config: Service configuration
            logger: Structured logger instance
        """
        self.calendar_client = calendar_client
        self.scheduler = scheduler
        self.config = config
        self.logger = logger
        
    def __str__(self) -> str:
        """String representation of calendar service."""
        return f"CalendarService(version={CALENDAR_SERVICE_VERSION})"

# Export public interfaces
__all__ = [
    'initialize_calendar_service',
    'CalendarService',
    'GoogleCalendarClient',
    'AppointmentScheduler',
    'CALENDAR_SERVICE_VERSION',
    'BRAZIL_TIMEZONE'
]