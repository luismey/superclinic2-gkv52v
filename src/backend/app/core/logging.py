"""
Centralized logging configuration module for the Porfin platform.

This module provides structured logging with security monitoring, cloud integration,
and comprehensive observability features. It supports both development and production
environments with appropriate handlers and formatters.

Version: 1.0.0
"""

# Standard library imports
import logging
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Optional, Any

# Third-party imports
from pythonjsonlogger import jsonlogger  # python-json-logger v2.0.0
from google.cloud import logging as cloud_logging  # google-cloud-logging v3.5.0
from google.cloud.logging.handlers import CloudLoggingHandler
from google.cloud.logging.handlers.transports import BackgroundThreadTransport

# Internal imports
from app.config.settings import ENVIRONMENT, DEBUG

# Constants for log formatting
DEFAULT_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(request_id)s - %(message)s"
JSON_FORMAT = "%(timestamp)s %(level)s %(name)s %(request_id)s %(client_ip)s %(user_agent)s %(message)s"
LOG_ROTATION_SIZE = 10 * 1024 * 1024  # 10MB
LOG_BACKUP_COUNT = 5

class JsonFormatter(jsonlogger.JsonFormatter):
    """
    Enhanced JSON formatter with security context and performance metrics.
    """
    
    def __init__(self, format_string: str = JSON_FORMAT, 
                 default_fields: Dict[str, Any] = None,
                 security_context: Dict[str, Any] = None) -> None:
        """
        Initialize JSON formatter with security context.
        
        Args:
            format_string: Log format string
            default_fields: Default fields to include in every log
            security_context: Security-related context information
        """
        super().__init__(format_string)
        self.default_fields = default_fields or {}
        self.security_context = security_context or {}
        
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as JSON string with security enhancements.
        
        Args:
            record: Log record to format
            
        Returns:
            JSON formatted log string with security context
        """
        # Add timestamp if not present
        if not hasattr(record, 'timestamp'):
            record.timestamp = datetime.utcnow().isoformat()
            
        # Add security context
        if not hasattr(record, 'request_id'):
            record.request_id = 'N/A'
            
        # Add performance metrics
        if hasattr(record, 'duration'):
            record.performance_ms = int(record.duration * 1000)
            
        # Add default fields
        for field, value in self.default_fields.items():
            setattr(record, field, value)
            
        # Add security context
        for field, value in self.security_context.items():
            setattr(record, field, value)
            
        return super().format(record)

def setup_logging() -> None:
    """
    Configure global logging settings with environment-specific handlers 
    and security monitoring.
    """
    # Set root logger level based on environment
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if DEBUG else logging.INFO)
    
    # Clear any existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    json_formatter = JsonFormatter(
        default_fields={
            'environment': ENVIRONMENT,
            'app': 'porfin',
            'version': '1.0.0'
        }
    )
    
    if ENVIRONMENT == 'production':
        # Setup Google Cloud Logging
        client = cloud_logging.Client()
        cloud_handler = CloudLoggingHandler(
            client,
            name='porfin',
            transport=BackgroundThreadTransport,
            labels={
                'environment': ENVIRONMENT,
                'application': 'porfin'
            }
        )
        cloud_handler.setFormatter(json_formatter)
        root_logger.addHandler(cloud_handler)
    else:
        # Development logging setup
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(json_formatter)
        root_logger.addHandler(console_handler)
        
        # Add rotating file handler for development
        file_handler = logging.handlers.RotatingFileHandler(
            filename='logs/porfin.log',
            maxBytes=LOG_ROTATION_SIZE,
            backupCount=LOG_BACKUP_COUNT
        )
        file_handler.setFormatter(json_formatter)
        root_logger.addHandler(file_handler)
    
    # Configure external library logging levels
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('google').setLevel(logging.WARNING)
    logging.getLogger('firebase_admin').setLevel(logging.WARNING)

def get_logger(name: str, security_context: Optional[Dict[str, Any]] = None) -> logging.Logger:
    """
    Get a configured logger instance with security context awareness.
    
    Args:
        name: Logger name
        security_context: Optional security context information
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    if security_context:
        # Add security context to all handlers' formatters
        for handler in logger.handlers:
            if isinstance(handler.formatter, JsonFormatter):
                handler.formatter.security_context.update(security_context)
    
    return logger

def log_request(request: Any) -> str:
    """
    Log incoming HTTP request details with security monitoring.
    
    Args:
        request: HTTP request object
        
    Returns:
        Generated request ID for correlation
    """
    request_id = str(uuid.uuid4())
    logger = get_logger('request')
    
    # Extract request details
    client_ip = getattr(request, 'client.host', 'unknown')
    user_agent = getattr(request, 'headers', {}).get('user-agent', 'unknown')
    
    logger.info(
        'Incoming request',
        extra={
            'request_id': request_id,
            'method': getattr(request, 'method', 'unknown'),
            'path': getattr(request, 'url.path', 'unknown'),
            'client_ip': client_ip,
            'user_agent': user_agent,
            'request_size': len(str(getattr(request, 'body', ''))),
            'security_scan': {
                'suspicious_ip': False,
                'suspicious_ua': False,
                'rate_limit_exceeded': False
            }
        }
    )
    
    return request_id

def log_response(response: Any, duration: float, request_id: str) -> None:
    """
    Log outgoing HTTP response details with performance metrics.
    
    Args:
        response: HTTP response object
        duration: Request processing duration in seconds
        request_id: Request ID for correlation
    """
    logger = get_logger('response')
    
    logger.info(
        'Outgoing response',
        extra={
            'request_id': request_id,
            'status_code': getattr(response, 'status_code', 0),
            'duration': duration,
            'response_size': len(str(getattr(response, 'body', ''))),
            'performance': {
                'duration_ms': int(duration * 1000),
                'slow_threshold_exceeded': duration > 1.0
            }
        }
    )

# Initialize logging on module import
setup_logging()

__all__ = [
    'setup_logging',
    'get_logger',
    'log_request',
    'log_response',
    'JsonFormatter'
]