"""
Comprehensive test suite for user management API endpoints.
Tests authentication, authorization, LGPD compliance, and security validation.

Version: 1.0.0
"""

# Standard library imports
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any

# Third-party imports
import pytest  # pytest v7.0.0
from fastapi import status
from fastapi.testclient import TestClient  # fastapi v0.100+
from faker import Faker  # faker v8.0.0
from pydantic import ValidationError  # pydantic v2.0.0

# Internal imports
from app.models.users import UserModel
from app.schemas.users import UserCreate, UserUpdate
from app.core.logging import AuditLogger
from app.core.security import get_password_hash
from app.utils.validators import validate_password, validate_professional_id

# Test constants
BASE_URL = "/api/v1/users"
VALID_PASSWORD = "Test123!@#$"
BRAZIL_TIMEZONE = "America/Sao_Paulo"

class UserTestFactory:
    """Factory class for generating test user data with Brazilian healthcare context."""
    
    def __init__(self):
        """Initialize test data factory with Brazilian locale."""
        self.faker = Faker('pt_BR')
        
    def create_test_user(self, role: str = "secretary") -> Dict[str, Any]:
        """
        Generate valid test user data with proper healthcare credentials.

        Args:
            role: User role to generate data for

        Returns:
            Dict containing valid test user data
        """
        professional_id = None
        if role in ["admin", "manager"]:
            # Generate valid CRM/CRO number for healthcare professionals
            state = self.faker.state_abbr()
            number = self.faker.random_number(digits=6)
            professional_id = f"CRM/{state} {number}"

        return {
            "email": self.faker.email(),
            "password": VALID_PASSWORD,
            "full_name": self.faker.name(),
            "role": role,
            "professional_id": professional_id,
            "phone": f"+55 {self.faker.msisdn()[3:]}",  # Brazilian phone format
            "lgpd_consent": True
        }

@pytest.fixture
def user_factory():
    """Fixture providing user test data factory."""
    return UserTestFactory()

@pytest.fixture
async def test_user(user_factory, app_client) -> Dict[str, Any]:
    """Fixture creating a test user for authentication tests."""
    user_data = user_factory.create_test_user(role="secretary")
    response = await app_client.post(f"{BASE_URL}/", json=user_data)
    assert response.status_code == status.HTTP_201_CREATED
    return response.json()

@pytest.mark.asyncio
async def test_create_user_success(app_client: TestClient, user_factory: UserTestFactory):
    """Test successful user creation with LGPD compliance."""
    # Arrange
    user_data = user_factory.create_test_user(role="manager")
    
    # Act
    response = await app_client.post(
        f"{BASE_URL}/",
        json=user_data,
        headers={"X-Request-ID": "test-create-user"}
    )
    
    # Assert
    assert response.status_code == status.HTTP_201_CREATED
    created_user = response.json()
    assert created_user["email"] == user_data["email"]
    assert created_user["role"] == "manager"
    assert created_user["professional_id"] == user_data["professional_id"]
    assert "hashed_password" not in created_user
    
    # Verify audit log
    audit_logs = await AuditLogger.get_audit_logs(created_user["id"])
    assert len(audit_logs) >= 1
    assert audit_logs[0]["action"] == "user_created"

@pytest.mark.asyncio
async def test_create_user_lgpd_validation(app_client: TestClient, user_factory: UserTestFactory):
    """Test LGPD compliance validation during user creation."""
    # Arrange
    user_data = user_factory.create_test_user()
    user_data["lgpd_consent"] = False
    
    # Act
    response = await app_client.post(f"{BASE_URL}/", json=user_data)
    
    # Assert
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "LGPD consent is required" in response.json()["detail"]

