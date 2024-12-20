"""
Comprehensive test suite for appointment management API endpoints.

This module provides extensive test coverage for appointment scheduling functionality,
including business hours validation, timezone handling, and LGPD compliance for
Brazilian healthcare providers.

Version: 1.0.0
"""

# Standard library imports
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any

# Third-party imports
import pytest  # v7.0.0
from freezegun import freeze_time  # v1.2.0
import pytz  # v2023.3

# Internal imports
from app.models.appointments import AppointmentStatus
from tests.conftest import TestClient, FirestoreClient

# Constants
BRAZIL_TIMEZONE = 'America/Sao_Paulo'
BUSINESS_HOURS = {
    'start': '08:00',
    'end': '18:00',
    'break_start': '12:00',
    'break_end': '13:00'
}

# Test data
TEST_APPOINTMENT_DATA = {
    'healthcare_provider_id': str(uuid.uuid4()),
    'patient_id': str(uuid.uuid4()),
    'start_time': '2024-01-01T10:00:00-03:00',
    'end_time': '2024-01-01T11:00:00-03:00',
    'service_type': 'Consultation',
    'price': 200.0,
    'notes': 'Initial consultation',
    'is_first_visit': True,
    'patient_cpf': '***.***.***-**',  # Masked for LGPD compliance
    'timezone': 'America/Sao_Paulo',
    'consent_given': True,
    'data_retention_days': 365
}

@pytest.mark.asyncio
@freeze_time('2024-01-01 10:00:00-03:00')
async def test_create_appointment(app_client: TestClient, auth_headers: Dict, mock_db: FirestoreClient) -> None:
    """
    Test successful appointment creation with calendar integration and LGPD compliance.
    """
    # Prepare test data
    appointment_data = TEST_APPOINTMENT_DATA.copy()
    appointment_id = str(uuid.uuid4())
    calendar_event_id = 'google_calendar_event_123'

    # Mock database calls
    mock_db.create_document.return_value = appointment_id

    # Send create appointment request
    response = await app_client.post(
        '/api/v1/appointments',
        json=appointment_data,
        headers=auth_headers
    )

    # Assert response
    assert response.status_code == 201
    response_data = response.json()
    assert response_data['id'] == appointment_id
    assert response_data['status'] == AppointmentStatus.SCHEDULED.value
    assert response_data['calendar_event_id'] == calendar_event_id

    # Verify LGPD compliance
    assert 'patient_cpf' not in response_data
    assert response_data['consent_given'] is True
    assert 'data_retention_days' in response_data

    # Verify database calls
    mock_db.create_document.assert_called_once()
    create_args = mock_db.create_document.call_args[0]
    assert create_args[0] == 'appointments'
    assert create_args[1]['healthcare_provider_id'] == appointment_data['healthcare_provider_id']

