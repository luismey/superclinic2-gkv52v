"""
Core data model for managing healthcare appointments in the Porfin platform.

This module implements timezone-aware scheduling, status tracking, and Google Calendar
integration with LGPD compliance for healthcare appointments.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, time, timedelta
from enum import Enum
import uuid
from typing import Dict, Any, Optional

# Third-party imports
import pytz  # pytz v2023.3

# Internal imports
from app.db.firestore import FirestoreClient
from app.core.logging import get_logger
from app.core.exceptions import ValidationError

# Configure module logger
logger = get_logger(__name__)

# Constants
BRAZIL_TZ = pytz.timezone('America/Sao_Paulo')
COLLECTION_NAME = 'appointments'

# Business rules constants
BUSINESS_HOURS = {
    'start': time(8, 0),  # 8:00 AM
    'end': time(18, 0)    # 6:00 PM
}
MIN_APPOINTMENT_DURATION = timedelta(minutes=30)
MAX_APPOINTMENT_DURATION = timedelta(hours=2)

class AppointmentStatus(Enum):
    """
    Enumeration of possible appointment statuses with validation rules.
    
    Attributes:
        SCHEDULED: Initial status when appointment is created
        CONFIRMED: Appointment confirmed by patient
        CANCELLED: Appointment cancelled by either party
        COMPLETED: Appointment successfully completed
        NO_SHOW: Patient did not show up for appointment
    """
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"

class AppointmentModel:
    """
    Enhanced appointment model with timezone awareness and validation.
    
    This class implements comprehensive appointment management with LGPD compliance,
    timezone handling, and business rules validation.
    """
    
    def __init__(self, data: Dict[str, Any], user_id: str) -> None:
        """
        Initialize appointment model with enhanced validation.
        
        Args:
            data: Dictionary containing appointment data
            user_id: ID of user creating/updating the appointment
            
        Raises:
            ValidationError: If appointment data is invalid
        """
        # Validate required fields
        required_fields = ['healthcare_provider_id', 'patient_id', 'start_time', 'end_time', 'service_type']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise ValidationError(
                message="Missing required fields",
                details={"missing_fields": missing_fields},
                validation_context={"appointment_data": data}
            )
            
        # Convert and validate times
        try:
            self.start_time = self._parse_datetime(data['start_time'])
            self.end_time = self._parse_datetime(data['end_time'])
        except ValueError as e:
            raise ValidationError(
                message="Invalid datetime format",
                details={"error": str(e)},
                validation_context={"appointment_data": data}
            )
            
        # Validate business rules
        self._validate_business_hours()
        self._validate_appointment_duration()
        
        # Set core fields
        self.id = data.get('id', str(uuid.uuid4()))
        self.healthcare_provider_id = data['healthcare_provider_id']
        self.patient_id = data['patient_id']
        self.service_type = data['service_type']
        self.price = data.get('price', 0.0)
        self.notes = data.get('notes', '')
        self.is_first_visit = data.get('is_first_visit', False)
        self.status = AppointmentStatus(data.get('status', AppointmentStatus.SCHEDULED.value))
        self.calendar_event_id = data.get('calendar_event_id')
        
        # Set audit fields
        now = datetime.now(BRAZIL_TZ)
        if 'created_at' in data:
            self.created_at = self._parse_datetime(data['created_at'])
            self.created_by = data['created_by']
        else:
            self.created_at = now
            self.created_by = user_id
            
        self.updated_at = now
        self.updated_by = user_id
        
        # Validate slot availability
        self._validate_slot_availability()
        
    def _parse_datetime(self, dt_value: Any) -> datetime:
        """Convert datetime string or object to timezone-aware datetime."""
        if isinstance(dt_value, str):
            dt = datetime.fromisoformat(dt_value)
        elif isinstance(dt_value, datetime):
            dt = dt_value
        else:
            raise ValueError(f"Invalid datetime value: {dt_value}")
            
        if dt.tzinfo is None:
            dt = BRAZIL_TZ.localize(dt)
        return dt
        
    def _validate_business_hours(self) -> None:
        """Validate appointment times against business hours."""
        start_time = self.start_time.time()
        end_time = self.end_time.time()
        
        if (start_time < BUSINESS_HOURS['start'] or 
            end_time > BUSINESS_HOURS['end'] or
            self.start_time >= self.end_time):
            raise ValidationError(
                message="Appointment must be within business hours",
                details={
                    "business_hours": f"{BUSINESS_HOURS['start']} - {BUSINESS_HOURS['end']}",
                    "appointment_time": f"{start_time} - {end_time}"
                }
            )
            
    def _validate_appointment_duration(self) -> None:
        """Validate appointment duration against allowed limits."""
        duration = self.end_time - self.start_time
        
        if duration < MIN_APPOINTMENT_DURATION or duration > MAX_APPOINTMENT_DURATION:
            raise ValidationError(
                message="Invalid appointment duration",
                details={
                    "duration": str(duration),
                    "allowed_range": f"{MIN_APPOINTMENT_DURATION} - {MAX_APPOINTMENT_DURATION}"
                }
            )
            
    def _validate_slot_availability(self) -> None:
        """Validate appointment slot availability."""
        db = FirestoreClient()
        
        # Query for overlapping appointments
        overlapping = db.query_documents(
            COLLECTION_NAME,
            filters=[
                ('healthcare_provider_id', '==', self.healthcare_provider_id),
                ('start_time', '<=', self.end_time),
                ('end_time', '>=', self.start_time),
                ('status', 'in', [AppointmentStatus.SCHEDULED.value, AppointmentStatus.CONFIRMED.value])
            ]
        )
        
        # Exclude current appointment in case of updates
        overlapping = [appt for appt in overlapping if appt.id != self.id]
        
        if overlapping:
            raise ValidationError(
                message="Time slot not available",
                details={
                    "conflicting_appointments": [appt.id for appt in overlapping]
                }
            )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert appointment model to dictionary with enhanced formatting.
        
        Returns:
            Dictionary containing appointment data
        """
        return {
            'id': self.id,
            'healthcare_provider_id': self.healthcare_provider_id,
            'patient_id': self.patient_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'service_type': self.service_type,
            'price': self.price,
            'notes': self.notes,
            'is_first_visit': self.is_first_visit,
            'status': self.status.value,
            'calendar_event_id': self.calendar_event_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'created_by': self.created_by,
            'updated_by': self.updated_by
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any], user_id: str) -> 'AppointmentModel':
        """
        Create appointment model from dictionary with validation.
        
        Args:
            data: Dictionary containing appointment data
            user_id: ID of user creating/updating the appointment
            
        Returns:
            New appointment instance
        """
        return cls(data, user_id)
    
    def save(self, user_id: str) -> 'AppointmentModel':
        """
        Save appointment with validation and audit.
        
        Args:
            user_id: ID of user saving the appointment
            
        Returns:
            Updated appointment instance
        """
        self.updated_at = datetime.now(BRAZIL_TZ)
        self.updated_by = user_id
        
        db = FirestoreClient()
        appointment_dict = self.to_dict()
        
        try:
            if hasattr(self, 'id'):
                db.update_document(COLLECTION_NAME, self.id, appointment_dict)
            else:
                self.id = db.create_document(COLLECTION_NAME, appointment_dict)
                
            logger.info(
                f"Appointment saved successfully",
                extra={
                    "appointment_id": self.id,
                    "user_id": user_id,
                    "action": "save"
                }
            )
            
            return self
            
        except Exception as e:
            logger.error(
                f"Error saving appointment",
                extra={
                    "appointment_id": self.id,
                    "user_id": user_id,
                    "error": str(e)
                }
            )
            raise
    
    def delete(self, user_id: str) -> bool:
        """
        Delete appointment with cleanup.
        
        Args:
            user_id: ID of user deleting the appointment
            
        Returns:
            True if deletion was successful
        """
        if not self.id:
            raise ValidationError(
                message="Cannot delete unsaved appointment",
                details={"appointment": self.to_dict()}
            )
            
        db = FirestoreClient()
        
        try:
            # Delete from Firestore
            db.delete_document(COLLECTION_NAME, self.id)
            
            logger.info(
                f"Appointment deleted successfully",
                extra={
                    "appointment_id": self.id,
                    "user_id": user_id,
                    "action": "delete"
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(
                f"Error deleting appointment",
                extra={
                    "appointment_id": self.id,
                    "user_id": user_id,
                    "error": str(e)
                }
            )
            raise
    
    def update_status(self, new_status: AppointmentStatus, user_id: str) -> 'AppointmentModel':
        """
        Update appointment status with validation.
        
        Args:
            new_status: New appointment status
            user_id: ID of user updating the status
            
        Returns:
            Updated appointment instance
        """
        # Validate status transition
        valid_transitions = {
            AppointmentStatus.SCHEDULED: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
            AppointmentStatus.CONFIRMED: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED],
            AppointmentStatus.CANCELLED: [],
            AppointmentStatus.COMPLETED: [],
            AppointmentStatus.NO_SHOW: []
        }
        
        if new_status not in valid_transitions[self.status]:
            raise ValidationError(
                message="Invalid status transition",
                details={
                    "current_status": self.status.value,
                    "new_status": new_status.value,
                    "valid_transitions": [s.value for s in valid_transitions[self.status]]
                }
            )
            
        self.status = new_status
        return self.save(user_id)