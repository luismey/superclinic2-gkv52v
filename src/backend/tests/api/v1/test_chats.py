"""
Test suite for chat management API endpoints.

This module provides comprehensive testing for chat-related API endpoints including
security validation, performance benchmarking, WebSocket functionality, and error handling.

Version: 1.0.0
"""

# Standard library imports
import json
import asyncio
from datetime import datetime
from typing import Dict, Any

# Third-party imports
import pytest  # v7.0.0
import aiohttp  # v3.8.0
from faker import Faker  # v18.0.0
from freezegun import freeze_time  # v1.2.0
from pytest_benchmark.fixture import BenchmarkFixture  # v4.0.0

# Internal imports
from app.models.chats import ChatStatus
from tests.conftest import TestClient, FirestoreClient

# Initialize faker with Brazilian locale
fake = Faker('pt_BR')

# Test data constants
TEST_CHAT_DATA = {
    "provider_id": "test_provider",
    "customer_phone": "5511999999999",
    "customer_name": "Test Patient",
    "customer_email": "patient@example.com",
    "ai_enabled": True,
    "metadata": {
        "source": "website",
        "campaign_id": "test_campaign",
        "tags": ["new_patient", "consultation"]
    }
}

# Performance thresholds
PERFORMANCE_THRESHOLDS = {
    "chat_creation_ms": 500,  # Max time for chat creation
    "chat_query_ms": 200,     # Max time for chat queries
    "concurrent_ops": 50      # Number of concurrent operations
}

