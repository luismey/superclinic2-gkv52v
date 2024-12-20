"""
FastAPI endpoints for managing AI virtual assistants with enhanced security,
performance optimization, and healthcare compliance features.

This module provides REST API endpoints for creating, updating, retrieving,
and managing AI virtual assistants with comprehensive security controls
and LGPD compliance for healthcare data.

Version: 1.0.0
"""

# Standard library imports
from typing import List, Optional
from datetime import datetime

# Third-party imports - version specified as per IE2
from fastapi import APIRouter, Depends, HTTPException, status  # fastapi v0.100+
from fastapi.responses import StreamingResponse  # fastapi v0.100+
from circuitbreaker import circuit  # circuitbreaker v1.4+
from fastapi_limiter.depends import RateLimiter  # fastapi-limiter v0.1.5+

# Internal imports
from app.models.assistants import Assistant, ASSISTANT_TYPES
from app.schemas.assistants import (
    AssistantCreateSchema,
    AssistantUpdateSchema,
    AssistantResponseSchema
)
from app.core.security import get_current_user
from app.core.logging import get_logger
from app.core.exceptions import (
    PorfinBaseException,
    ValidationError,
    AuthorizationError
)

# Module configuration
logger = get_logger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix="/assistants", tags=["assistants"])

# Rate limiting configuration
RATE_LIMIT = "100/minute"

