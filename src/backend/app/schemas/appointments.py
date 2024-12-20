"""
Pydantic schemas for appointment data validation and serialization in the Porfin platform.
Implements comprehensive validation for Brazilian healthcare appointments with timezone
awareness and business rules enforcement.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Optional
from uuid import UUID

# Third-party imports
from pydantic import BaseModel, Field, validator, constr  # pydantic v2.0.0

# Internal imports
from app.models.appointments import AppointmentStatus
from app.utils.validators import validate_date_range, validate_phone_number
from app.utils.datetime import (
    to_brazil_timezone,
    validate_appointment_duration,
    validate_business_hours
)

# Constants
SERVICE_TYPES = ["CONSULTATION", "FOLLOW_UP", "PROCEDURE", "EXAM", "EMERGENCY"]
MIN_APPOINTMENT_DURATION = datetime.timedelta(minutes=15)
MAX_APPOINTMENT_DURATION = datetime.timedelta(hours=4)

class AppointmentBase(BaseModel):
    """
    Enhanced base schema for appointment data validation with Brazilian healthcare requirements.
    Implements comprehensive validation for appointments including business hours,
    duration limits, and Brazilian timezone handling.
    """
    healthcare_provider_id: UUID = Field(
        ...,
        description="Unique identifier of the healthcare provider"
    )
    patient_id: UUID = Field(
        ...,
        description="Unique identifier of the patient"
    )
    start_time: datetime = Field(
        ...,
        description="Appointment start time in Brazil timezone"
    )
    end_time: datetime = Field(
        ...,
        description="Appointment end time in Brazil timezone"
    )
    service_type: constr(min_length=1, regex='^[A-Z_]+$') = Field(
        ...,
        description="Type of healthcare service"
    )
    price: float = Field(
        ...,
        ge=0,
        description="Appointment price in BRL"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Additional appointment notes"
    )
    is_first_visit: bool = Field(
        default=False,
        description="Indicates if this is patient's first visit"
    )
    patient_phone: Optional[str] = Field(
        None,
        description="Patient's contact phone number"
    )

    @validator('start_time', 'end_time')
    def convert_to_brazil_timezone(cls, v):
        """Convert datetime to Brazil timezone."""
        return to_brazil_timezone(v)

    @validator('service_type')
    def validate_service_type(cls, v):
        """Validate service type against predefined types."""
        if v not in SERVICE_TYPES:
            raise ValueError(f"Invalid service type. Must be one of: {', '.join(SERVICE_TYPES)}")
        return v

    @validator('patient_phone')
    def validate_phone(cls, v):
        """Validate Brazilian phone number format."""
        if v and not validate_phone_number(v):
            raise ValueError("Invalid Brazilian phone number format")
        return v

    @validator('end_time')
    def validate_appointment_times(cls, v, values):
        """Validate appointment time slot and duration."""
        if 'start_time' in values:
            start_time = values['start_time']
            
            # Validate date range
            if not validate_date_range(start_time, v):
                raise ValueError("Invalid appointment date range")
            
            # Validate business hours
            if not validate_business_hours(start_time) or not validate_business_hours(v):
                raise ValueError("Appointment must be within business hours")
            
            # Validate duration
            is_valid, message = validate_appointment_duration(start_time, v)
            if not is_valid:
                raise ValueError(message)
        
        return v

class AppointmentCreate(AppointmentBase):
    """
    Enhanced schema for appointment creation with additional validation.
    """
    class Config:
        json_schema_extra = {
            "example": {
                "healthcare_provider_id": "123e4567-e89b-12d3-a456-426614174000",
                "patient_id": "123e4567-e89b-12d3-a456-426614174001",
                "start_time": "2024-01-01T09:00:00-03:00",
                "end_time": "2024-01-01T10:00:00-03:00",
                "service_type": "CONSULTATION",
                "price": 250.00,
                "notes": "Initial consultation",
                "is_first_visit": True,
                "patient_phone": "+55 11 98765-4321"
            }
        }

class AppointmentUpdate(BaseModel):
    """
    Enhanced schema for appointment updates with status transition validation.
    """
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    service_type: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[AppointmentStatus] = None

    @validator('status')
    def validate_status_transition(cls, v, values):
        """Validate appointment status transitions."""
        valid_transitions = {
            AppointmentStatus.SCHEDULED: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
            AppointmentStatus.CONFIRMED: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED],
            AppointmentStatus.CANCELLED: [],
            AppointmentStatus.COMPLETED: [],
            AppointmentStatus.NO_SHOW: []
        }

        if v and 'status' in values:
            current_status = values['status']
            if v not in valid_transitions[current_status]:
                raise ValueError(f"Invalid status transition from {current_status.value} to {v.value}")
        return v

class AppointmentResponse(AppointmentBase):
    """
    Enhanced schema for appointment responses with audit information.
    """
    id: UUID
    status: AppointmentStatus
    calendar_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_notification_status: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "healthcare_provider_id": "123e4567-e89b-12d3-a456-426614174000",
                "patient_id": "123e4567-e89b-12d3-a456-426614174001",
                "start_time": "2024-01-01T09:00:00-03:00",
                "end_time": "2024-01-01T10:00:00-03:00",
                "service_type": "CONSULTATION",
                "price": 250.00,
                "notes": "Initial consultation",
                "is_first_visit": True,
                "status": "SCHEDULED",
                "calendar_event_id": "google_calendar_event_id",
                "created_at": "2023-12-01T10:00:00-03:00",
                "updated_at": "2023-12-01T10:00:00-03:00",
                "patient_phone": "+55 11 98765-4321",
                "last_notification_status": "SENT"
            }
        }