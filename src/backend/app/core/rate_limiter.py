"""
Rate limiting implementation for the Porfin platform using Redis-based token bucket algorithm.

This module provides secure rate limiting with enhanced monitoring and security features,
implementing a token bucket algorithm with burst allowance and comprehensive logging.

Version: 1.0.0
"""

# Standard library imports
import time
from typing import Dict, Optional

# Third-party imports
from starlette.middleware.base import BaseHTTPMiddleware  # v0.27+
from starlette.requests import Request
from starlette.responses import Response

# Internal imports
from app.db.redis import RedisClient
from app.core.exceptions import PorfinBaseException
from app.core.logging import get_logger
from app.core.security import SecurityContext

# Configure module logger
logger = get_logger(__name__)

# Rate limiting constants
DEFAULT_RATE_LIMIT = 100  # Requests per minute
DEFAULT_WINDOW_SECONDS = 60  # Time window in seconds
DEFAULT_BURST_MULTIPLIER = 1.5  # Burst allowance multiplier
RATE_LIMIT_PREFIX = "rate_limit"  # Redis key prefix for rate limits
VIOLATION_PREFIX = "rate_limit_violation"  # Redis key prefix for violations

class RateLimitExceeded(PorfinBaseException):
    """Enhanced exception for rate limit violations with security context."""

    def __init__(self, message: str, details: Dict, retry_after: int) -> None:
        """
        Initialize rate limit exception with security context.

        Args:
            message: Error message
            details: Violation details
            retry_after: Seconds until rate limit resets
        """
        super().__init__(
            message=message,
            status_code=429,
            details=details
        )
        self.retry_after = retry_after
        self.violation_details = details

        # Log rate limit violation with security context
        logger.warning(
            "Rate limit exceeded",
            extra={
                "security_event": "rate_limit_exceeded",
                "retry_after": retry_after,
                "violation_details": details
            }
        )

class TokenBucket:
    """Secure token bucket implementation with monitoring."""

    def __init__(
        self,
        redis_client: RedisClient,
        rate_limit: int = DEFAULT_RATE_LIMIT,
        window_seconds: int = DEFAULT_WINDOW_SECONDS,
        burst_multiplier: float = DEFAULT_BURST_MULTIPLIER
    ) -> None:
        """
        Initialize token bucket with security features.

        Args:
            redis_client: Redis client instance
            rate_limit: Maximum requests per time window
            window_seconds: Time window in seconds
            burst_multiplier: Burst allowance multiplier
        """
        if rate_limit <= 0 or window_seconds <= 0 or burst_multiplier < 1.0:
            raise ValueError("Invalid rate limit parameters")

        self._redis = redis_client
        self.rate_limit = rate_limit
        self.window_seconds = window_seconds
        self.burst_multiplier = burst_multiplier
        self.metrics = {
            "total_requests": 0,
            "rate_limited": 0,
            "burst_requests": 0
        }

        logger.info(
            "Token bucket initialized",
            extra={
                "rate_limit": rate_limit,
                "window_seconds": window_seconds,
                "burst_multiplier": burst_multiplier
            }
        )

    def get_token_count(self, user_id: str) -> int:
        """
        Get current token count with security validation.

        Args:
            user_id: User identifier for rate limiting

        Returns:
            Current token count
        """
        if not user_id or not isinstance(user_id, str):
            raise ValueError("Invalid user ID")

        key = f"{RATE_LIMIT_PREFIX}:{user_id}"
        count = self._redis.get(key)

        logger.debug(
            "Token count retrieved",
            extra={
                "user_id": user_id,
                "token_count": count,
                "key": key
            }
        )

        return int(count) if count else self.rate_limit

    def consume_token(self, user_id: str) -> bool:
        """
        Securely consume a token with monitoring.

        Args:
            user_id: User identifier for rate limiting

        Returns:
            True if token consumed, False if limit exceeded
        """
        key = f"{RATE_LIMIT_PREFIX}:{user_id}"
        violation_key = f"{VIOLATION_PREFIX}:{user_id}"
        current_time = int(time.time())

        # Update metrics
        self.metrics["total_requests"] += 1

        # Get current token count
        tokens = self.get_token_count(user_id)
        burst_limit = int(self.rate_limit * self.burst_multiplier)

        # Check if rate limit exceeded
        if tokens <= 0 or tokens > burst_limit:
            self.metrics["rate_limited"] += 1
            self._redis.incr(violation_key)
            self._redis.expire(violation_key, self.window_seconds * 2)

            logger.warning(
                "Rate limit exceeded",
                extra={
                    "user_id": user_id,
                    "tokens": tokens,
                    "burst_limit": burst_limit,
                    "security_event": "rate_limit_exceeded"
                }
            )
            return False

        # Consume token
        new_tokens = tokens - 1
        self._redis.set(key, new_tokens)
        self._redis.expire(key, self.window_seconds)

        # Track burst usage
        if new_tokens < self.rate_limit:
            self.metrics["burst_requests"] += 1

        logger.debug(
            "Token consumed",
            extra={
                "user_id": user_id,
                "remaining_tokens": new_tokens,
                "window_expires": current_time + self.window_seconds
            }
        )
        return True

    def get_metrics(self) -> Dict:
        """
        Retrieve rate limiting metrics.

        Returns:
            Dictionary containing collected metrics
        """
        total = self.metrics["total_requests"]
        if total > 0:
            rate_limited_ratio = self.metrics["rate_limited"] / total
            burst_ratio = self.metrics["burst_requests"] / total
        else:
            rate_limited_ratio = 0
            burst_ratio = 0

        return {
            "total_requests": total,
            "rate_limited_requests": self.metrics["rate_limited"],
            "burst_requests": self.metrics["burst_requests"],
            "rate_limited_ratio": rate_limited_ratio,
            "burst_ratio": burst_ratio
        }

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Secure rate limiting middleware with monitoring."""

    def __init__(
        self,
        rate_limit: int = DEFAULT_RATE_LIMIT,
        window_seconds: int = DEFAULT_WINDOW_SECONDS,
        burst_multiplier: float = DEFAULT_BURST_MULTIPLIER
    ) -> None:
        """
        Initialize secure rate limit middleware.

        Args:
            rate_limit: Maximum requests per time window
            window_seconds: Time window in seconds
            burst_multiplier: Burst allowance multiplier
        """
        super().__init__(None)
        self._bucket = TokenBucket(
            redis_client=RedisClient(),
            rate_limit=rate_limit,
            window_seconds=window_seconds,
            burst_multiplier=burst_multiplier
        )
        self._security_context = SecurityContext()

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request with security validation.

        Args:
            request: HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Get user ID from security context
        user_id = self._security_context.get_user_id(request)
        if not user_id:
            logger.warning(
                "Rate limit check failed - no user ID",
                extra={"path": request.url.path}
            )
            return Response(status_code=401)

        # Try to consume token
        if not self._bucket.consume_token(user_id):
            retry_after = self._bucket.window_seconds
            details = {
                "user_id": user_id,
                "path": request.url.path,
                "retry_after": retry_after
            }
            raise RateLimitExceeded(
                message="Rate limit exceeded",
                details=details,
                retry_after=retry_after
            )

        # Add rate limit headers
        response = await call_next(request)
        tokens_remaining = self._bucket.get_token_count(user_id)
        response.headers["X-RateLimit-Limit"] = str(self._bucket.rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(tokens_remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + self._bucket.window_seconds))

        return response

__all__ = ["RateLimitExceeded", "RateLimitMiddleware"]