"""
FastAPI endpoint handlers for managing healthcare appointments with enhanced security,
LGPD compliance, and Brazilian timezone handling.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import List, Optional
from uuid import UUID

# Third-party imports
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi_limiter import RateLimiter  # v0.1.5
from tenacity import RetryClient  # v8.0.1
from pydantic import BaseModel, validator

# Internal imports
from app.models.appointments import AppointmentModel, AppointmentStatus
from app.utils.validators import validate_date_range
from app.utils.datetime import BrazilianTimeZoneHandler
from app.core.auth import get_current_user, requires_auth
from app.core.logging import get_logger
from app.core.exceptions import ValidationError
from app.services.calendar import GoogleCalendarClient
from app.schemas.appointments import AppointmentResponse, AppointmentCreate, AppointmentUpdate

# Initialize components
router = APIRouter(prefix='/appointments', tags=['appointments'])
logger = get_logger(__name__)
calendar_client = GoogleCalendarClient(retry_client=RetryClient())
tz_handler = BrazilianTimeZoneHandler()

# Rate limiting configuration
RATE_LIMIT_CALLS = 100
RATE_LIMIT_PERIOD = 60  # seconds

@router.get(
    '/',
    response_model=List[AppointmentResponse],
    summary="Get appointments with enhanced filtering",
    description="Retrieve appointments with LGPD-compliant data filtering and Brazilian timezone handling"
)
@requires_auth
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_appointments(
    start_date: Optional[datetime] = Query(None, description="Filter by start date (Brazil timezone)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (Brazil timezone)"),
    healthcare_provider_id: Optional[UUID] = Query(None, description="Filter by healthcare provider"),
    patient_id: Optional[UUID] = Query(None, description="Filter by patient"),
    status: Optional[str] = Query(None, description="Filter by appointment status"),
    current_user = Depends(get_current_user)
) -> List[AppointmentResponse]:
    """
    Get appointments with comprehensive filtering and LGPD compliance.
    
    Args:
        start_date: Optional start date filter
        end_date: Optional end date filter
        healthcare_provider_id: Optional healthcare provider filter
        patient_id: Optional patient filter
        status: Optional appointment status filter
        current_user: Current authenticated user
        
    Returns:
        List of filtered appointments with audit information
        
    Raises:
        ValidationError: If date range or filters are invalid
        AuthorizationError: If user lacks required permissions
    """
    try:
        # Validate date range if provided
        if start_date and end_date:
            # Convert dates to Brazil timezone
            start_date = tz_handler.convert_to_local(start_date)
            end_date = tz_handler.convert_to_local(end_date)
            
            if not validate_date_range(start_date, end_date):
                raise ValidationError(
                    message="Invalid date range",
                    details={
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat()
                    }
                )

        # Build query filters
        filters = {}
        if start_date:
            filters["start_time"] = {"$gte": start_date}
        if end_date:
            filters["end_time"] = {"$lte": end_date}
        if healthcare_provider_id:
            filters["healthcare_provider_id"] = healthcare_provider_id
        if patient_id:
            filters["patient_id"] = patient_id
        if status:
            try:
                filters["status"] = AppointmentStatus(status).value
            except ValueError:
                raise ValidationError(
                    message="Invalid appointment status",
                    details={"status": status}
                )

        # Apply LGPD compliance filters based on user role
        if not current_user.is_admin:
            if current_user.is_healthcare_provider:
                filters["healthcare_provider_id"] = current_user.id
            elif current_user.is_patient:
                filters["patient_id"] = current_user.id
            else:
                # Secretary can only view appointments for their clinic
                filters["clinic_id"] = current_user.clinic_id

        # Retrieve appointments
        appointments = AppointmentModel.query(filters)

        # Convert to response model with timezone handling
        response_appointments = []
        for appointment in appointments:
            appointment_data = appointment.to_dict()
            
            # Convert times to Brazil timezone
            appointment_data["start_time"] = tz_handler.convert_to_local(
                appointment_data["start_time"]
            )
            appointment_data["end_time"] = tz_handler.convert_to_local(
                appointment_data["end_time"]
            )
            
            # Remove sensitive data based on user role
            if not current_user.is_admin and not current_user.is_healthcare_provider:
                appointment_data.pop("notes", None)
                appointment_data.pop("price", None)
            
            response_appointments.append(
                AppointmentResponse(**appointment_data)
            )

        logger.info(
            "Appointments retrieved successfully",
            extra={
                "user_id": current_user.id,
                "filters": filters,
                "appointments_count": len(response_appointments)
            }
        )

        return response_appointments

    except ValidationError as e:
        logger.warning(
            "Validation error in get_appointments",
            extra={
                "error": str(e),
                "user_id": current_user.id,
                "filters": filters
            }
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Error retrieving appointments",
            extra={
                "error": str(e),
                "user_id": current_user.id,
                "filters": filters
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post(
    '/',
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new appointment",
    description="Create a new appointment with calendar integration and validation"
)
@requires_auth
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def create_appointment(
    appointment: AppointmentCreate,
    current_user = Depends(get_current_user)
) -> AppointmentResponse:
    """
    Create a new appointment with comprehensive validation and calendar integration.
    
    Args:
        appointment: Appointment creation data
        current_user: Current authenticated user
        
    Returns:
        Created appointment details
        
    Raises:
        ValidationError: If appointment data is invalid
        AuthorizationError: If user lacks required permissions
    """
    try:
        # Convert times to UTC for storage
        appointment.start_time = tz_handler.convert_to_utc(appointment.start_time)
        appointment.end_time = tz_handler.convert_to_utc(appointment.end_time)
        
        # Create appointment model
        appointment_model = AppointmentModel(
            data=appointment.dict(),
            user_id=str(current_user.id)
        )
        
        # Save to database
        saved_appointment = appointment_model.save(str(current_user.id))
        
        # Create calendar event
        if saved_appointment.calendar_integration_enabled:
            event = await calendar_client.create_event(
                start_time=appointment.start_time,
                end_time=appointment.end_time,
                title=f"Consulta - {appointment.patient_name}",
                description=appointment.notes
            )
            
            # Update appointment with calendar event ID
            saved_appointment.calendar_event_id = event.id
            saved_appointment.save(str(current_user.id))
        
        # Convert response times to Brazil timezone
        response_data = saved_appointment.to_dict()
        response_data["start_time"] = tz_handler.convert_to_local(
            response_data["start_time"]
        )
        response_data["end_time"] = tz_handler.convert_to_local(
            response_data["end_time"]
        )
        
        logger.info(
            "Appointment created successfully",
            extra={
                "appointment_id": saved_appointment.id,
                "user_id": current_user.id,
                "calendar_integrated": saved_appointment.calendar_integration_enabled
            }
        )
        
        return AppointmentResponse(**response_data)
        
    except ValidationError as e:
        logger.warning(
            "Validation error in create_appointment",
            extra={
                "error": str(e),
                "user_id": current_user.id,
                "appointment_data": appointment.dict()
            }
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Error creating appointment",
            extra={
                "error": str(e),
                "user_id": current_user.id,
                "appointment_data": appointment.dict()
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

# Additional endpoints would follow similar patterns for update, delete, etc.