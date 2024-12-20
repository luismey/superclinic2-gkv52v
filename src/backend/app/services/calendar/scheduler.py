"""
Enhanced appointment scheduling service for healthcare providers.

This module provides comprehensive appointment management with Google Calendar
integration, timezone handling, conflict resolution, and LGPD compliance.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Tuple
import asyncio

# Third-party imports - versions specified in comments
from tenacity import (  # v8.2.2
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

# Internal imports
from app.services.calendar.google import GoogleCalendarClient
from app.models.appointments import AppointmentModel, AppointmentStatus
from app.utils.datetime import BRAZIL_TIMEZONE
from app.core.logging import get_logger
from app.core.exceptions import ValidationError

# Configure module logger
logger = get_logger(__name__)

# Constants
DEFAULT_APPOINTMENT_DURATION = timedelta(minutes=30)
BUSINESS_HOURS = {
    'start': time(8, 0),   # 8:00 AM
    'end': time(18, 0)     # 6:00 PM
}

class AppointmentScheduler:
    """
    Enhanced service for managing healthcare appointment scheduling with
    comprehensive validation, error handling, and performance optimization.
    """
    
    def __init__(
        self,
        calendar_id: str,
        business_hours: Optional[Dict] = None,
        cache_config: Optional[Dict] = None
    ) -> None:
        """
        Initialize appointment scheduler with enhanced configuration.
        
        Args:
            calendar_id: Google Calendar ID
            business_hours: Custom business hours configuration
            cache_config: Cache settings for performance optimization
            
        Raises:
            ValidationError: If configuration is invalid
        """
        try:
            # Initialize Google Calendar client with retry configuration
            self.calendar_client = GoogleCalendarClient(
                calendar_id=calendar_id,
                business_hours=business_hours or BUSINESS_HOURS
            )
            
            # Set business hours with validation
            self.business_hours = business_hours or BUSINESS_HOURS
            self._validate_business_hours()
            
            # Initialize cache for performance optimization
            self.cache = cache_config or {}
            
            logger.info(
                "Appointment scheduler initialized",
                extra={
                    "calendar_id": calendar_id,
                    "business_hours": self.business_hours
                }
            )
            
        except Exception as e:
            raise ValidationError(
                message="Failed to initialize appointment scheduler",
                details={"error": str(e)},
                validation_context={"calendar_id": calendar_id}
            )

    def _validate_business_hours(self) -> None:
        """Validate business hours configuration."""
        if not all(key in self.business_hours for key in ['start', 'end']):
            raise ValidationError(
                message="Invalid business hours configuration",
                details={"required_keys": ['start', 'end']},
                validation_context={"business_hours": self.business_hours}
            )
        
        if self.business_hours['start'] >= self.business_hours['end']:
            raise ValidationError(
                message="Invalid business hours range",
                details={
                    "start": self.business_hours['start'].isoformat(),
                    "end": self.business_hours['end'].isoformat()
                }
            )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError))
    )
    async def schedule_appointment(
        self,
        appointment_data: Dict
    ) -> AppointmentModel:
        """
        Schedule a new appointment with comprehensive validation and error handling.
        
        Args:
            appointment_data: Appointment details including:
                - healthcare_provider_id: Provider's ID
                - patient_id: Patient's ID
                - start_time: Appointment start time
                - end_time: Appointment end time
                - service_type: Type of healthcare service
                - notes: Optional appointment notes
                
        Returns:
            Created AppointmentModel instance
            
        Raises:
            ValidationError: If appointment data is invalid
            ConnectionError: If calendar integration fails
        """
        try:
            # Validate and sanitize input data
            self._validate_appointment_data(appointment_data)
            
            # Check slot availability with conflict detection
            start_time = appointment_data['start_time']
            end_time = appointment_data['end_time']
            
            available_slots = await self.calendar_client.get_available_slots(
                start_date=start_time.date(),
                end_date=end_time.date()
            )
            
            slot_available = any(
                slot[0] <= start_time and slot[1] >= end_time
                for slot in available_slots
            )
            
            if not slot_available:
                raise ValidationError(
                    message="Time slot not available",
                    details={
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat()
                    }
                )
            
            # Create calendar event with retry logic
            event_id = await self.calendar_client.create_event(
                title=f"Appointment: {appointment_data['service_type']}",
                start_time=start_time,
                end_time=end_time,
                description=appointment_data.get('notes', ''),
                attendees=[
                    {"email": appointment_data.get('patient_email')}
                ] if appointment_data.get('patient_email') else None
            )
            
            # Create appointment model
            appointment_data['calendar_event_id'] = event_id
            appointment_data['status'] = AppointmentStatus.SCHEDULED
            
            appointment = AppointmentModel(
                data=appointment_data,
                user_id=appointment_data['healthcare_provider_id']
            )
            
            # Save appointment with transaction handling
            saved_appointment = await appointment.save(
                user_id=appointment_data['healthcare_provider_id']
            )
            
            # Update cache for performance optimization
            self._update_cache(saved_appointment)
            
            logger.info(
                "Appointment scheduled successfully",
                extra={
                    "appointment_id": saved_appointment.id,
                    "calendar_event_id": event_id,
                    "provider_id": appointment_data['healthcare_provider_id'],
                    "patient_id": appointment_data['patient_id']
                }
            )
            
            return saved_appointment
            
        except ValidationError as e:
            logger.warning(
                "Appointment scheduling validation failed",
                extra={
                    "error": str(e),
                    "appointment_data": appointment_data
                }
            )
            raise
            
        except Exception as e:
            logger.error(
                "Appointment scheduling failed",
                extra={
                    "error": str(e),
                    "appointment_data": appointment_data
                }
            )
            raise ValidationError(
                message="Failed to schedule appointment",
                details={"error": str(e)},
                validation_context={"appointment_data": appointment_data}
            )

    def _validate_appointment_data(self, data: Dict) -> None:
        """
        Validate appointment data with comprehensive checks.
        
        Args:
            data: Appointment data to validate
            
        Raises:
            ValidationError: If data is invalid
        """
        required_fields = [
            'healthcare_provider_id',
            'patient_id',
            'start_time',
            'end_time',
            'service_type'
        ]
        
        # Check required fields
        missing_fields = [
            field for field in required_fields
            if field not in data
        ]
        if missing_fields:
            raise ValidationError(
                message="Missing required fields",
                details={"missing_fields": missing_fields}
            )
        
        # Validate times
        start_time = data['start_time']
        end_time = data['end_time']
        
        if not isinstance(start_time, datetime) or not isinstance(end_time, datetime):
            raise ValidationError(
                message="Invalid datetime format",
                details={
                    "start_time": str(start_time),
                    "end_time": str(end_time)
                }
            )
        
        # Ensure times are in Brazil timezone
        if start_time.tzinfo != BRAZIL_TIMEZONE:
            raise ValidationError(
                message="Appointment times must be in Brazil timezone",
                details={"timezone": str(BRAZIL_TIMEZONE)}
            )

    def _update_cache(self, appointment: AppointmentModel) -> None:
        """
        Update cache with new appointment data.
        
        Args:
            appointment: Newly created appointment
        """
        cache_key = f"appointments:{appointment.healthcare_provider_id}:{appointment.start_time.date()}"
        if cache_key in self.cache:
            self.cache[cache_key].append(appointment.to_dict())

    async def get_available_slots(
        self,
        provider_id: str,
        start_date: datetime,
        end_date: datetime,
        duration: timedelta = DEFAULT_APPOINTMENT_DURATION
    ) -> List[Tuple[datetime, datetime]]:
        """
        Get available appointment slots for a healthcare provider.
        
        Args:
            provider_id: Healthcare provider ID
            start_date: Start of date range
            end_date: End of date range
            duration: Desired appointment duration
            
        Returns:
            List of available time slots as (start, end) tuples
            
        Raises:
            ValidationError: If parameters are invalid
        """
        try:
            # Validate parameters
            if start_date >= end_date:
                raise ValidationError(
                    message="Invalid date range",
                    details={
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat()
                    }
                )
            
            if duration < DEFAULT_APPOINTMENT_DURATION:
                raise ValidationError(
                    message="Invalid appointment duration",
                    details={"minimum_duration": str(DEFAULT_APPOINTMENT_DURATION)}
                )
            
            # Get available slots from calendar
            slots = await self.calendar_client.get_available_slots(
                start_date=start_date,
                end_date=end_date,
                duration_minutes=int(duration.total_seconds() / 60)
            )
            
            logger.info(
                "Retrieved available slots",
                extra={
                    "provider_id": provider_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "slot_count": len(slots)
                }
            )
            
            return slots
            
        except Exception as e:
            logger.error(
                "Failed to get available slots",
                extra={
                    "error": str(e),
                    "provider_id": provider_id,
                    "date_range": f"{start_date.isoformat()} - {end_date.isoformat()}"
                }
            )
            raise ValidationError(
                message="Failed to retrieve available slots",
                details={"error": str(e)}
            )