"""
Core security module for the Porfin platform.

This module implements JWT authentication, password hashing, token management,
and enhanced security features with comprehensive logging and monitoring.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
import uuid
from typing import Optional, Dict, Any

# Third-party imports
from passlib.context import CryptContext  # v1.7.4
from jose import jwt, JWTError  # python-jose[cryptography] v3.3.0
from redis import Redis  # redis v4.5.0

# Internal imports
from app.config.settings import (
    SECRET_KEY,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECURITY_CONFIG
)
from app.core.exceptions import AuthenticationError
from app.core.logging import get_logger

# Configure security logger
security_logger = get_logger(__name__)

# Configure password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # High security for healthcare data
)

# JWT configuration
ALGORITHM = "HS256"
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

# Redis client for token blacklist
redis_client = Redis(
    host=SECURITY_CONFIG['redis_host'],
    port=SECURITY_CONFIG['redis_port'],
    ssl=SECURITY_CONFIG.get('redis_ssl', False),
    password=SECURITY_CONFIG.get('redis_password'),
    decode_responses=True
)

def verify_password(plain_password: str, hashed_password: str, user_id: str) -> bool:
    """
    Verify a plain password against a hashed password with rate limiting.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Bcrypt hashed password to compare against
        user_id: User ID for rate limiting

    Returns:
        bool: True if password matches hash
    """
    # Check rate limit
    rate_limit_key = f"auth_attempts:{user_id}"
    attempts = redis_client.incr(rate_limit_key)
    
    if attempts == 1:
        # Set key expiration on first attempt
        redis_client.expire(rate_limit_key, 300)  # 5 minutes window
    
    if attempts > 5:  # Max 5 attempts per 5 minutes
        security_logger.warning(
            "Rate limit exceeded for password verification",
            extra={
                "user_id": user_id,
                "attempts": attempts,
                "security_event": "rate_limit_exceeded"
            }
        )
        return False

    # Verify password
    is_valid = pwd_context.verify(plain_password, hashed_password)
    
    if not is_valid:
        security_logger.warning(
            "Failed password verification attempt",
            extra={
                "user_id": user_id,
                "attempts": attempts,
                "security_event": "failed_password_verification"
            }
        )
    
    return is_valid

def get_password_hash(password: str) -> str:
    """
    Generate a secure hash from a plain password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        str: Bcrypt hashed password

    Raises:
        ValueError: If password doesn't meet complexity requirements
    """
    # Validate password complexity
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one number")
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        raise ValueError("Password must contain at least one special character")

    # Generate hash
    hashed = pwd_context.hash(password)
    
    security_logger.info(
        "Password hash generated",
        extra={"security_event": "password_hash_generated"}
    )
    
    return hashed

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a new JWT access token with enhanced security.

    Args:
        data: Token payload data
        expires_delta: Optional custom expiration time

    Returns:
        str: Encoded JWT access token
    """
    # Create copy of data to avoid mutations
    payload = data.copy()
    
    # Add security claims
    payload.update({
        "jti": str(uuid.uuid4()),  # Unique token ID
        "type": TOKEN_TYPE_ACCESS,
        "iat": datetime.utcnow(),
        "iss": "porfin.auth"
    })
    
    # Set expiration
    expire = datetime.utcnow() + (
        expires_delta if expires_delta
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire

    # Create token
    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    security_logger.info(
        "Access token created",
        extra={
            "token_type": TOKEN_TYPE_ACCESS,
            "user_id": data.get("sub"),
            "expires": expire.isoformat(),
            "security_event": "token_created"
        }
    )
    
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Create a new JWT refresh token with rotation support.

    Args:
        data: Token payload data

    Returns:
        str: Encoded JWT refresh token
    """
    # Create copy of data to avoid mutations
    payload = data.copy()
    
    # Generate unique token ID
    token_id = str(uuid.uuid4())
    
    # Add security claims
    payload.update({
        "jti": token_id,
        "type": TOKEN_TYPE_REFRESH,
        "iat": datetime.utcnow(),
        "iss": "porfin.auth"
    })
    
    # Set expiration
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload["exp"] = expire
    
    # Store token ID in Redis for rotation tracking
    redis_client.setex(
        f"refresh_token:{token_id}",
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS).total_seconds(),
        "valid"
    )
    
    # Create token
    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    security_logger.info(
        "Refresh token created",
        extra={
            "token_type": TOKEN_TYPE_REFRESH,
            "user_id": data.get("sub"),
            "token_id": token_id,
            "expires": expire.isoformat(),
            "security_event": "token_created"
        }
    )
    
    return encoded_jwt

def verify_token(token: str, token_type: str) -> Dict[str, Any]:
    """
    Verify and decode a JWT token with blacklist check.

    Args:
        token: JWT token to verify
        token_type: Expected token type (access/refresh)

    Returns:
        dict: Decoded token payload

    Raises:
        AuthenticationError: If token is invalid or blacklisted
    """
    try:
        # Check token blacklist
        if redis_client.exists(f"blacklist:{token}"):
            raise AuthenticationError("Token has been revoked")
        
        # Decode token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify token type
        if payload.get("type") != token_type:
            raise AuthenticationError("Invalid token type")
        
        # For refresh tokens, verify token ID is still valid
        if token_type == TOKEN_TYPE_REFRESH:
            token_id = payload.get("jti")
            if not redis_client.exists(f"refresh_token:{token_id}"):
                raise AuthenticationError("Refresh token has been rotated")
        
        security_logger.info(
            "Token verified successfully",
            extra={
                "token_type": token_type,
                "user_id": payload.get("sub"),
                "security_event": "token_verified"
            }
        )
        
        return payload
        
    except JWTError as e:
        security_logger.warning(
            "Token verification failed",
            extra={
                "token_type": token_type,
                "error": str(e),
                "security_event": "token_verification_failed"
            }
        )
        raise AuthenticationError("Invalid token")

def blacklist_token(token: str, token_type: str) -> bool:
    """
    Add a token to the blacklist.

    Args:
        token: JWT token to blacklist
        token_type: Type of token (access/refresh)

    Returns:
        bool: Success status
    """
    try:
        # Decode token to get expiration
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"])
        
        # Calculate TTL for blacklist entry
        ttl = (exp - datetime.utcnow()).total_seconds()
        if ttl <= 0:
            return True  # Token already expired
        
        # Add to blacklist with expiration
        redis_client.setex(f"blacklist:{token}", int(ttl), "revoked")
        
        # If refresh token, remove from valid tokens
        if token_type == TOKEN_TYPE_REFRESH:
            token_id = payload.get("jti")
            redis_client.delete(f"refresh_token:{token_id}")
        
        security_logger.info(
            "Token blacklisted",
            extra={
                "token_type": token_type,
                "user_id": payload.get("sub"),
                "expires": exp.isoformat(),
                "security_event": "token_blacklisted"
            }
        )
        
        return True
        
    except JWTError as e:
        security_logger.error(
            "Failed to blacklist token",
            extra={
                "token_type": token_type,
                "error": str(e),
                "security_event": "token_blacklist_failed"
            }
        )
        return False