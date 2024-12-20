"""
Main entry point for Porfin platform's data models.

This module provides centralized access to all model classes with proper initialization
order, dependency management, and comprehensive performance monitoring.

Version: 1.0.0
"""

# Standard library imports
from typing import Dict, Any
import logging

# Internal imports - version comments as per IE2
from app.models.analytics import AnalyticsModel  # v1.0.0
from app.models.chats import Chat, ChatStatus  # v1.0.0
from app.models.assistants import AssistantModel  # v1.0.0
from app.core.logging import logger  # v1.0.0

# Module metadata
__version__ = "1.0.0"
__author__ = "Porfin Development Team"

# Export commonly used models - as per IE3
__all__ = [
    "AnalyticsModel",
    "Chat",
    "ChatStatus",
    "AssistantModel"
]

def _initialize_models() -> None:
    """
    Initialize all models in the correct order with dependency verification
    and performance monitoring.
    """
    try:
        logger.info(
            "Initializing data models",
            extra={"module": "models", "action": "initialization_start"}
        )

        # Step 1: Initialize AnalyticsModel first as it's a core dependency
        logger.info("Initializing AnalyticsModel...")
        analytics_model = AnalyticsModel()
        
        # Verify analytics initialization
        if not hasattr(analytics_model, '_db_client'):
            raise RuntimeError("AnalyticsModel failed to initialize database client")

        # Step 2: Initialize Chat models with dependencies
        logger.info("Initializing Chat models...")
        chat_model = Chat()
        
        # Verify chat initialization
        if not hasattr(chat_model, '_db'):
            raise RuntimeError("Chat model failed to initialize database connection")

        # Step 3: Initialize AssistantModel with AI dependencies
        logger.info("Initializing AssistantModel...")
        assistant_model = AssistantModel()
        
        # Verify assistant initialization
        if not hasattr(assistant_model, '_gpt_service'):
            raise RuntimeError("AssistantModel failed to initialize GPT service")

        # Log successful initialization
        logger.info(
            "All models initialized successfully",
            extra={
                "module": "models",
                "action": "initialization_complete",
                "models": ["AnalyticsModel", "Chat", "AssistantModel"]
            }
        )

    except Exception as e:
        logger.error(
            f"Model initialization failed: {str(e)}",
            extra={
                "module": "models",
                "action": "initialization_failed",
                "error": str(e)
            },
            exc_info=True
        )
        raise RuntimeError(f"Failed to initialize models: {str(e)}")

# Initialize models when module is imported
_initialize_models()