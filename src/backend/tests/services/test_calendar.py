"""
Comprehensive test suite for calendar service components including Google Calendar
integration, appointment scheduling, performance validation, and timezone handling.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
import json
import os
from typing import Dict, List, Optional

# Third-party imports
import pytest  # version: 7.4.0
import pytest_asyncio  # version: 0.21.0
from freezegun import freeze_time  # version: 1.2.0
from unittest.mock import AsyncMock, MagicMock, patch

# Internal imports
from app.services.calendar.google import GoogleCalendarClient
from app.services.calendar.scheduler import AppointmentScheduler
from app.utils.datetime import BRAZIL_TIMEZONE, to_brazil_timezone
from app.core.exceptions import ValidationError

# Test constants
TEST_CALENDAR_ID = "test_calendar@group.calendar.google.com"
TEST_CREDENTIALS = {
    "type": "service_account",
    "project_id": "test-project",
    "private_key": "test-key",
    "client_email": "test@test-project.iam.gserviceaccount.com"
}

BUSINESS_HOURS = {
    'start': datetime.strptime('08:00', '%H:%M').time(),
    'end': datetime.strptime('18:00', '%H:%M').time(),
    'break_start': datetime.strptime('12:00', '%H:%M').time(),
    'break_end': datetime.strptime('13:00', '%H:%M').time()
}

@pytest.fixture
def mock_credentials():
    """Fixture for mocked Google Calendar credentials."""
    with patch('app.services.calendar.google.Credentials') as mock_creds:
        mock_creds.from_authorized_user_info.return_value = MagicMock()
        yield mock_creds

@pytest.fixture
def mock_calendar_service():
    """Fixture for mocked Google Calendar service."""
    with patch('app.services.calendar.google.build') as mock_build:
        mock_service = MagicMock()
        mock_build.return_value = mock_service
        yield mock_service

@pytest.fixture
async def calendar_client(mock_credentials, mock_calendar_service):
    """Fixture for initialized calendar client."""
    client = GoogleCalendarClient(
        calendar_id=TEST_CALENDAR_ID,
        business_hours=BUSINESS_HOURS
    )
    yield client

@pytest.fixture
async def appointment_scheduler(calendar_client):
    """Fixture for initialized appointment scheduler."""
    scheduler = AppointmentScheduler(
        calendar_id=TEST_CALENDAR_ID,
        business_hours=BUSINESS_HOURS
    )
    scheduler.calendar_client = calendar_client
    yield scheduler

class TestGoogleCalendarClient:
    """Test suite for Google Calendar API client with performance validation."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(1)  # Enforce 500ms latency requirement
    async def test_create_event_performance(self, calendar_client, mock_calendar_service):
        """Test event creation meets latency requirements."""
        # Prepare test data
        start_time = datetime.now(BRAZIL_TIMEZONE)
        end_time = start_time + timedelta(hours=1)
        title = "Test Appointment"
        
        # Configure mock response
        mock_calendar_service.events().insert().execute.return_value = {
            'id': 'test_event_id'
        }
        
        # Execute with timing
        start = datetime.now()
        event_id = await calendar_client.create_event(
            title=title,
            start_time=start_time,
            end_time=end_time
        )
        duration = (datetime.now() - start).total_seconds()
        
        # Verify performance
        assert duration < 0.5, "Event creation exceeded 500ms latency requirement"
        assert event_id == 'test_event_id'

    @pytest.mark.asyncio
    async def test_timezone_handling(self, calendar_client):
        """Test Brazil timezone handling in calendar operations."""
        # Test event in Brazil timezone
        with freeze_time("2023-12-01 14:00:00", tz_offset=-3):  # Brazil timezone
            start_time = datetime.now(BRAZIL_TIMEZONE)
            end_time = start_time + timedelta(hours=1)
            
            # Verify timezone conversion
            formatted_start = calendar_client._format_event_time(start_time)
            formatted_end = calendar_client._format_event_time(end_time)
            
            assert "America/Sao_Paulo" in formatted_start
            assert "America/Sao_Paulo" in formatted_end

    @pytest.mark.asyncio
    async def test_business_hours_validation(self, calendar_client):
        """Test business hours validation logic."""
        # Test valid business hours
        valid_start = datetime.now(BRAZIL_TIMEZONE).replace(hour=9, minute=0)
        valid_end = valid_start + timedelta(hours=1)
        
        assert calendar_client._is_within_business_hours(valid_start, valid_end)
        
        # Test invalid business hours
        invalid_start = datetime.now(BRAZIL_TIMEZONE).replace(hour=19, minute=0)
        invalid_end = invalid_start + timedelta(hours=1)
        
        assert not calendar_client._is_within_business_hours(invalid_start, invalid_end)

    @pytest.mark.asyncio
    async def test_concurrent_slot_availability(self, calendar_client):
        """Test concurrent slot availability checking."""
        base_time = datetime.now(BRAZIL_TIMEZONE).replace(hour=10, minute=0)
        
        # Create overlapping events
        events = [
            {
                'start': {'dateTime': (base_time).isoformat()},
                'end': {'dateTime': (base_time + timedelta(hours=1)).isoformat()},
                'status': 'confirmed'
            },
            {
                'start': {'dateTime': (base_time + timedelta(hours=2)).isoformat()},
                'end': {'dateTime': (base_time + timedelta(hours=3)).isoformat()},
                'status': 'confirmed'
            }
        ]
        
        # Test slot availability
        assert not calendar_client._is_slot_available(
            base_time,
            base_time + timedelta(hours=1),
            events
        )
        
        assert calendar_client._is_slot_available(
            base_time + timedelta(hours=1),
            base_time + timedelta(hours=2),
            events
        )