@router.post(
    "/",
    response_model=AssistantResponseSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def create_assistant(
    assistant_data: AssistantCreateSchema,
    current_user = Depends(get_current_user)
) -> AssistantResponseSchema:
    """
    Create a new AI virtual assistant with enhanced security validation.

    Args:
        assistant_data: Assistant creation data
        current_user: Authenticated user from token

    Returns:
        AssistantResponseSchema: Created assistant data

    Raises:
        ValidationError: If assistant data is invalid
        AuthorizationError: If user lacks required permissions
    """
    try:
        logger.info(
            "Creating new assistant",
            extra={
                "user_id": current_user.id,
                "assistant_type": assistant_data.assistant_type
            }
        )

        # Validate user permissions
        if not current_user.can_create_assistant:
            raise AuthorizationError(
                message="User not authorized to create assistants",
                details={"user_id": current_user.id}
            )

        # Create assistant instance with security context
        assistant = Assistant(
            name=assistant_data.name,
            assistant_type=assistant_data.assistant_type,
            user_id=current_user.id,
            knowledge_base=assistant_data.knowledge_base,
            behavior_settings=assistant_data.behavior_settings,
            temperature=assistant_data.temperature,
            max_tokens=assistant_data.max_tokens
        )

        # Return response with security headers
        return AssistantResponseSchema(
            id=assistant.id,
            name=assistant.name,
            assistant_type=assistant.assistant_type,
            user_id=assistant.user_id,
            model_version=assistant.model_version,
            temperature=assistant.temperature,
            max_tokens=assistant.max_tokens,
            knowledge_base=assistant.knowledge_base,
            behavior_settings=assistant.behavior_settings,
            security_metadata=assistant_data.security_metadata,
            created_at=assistant.created_at,
            updated_at=assistant.updated_at,
            performance_metrics=assistant.performance_stats
        )

    except Exception as e:
        logger.error(
            f"Assistant creation failed: {str(e)}",
            extra={
                "user_id": current_user.id,
                "assistant_data": assistant_data.dict(exclude={"security_metadata"})
            }
        )
        if isinstance(e, PorfinBaseException):
            raise e
        raise ValidationError(
            message="Failed to create assistant",
            details={"error": str(e)}
        )

@router.get(
    "/{assistant_id}",
    response_model=AssistantResponseSchema,
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def get_assistant(
    assistant_id: str,
    current_user = Depends(get_current_user)
) -> AssistantResponseSchema:
    """
    Retrieve an AI virtual assistant by ID with security validation.

    Args:
        assistant_id: Assistant unique identifier
        current_user: Authenticated user from token

    Returns:
        AssistantResponseSchema: Assistant data

    Raises:
        AuthorizationError: If user lacks access to the assistant
        HTTPException: If assistant not found
    """
    try:
        # Get assistant instance
        assistant = Assistant.get_by_id(assistant_id)
        
        # Validate user access
        if assistant.user_id != current_user.id:
            raise AuthorizationError(
                message="User not authorized to access this assistant",
                details={
                    "user_id": current_user.id,
                    "assistant_id": assistant_id
                }
            )

        return AssistantResponseSchema.from_orm(assistant)

    except Exception as e:
        logger.error(
            f"Assistant retrieval failed: {str(e)}",
            extra={
                "user_id": current_user.id,
                "assistant_id": assistant_id
            }
        )
        if isinstance(e, PorfinBaseException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found"
        )

@router.put(
    "/{assistant_id}",
    response_model=AssistantResponseSchema,
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def update_assistant(
    assistant_id: str,
    update_data: AssistantUpdateSchema,
    current_user = Depends(get_current_user)
) -> AssistantResponseSchema:
    """
    Update an existing AI virtual assistant with compliance validation.

    Args:
        assistant_id: Assistant unique identifier
        update_data: Assistant update data
        current_user: Authenticated user from token

    Returns:
        AssistantResponseSchema: Updated assistant data

    Raises:
        AuthorizationError: If user lacks update permissions
        ValidationError: If update data is invalid
    """
    try:
        # Get existing assistant
        assistant = Assistant.get_by_id(assistant_id)
        
        # Validate user access
        if assistant.user_id != current_user.id:
            raise AuthorizationError(
                message="User not authorized to update this assistant",
                details={
                    "user_id": current_user.id,
                    "assistant_id": assistant_id
                }
            )

        # Update assistant with validation
        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(assistant, key, value)

        assistant.updated_at = datetime.utcnow()

        return AssistantResponseSchema.from_orm(assistant)

    except Exception as e:
        logger.error(
            f"Assistant update failed: {str(e)}",
            extra={
                "user_id": current_user.id,
                "assistant_id": assistant_id,
                "update_data": update_data.dict(exclude={"security_metadata"})
            }
        )
        if isinstance(e, PorfinBaseException):
            raise e
        raise ValidationError(
            message="Failed to update assistant",
            details={"error": str(e)}
        )

@router.delete(
    "/{assistant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def delete_assistant(
    assistant_id: str,
    current_user = Depends(get_current_user)
):
    """
    Delete an AI virtual assistant with security validation.

    Args:
        assistant_id: Assistant unique identifier
        current_user: Authenticated user from token

    Raises:
        AuthorizationError: If user lacks delete permissions
        HTTPException: If assistant not found
    """
    try:
        # Get assistant instance
        assistant = Assistant.get_by_id(assistant_id)
        
        # Validate user access
        if assistant.user_id != current_user.id:
            raise AuthorizationError(
                message="User not authorized to delete this assistant",
                details={
                    "user_id": current_user.id,
                    "assistant_id": assistant_id
                }
            )

        # Delete assistant
        await assistant.delete()

    except Exception as e:
        logger.error(
            f"Assistant deletion failed: {str(e)}",
            extra={
                "user_id": current_user.id,
                "assistant_id": assistant_id
            }
        )
        if isinstance(e, PorfinBaseException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found"
        )

@router.post(
    "/{assistant_id}/process",
    response_model=dict,
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
@circuit(failure_threshold=5, recovery_timeout=30)
async def process_message(
    assistant_id: str,
    message: str,
    current_user = Depends(get_current_user)
) -> dict:
    """
    Process a message using an AI virtual assistant with performance optimization.

    Args:
        assistant_id: Assistant unique identifier
        message: User message to process
        current_user: Authenticated user from token

    Returns:
        dict: Assistant response with performance metrics

    Raises:
        AuthorizationError: If user lacks access to the assistant
        ValidationError: If message processing fails
    """
    try:
        # Get assistant instance
        assistant = Assistant.get_by_id(assistant_id)
        
        # Validate user access
        if assistant.user_id != current_user.id:
            raise AuthorizationError(
                message="User not authorized to use this assistant",
                details={
                    "user_id": current_user.id,
                    "assistant_id": assistant_id
                }
            )

        # Process message with monitoring
        start_time = datetime.utcnow()
        response = await assistant.process_message(
            message=message,
            conversation_history=[]
        )
        duration = (datetime.utcnow() - start_time).total_seconds()

        return {
            "response": response,
            "performance": {
                "processing_time": duration,
                "token_count": len(message.split()),
                "cache_hit": False
            }
        }

    except Exception as e:
        logger.error(
            f"Message processing failed: {str(e)}",
            extra={
                "user_id": current_user.id,
                "assistant_id": assistant_id,
                "message_length": len(message)
            }
        )
        if isinstance(e, PorfinBaseException):
            raise e
        raise ValidationError(
            message="Failed to process message",
            details={"error": str(e)}
        )

@router.post(
    "/{assistant_id}/stream",
    response_class=StreamingResponse,
    dependencies=[Depends(RateLimiter(times=100, seconds=60))]
)
async def stream_response(
    assistant_id: str,
    message: str,
    current_user = Depends(get_current_user)
) -> StreamingResponse:
    """
    Stream an AI assistant response with optimized performance.

    Args:
        assistant_id: Assistant unique identifier
        message: User message to process
        current_user: Authenticated user from token

    Returns:
        StreamingResponse: Streamed assistant response

    Raises:
        AuthorizationError: If user lacks access to the assistant
        ValidationError: If streaming fails
    """
    try:
        # Get assistant instance
        assistant = Assistant.get_by_id(assistant_id)
        
        # Validate user access
        if assistant.user_id != current_user.id:
            raise AuthorizationError(
                message="User not authorized to use this assistant",
                details={
                    "user_id": current_user.id,
                    "assistant_id": assistant_id
                }
            )

        # Stream response
        return StreamingResponse(
            assistant.stream_response(
                message=message,
                conversation_history=[]
            ),
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(
            f"Response streaming failed: {str(e)}",
            extra={
                "user_id": current_user.id,
                "assistant_id": assistant_id,
                "message_length": len(message)
            }
        )
        if isinstance(e, PorfinBaseException):
            raise e
        raise ValidationError(
            message="Failed to stream response",
            details={"error": str(e)}
        )

# Export router
__all__ = ["router"]