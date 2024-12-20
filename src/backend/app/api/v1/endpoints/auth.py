"""
Authentication endpoints module for the Porfin platform.

This module implements secure authentication endpoints with LGPD compliance,
enhanced security features, and comprehensive audit logging for healthcare
professionals in Brazil.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
from typing import Dict, Optional

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter  # v0.1.5
from slowapi.util import get_remote_address
import pytz  # v2023.3

# Internal imports
from app.models.users import UserModel, ValidationError
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
    blacklist_token
)
from app.core.exceptions import AuthenticationError

# Configure router and rate limiter
router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# Configure Brazil timezone
BR_TZ = pytz.timezone('America/Sao_Paulo')

# Configure logger with security context
logger = get_logger(__name__)

# Password policy constants
PASSWORD_MIN_LENGTH = 10
PASSWORD_REQUIREMENTS = {
    "uppercase": 1,
    "numbers": 1,
    "special": 1
}

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/15minute")
async def register(
    user_data: Dict,
    healthcare_id: str,
    lgpd_consent: bool = False
) -> Dict:
    """
    Register a new healthcare professional with LGPD compliance.

    Args:
        user_data: User registration data
        healthcare_id: Brazilian healthcare professional ID (CRM/CRO)
        lgpd_consent: LGPD data processing consent flag

    Returns:
        dict: User data with authentication tokens

    Raises:
        ValidationError: If registration data is invalid
        AuthenticationError: If healthcare ID verification fails
    """
    try:
        # Validate LGPD consent
        if not lgpd_consent:
            raise ValidationError(
                message="LGPD consent is required for registration",
                details={"field": "lgpd_consent"}
            )

        # Validate healthcare professional ID format
        if not _validate_healthcare_id(healthcare_id):
            raise ValidationError(
                message="Invalid healthcare professional ID format",
                details={"field": "healthcare_id"}
            )

        # Validate password complexity
        if not _validate_password_complexity(user_data.get("password", "")):
            raise ValidationError(
                message="Password does not meet security requirements",
                details={"field": "password"}
            )

        # Create user with enhanced security
        user = await UserModel.create({
            **user_data,
            "healthcare_id": healthcare_id,
            "lgpd_consent": {
                "accepted": True,
                "timestamp": datetime.now(BR_TZ).isoformat(),
                "ip_address": get_remote_address()
            }
        })

        # Generate authentication tokens
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})

        # Log successful registration
        logger.info(
            "New healthcare professional registered",
            extra={
                "user_id": user.id,
                "healthcare_id": healthcare_id,
                "security_event": "user_registration"
            }
        )

        return {
            "id": user.id,
            "email": user.email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }

    except Exception as e:
        logger.error(
            "Registration failed",
            extra={
                "error": str(e),
                "healthcare_id": healthcare_id,
                "security_event": "registration_failed"
            }
        )
        raise

@router.post("/login")
@limiter.limit("5/15minute")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    device_id: Optional[str] = None
) -> Dict:
    """
    Authenticate healthcare professional with enhanced security.

    Args:
        form_data: OAuth2 password request form
        device_id: Optional device identifier for audit

    Returns:
        dict: Authentication tokens and user data

    Raises:
        AuthenticationError: If authentication fails
    """
    try:
        # Get user by email
        user = await UserModel.get_by_email(form_data.username)
        if not user:
            raise AuthenticationError("Invalid credentials")

        # Verify password with rate limiting
        if not await user.verify_password(form_data.password):
            raise AuthenticationError("Invalid credentials")

        # Generate new token pair
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})

        # Update last login timestamp
        await user.update_last_login(
            timestamp=datetime.now(BR_TZ),
            device_id=device_id
        )

        # Log successful login
        logger.info(
            "User logged in successfully",
            extra={
                "user_id": user.id,
                "device_id": device_id,
                "security_event": "user_login"
            }
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role
            }
        }

    except Exception as e:
        logger.error(
            "Login failed",
            extra={
                "email": form_data.username,
                "device_id": device_id,
                "error": str(e),
                "security_event": "login_failed"
            }
        )
        raise

@router.post("/refresh")
async def refresh_token(current_refresh_token: str) -> Dict:
    """
    Refresh authentication tokens with rotation.

    Args:
        current_refresh_token: Current valid refresh token

    Returns:
        dict: New token pair

    Raises:
        AuthenticationError: If refresh token is invalid
    """
    try:
        # Verify current refresh token
        payload = verify_token(current_refresh_token, "refresh")
        user_id = payload.get("sub")

        # Generate new token pair
        new_access_token = create_access_token(data={"sub": user_id})
        new_refresh_token = create_refresh_token(data={"sub": user_id})

        # Blacklist current refresh token
        blacklist_token(current_refresh_token, "refresh")

        # Log token refresh
        logger.info(
            "Tokens refreshed successfully",
            extra={
                "user_id": user_id,
                "security_event": "token_refresh"
            }
        )

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }

    except Exception as e:
        logger.error(
            "Token refresh failed",
            extra={
                "error": str(e),
                "security_event": "refresh_failed"
            }
        )
        raise

@router.post("/logout")
async def logout(
    access_token: str,
    refresh_token: str,
    device_id: Optional[str] = None
) -> Dict:
    """
    Logout user and invalidate tokens.

    Args:
        access_token: Current access token
        refresh_token: Current refresh token
        device_id: Optional device identifier

    Returns:
        dict: Logout confirmation

    Raises:
        AuthenticationError: If token invalidation fails
    """
    try:
        # Verify and blacklist both tokens
        access_payload = verify_token(access_token, "access")
        refresh_payload = verify_token(refresh_token, "refresh")

        user_id = access_payload.get("sub")

        blacklist_token(access_token, "access")
        blacklist_token(refresh_token, "refresh")

        # Log logout event
        logger.info(
            "User logged out successfully",
            extra={
                "user_id": user_id,
                "device_id": device_id,
                "security_event": "user_logout"
            }
        )

        return {"message": "Successfully logged out"}

    except Exception as e:
        logger.error(
            "Logout failed",
            extra={
                "error": str(e),
                "device_id": device_id,
                "security_event": "logout_failed"
            }
        )
        raise

def _validate_healthcare_id(healthcare_id: str) -> bool:
    """
    Validate Brazilian healthcare professional ID format.

    Args:
        healthcare_id: CRM/CRO number to validate

    Returns:
        bool: True if format is valid
    """
    # Basic format validation for CRM/CRO
    # Format: CRM/CRO + UF + NUMBER (e.g., CRM-SP-123456)
    import re
    pattern = r'^(CRM|CRO)-[A-Z]{2}-\d{4,6}$'
    return bool(re.match(pattern, healthcare_id.upper()))

def _validate_password_complexity(password: str) -> bool:
    """
    Validate password against security policy.

    Args:
        password: Password to validate

    Returns:
        bool: True if password meets requirements
    """
    if len(password) < PASSWORD_MIN_LENGTH:
        return False

    has_upper = sum(1 for c in password if c.isupper()) >= PASSWORD_REQUIREMENTS["uppercase"]
    has_number = sum(1 for c in password if c.isdigit()) >= PASSWORD_REQUIREMENTS["numbers"]
    has_special = sum(1 for c in password if c in "!@#$%^&*()_+-=[]{}|;:,.<>?") >= PASSWORD_REQUIREMENTS["special"]

    return all([has_upper, has_number, has_special])

# Export router for API inclusion
__all__ = ["router"]