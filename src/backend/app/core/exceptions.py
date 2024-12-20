"""
Custom exception classes and handlers for the Porfin platform.

This module provides standardized error handling with enhanced security features,
detailed logging, and proper sanitization of error messages to prevent information
leakage.

Version: 1.0.0
"""

# Third-party imports
from fastapi import HTTPException, status  # fastapi v0.100+
from fastapi.responses import JSONResponse
from fastapi.requests import Request

# Internal imports
from app.core.logging import get_logger

# Configure logger with security context
logger = get_logger(__name__)

class PorfinBaseException(Exception):
    """
    Base exception class for all custom Porfin exceptions with enhanced security logging
    and context tracking.
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: dict = None,
        correlation_id: str = None,
        security_context: dict = None
    ) -> None:
        """
        Initialize base exception with security context and correlation tracking.

        Args:
            message: Error message (will be sanitized)
            status_code: HTTP status code
            details: Additional error details (will be sanitized)
            correlation_id: Request correlation ID for tracing
            security_context: Security context for audit logging
        """
        super().__init__(message)
        
        # Sanitize error message to prevent information leakage
        self.message = self._sanitize_message(message)
        self.status_code = status_code
        self.details = self._sanitize_details(details or {})
        self.correlation_id = correlation_id
        self.security_context = security_context or {}
        
        # Log exception with security context
        logger.error(
            f"Exception occurred: {self.message}",
            extra={
                "error_type": self.__class__.__name__,
                "status_code": self.status_code,
                "correlation_id": self.correlation_id,
                "security_context": self.security_context,
                "details": self.details
            }
        )

    @staticmethod
    def _sanitize_message(message: str) -> str:
        """Sanitize error message to prevent sensitive data leakage."""
        # Remove potential sensitive information patterns
        sanitized = str(message)
        sensitive_patterns = [
            r"password[=:]\S+",
            r"token[=:]\S+",
            r"key[=:]\S+",
            r"secret[=:]\S+"
        ]
        for pattern in sensitive_patterns:
            sanitized = sanitized.replace(pattern, "[REDACTED]")
        return sanitized

    @staticmethod
    def _sanitize_details(details: dict) -> dict:
        """Sanitize error details to prevent sensitive data leakage."""
        sanitized = details.copy()
        sensitive_keys = {
            "password", "token", "key", "secret", "credential",
            "auth", "authorization", "api_key"
        }
        for key in sensitive_keys:
            if key in sanitized:
                sanitized[key] = "[REDACTED]"
        return sanitized

class AuthenticationError(PorfinBaseException):
    """Exception raised for authentication failures with enhanced security logging."""
    
    def __init__(
        self,
        message: str,
        details: dict = None,
        correlation_id: str = None,
        security_context: dict = None
    ) -> None:
        """
        Initialize authentication error with security context.

        Args:
            message: Authentication error message
            details: Additional error details
            correlation_id: Request correlation ID
            security_context: Security context for audit logging
        """
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
            correlation_id=correlation_id,
            security_context=security_context
        )
        # Log authentication failure with security context
        logger.warning(
            "Authentication failure",
            extra={
                "correlation_id": correlation_id,
                "security_context": security_context,
                "attempt_details": self._sanitize_details(details or {})
            }
        )

class AuthorizationError(PorfinBaseException):
    """Exception raised for authorization failures with audit logging."""
    
    def __init__(
        self,
        message: str,
        details: dict = None,
        correlation_id: str = None,
        security_context: dict = None
    ) -> None:
        """
        Initialize authorization error with audit context.

        Args:
            message: Authorization error message
            details: Additional error details
            correlation_id: Request correlation ID
            security_context: Security context for audit logging
        """
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
            correlation_id=correlation_id,
            security_context=security_context
        )
        # Log authorization failure with audit context
        logger.warning(
            "Authorization failure",
            extra={
                "correlation_id": correlation_id,
                "security_context": security_context,
                "access_attempt": self._sanitize_details(details or {})
            }
        )

class ValidationError(PorfinBaseException):
    """Exception raised for data validation failures with detailed error tracking."""
    
    def __init__(
        self,
        message: str,
        details: dict = None,
        correlation_id: str = None,
        validation_context: dict = None
    ) -> None:
        """
        Initialize validation error with validation context.

        Args:
            message: Validation error message
            details: Validation error details
            correlation_id: Request correlation ID
            validation_context: Context about the validation failure
        """
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
            correlation_id=correlation_id,
            security_context={"validation_context": validation_context}
        )
        # Log validation failure with context
        logger.info(
            "Validation error",
            extra={
                "correlation_id": correlation_id,
                "validation_context": validation_context,
                "validation_errors": self._sanitize_details(details or {})
            }
        )

class WhatsAppError(PorfinBaseException):
    """Exception raised for WhatsApp integration failures with retry logic."""
    
    def __init__(
        self,
        message: str,
        details: dict = None,
        correlation_id: str = None,
        integration_context: dict = None
    ) -> None:
        """
        Initialize WhatsApp error with integration context.

        Args:
            message: WhatsApp error message
            details: Error details
            correlation_id: Request correlation ID
            integration_context: WhatsApp integration context
        """
        super().__init__(
            message=message,
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details,
            correlation_id=correlation_id,
            security_context={"integration_context": integration_context}
        )
        # Log integration failure with context
        logger.error(
            "WhatsApp integration error",
            extra={
                "correlation_id": correlation_id,
                "integration_context": integration_context,
                "error_details": self._sanitize_details(details or {})
            }
        )

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Global exception handler for HTTP exceptions with security logging.

    Args:
        request: FastAPI request object
        exc: HTTP exception instance

    Returns:
        JSONResponse with formatted error details and security headers
    """
    correlation_id = getattr(request.state, "correlation_id", None)
    
    # Log exception with security context
    logger.error(
        f"HTTP exception occurred: {exc.detail}",
        extra={
            "status_code": exc.status_code,
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    # Prepare sanitized response
    response = JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": PorfinBaseException._sanitize_message(str(exc.detail)),
                "status_code": exc.status_code,
                "correlation_id": correlation_id
            }
        }
    )
    
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Correlation-ID"] = correlation_id or ""
    
    return response

async def porfin_exception_handler(request: Request, exc: PorfinBaseException) -> JSONResponse:
    """
    Exception handler for custom Porfin exceptions with enhanced logging.

    Args:
        request: FastAPI request object
        exc: Porfin exception instance

    Returns:
        JSONResponse with formatted error details and security context
    """
    # Log exception with full context
    logger.error(
        f"Porfin exception occurred: {exc.message}",
        extra={
            "error_type": exc.__class__.__name__,
            "status_code": exc.status_code,
            "correlation_id": exc.correlation_id,
            "security_context": exc.security_context,
            "path": request.url.path,
            "method": request.method
        },
        exc_info=True
    )
    
    # Prepare sanitized response
    response = JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "status_code": exc.status_code,
                "correlation_id": exc.correlation_id,
                "details": exc.details
            }
        }
    )
    
    # Add security headers
    response.headers.update({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Correlation-ID": exc.correlation_id or "",
        "X-Error-Type": exc.__class__.__name__
    })
    
    return response

__all__ = [
    "PorfinBaseException",
    "AuthenticationError",
    "AuthorizationError",
    "ValidationError",
    "WhatsAppError",
    "http_exception_handler",
    "porfin_exception_handler"
]