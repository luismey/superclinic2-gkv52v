"""
Google Calendar API client implementation for healthcare appointments.
Provides calendar integration and synchronization with comprehensive timezone
handling and business rules for Brazilian healthcare practices.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json

# Third-party imports
from google.oauth2.credentials import Credentials  # version: 2.22.0
from googleapiclient.discovery import build, Resource  # version: 2.100.0
from tenacity import (  # version: 8.2.2
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

# Internal imports
from app.config.settings import settings
from app.utils.datetime import (
    to_brazil_timezone,
    BRAZIL_TIMEZONE,
    validate_appointment_duration
)

# Calendar API configuration
CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"]

# Event color coding for different appointment states
EVENT_COLORS = {
    "DEFAULT": "1",    # Blue
    "CONFIRMED": "2",  # Green
    "CANCELLED": "4",  # Red
    "TENTATIVE": "5"   # Yellow
}

# Appointment duration constraints in minutes
APPOINTMENT_DURATIONS = {
    "MIN_MINUTES": 30,
    "MAX_MINUTES": 180,
    "DEFAULT_MINUTES": 60
}

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type((ConnectionError, TimeoutError))
)
def format_event_time(dt: datetime) -> str:
    """
    Format datetime for Google Calendar API with proper timezone handling.
    
    Args:
        dt (datetime): Datetime to format
        
    Returns:
        str: RFC3339 formatted datetime string
        
    Raises:
        ValueError: If datetime is invalid
    """
    if not dt:
        raise ValueError("Datetime cannot be None")
        
    # Ensure datetime is in Brazil timezone
    brazil_dt = to_brazil_timezone(dt)
    return brazil_dt.isoformat()

class GoogleCalendarClient:
    """
    Client for interacting with Google Calendar API with comprehensive error
    handling and retry logic for healthcare appointment management.
    """
    
    def __init__(self, calendar_id: str, business_hours: Optional[Dict] = None):
        """
        Initialize Google Calendar client with credentials and business configuration.
        
        Args:
            calendar_id (str): Google Calendar ID to use
            business_hours (Optional[Dict]): Business hours configuration
            
        Raises:
            ValueError: If credentials are invalid
            ConnectionError: If unable to connect to Google Calendar API
        """
        try:
            # Load credentials from file
            with open(settings.GOOGLE_CALENDAR_CREDENTIALS_PATH) as f:
                creds_data = json.load(f)
            
            # Initialize credentials
            self.credentials = Credentials.from_authorized_user_info(
                creds_data,
                CALENDAR_SCOPES
            )
            
            # Build Calendar API service
            self.service: Resource = build(
                'calendar',
                'v3',
                credentials=self.credentials,
                cache_discovery=False
            )
            
            self.calendar_id = calendar_id
            self.business_hours = business_hours or {}
            
            # Validate calendar access
            self.service.calendars().get(
                calendarId=self.calendar_id
            ).execute()
            
        except Exception as e:
            raise ConnectionError(f"Failed to initialize Google Calendar client: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError))
    )
    def create_event(
        self,
        title: str,
        start_time: datetime,
        end_time: datetime,
        description: str = "",
        attendees: Optional[List[Dict[str, str]]] = None,
        send_notifications: bool = True
    ) -> str:
        """
        Create a new calendar event for an appointment with validation.
        
        Args:
            title (str): Event title
            start_time (datetime): Appointment start time
            end_time (datetime): Appointment end time
            description (str): Event description
            attendees (Optional[List[Dict[str, str]]]): List of attendee emails
            send_notifications (bool): Whether to send email notifications
            
        Returns:
            str: Created event ID
            
        Raises:
            ValueError: If appointment time is invalid
            ConnectionError: If API call fails
        """
        # Validate appointment duration
        is_valid, message = validate_appointment_duration(start_time, end_time)
        if not is_valid:
            raise ValueError(message)
        
        # Format event times
        formatted_start = format_event_time(start_time)
        formatted_end = format_event_time(end_time)
        
        # Prepare event body
        event_body = {
            'summary': title,
            'description': description,
            'start': {
                'dateTime': formatted_start,
                'timeZone': str(BRAZIL_TIMEZONE),
            },
            'end': {
                'dateTime': formatted_end,
                'timeZone': str(BRAZIL_TIMEZONE),
            },
            'colorId': EVENT_COLORS['DEFAULT'],
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 30},
                ],
            },
        }
        
        # Add attendees if provided
        if attendees:
            event_body['attendees'] = attendees
            
        try:
            # Create event
            event = self.service.events().insert(
                calendarId=self.calendar_id,
                body=event_body,
                sendUpdates='all' if send_notifications else 'none'
            ).execute()
            
            return event['id']
            
        except Exception as e:
            raise ConnectionError(f"Failed to create calendar event: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError))
    )
    def get_available_slots(
        self,
        start_date: datetime,
        end_date: datetime,
        duration_minutes: int = APPOINTMENT_DURATIONS['DEFAULT_MINUTES']
    ) -> List[Tuple[datetime, datetime]]:
        """
        Get available time slots between two dates considering business rules.
        
        Args:
            start_date (datetime): Start of date range
            end_date (datetime): End of date range
            duration_minutes (int): Desired appointment duration
            
        Returns:
            List[Tuple[datetime, datetime]]: List of available time slots
            
        Raises:
            ValueError: If parameters are invalid
            ConnectionError: If API call fails
        """
        # Validate parameters
        if duration_minutes < APPOINTMENT_DURATIONS['MIN_MINUTES']:
            raise ValueError(f"Duration must be at least {APPOINTMENT_DURATIONS['MIN_MINUTES']} minutes")
        if duration_minutes > APPOINTMENT_DURATIONS['MAX_MINUTES']:
            raise ValueError(f"Duration cannot exceed {APPOINTMENT_DURATIONS['MAX_MINUTES']} minutes")
        
        # Convert dates to Brazil timezone
        start_date = to_brazil_timezone(start_date)
        end_date = to_brazil_timezone(end_date)
        
        try:
            # Fetch existing events
            events_result = self.service.events().list(
                calendarId=self.calendar_id,
                timeMin=format_event_time(start_date),
                timeMax=format_event_time(end_date),
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            # Calculate available slots
            available_slots = []
            current_time = start_date
            
            while current_time < end_date:
                slot_end = current_time + timedelta(minutes=duration_minutes)
                
                # Check if slot is within business hours and not conflicting
                if (
                    self._is_slot_available(current_time, slot_end, events) and
                    self._is_within_business_hours(current_time, slot_end)
                ):
                    available_slots.append((current_time, slot_end))
                
                # Move to next slot
                current_time += timedelta(minutes=30)
            
            return available_slots
            
        except Exception as e:
            raise ConnectionError(f"Failed to fetch available slots: {str(e)}")

    def _is_slot_available(
        self,
        start: datetime,
        end: datetime,
        events: List[Dict]
    ) -> bool:
        """
        Check if a time slot conflicts with existing events.
        
        Args:
            start (datetime): Slot start time
            end (datetime): Slot end time
            events (List[Dict]): List of existing events
            
        Returns:
            bool: True if slot is available
        """
        for event in events:
            event_start = datetime.fromisoformat(
                event['start'].get('dateTime', event['start'].get('date'))
            )
            event_end = datetime.fromisoformat(
                event['end'].get('dateTime', event['end'].get('date'))
            )
            
            # Check for overlap
            if (
                start < event_end and
                end > event_start and
                event.get('status') != 'cancelled'
            ):
                return False
        return True

    def _is_within_business_hours(self, start: datetime, end: datetime) -> bool:
        """
        Check if time slot is within business hours.
        
        Args:
            start (datetime): Slot start time
            end (datetime): Slot end time
            
        Returns:
            bool: True if within business hours
        """
        start_time = start.time()
        end_time = end.time()
        
        business_start = self.business_hours.get('start', time(8, 0))
        business_end = self.business_hours.get('end', time(18, 0))
        break_start = self.business_hours.get('break_start', time(12, 0))
        break_end = self.business_hours.get('break_end', time(13, 0))
        
        # Check business hours
        if not (business_start <= start_time <= business_end):
            return False
        if not (business_start <= end_time <= business_end):
            return False
            
        # Check lunch break
        if (start_time <= break_end and end_time >= break_start):
            return False
            
        return True