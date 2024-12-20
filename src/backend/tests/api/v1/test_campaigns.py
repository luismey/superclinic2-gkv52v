"""
Test suite for WhatsApp marketing campaign API endpoints.

This module provides comprehensive testing for campaign management functionality
including CRUD operations, security measures, and performance monitoring.

Version: 1.0.0
"""

# Standard library imports
import json
from datetime import datetime, timedelta
from typing import Dict, Any

# Third-party imports
import pytest  # v7.0.0
from freezegun import freeze_time  # v1.2.0
import asyncio

# Internal imports
from app.core.exceptions import ValidationError, AuthorizationError
from app.core.logging import get_logger

# Configure test logger
logger = get_logger(__name__)

# Test data constants
TEST_CAMPAIGN_DATA = {
    "name": "Test Campaign",
    "description": "Test marketing campaign",
    "target_type": "new_leads",
    "target_audience_ids": ["test_audience_1"],
    "message_template": {
        "type": "text",
        "content": "Hello {{name}}, special offer!",
        "variables": {"name": "str"}
    },
    "security_context": {
        "rate_limit": 100,
        "requires_approval": True,
        "audit_level": "detailed"
    }
}

INVALID_TEMPLATE_DATA = {
    "type": "text",
    "content": "Hello {{invalid}}, offer!",
    "variables": {}
}

class TestCampaignAPI:
    """Test class for campaign API endpoints with enhanced security and monitoring."""

    @pytest.fixture(autouse=True)
    def setup(self, app_client, auth_headers, mock_db):
        """Setup test environment with security context."""
        self.client = app_client
        self.headers = auth_headers
        self.db = mock_db
        self.base_url = "/api/v1/campaigns"
        self.metrics = {
            "request_count": 0,
            "error_count": 0,
            "response_times": []
        }

    async def setup_test_data(self):
        """Initialize test data with proper security context."""
        campaign_id = await self.db.create_document(
            "campaigns",
            TEST_CAMPAIGN_DATA
        )
        return campaign_id

    @pytest.mark.asyncio
    async def test_create_campaign(self):
        """Test campaign creation with security validation."""
        start_time = datetime.now()

        try:
            response = await self.client.post(
                f"{self.base_url}/",
                json=TEST_CAMPAIGN_DATA,
                headers=self.headers
            )

            assert response.status_code == 201
            data = response.json()
            assert "campaign_id" in data
            assert data["name"] == TEST_CAMPAIGN_DATA["name"]
            
            # Verify security context
            assert "audit_trail" in data
            assert data["audit_trail"]["created_by"] == self.headers.get("X-User-ID")
            assert data["audit_trail"]["security_level"] == "high"

            # Verify rate limiting
            assert "rate_limit" in data["security_context"]
            assert data["security_context"]["rate_limit"] == TEST_CAMPAIGN_DATA["security_context"]["rate_limit"]

        finally:
            duration = (datetime.now() - start_time).total_seconds()
            self.metrics["response_times"].append(duration)
            self.metrics["request_count"] += 1

    @pytest.mark.asyncio
    async def test_campaign_validation(self):
        """Test campaign validation with invalid data."""
        invalid_data = TEST_CAMPAIGN_DATA.copy()
        invalid_data["message_template"] = INVALID_TEMPLATE_DATA

        with pytest.raises(ValidationError) as exc_info:
            await self.client.post(
                f"{self.base_url}/",
                json=invalid_data,
                headers=self.headers
            )

        assert exc_info.value.status_code == 422
        assert "Invalid template variables" in str(exc_info.value)
        self.metrics["error_count"] += 1

    @pytest.mark.asyncio
    async def test_campaign_security(self):
        """Test campaign security features and constraints."""
        # Test without auth headers
        response = await self.client.post(
            f"{self.base_url}/",
            json=TEST_CAMPAIGN_DATA
        )
        assert response.status_code == 401

        # Test with invalid permissions
        invalid_headers = self.headers.copy()
        invalid_headers["X-User-Role"] = "guest"
        response = await self.client.post(
            f"{self.base_url}/",
            json=TEST_CAMPAIGN_DATA,
            headers=invalid_headers
        )
        assert response.status_code == 403

        self.metrics["error_count"] += 2

    @pytest.mark.asyncio
    async def test_campaign_update(self):
        """Test campaign update with security validation."""
        campaign_id = await self.setup_test_data()
        updated_data = {
            **TEST_CAMPAIGN_DATA,
            "name": "Updated Campaign"
        }

        response = await self.client.put(
            f"{self.base_url}/{campaign_id}",
            json=updated_data,
            headers=self.headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Campaign"
        assert "audit_trail" in data
        assert "modified_at" in data["audit_trail"]

    @pytest.mark.asyncio
    async def test_campaign_deletion(self):
        """Test campaign deletion with security checks."""
        campaign_id = await self.setup_test_data()

        response = await self.client.delete(
            f"{self.base_url}/{campaign_id}",
            headers=self.headers
        )

        assert response.status_code == 204
        
        # Verify campaign is marked as deleted but not removed
        campaign = await self.db.get_document("campaigns", campaign_id)
        assert campaign["status"] == "deleted"
        assert "deleted_at" in campaign["audit_trail"]

    @pytest.mark.asyncio
    async def test_campaign_metrics(self):
        """Test campaign performance metrics and tracking."""
        campaign_id = await self.setup_test_data()

        response = await self.client.get(
            f"{self.base_url}/{campaign_id}/metrics",
            headers=self.headers
        )

        assert response.status_code == 200
        metrics = response.json()
        assert "delivery_rate" in metrics
        assert "engagement_rate" in metrics
        assert "error_rate" in metrics

    @pytest.mark.asyncio
    async def test_campaign_rate_limiting(self):
        """Test campaign rate limiting functionality."""
        # Create multiple requests to trigger rate limit
        tasks = []
        for _ in range(10):
            tasks.append(
                self.client.post(
                    f"{self.base_url}/",
                    json=TEST_CAMPAIGN_DATA,
                    headers=self.headers
                )
            )

        responses = await asyncio.gather(*tasks, return_exceptions=True)
        rate_limited = sum(1 for r in responses if getattr(r, "status_code", 429) == 429)
        assert rate_limited > 0

    @pytest.mark.asyncio
    async def test_campaign_audit_logging(self):
        """Test campaign audit logging functionality."""
        campaign_id = await self.setup_test_data()

        response = await self.client.get(
            f"{self.base_url}/{campaign_id}/audit-log",
            headers=self.headers
        )

        assert response.status_code == 200
        audit_log = response.json()
        assert len(audit_log) > 0
        assert "action" in audit_log[0]
        assert "timestamp" in audit_log[0]
        assert "user_id" in audit_log[0]

    def teardown_method(self, method):
        """Cleanup and log test metrics."""
        logger.info(
            "Test metrics",
            extra={
                "test_name": method.__name__,
                "request_count": self.metrics["request_count"],
                "error_count": self.metrics["error_count"],
                "avg_response_time": sum(self.metrics["response_times"]) / len(self.metrics["response_times"])
                if self.metrics["response_times"] else 0
            }
        )