@pytest.mark.asyncio
async def test_create_chat_security(
    client: TestClient,
    auth_headers: Dict[str, str],
    mock_db: FirestoreClient
) -> None:
    """Test chat creation with various security scenarios."""
    
    # Test unauthorized access
    response = await client.post("/api/v1/chats", json=TEST_CHAT_DATA)
    assert response.status_code == 401
    
    # Test invalid token
    invalid_headers = auth_headers.copy()
    invalid_headers["Authorization"] = "Bearer invalid_token"
    response = await client.post("/api/v1/chats", json=TEST_CHAT_DATA, headers=invalid_headers)
    assert response.status_code == 401
    
    # Test rate limiting
    for _ in range(10):  # Exceed rate limit
        await client.post("/api/v1/chats", json=TEST_CHAT_DATA, headers=auth_headers)
    response = await client.post("/api/v1/chats", json=TEST_CHAT_DATA, headers=auth_headers)
    assert response.status_code == 429
    
    # Test SQL injection attempt
    malicious_data = TEST_CHAT_DATA.copy()
    malicious_data["customer_name"] = "'; DROP TABLE chats; --"
    response = await client.post("/api/v1/chats", json=malicious_data, headers=auth_headers)
    assert response.status_code == 422
    
    # Test XSS prevention
    xss_data = TEST_CHAT_DATA.copy()
    xss_data["customer_name"] = "<script>alert('xss')</script>"
    response = await client.post("/api/v1/chats", json=xss_data, headers=auth_headers)
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_chat_crud_operations(
    client: TestClient,
    auth_headers: Dict[str, str],
    mock_db: FirestoreClient
) -> None:
    """Test CRUD operations for chat management."""
    
    # Create chat
    response = await client.post("/api/v1/chats", json=TEST_CHAT_DATA, headers=auth_headers)
    assert response.status_code == 201
    chat_data = response.json()
    chat_id = chat_data["id"]
    
    # Verify created chat data
    assert chat_data["provider_id"] == TEST_CHAT_DATA["provider_id"]
    assert chat_data["customer_phone"] == TEST_CHAT_DATA["customer_phone"]
    assert chat_data["status"] == ChatStatus.ACTIVE
    
    # Get chat
    response = await client.get(f"/api/v1/chats/{chat_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == chat_id
    
    # Update chat
    update_data = {"customer_name": "Updated Patient Name"}
    response = await client.patch(
        f"/api/v1/chats/{chat_id}",
        json=update_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["customer_name"] == update_data["customer_name"]
    
    # Archive chat
    response = await client.patch(
        f"/api/v1/chats/{chat_id}",
        json={"status": ChatStatus.ARCHIVED},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == ChatStatus.ARCHIVED

@pytest.mark.asyncio
async def test_chat_websocket(
    client: TestClient,
    auth_headers: Dict[str, str],
    mock_db: FirestoreClient
) -> None:
    """Test real-time chat updates via WebSocket."""
    
    # Create test chat
    response = await client.post("/api/v1/chats", json=TEST_CHAT_DATA, headers=auth_headers)
    chat_id = response.json()["id"]
    
    # Connect to WebSocket
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(
            f"ws://testserver/api/v1/chats/{chat_id}/ws",
            headers=auth_headers
        ) as ws:
            # Send test message
            test_message = {
                "type": "message",
                "content": "Test message",
                "timestamp": datetime.utcnow().isoformat()
            }
            await ws.send_json(test_message)
            
            # Receive message confirmation
            response = await ws.receive_json()
            assert response["status"] == "delivered"
            assert response["message_id"]
            
            # Test connection status
            await ws.ping()
            await ws.pong()
            assert ws.closed is False
            
            # Test message history
            await ws.send_json({"type": "get_history", "limit": 10})
            history = await ws.receive_json()
            assert isinstance(history["messages"], list)

@pytest.mark.benchmark
async def test_chat_performance(
    client: TestClient,
    auth_headers: Dict[str, str],
    benchmark: BenchmarkFixture
) -> None:
    """Test chat operations performance."""
    
    # Benchmark chat creation
    result = benchmark(
        client.post,
        "/api/v1/chats",
        json=TEST_CHAT_DATA,
        headers=auth_headers
    )
    assert result.status_code == 201
    assert benchmark.stats.stats.mean * 1000 < PERFORMANCE_THRESHOLDS["chat_creation_ms"]
    
    # Test concurrent chat operations
    async def concurrent_operation():
        chat_data = TEST_CHAT_DATA.copy()
        chat_data["customer_phone"] = fake.phone_number()
        return await client.post("/api/v1/chats", json=chat_data, headers=auth_headers)
    
    tasks = [concurrent_operation() for _ in range(PERFORMANCE_THRESHOLDS["concurrent_ops"])]
    results = await asyncio.gather(*tasks)
    assert all(r.status_code == 201 for r in results)

@pytest.mark.asyncio
async def test_chat_validation(
    client: TestClient,
    auth_headers: Dict[str, str]
) -> None:
    """Test chat data validation."""
    
    # Test invalid phone number
    invalid_data = TEST_CHAT_DATA.copy()
    invalid_data["customer_phone"] = "invalid_phone"
    response = await client.post("/api/v1/chats", json=invalid_data, headers=auth_headers)
    assert response.status_code == 422
    
    # Test missing required fields
    incomplete_data = {
        "provider_id": TEST_CHAT_DATA["provider_id"]
    }
    response = await client.post("/api/v1/chats", json=incomplete_data, headers=auth_headers)
    assert response.status_code == 422
    
    # Test invalid metadata format
    invalid_metadata = TEST_CHAT_DATA.copy()
    invalid_metadata["metadata"] = "invalid_json"
    response = await client.post("/api/v1/chats", json=invalid_metadata, headers=auth_headers)
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_chat_error_handling(
    client: TestClient,
    auth_headers: Dict[str, str],
    mock_db: FirestoreClient
) -> None:
    """Test error handling scenarios."""
    
    # Test non-existent chat
    response = await client.get("/api/v1/chats/non_existent_id", headers=auth_headers)
    assert response.status_code == 404
    
    # Test invalid update operation
    response = await client.patch(
        "/api/v1/chats/non_existent_id",
        json={"status": "invalid_status"},
        headers=auth_headers
    )
    assert response.status_code == 404
    
    # Test database connection failure
    mock_db.connection_error = True
    response = await client.post("/api/v1/chats", json=TEST_CHAT_DATA, headers=auth_headers)
    assert response.status_code == 503
    mock_db.connection_error = False

if __name__ == "__main__":
    pytest.main(["-v", __file__])