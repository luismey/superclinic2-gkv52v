"""
User management endpoints with enhanced healthcare-specific features, LGPD compliance,
and Brazilian regulatory requirements.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import List, Optional

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import SecurityScopes
from slowapi import Limiter
from slowapi.util import get_remote_address

# Internal imports
from app.models.users import UserModel
from app.utils.validators import (
    validate_email,
    validate_password,
    validate_document,
    validate_phone_number
)
from app.core.security import (
    get_password_hash,
    create_access_token,
    create_refresh_token
)
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ValidationError
)
from app.core.logging import get_logger

# Initialize router and logger
router = APIRouter(prefix="/users", tags=["users"])
logger = get_logger(__name__)

# Constants
HEALTHCARE_ROLES = ["doctor", "dentist", "nurse", "admin", "manager", "secretary"]
RATE_LIMIT_ATTEMPTS = 5
PROFESSIONAL_ID_PREFIXES = {
    "doctor": "CRM",
    "dentist": "CRO",
    "nurse": "COREN"
}

# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address)

async def get_current_user(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme)
) -> UserModel:
    """
    Enhanced dependency for getting current authenticated user with healthcare role validation.

    Args:
        security_scopes: Security scopes for role-based access
        token: JWT access token

    Returns:
        UserModel: Current authenticated user

    Raises:
        AuthenticationError: If authentication fails
        AuthorizationError: If user lacks required permissions
    """
    try:
        # Verify JWT token
        payload = verify_token(token, token_type="access")
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("Invalid token payload")

        # Retrieve user from database
        user = await UserModel.get_by_id(user_id)
        if not user:
            raise AuthenticationError("User not found")

        # Validate user status
        if not user.is_active:
            raise AuthenticationError("User account is disabled")

        # Validate security scopes
        if security_scopes.scopes:
            if not user.role in security_scopes.scopes:
                raise AuthorizationError(
                    "Insufficient permissions",
                    details={"required_scopes": security_scopes.scopes}
                )

        # Log access
        logger.info(
            "User authenticated",
            extra={
                "user_id": user_id,
                "role": user.role,
                "scopes": security_scopes.scopes
            }
        )

        return user

    except Exception as e:
        logger.error(
            "Authentication failed",
            extra={"error": str(e), "token_preview": token[:10] if token else None}
        )
        raise

@router.post("/", response_model=UserInDB, status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{RATE_LIMIT_ATTEMPTS}/minute")
async def create_user(
    user_data: UserCreate,
    current_user: UserModel = Security(
        get_current_user,
        scopes=["admin", "manager"]
    )
) -> UserInDB:
    """
    Create a new user with healthcare role validation and LGPD compliance.

    Args:
        user_data: User creation data
        current_user: Current authenticated user with admin/manager role

    Returns:
        UserInDB: Created user data

    Raises:
        ValidationError: If validation fails
        AuthorizationError: If current user lacks permissions
    """
    try:
        # Validate email format
        if not validate_email(user_data.email):
            raise ValidationError("Invalid email format")

        # Validate password strength
        password_valid, password_error = validate_password(user_data.password)
        if not password_valid:
            raise ValidationError(f"Invalid password: {password_error}")

        # Validate healthcare role
        if user_data.role not in HEALTHCARE_ROLES:
            raise ValidationError(
                f"Invalid role. Must be one of: {', '.join(HEALTHCARE_ROLES)}"
            )

        # Validate professional credentials for healthcare roles
        if user_data.role in PROFESSIONAL_ID_PREFIXES:
            if not user_data.professional_id:
                raise ValidationError(
                    f"{user_data.role.title()} registration number is required"
                )
            
            prefix = PROFESSIONAL_ID_PREFIXES[user_data.role]
            if not user_data.professional_id.startswith(prefix):
                raise ValidationError(
                    f"Professional ID must start with {prefix}"
                )

        # Validate Brazilian documents
        if user_data.cpf and not validate_document(user_data.cpf, "cpf"):
            raise ValidationError("Invalid CPF number")

        if user_data.phone and not validate_phone_number(user_data.phone):
            raise ValidationError("Invalid phone number")

        # Check email uniqueness
        existing_user = await UserModel.get_by_email(user_data.email)
        if existing_user:
            raise ValidationError("Email already registered")

        # Prepare user data with LGPD compliance
        user_dict = user_data.dict(exclude={"password"})
        user_dict.update({
            "hashed_password": get_password_hash(user_data.password),
            "created_by": current_user.id,
            "created_at": datetime.utcnow(),
            "consent_data": {
                "terms_accepted": True,
                "privacy_policy_accepted": True,
                "data_collection_consent": True,
                "consent_date": datetime.utcnow().isoformat()
            }
        })

        # Create user
        new_user = await UserModel.create(user_dict)

        # Log user creation
        logger.info(
            "User created",
            extra={
                "created_user_id": new_user.id,
                "created_by": current_user.id,
                "role": new_user.role
            }
        )

        return UserInDB.from_orm(new_user)

    except Exception as e:
        logger.error(
            "User creation failed",
            extra={
                "error": str(e),
                "email": user_data.email,
                "role": user_data.role
            }
        )
        raise

@router.get("/me", response_model=UserInDB)
async def get_current_user_profile(
    current_user: UserModel = Depends(get_current_user)
) -> UserInDB:
    """Get current user's profile data."""
    return UserInDB.from_orm(current_user)

@router.put("/me", response_model=UserInDB)
@limiter.limit(f"{RATE_LIMIT_ATTEMPTS}/minute")
async def update_current_user(
    user_update: UserUpdate,
    current_user: UserModel = Depends(get_current_user)
) -> UserInDB:
    """
    Update current user's profile with validation.

    Args:
        user_update: User update data
        current_user: Current authenticated user

    Returns:
        UserInDB: Updated user data
    """
    try:
        update_data = user_update.dict(exclude_unset=True)

        # Validate updates
        if "email" in update_data:
            if not validate_email(update_data["email"]):
                raise ValidationError("Invalid email format")
            
            existing_user = await UserModel.get_by_email(update_data["email"])
            if existing_user and existing_user.id != current_user.id:
                raise ValidationError("Email already registered")

        if "phone" in update_data and not validate_phone_number(update_data["phone"]):
            raise ValidationError("Invalid phone number")

        # Update user
        updated_user = await current_user.update(update_data)

        logger.info(
            "User profile updated",
            extra={"user_id": current_user.id, "updated_fields": list(update_data.keys())}
        )

        return UserInDB.from_orm(updated_user)

    except Exception as e:
        logger.error(
            "Profile update failed",
            extra={"user_id": current_user.id, "error": str(e)}
        )
        raise

@router.delete("/me")
async def delete_current_user(
    current_user: UserModel = Depends(get_current_user)
) -> dict:
    """
    Delete current user's account with LGPD compliance.

    Returns:
        dict: Deletion confirmation
    """
    try:
        # Perform LGPD-compliant deletion
        await current_user.delete()

        logger.info(
            "User account deleted",
            extra={"user_id": current_user.id}
        )

        return {"message": "Account deleted successfully"}

    except Exception as e:
        logger.error(
            "Account deletion failed",
            extra={"user_id": current_user.id, "error": str(e)}
        )
        raise

# Export router
__all__ = ["router"]