"""
Core middleware components for the Porfin platform.

This module implements secure request/response processing, JWT authentication,
rate limiting, logging and error handling with comprehensive monitoring.

Version: 1.0.0
"""

# Standard library imports
import time
import uuid
from typing import Optional

# Third-party imports - v0.27+
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Internal imports
from app.core.security import verify_token, SecurityHeaders
from app.core.rate_limiter import RateLimitMiddleware
from app.core.logging import log_request, log_response
from app.core.exceptions import AuthenticationError

# Constants
PUBLIC_PATHS = ['/docs', '/redoc', '/openapi.json', '/health', '/metrics']
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin'
}

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for JWT authentication with comprehensive security features."""

    def __init__(
        self,
        request_id_header: str = 'X-Request-ID',
        security_headers: Optional[SecurityHeaders] = None
    ) -> None:
        """
        Initialize authentication middleware with security configuration.

        Args:
            request_id_header: Custom header for request correlation
            security_headers: Security headers configuration
        """
        super().__init__(None)
        self.request_id_header = request_id_header
        self.security_headers = security_headers or SecurityHeaders()
        self.public_paths = set(PUBLIC_PATHS)

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request for authentication with comprehensive security checks.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            Response with security headers

        Raises:
            AuthenticationError: If authentication fails
        """
        # Generate request ID for correlation
        request_id = str(uuid.uuid4())
        request.state.correlation_id = request_id

        # Skip authentication for public paths
        if request.url.path in self.public_paths:
            response = await call_next(request)
            return self._add_security_headers(response, request_id)

        try:
            # Extract and validate JWT token
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                raise AuthenticationError(
                    message="Missing or invalid authorization header",
                    correlation_id=request_id
                )

            token = auth_header.split(' ')[1]
            
            # Verify token and extract claims
            claims = verify_token(token, token_type='access')
            
            # Add user context to request state
            request.state.user = claims
            request.state.user_id = claims.get('sub')
            request.state.security_context = {
                'user_id': claims.get('sub'),
                'roles': claims.get('roles', []),
                'permissions': claims.get('permissions', [])
            }

            # Process request with security context
            start_time = time.time()
            log_request(request)
            
            response = await call_next(request)
            
            duration = time.time() - start_time
            log_response(response, duration, request_id)

            return self._add_security_headers(response, request_id)

        except AuthenticationError as e:
            # Log authentication failure and raise
            e.correlation_id = request_id
            raise

        except Exception as e:
            # Log unexpected errors with security context
            raise AuthenticationError(
                message="Authentication failed",
                details={"error": str(e)},
                correlation_id=request_id
            )

    def _add_security_headers(self, response: Response, request_id: str) -> Response:
        """Add security headers to response."""
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        response.headers[self.request_id_header] = request_id
        return response

class LoggingMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for structured logging with comprehensive monitoring."""

    def __init__(self, request_id_header: str = 'X-Request-ID') -> None:
        """
        Initialize logging middleware with monitoring configuration.

        Args:
            request_id_header: Custom header for request correlation
        """
        super().__init__(None)
        self.request_id_header = request_id_header

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request for logging with performance tracking.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            Processed response with logging
        """
        # Extract or generate request ID
        request_id = request.headers.get(self.request_id_header, str(uuid.uuid4()))
        request.state.correlation_id = request_id

        # Start request timing
        start_time = time.time()

        # Log request details
        log_request(request)

        try:
            # Process request
            response = await call_next(request)

            # Calculate duration and log response
            duration = time.time() - start_time
            log_response(response, duration, request_id)

            # Add correlation header to response
            response.headers[self.request_id_header] = request_id
            
            return response

        except Exception as e:
            # Log error with context
            duration = time.time() - start_time
            log_response(
                Response(status_code=500),
                duration,
                request_id,
                error=str(e)
            )
            raise

__all__ = ['AuthenticationMiddleware', 'LoggingMiddleware']