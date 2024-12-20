"""
FastAPI endpoint handlers for LGPD-compliant WhatsApp chat management.

This module provides secure REST APIs for healthcare communications between
Brazilian providers and patients with AI assistance capabilities.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import List, Optional, Dict, Any

# Third-party imports
from fastapi import APIRouter, Depends, HTTPException, status, Request  # fastapi v0.100.0
import pytz  # pytz v2023.3

# Internal imports
from app.models.chats import Chat, ChatBase, ChatStatus
from app.core.security import verify_token
from app.core.exceptions import ValidationError, WhatsAppError
from app.core.logging import get_logger

# Configure logger
logger = get_logger(__name__)

# Initialize router
router = APIRouter(prefix="/chats", tags=["chats"])

# Configure timezone
BRAZIL_TZ = pytz.timezone('America/Sao_Paulo')

async def get_current_user(token: str, request: Request) -> Dict[str, Any]:
    """
    Enhanced dependency for getting authenticated healthcare provider from JWT token.

    Args:
        token: JWT access token
        request: FastAPI request object

    Returns:
        dict: Healthcare provider data with security context

    Raises:
        HTTPException: If authentication fails
    """
    try:
        payload = verify_token(token, token_type="access")
        return {
            "id": payload["sub"],
            "role": payload["role"],
            "security_context": {
                "request_id": request.state.request_id,
                "client_ip": request.client.host,
                "user_agent": request.headers.get("user-agent")
            }
        }
    except Exception as e:
        logger.error(
            "Authentication failed",
            extra={
                "error": str(e),
                "security_event": "authentication_failed"
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas"
        )

@router.post("/", response_model=ChatBase, status_code=status.HTTP_201_CREATED)
async def create_chat(
    chat_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> ChatBase:
    """
    Create a new LGPD-compliant chat for a healthcare provider.

    Args:
        chat_data: Chat creation data
        current_user: Authenticated user data

    Returns:
        ChatBase: Created chat instance

    Raises:
        HTTPException: If creation fails
    """
    try:
        # Add provider context
        chat_data.update({
            "provider_id": current_user["id"],
            "created_by": current_user["id"],
            "created_at": datetime.now(BRAZIL_TZ)
        })

        # Create chat instance
        chat_service = Chat()
        chat = await chat_service.create(chat_data)

        logger.info(
            "Chat created successfully",
            extra={
                "chat_id": chat.id,
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )

        return chat

    except ValidationError as e:
        logger.warning(
            "Chat creation validation failed",
            extra={
                "error": str(e),
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Chat creation failed",
            extra={
                "error": str(e),
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar chat"
        )

@router.get("/{chat_id}", response_model=ChatBase)
async def get_chat(
    chat_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> ChatBase:
    """
    Retrieve a specific chat with LGPD compliance checks.

    Args:
        chat_id: Chat ID to retrieve
        current_user: Authenticated user data

    Returns:
        ChatBase: Retrieved chat instance

    Raises:
        HTTPException: If retrieval fails or unauthorized
    """
    try:
        chat_service = Chat()
        chat = await chat_service.get(chat_id)

        # Verify ownership
        if chat.provider_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado"
            )

        logger.info(
            "Chat retrieved successfully",
            extra={
                "chat_id": chat_id,
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )

        return chat

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat não encontrado"
        )
    except Exception as e:
        logger.error(
            "Chat retrieval failed",
            extra={
                "error": str(e),
                "chat_id": chat_id,
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao recuperar chat"
        )

@router.get("/", response_model=List[ChatBase])
async def list_chats(
    status: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[ChatBase]:
    """
    List all chats for a healthcare provider with filtering.

    Args:
        status: Optional chat status filter
        current_user: Authenticated user data

    Returns:
        List[ChatBase]: List of chat instances

    Raises:
        HTTPException: If listing fails
    """
    try:
        chat_service = Chat()
        filters = {"provider_id": current_user["id"]}
        
        if status:
            if status not in ChatStatus.__members__:
                raise ValidationError(f"Status inválido: {status}")
            filters["status"] = status

        chats = await chat_service.list_by_provider(
            provider_id=current_user["id"],
            filters=filters
        )

        logger.info(
            "Chats listed successfully",
            extra={
                "provider_id": current_user["id"],
                "chat_count": len(chats),
                "security_context": current_user["security_context"]
            }
        )

        return chats

    except Exception as e:
        logger.error(
            "Chat listing failed",
            extra={
                "error": str(e),
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar chats"
        )

@router.patch("/{chat_id}", response_model=ChatBase)
async def update_chat(
    chat_id: str,
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> ChatBase:
    """
    Update chat information with LGPD compliance.

    Args:
        chat_id: Chat ID to update
        update_data: Fields to update
        current_user: Authenticated user data

    Returns:
        ChatBase: Updated chat instance

    Raises:
        HTTPException: If update fails or unauthorized
    """
    try:
        chat_service = Chat()
        chat = await chat_service.get(chat_id)

        # Verify ownership
        if chat.provider_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado"
            )

        # Add update context
        update_data["updated_by"] = current_user["id"]
        update_data["updated_at"] = datetime.now(BRAZIL_TZ)

        updated_chat = await chat_service.update(chat_id, update_data)

        logger.info(
            "Chat updated successfully",
            extra={
                "chat_id": chat_id,
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )

        return updated_chat

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Chat update failed",
            extra={
                "error": str(e),
                "chat_id": chat_id,
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar chat"
        )

@router.post("/{chat_id}/ai", response_model=ChatBase)
async def toggle_ai_assistant(
    chat_id: str,
    enabled: bool,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> ChatBase:
    """
    Toggle AI assistant for a chat.

    Args:
        chat_id: Chat ID to update
        enabled: AI assistant enabled state
        current_user: Authenticated user data

    Returns:
        ChatBase: Updated chat instance

    Raises:
        HTTPException: If toggle fails or unauthorized
    """
    try:
        chat_service = Chat()
        chat = await chat_service.get(chat_id)

        # Verify ownership
        if chat.provider_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado"
            )

        updated_chat = await chat_service.toggle_ai(
            chat_id=chat_id,
            enabled=enabled,
            updated_by=current_user["id"]
        )

        logger.info(
            "AI assistant toggled successfully",
            extra={
                "chat_id": chat_id,
                "enabled": enabled,
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )

        return updated_chat

    except Exception as e:
        logger.error(
            "AI assistant toggle failed",
            extra={
                "error": str(e),
                "chat_id": chat_id,
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao alterar configuração do assistente"
        )

@router.post("/{chat_id}/archive", response_model=ChatBase)
async def archive_chat(
    chat_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> ChatBase:
    """
    Archive a chat with LGPD compliance.

    Args:
        chat_id: Chat ID to archive
        current_user: Authenticated user data

    Returns:
        ChatBase: Archived chat instance

    Raises:
        HTTPException: If archival fails or unauthorized
    """
    try:
        chat_service = Chat()
        chat = await chat_service.get(chat_id)

        # Verify ownership
        if chat.provider_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado"
            )

        archived_chat = await chat_service.archive(
            chat_id=chat_id,
            archived_by=current_user["id"]
        )

        logger.info(
            "Chat archived successfully",
            extra={
                "chat_id": chat_id,
                "provider_id": current_user["id"],
                "security_context": current_user["security_context"]
            }
        )

        return archived_chat

    except Exception as e:
        logger.error(
            "Chat archival failed",
            extra={
                "error": str(e),
                "chat_id": chat_id,
                "security_context": current_user["security_context"]
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao arquivar chat"
        )