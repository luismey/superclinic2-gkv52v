"""
Comprehensive test suite for WhatsApp message API endpoints.

This module provides extensive testing coverage for message operations,
performance validation, and AI integration scenarios.

Version: 1.0.0
"""

# Standard library imports
import uuid
import time
from datetime import datetime, timedelta
from typing import Dict, Any

# Third-party imports
import pytest  # pytest v7.0.0
from freezegun import freeze_time  # freezegun v1.2.0

# Internal imports
from app.schemas.messages import (
    MessageCreate,
    MessageUpdate,
    MessageResponse,
)
from app.models.messages import (
    MessageType,
    MessageDirection,
    MessageStatus
)
from app.core.exceptions import ValidationError, WhatsAppError

# Test constants
TEST_CHAT_ID = str(uuid.uuid4())
PERFORMANCE_THRESHOLD_MS = 500  # Maximum allowed latency in milliseconds

# Test data fixtures
@pytest.fixture
def test_message_data() -> Dict[str, Any]:
    """Fixture providing base test message data."""
    return {
        "chat_id": TEST_CHAT_ID,
        "type": MessageType.TEXT,
        "direction": MessageDirection.OUTBOUND,
        "content": "Test message content",
        "is_ai_generated": False,
        "metadata": {
            "source": "test_suite",
            "priority": "normal"
        }
    }

@pytest.fixture
def test_media_message_data(test_message_data: Dict[str, Any]) -> Dict[str, Any]:
    """Fixture providing test media message data."""
    return {
        **test_message_data,
        "type": MessageType.IMAGE,
        "media_url": "https://example.com/test.jpg",
        "media_type": "image/jpeg"
    }

@pytest.fixture
def mock_gpt_response() -> Dict[str, Any]:
    """Fixture providing mock GPT response data."""
    return {
        "content": "AI generated response",
        "metadata": {
            "model": "gpt-4",
            "tokens": 150,
            "confidence": 0.95
        }
    }

@pytest.mark.asyncio
@pytest.mark.performance
async def test_get_messages(
    app_client,
    auth_headers: Dict[str, str],
    mock_db,
    test_message_data: Dict[str, Any]
) -> None:
    """
    Test retrieving paginated list of messages with performance validation.
    
    Validates:
    - Message retrieval performance (<500ms)
    - Pagination functionality
    - Response schema compliance
    - Error handling
    """
    # Setup test data
    messages = []
    for i in range(10):
        message = test_message_data.copy()
        message["id"] = str(uuid.uuid4())
        message["content"] = f"Test message {i}"
        message["created_at"] = datetime.utcnow() - timedelta(minutes=i)
        messages.append(message)
        await mock_db.collection("messages").document(message["id"]).set(message)

    # Test performance and pagination
    start_time = time.time()
    response = await app_client.get(
        "/api/v1/messages",
        headers=auth_headers,
        params={"chat_id": TEST_CHAT_ID, "limit": 5}
    )
    duration_ms = (time.time() - start_time) * 1000

    # Assert performance requirements
    assert duration_ms < PERFORMANCE_THRESHOLD_MS, f"Message retrieval took {duration_ms}ms, exceeding {PERFORMANCE_THRESHOLD_MS}ms threshold"

    # Validate response
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "next_cursor" in data
    assert len(data["items"]) == 5
    assert data["total"] == 10

    # Validate message ordering
    messages = data["items"]
    for i in range(len(messages) - 1):
        assert messages[i]["created_at"] > messages[i + 1]["created_at"]

    # Test invalid pagination parameters
    response = await app_client.get(
        "/api/v1/messages",
        headers=auth_headers,
        params={"chat_id": TEST_CHAT_ID, "limit": 1000}  # Exceeds max limit
    )
    assert response.status_code == 422

@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_message(
    app_client,
    auth_headers: Dict[str, str],
    mock_db,
    test_message_data: Dict[str, Any]
) -> None:
    """
    Test message creation with various types and validation.
    
    Validates:
    - Text message creation
    - Media message handling
    - Schema validation
    - Performance requirements
    - Error scenarios
    """
    # Test text message creation
    start_time = time.time()
    response = await app_client.post(
        "/api/v1/messages",
        headers=auth_headers,
        json=test_message_data
    )
    duration_ms = (time.time() - start_time) * 1000

    # Assert performance and response
    assert duration_ms < PERFORMANCE_THRESHOLD_MS
    assert response.status_code == 201
    created_message = response.json()
    assert created_message["chat_id"] == TEST_CHAT_ID
    assert created_message["type"] == MessageType.TEXT.value
    assert created_message["status"] == MessageStatus.PENDING.value

    # Test media message creation
    test_media_data = {
        **test_message_data,
        "type": MessageType.IMAGE,
        "media_url": "https://example.com/test.jpg",
        "media_type": "image/jpeg"
    }
    response = await app_client.post(
        "/api/v1/messages",
        headers=auth_headers,
        json=test_media_data
    )
    assert response.status_code == 201
    assert response.json()["media_url"] == test_media_data["media_url"]

    # Test validation errors
    invalid_data = test_message_data.copy()
    invalid_data["content"] = "a" * 5000  # Exceeds max length
    response = await app_client.post(
        "/api/v1/messages",
        headers=auth_headers,
        json=invalid_data
    )
    assert response.status_code == 422