@pytest.mark.asyncio
async def test_appointment_status_transitions(app_client: TestClient, auth_headers: Dict, mock_db: FirestoreClient) -> None:
    """
    Test appointment status transitions and validations.
    """
    # Create test appointment
    appointment_id = str(uuid.uuid4())
    appointment_data = TEST_APPOINTMENT_DATA.copy()
    appointment_data['id'] = appointment_id
    mock_db.get_document.return_value = appointment_data

    # Test valid transitions
    valid_transitions = [
        (AppointmentStatus.SCHEDULED.value, AppointmentStatus.CONFIRMED.value),
        (AppointmentStatus.CONFIRMED.value, AppointmentStatus.COMPLETED.value),
        (AppointmentStatus.SCHEDULED.value, AppointmentStatus.CANCELLED.value)
    ]

    for current_status, new_status in valid_transitions:
        appointment_data['status'] = current_status
        response = await app_client.patch(
            f'/api/v1/appointments/{appointment_id}/status',
            json={'status': new_status},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()['status'] == new_status

    # Test invalid transition
    response = await app_client.patch(
        f'/api/v1/appointments/{appointment_id}/status',
        json={'status': AppointmentStatus.SCHEDULED.value},
        headers=auth_headers
    )
    assert response.status_code == 422
    assert 'Invalid status transition' in response.json()['error']['message']

@pytest.mark.asyncio
async def test_business_hours_validation(app_client: TestClient, auth_headers: Dict, mock_db: FirestoreClient) -> None:
    """
    Test appointment creation within business hours.
    """
    # Test valid business hours
    valid_times = [
        ('09:00:00-03:00', '10:00:00-03:00'),
        ('14:00:00-03:00', '15:00:00-03:00'),
        ('17:00:00-03:00', '18:00:00-03:00')
    ]

    for start_time, end_time in valid_times:
        appointment_data = TEST_APPOINTMENT_DATA.copy()
        appointment_data['start_time'] = f'2024-01-01T{start_time}'
        appointment_data['end_time'] = f'2024-01-01T{end_time}'

        response = await app_client.post(
            '/api/v1/appointments',
            json=appointment_data,
            headers=auth_headers
        )
        assert response.status_code == 201

    # Test invalid business hours
    invalid_times = [
        ('07:00:00-03:00', '08:00:00-03:00'),  # Before hours
        ('18:00:00-03:00', '19:00:00-03:00'),  # After hours
        ('12:15:00-03:00', '12:45:00-03:00')   # During break
    ]

    for start_time, end_time in invalid_times:
        appointment_data = TEST_APPOINTMENT_DATA.copy()
        appointment_data['start_time'] = f'2024-01-01T{start_time}'
        appointment_data['end_time'] = f'2024-01-01T{end_time}'

        response = await app_client.post(
            '/api/v1/appointments',
            json=appointment_data,
            headers=auth_headers
        )
        assert response.status_code == 422
        assert 'business hours' in response.json()['error']['message'].lower()

@pytest.mark.asyncio
async def test_appointment_overlap_validation(app_client: TestClient, auth_headers: Dict, mock_db: FirestoreClient) -> None:
    """
    Test appointment overlap validation.
    """
    # Create existing appointment
    existing_appointment = TEST_APPOINTMENT_DATA.copy()
    existing_appointment['id'] = str(uuid.uuid4())
    mock_db.query_documents.return_value = [existing_appointment]

    # Test overlapping appointment
    overlapping_data = TEST_APPOINTMENT_DATA.copy()
    overlapping_data['start_time'] = '2024-01-01T10:30:00-03:00'
    overlapping_data['end_time'] = '2024-01-01T11:30:00-03:00'

    response = await app_client.post(
        '/api/v1/appointments',
        json=overlapping_data,
        headers=auth_headers
    )
    assert response.status_code == 422
    assert 'slot not available' in response.json()['error']['message'].lower()

@pytest.mark.asyncio
async def test_appointment_lgpd_compliance(app_client: TestClient, auth_headers: Dict, mock_db: FirestoreClient) -> None:
    """
    Test LGPD compliance for appointment data handling.
    """
    # Test without consent
    appointment_data = TEST_APPOINTMENT_DATA.copy()
    appointment_data['consent_given'] = False

    response = await app_client.post(
        '/api/v1/appointments',
        json=appointment_data,
        headers=auth_headers
    )
    assert response.status_code == 422
    assert 'consent' in response.json()['error']['message'].lower()

    # Test data retention
    appointment_data['consent_given'] = True
    response = await app_client.post(
        '/api/v1/appointments',
        json=appointment_data,
        headers=auth_headers
    )
    assert response.status_code == 201
    assert 'data_retention_days' in response.json()

    # Test data masking
    assert 'patient_cpf' not in response.json()
    assert '***' in response.json()['masked_patient_cpf']

@pytest.mark.asyncio
async def test_appointment_timezone_handling(app_client: TestClient, auth_headers: Dict, mock_db: FirestoreClient) -> None:
    """
    Test timezone handling for appointments.
    """
    # Test different timezone conversions
    timezones = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem']
    
    for tz in timezones:
        appointment_data = TEST_APPOINTMENT_DATA.copy()
        appointment_data['timezone'] = tz
        local_tz = pytz.timezone(tz)
        
        # Convert times to local timezone
        start_time = datetime.now(local_tz).replace(hour=10, minute=0)
        end_time = start_time + timedelta(hours=1)
        
        appointment_data['start_time'] = start_time.isoformat()
        appointment_data['end_time'] = end_time.isoformat()

        response = await app_client.post(
            '/api/v1/appointments',
            json=appointment_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        
        # Verify timezone conversion
        response_data = response.json()
        assert pytz.timezone(tz).localize(
            datetime.fromisoformat(response_data['start_time'].replace('Z', '+00:00'))
        ).hour == 10