"""
Configuration initialization module for the Porfin platform.

This module provides centralized access to all application settings through a global
singleton instance, ensuring secure and consistent configuration management across
the FastAPI backend application.

Version: 1.0.0
"""

from .settings import Settings

# Create a global settings instance that will be used throughout the application
settings = Settings()

# Export all settings-related attributes and the settings instance
__all__ = [
    "settings",
    # Core application settings
    "PROJECT_NAME",
    "VERSION",
    "API_V1_PREFIX",
    "ENVIRONMENT",
    "DEBUG",
    "SECRET_KEY",
    
    # Authentication settings
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "REFRESH_TOKEN_EXPIRE_DAYS",
    
    # Firebase settings
    "FIREBASE_PROJECT_ID",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_CLIENT_EMAIL",
    "FIRESTORE_DATABASE",
    
    # Redis settings
    "REDIS_HOST",
    "REDIS_PORT", 
    "REDIS_PASSWORD",
    "REDIS_SSL_ENABLED",
    
    # OpenAI settings
    "OPENAI_API_KEY",
    "OPENAI_MODEL_NAME",
    "OPENAI_MAX_TOKENS",
    
    # WhatsApp settings
    "WHATSAPP_API_TOKEN",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_MESSAGE_RATE_LIMIT",
    
    # Google Calendar settings
    "GOOGLE_CALENDAR_CLIENT_ID",
    "GOOGLE_CALENDAR_CLIENT_SECRET",
    
    # Security settings
    "CORS_ORIGINS",
    "RATE_LIMIT_PER_MINUTE",
    "ENCRYPTION_KEY",
    
    # Utility functions
    "get_redis_url",
    "get_firebase_credentials"
]

# Version information
VERSION = "1.0.0"

# Make all settings available at module level for convenient importing
PROJECT_NAME = settings.PROJECT_NAME
API_V1_PREFIX = settings.API_V1_PREFIX
ENVIRONMENT = settings.ENVIRONMENT
DEBUG = settings.DEBUG
SECRET_KEY = settings.SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS
FIREBASE_PROJECT_ID = settings.FIRESTORE_PROJECT_ID
REDIS_HOST = settings.REDIS_HOST
REDIS_PORT = settings.REDIS_PORT
REDIS_PASSWORD = settings.REDIS_PASSWORD
REDIS_SSL_ENABLED = settings.REDIS_SSL_ENABLED
OPENAI_API_KEY = settings.OPENAI_API_KEY
OPENAI_MODEL_NAME = settings.OPENAI_MODEL_VERSION
OPENAI_MAX_TOKENS = settings.OPENAI_TEMPERATURE
WHATSAPP_API_TOKEN = settings.WHATSAPP_API_TOKEN
WHATSAPP_VERIFY_TOKEN = settings.WHATSAPP_BUSINESS_ID
WHATSAPP_MESSAGE_RATE_LIMIT = settings.MAX_CONNECTIONS_PER_HOST
GOOGLE_CALENDAR_CLIENT_ID = settings.GOOGLE_CALENDAR_CREDENTIALS_PATH
CORS_ORIGINS = settings.BACKEND_CORS_ORIGINS
RATE_LIMIT_PER_MINUTE = settings.REQUEST_TIMEOUT_SECONDS
ENCRYPTION_KEY = settings.SECRET_KEY

# Export utility functions from settings
get_redis_url = settings.get_redis_url
get_firebase_credentials = lambda: {
    "project_id": settings.FIRESTORE_PROJECT_ID,
    "credentials_path": settings.FIREBASE_CREDENTIALS_PATH
}