@pytest.mark.asyncio
async def test_create_user_password_security(app_client: TestClient, user_factory: UserTestFactory):
    """Test password security requirements validation."""
    # Arrange
    user_data = user_factory.create_test_user()
    weak_passwords = [
        "short",  # Too short
        "nospecialchars123",  # No special characters
        "NoNumbers!",  # No numbers
        "no_upper_case_123!",  # No uppercase
        "NO_LOWER_CASE_123!"  # No lowercase
    ]
    
    # Act & Assert
    for password in weak_passwords:
        user_data["password"] = password
        response = await app_client.post(f"{BASE_URL}/", json=user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "password" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_user_authorization(
    app_client: TestClient,
    test_user: Dict[str, Any],
    auth_headers: Dict[str, str]
):
    """Test role-based access control for user retrieval."""
    # Arrange
    user_id = test_user["id"]
    
    # Act & Assert - Secretary (own profile)
    response = await app_client.get(
        f"{BASE_URL}/{user_id}",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    
    # Act & Assert - Secretary (other profile)
    other_user = await UserModel.create(
        user_factory.create_test_user(role="secretary")
    )
    response = await app_client.get(
        f"{BASE_URL}/{other_user.id}",
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.asyncio
async def test_update_user_security(
    app_client: TestClient,
    test_user: Dict[str, Any],
    auth_headers: Dict[str, str]
):
    """Test security validations for user updates."""
    # Arrange
    user_id = test_user["id"]
    update_data = {"email": "new.email@example.com"}
    
    # Act & Assert - Without authentication
    response = await app_client.patch(
        f"{BASE_URL}/{user_id}",
        json=update_data
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Act & Assert - With authentication
    response = await app_client.patch(
        f"{BASE_URL}/{user_id}",
        json=update_data,
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    
    # Verify audit trail
    user = await UserModel.get_by_id(user_id)
    assert len(user.audit_trail) >= 1
    assert user.audit_trail[-1]["action"] == "user_updated"

@pytest.mark.asyncio
async def test_rate_limiting(app_client: TestClient, auth_headers: Dict[str, str]):
    """Test rate limiting for user management endpoints."""
    # Arrange
    requests_count = 0
    max_requests = 5
    
    # Act
    for _ in range(max_requests + 1):
        response = await app_client.get(
            f"{BASE_URL}/me",
            headers=auth_headers
        )
        if response.status_code == status.HTTP_200_OK:
            requests_count += 1
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            break
    
    # Assert
    assert requests_count <= max_requests
    assert "Retry-After" in response.headers

@pytest.mark.asyncio
async def test_professional_id_validation(app_client: TestClient, user_factory: UserTestFactory):
    """Test healthcare professional ID validation."""
    # Arrange
    user_data = user_factory.create_test_user(role="manager")
    invalid_ids = [
        "CRM12345",  # Missing state
        "CRO/XX 12345",  # Invalid state
        "CRM/SP ABC123",  # Non-numeric ID
        "CRMSP123456"  # Invalid format
    ]
    
    # Act & Assert
    for invalid_id in invalid_ids:
        user_data["professional_id"] = invalid_id
        response = await app_client.post(f"{BASE_URL}/", json=user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "professional_id" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_soft_delete(
    app_client: TestClient,
    test_user: Dict[str, Any],
    auth_headers: Dict[str, str]
):
    """Test user soft deletion with audit trail."""
    # Arrange
    user_id = test_user["id"]
    
    # Act
    response = await app_client.delete(
        f"{BASE_URL}/{user_id}",
        headers=auth_headers
    )
    
    # Assert
    assert response.status_code == status.HTTP_200_OK
    
    # Verify user is soft deleted
    user = await UserModel.get_by_id(user_id)
    assert not user.is_active
    
    # Verify audit trail
    assert len(user.audit_trail) >= 1
    assert user.audit_trail[-1]["action"] == "user_deleted"

@pytest.mark.asyncio
async def test_password_change_security(
    app_client: TestClient,
    test_user: Dict[str, Any],
    auth_headers: Dict[str, str]
):
    """Test password change security requirements."""
    # Arrange
    user_id = test_user["id"]
    new_password = "NewTest123!@#"
    
    # Act & Assert - Without old password
    response = await app_client.post(
        f"{BASE_URL}/{user_id}/change-password",
        json={"new_password": new_password},
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Act & Assert - With correct old password
    response = await app_client.post(
        f"{BASE_URL}/{user_id}/change-password",
        json={
            "old_password": VALID_PASSWORD,
            "new_password": new_password
        },
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    
    # Verify password history
    user = await UserModel.get_by_id(user_id)
    assert len(user.password_history) >= 1