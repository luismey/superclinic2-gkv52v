"""
Central configuration module for the Porfin platform.

This module provides a comprehensive settings management system using Pydantic for
type safety and validation. It handles all environment-specific configurations,
security settings, and infrastructure parameters.

Version: 1.0.0
"""

# Standard library imports - built-in
import os
import secrets
from typing import List, Optional

# Third-party imports
from pydantic import (  # v2.0.0
    BaseSettings,
    Field,
    validator,
    AnyHttpUrl,
    DirectoryPath,
    FilePath,
    PositiveInt,
    confloat,
)

# Project root path for relative file references
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Valid deployment environments
VALID_ENVIRONMENTS = ["development", "staging", "production"]

def get_random_secret_key() -> str:
    """
    Generate a cryptographically secure random key for JWT signing.
    
    Returns:
        str: A 64-character URL-safe base64-encoded random string
    """
    # Generate 48 bytes which will encode to approximately 64 base64 characters
    token_bytes = secrets.token_bytes(48)
    token = secrets.token_urlsafe(48)
    # Ensure exactly 64 characters by padding or truncating
    return token[:64].ljust(64, "=")

class Settings(BaseSettings):
    """
    Pydantic settings class containing all application configuration.
    
    This class manages all configuration parameters with type validation,
    environment variable loading, and comprehensive documentation.
    """
    
    # Core application settings
    ENVIRONMENT: str = Field(
        default="development",
        description="Deployment environment (development/staging/production)"
    )
    DEBUG: bool = Field(
        default=False,
        description="Debug mode flag - should be False in production"
    )
    SECRET_KEY: str = Field(
        default_factory=get_random_secret_key,
        description="Secret key for JWT signing and encryption"
    )
    PROJECT_NAME: str = Field(
        default="Porfin",
        description="Project name used in API documentation and logs"
    )
    
    # API Configuration
    API_V1_PREFIX: str = Field(
        default="/api/v1",
        description="API version 1 URL prefix"
    )
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = Field(
        default=[],
        description="List of origins permitted for CORS"
    )
    
    # Authentication settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="JWT access token expiration time in minutes"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="JWT refresh token expiration time in days"
    )
    
    # Firebase configuration
    FIREBASE_CREDENTIALS_PATH: FilePath = Field(
        default=os.path.join(PROJECT_ROOT, "credentials", "firebase-admin.json"),
        description="Path to Firebase service account credentials file"
    )
    FIRESTORE_PROJECT_ID: str = Field(
        ...,  # Required field
        description="Google Cloud project ID for Firestore"
    )
    
    # Redis configuration
    REDIS_HOST: str = Field(
        default="localhost",
        description="Redis server hostname"
    )
    REDIS_PORT: int = Field(
        default=6379,
        description="Redis server port"
    )
    REDIS_PASSWORD: Optional[str] = Field(
        default=None,
        description="Redis password for authentication"
    )
    REDIS_SSL_ENABLED: bool = Field(
        default=False,
        description="Enable SSL for Redis connections"
    )
    REDIS_POOL_SIZE: PositiveInt = Field(
        default=10,
        description="Maximum number of Redis connections in the pool"
    )
    
    # OpenAI configuration
    OPENAI_API_KEY: str = Field(
        ...,  # Required field
        description="OpenAI API key for GPT-4 access"
    )
    OPENAI_MODEL_VERSION: str = Field(
        default="gpt-4",
        description="OpenAI model version to use"
    )
    OPENAI_TEMPERATURE: confloat(ge=0.0, le=1.0) = Field(
        default=0.7,
        description="Temperature parameter for OpenAI API calls"
    )
    
    # WhatsApp Business API configuration
    WHATSAPP_API_TOKEN: str = Field(
        ...,  # Required field
        description="WhatsApp Business API access token"
    )
    WHATSAPP_BUSINESS_ID: str = Field(
        ...,  # Required field
        description="WhatsApp Business account ID"
    )
    WHATSAPP_PHONE_NUMBER: str = Field(
        ...,  # Required field
        description="WhatsApp Business phone number"
    )
    
    # Google Calendar integration
    GOOGLE_CALENDAR_CREDENTIALS_PATH: FilePath = Field(
        default=os.path.join(PROJECT_ROOT, "credentials", "google-calendar.json"),
        description="Path to Google Calendar service account credentials"
    )
    
    # HTTP client settings
    MAX_CONNECTIONS_PER_HOST: PositiveInt = Field(
        default=10,
        description="Maximum number of concurrent connections per host"
    )
    REQUEST_TIMEOUT_SECONDS: PositiveInt = Field(
        default=30,
        description="Default timeout for HTTP requests in seconds"
    )
    
    # Logging configuration
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level (DEBUG/INFO/WARNING/ERROR/CRITICAL)"
    )
    LOG_FORMAT: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log message format string"
    )
    
    @validator("ENVIRONMENT")
    def validate_environment(cls, env_name: str) -> str:
        """
        Validate the environment name against allowed values.
        
        Args:
            env_name: Environment name to validate
            
        Returns:
            str: Validated environment name
            
        Raises:
            ValueError: If environment name is not valid
        """
        env_name = env_name.lower()
        if env_name not in VALID_ENVIRONMENTS:
            raise ValueError(
                f"Invalid environment '{env_name}'. "
                f"Must be one of: {', '.join(VALID_ENVIRONMENTS)}"
            )
        return env_name
    
    def get_redis_url(self) -> str:
        """
        Construct the complete Redis connection URL.
        
        Returns:
            str: Formatted Redis connection URL with authentication and SSL if enabled
        """
        protocol = "rediss" if self.REDIS_SSL_ENABLED else "redis"
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return (
            f"{protocol}://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}"
            f"?encoding=utf-8&max_connections={self.REDIS_POOL_SIZE}"
        )
    
    class Config:
        """Pydantic model configuration."""
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

# Create global settings instance
settings = Settings()

# Export commonly used settings
__all__ = [
    "settings",
    "VALID_ENVIRONMENTS",
    "PROJECT_ROOT"
]