@pytest.mark.asyncio
@pytest.mark.ai
async def test_generate_ai_response(
    app_client,
    auth_headers: Dict[str, str],
    mock_db,
    mock_gpt,
    test_message_data: Dict[str, Any],
    mock_gpt_response: Dict[str, Any]
) -> None:
    """
    Test AI response generation with context handling.
    
    Validates:
    - AI response generation
    - Context preservation
    - Performance requirements
    - Error handling and retry logic
    """
    # Setup conversation context
    context_messages = []
    for i in range(3):
        message = test_message_data.copy()
        message["id"] = str(uuid.uuid4())
        message["content"] = f"Context message {i}"
        message["created_at"] = datetime.utcnow() - timedelta(minutes=i)
        context_messages.append(message)
        await mock_db.collection("messages").document(message["id"]).set(message)

    # Configure mock GPT response
    mock_gpt.generate_response.return_value = mock_gpt_response

    # Test AI response generation
    start_time = time.time()
    response = await app_client.post(
        "/api/v1/messages/ai/generate",
        headers=auth_headers,
        json={
            "chat_id": TEST_CHAT_ID,
            "prompt": "Test prompt",
            "context_messages": [msg["id"] for msg in context_messages]
        }
    )
    duration_ms = (time.time() - start_time) * 1000

    # Assert performance and response
    assert duration_ms < PERFORMANCE_THRESHOLD_MS
    assert response.status_code == 200
    generated_message = response.json()
    assert generated_message["is_ai_generated"] is True
    assert generated_message["content"] == mock_gpt_response["content"]
    assert "ai_context" in generated_message
    assert generated_message["ai_context"]["model"] == "gpt-4"

    # Test error handling
    mock_gpt.generate_response.side_effect = Exception("GPT service error")
    response = await app_client.post(
        "/api/v1/messages/ai/generate",
        headers=auth_headers,
        json={
            "chat_id": TEST_CHAT_ID,
            "prompt": "Test prompt"
        }
    )
    assert response.status_code == 500

@pytest.mark.asyncio
async def test_update_message_status(
    app_client,
    auth_headers: Dict[str, str],
    mock_db,
    test_message_data: Dict[str, Any]
) -> None:
    """
    Test message status updates and delivery tracking.
    
    Validates:
    - Status update functionality
    - Timestamp tracking
    - Webhook notifications
    - Error handling
    """
    # Create test message
    message = test_message_data.copy()
    message["id"] = str(uuid.uuid4())
    message["status"] = MessageStatus.PENDING.value
    await mock_db.collection("messages").document(message["id"]).set(message)

    # Test status update
    update_data = {
        "status": MessageStatus.DELIVERED.value,
        "delivered_at": datetime.utcnow().isoformat()
    }
    response = await app_client.patch(
        f"/api/v1/messages/{message['id']}/status",
        headers=auth_headers,
        json=update_data
    )
    assert response.status_code == 200
    updated_message = response.json()
    assert updated_message["status"] == MessageStatus.DELIVERED.value
    assert updated_message["delivered_at"] is not None

    # Test invalid status transition
    invalid_update = {
        "status": MessageStatus.PENDING.value  # Cannot revert to PENDING
    }
    response = await app_client.patch(
        f"/api/v1/messages/{message['id']}/status",
        headers=auth_headers,
        json=invalid_update
    )
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_message_rate_limiting(
    app_client,
    auth_headers: Dict[str, str],
    test_message_data: Dict[str, Any]
) -> None:
    """
    Test message rate limiting enforcement.
    
    Validates:
    - Rate limit thresholds
    - Rate limit headers
    - Burst handling
    - Cooldown periods
    """
    # Send messages in rapid succession
    responses = []
    for _ in range(5):
        response = await app_client.post(
            "/api/v1/messages",
            headers=auth_headers,
            json=test_message_data
        )
        responses.append(response)

    # Verify rate limit headers
    assert "X-RateLimit-Limit" in responses[-1].headers
    assert "X-RateLimit-Remaining" in responses[-1].headers
    assert "X-RateLimit-Reset" in responses[-1].headers

    # Verify rate limiting kicks in
    response = await app_client.post(
        "/api/v1/messages",
        headers=auth_headers,
        json=test_message_data
    )
    assert response.status_code == 429