class TestAppointmentScheduler:
    """Test suite for appointment scheduling with business rules."""

    @pytest.mark.asyncio
    async def test_concurrent_scheduling(self, appointment_scheduler):
        """Test concurrent appointment scheduling handling."""
        base_time = datetime.now(BRAZIL_TIMEZONE).replace(hour=10, minute=0)
        
        # Create multiple concurrent appointments
        appointments = [
            {
                'healthcare_provider_id': 'provider1',
                'patient_id': f'patient{i}',
                'start_time': base_time + timedelta(hours=i),
                'end_time': base_time + timedelta(hours=i+1),
                'service_type': 'Consultation'
            } for i in range(3)
        ]
        
        # Schedule appointments concurrently
        tasks = [
            appointment_scheduler.schedule_appointment(appointment)
            for appointment in appointments
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify no conflicts
        successful = [r for r in results if not isinstance(r, Exception)]
        assert len(successful) == 3, "Concurrent scheduling failed"

    @pytest.mark.asyncio
    async def test_appointment_validation(self, appointment_scheduler):
        """Test appointment validation rules."""
        # Test invalid duration
        with pytest.raises(ValidationError) as exc_info:
            await appointment_scheduler.schedule_appointment({
                'healthcare_provider_id': 'provider1',
                'patient_id': 'patient1',
                'start_time': datetime.now(BRAZIL_TIMEZONE),
                'end_time': datetime.now(BRAZIL_TIMEZONE) + timedelta(minutes=15),
                'service_type': 'Consultation'
            })
        assert "duration" in str(exc_info.value)

        # Test lunch break conflict
        lunch_start = datetime.now(BRAZIL_TIMEZONE).replace(hour=12, minute=0)
        with pytest.raises(ValidationError) as exc_info:
            await appointment_scheduler.schedule_appointment({
                'healthcare_provider_id': 'provider1',
                'patient_id': 'patient1',
                'start_time': lunch_start,
                'end_time': lunch_start + timedelta(hours=1),
                'service_type': 'Consultation'
            })
        assert "break time" in str(exc_info.value)

@pytest.mark.asyncio
class TestCalendarPerformance:
    """Test suite for calendar service performance requirements."""

    async def test_slot_search_performance(self, appointment_scheduler):
        """Test available slot search performance."""
        start_date = datetime.now(BRAZIL_TIMEZONE)
        end_date = start_date + timedelta(days=7)
        
        # Execute with timing
        start = datetime.now()
        slots = await appointment_scheduler.get_available_slots(
            provider_id='provider1',
            start_date=start_date,
            end_date=end_date
        )
        duration = (datetime.now() - start).total_seconds()
        
        # Verify performance
        assert duration < 0.5, "Slot search exceeded 500ms latency requirement"
        assert isinstance(slots, list)

    async def test_batch_operation_performance(self, calendar_client):
        """Test batch calendar operation performance."""
        events = []
        base_time = datetime.now(BRAZIL_TIMEZONE).replace(hour=9, minute=0)
        
        # Create 10 test events
        for i in range(10):
            start_time = base_time + timedelta(days=i)
            end_time = start_time + timedelta(hours=1)
            events.append({
                'title': f'Test Event {i}',
                'start_time': start_time,
                'end_time': end_time
            })
        
        # Execute batch creation with timing
        start = datetime.now()
        tasks = [
            calendar_client.create_event(**event)
            for event in events
        ]
        results = await asyncio.gather(*tasks)
        duration = (datetime.now() - start).total_seconds()
        
        # Verify performance
        assert duration < 2.0, "Batch operation exceeded time limit"
        assert len(results) == 10