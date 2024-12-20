"""
Comprehensive test suite for the Porfin platform's main FastAPI application.

This module implements extensive testing of core functionality, security features,
and performance characteristics with enhanced monitoring and LGPD compliance validation.

Version: 1.0.0
"""

# Standard library imports
import json
from datetime import datetime, timedelta
from typing import Dict, Generator

# Third-party imports
import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
import pytest_asyncio
from httpx import AsyncClient

# Internal imports
from app.main import create_application
from app.core.exceptions import PorfinBaseException
from app.core.security import create_access_token

# Test constants
TEST_USER_ID = "test_user_123"
TEST_RATE_LIMIT = 100
TEST_WINDOW_SECONDS = 60

@pytest.fixture
def app() -> FastAPI:
    """Fixture for creating test FastAPI application instance."""
    return create_application()

@pytest.fixture
def test_client(app: FastAPI) -> TestClient:
    """Fixture for creating FastAPI test client."""
    return TestClient(app)

@pytest.fixture
def valid_token() -> str:
    """Fixture for creating valid test JWT token."""
    return create_access_token(
        data={"sub": TEST_USER_ID, "role": "admin"},
        expires_delta=timedelta(minutes=15)
    )

@pytest.fixture
def auth_headers(valid_token: str) -> Dict[str, str]:
    """Fixture for creating authenticated request headers."""
    return {"Authorization": f"Bearer {valid_token}"}

@pytest_asyncio.fixture
async def async_client(app: FastAPI) -> AsyncClient:
    """Fixture for creating async test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

class TestMainApplication:
    """Main test suite for FastAPI application testing."""

    @pytest.mark.asyncio
    async def test_app_creation(self, app: FastAPI):
        """Test FastAPI application initialization and configuration."""
        assert app.title == "Porfin"
        assert app.docs_url is not None  # Should be enabled in test environment
        assert app.redoc_url is not None

        # Verify middleware configuration
        middleware_classes = [m.__class__.__name__ for m in app.middleware]
        assert "CORSMiddleware" in middleware_classes
        assert "RateLimitMiddleware" in middleware_classes

        # Verify security headers middleware
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/health")
            assert response.headers["X-Content-Type-Options"] == "nosniff"
            assert response.headers["X-Frame-Options"] == "DENY"
            assert response.headers["X-XSS-Protection"] == "1; mode=block"
            assert "Strict-Transport-Security" in response.headers

    @pytest.mark.asyncio
    async def test_health_check(self, async_client: AsyncClient):
        """Test health check endpoint functionality."""
        response = await async_client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"status": "healthy"}

        # Verify response headers
        assert response.headers["Content-Type"] == "application/json"
        assert response.headers["Content-Language"] == "pt-BR"

    @pytest.mark.asyncio
    async def test_cors_middleware(self, async_client: AsyncClient):
        """Test CORS middleware configuration."""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        }
        
        response = await async_client.options("/api/v1/auth/login", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        
        # Verify CORS headers
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
        assert "POST" in response.headers["Access-Control-Allow-Methods"]
        assert "Content-Type" in response.headers["Access-Control-Allow-Headers"]
        assert response.headers["Access-Control-Allow-Credentials"] == "true"

    @pytest.mark.asyncio
    async def test_authentication_middleware(
        self, 
        async_client: AsyncClient,
        valid_token: str,
        auth_headers: Dict[str, str]
    ):
        """Test JWT authentication middleware."""
        # Test without token
        response = await async_client.get("/api/v1/chats")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Test with invalid token
        response = await async_client.get(
            "/api/v1/chats",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Test with valid token
        response = await async_client.get("/api/v1/chats", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        # Test with expired token
        expired_token = create_access_token(
            data={"sub": TEST_USER_ID},
            expires_delta=timedelta(minutes=-15)
        )
        response = await async_client.get(
            "/api/v1/chats",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_rate_limiting(self, async_client: AsyncClient, auth_headers: Dict[str, str]):
        """Test rate limiting middleware."""
        # Make requests up to limit
        for _ in range(TEST_RATE_LIMIT):
            response = await async_client.get("/health", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            
            # Verify rate limit headers
            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers
            assert "X-RateLimit-Reset" in response.headers

        # Verify rate limit exceeded
        response = await async_client.get("/health", headers=auth_headers)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Retry-After" in response.headers

    @pytest.mark.asyncio
    async def test_error_handlers(self, async_client: AsyncClient, auth_headers: Dict[str, str]):
        """Test global exception handlers."""
        # Test validation error
        response = await async_client.post(
            "/api/v1/chats",
            headers=auth_headers,
            json={"invalid": "data"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "detail" in response.json()

        # Test not found error
        response = await async_client.get(
            "/api/v1/chats/nonexistent",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Test internal server error
        # This would require mocking a service to raise an exception
        # Implementation depends on specific error scenarios

    @pytest.mark.asyncio
    async def test_lgpd_compliance_headers(self, async_client: AsyncClient):
        """Test LGPD compliance headers."""
        response = await async_client.get("/health")
        assert response.headers["X-LGPD-Consent-Required"] == "true"
        assert response.headers["X-Healthcare-Data-Protection"] == "enabled"
        assert response.headers["X-Data-Retention-Days"] == "365"

    @pytest.mark.asyncio
    async def test_security_headers(self, async_client: AsyncClient):
        """Test security headers configuration."""
        response = await async_client.get("/health")
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert "max-age=31536000" in response.headers["Strict-Transport-Security"]
        assert "includeSubDomains" in response.headers["Strict-Transport-Security"]

    @pytest.mark.asyncio
    async def test_brazilian_localization(self, async_client: AsyncClient):
        """Test Brazilian Portuguese localization."""
        response = await async_client.get("/health")
        assert response.headers["Content-Language"] == "pt-BR"

        # Test error messages in Portuguese
        response = await async_client.get("/api/v1/chats", headers={"Authorization": "Bearer invalid"})
        error_message = response.json()["detail"]
        assert isinstance(error_message, str)
        assert error_message.strip() != ""  # Should contain Portuguese error message

    @pytest.mark.asyncio
    async def test_monitoring_headers(self, async_client: AsyncClient):
        """Test monitoring and observability headers."""
        response = await async_client.get("/health")
        assert "X-Request-ID" in response.headers
        assert "X-Response-Time" in response.headers

    def test_openapi_schema(self, app: FastAPI):
        """Test OpenAPI schema generation."""
        openapi_schema = app.openapi()
        assert openapi_schema["info"]["title"] == "Porfin"
        assert "paths" in openapi_schema
        assert "/health" in openapi_schema["paths"]

        # Verify security schemes
        assert "components" in openapi_schema
        assert "securitySchemes" in openapi_schema["components"]
        assert "OAuth2PasswordBearer" in openapi_schema["components"]["securitySchemes"]