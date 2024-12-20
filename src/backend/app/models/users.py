"""
Core user model module for the Porfin platform.

This module implements a comprehensive user model with role-based access control,
LGPD compliance, and enhanced security features for healthcare professionals.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
import uuid
from typing import Dict, List, Optional, Any

# Third-party imports - pydantic v2.0.0
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr

# Internal imports
from app.db.firestore import FirestoreClient
from app.core.security import get_password_hash, verify_password
from app.core.exceptions import ValidationError, AuthenticationError

# Collection and security constants
COLLECTION_NAME = "users"
USER_ROLES = ["admin", "manager", "secretary"]
PASSWORD_HISTORY_SIZE = 5
MAX_LOGIN_ATTEMPTS = 3
LOCKOUT_DURATION_MINUTES = 30

class UserModel(BaseModel):
    """
    Enhanced user model with comprehensive security features and LGPD compliance.
    """
    
    # Core user fields
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=100)
    hashed_password: str
    role: str = Field(default="secretary")
    is_active: bool = Field(default=True)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Security fields
    password_history: List[str] = Field(default_factory=list)
    login_attempts: int = Field(default=0)
    lockout_until: Optional[datetime] = None
    mfa_settings: Dict[str, Any] = Field(default_factory=dict)
    
    # LGPD compliance fields
    consent_data: Dict[str, Any] = Field(default_factory=lambda: {
        "terms_accepted": False,
        "privacy_policy_accepted": False,
        "marketing_consent": False,
        "data_collection_consent": False,
        "consent_date": None
    })
    
    # Audit trail
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            SecretStr: lambda v: v.get_secret_value() if v else None
        }

    @validator("role")
    def validate_role(cls, v: str) -> str:
        """Validate user role against allowed roles."""
        if v not in USER_ROLES:
            raise ValidationError(
                message=f"Invalid role: {v}. Must be one of: {', '.join(USER_ROLES)}"
            )
        return v

    def add_audit_log(self, action: str, details: Dict[str, Any]) -> None:
        """Add an entry to the user's audit trail."""
        self.audit_trail.append({
            "timestamp": datetime.utcnow(),
            "action": action,
            "details": details
        })

    @classmethod
    async def create(cls, user_data: Dict[str, Any]) -> "UserModel":
        """
        Create a new user with security checks and LGPD compliance.

        Args:
            user_data: User creation data including password

        Returns:
            Created UserModel instance

        Raises:
            ValidationError: If validation fails
            AuthenticationError: If security checks fail
        """
        db = FirestoreClient()
        
        # Validate email uniqueness
        existing_user = await cls.get_by_email(user_data["email"])
        if existing_user:
            raise ValidationError("Email already registered")

        # Hash password and create password history
        plain_password = user_data.pop("password")
        hashed_password = get_password_hash(plain_password)
        
        # Prepare user data
        user_data.update({
            "hashed_password": hashed_password,
            "password_history": [hashed_password],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

        # Create user instance
        user = cls(**user_data)

        # Create user document in transaction
        async with db.transaction() as transaction:
            await transaction.create_document(
                COLLECTION_NAME,
                user.id,
                user.dict(exclude={"audit_trail"})
            )
            
            # Add creation audit log
            user.add_audit_log(
                action="user_created",
                details={"created_by": user_data.get("created_by", "system")}
            )

        return user

    @classmethod
    async def get_by_id(cls, user_id: str) -> Optional["UserModel"]:
        """
        Retrieve user by ID with security checks.

        Args:
            user_id: User ID to retrieve

        Returns:
            UserModel instance if found
        """
        db = FirestoreClient()
        user_data = await db.get_document(COLLECTION_NAME, user_id)
        return cls(**user_data) if user_data else None

    @classmethod
    async def get_by_email(cls, email: str) -> Optional["UserModel"]:
        """
        Retrieve user by email with security checks.

        Args:
            email: User email to retrieve

        Returns:
            UserModel instance if found
        """
        db = FirestoreClient()
        users = await db.query_documents(
            COLLECTION_NAME,
            [("email", "==", email)]
        )
        return cls(**users[0]) if users else None

    async def verify_password(self, password: str) -> bool:
        """
        Verify password with brute force protection.

        Args:
            password: Password to verify

        Returns:
            bool: Password verification result
        """
        # Check account lockout
        if self.lockout_until and datetime.utcnow() < self.lockout_until:
            raise AuthenticationError("Account is temporarily locked")

        # Verify password
        is_valid = verify_password(password, self.hashed_password, self.id)

        if not is_valid:
            # Increment login attempts
            self.login_attempts += 1
            
            # Check if account should be locked
            if self.login_attempts >= MAX_LOGIN_ATTEMPTS:
                self.lockout_until = datetime.utcnow() + timedelta(
                    minutes=LOCKOUT_DURATION_MINUTES
                )
                
            await self.save()
            
        else:
            # Reset login attempts on successful verification
            if self.login_attempts > 0:
                self.login_attempts = 0
                self.lockout_until = None
                await self.save()

        return is_valid

    async def change_password(self, new_password: str) -> bool:
        """
        Change user password with history check.

        Args:
            new_password: New password to set

        Returns:
            bool: Password change success status

        Raises:
            ValidationError: If password fails validation
        """
        # Hash new password
        new_hash = get_password_hash(new_password)

        # Check password history
        for old_hash in self.password_history:
            if verify_password(new_password, old_hash, self.id):
                raise ValidationError(
                    "Password has been used recently. Please choose a different password."
                )

        # Update password and history
        self.hashed_password = new_hash
        self.password_history.append(new_hash)
        
        # Maintain history size
        if len(self.password_history) > PASSWORD_HISTORY_SIZE:
            self.password_history = self.password_history[-PASSWORD_HISTORY_SIZE:]

        # Add audit log
        self.add_audit_log(
            action="password_changed",
            details={"timestamp": datetime.utcnow()}
        )

        await self.save()
        return True

    async def save(self) -> bool:
        """
        Save user changes to database.

        Returns:
            bool: Save operation success status
        """
        db = FirestoreClient()
        self.updated_at = datetime.utcnow()
        
        try:
            await db.update_document(
                COLLECTION_NAME,
                self.id,
                self.dict(exclude={"audit_trail"})
            )
            return True
        except Exception as e:
            return False

    def has_permission(self, required_role: str) -> bool:
        """
        Check if user has required role permission.

        Args:
            required_role: Role to check against

        Returns:
            bool: True if user has required role
        """
        role_hierarchy = {
            "admin": 3,
            "manager": 2,
            "secretary": 1
        }
        
        user_level = role_hierarchy.get(self.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        return user_level >= required_level

# Export commonly used items
__all__ = [
    "UserModel",
    "USER_ROLES",
    "ValidationError",
    "AuthenticationError"
]