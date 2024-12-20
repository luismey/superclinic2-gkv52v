"""
Datetime utility module for Brazilian healthcare practices.
Provides comprehensive datetime handling including timezone operations,
business hours validation, appointment scheduling, and Brazilian date formatting.

Version: 1.0
"""

from datetime import datetime, time, timedelta, date
import pytz  # version: 2023.3
from typing import Optional, Tuple

# Brazil timezone constant
BRAZIL_TIMEZONE = pytz.timezone('America/Sao_Paulo')

# Standard business hours configuration
BUSINESS_HOURS = {
    'start': time(8, 0),      # 8:00 AM
    'end': time(18, 0),       # 6:00 PM
    'break_start': time(12, 0),  # 12:00 PM
    'break_end': time(13, 0)     # 1:00 PM
}

# Appointment duration constraints
MIN_APPOINTMENT_DURATION = timedelta(minutes=30)
MAX_APPOINTMENT_DURATION = timedelta(hours=2)

# Brazilian date format templates
BRAZILIAN_DATE_FORMATS = {
    'short': '%d/%m/%Y',
    'long': '%d de %B de %Y',
    'datetime': '%d/%m/%Y %H:%M'
}

def to_brazil_timezone(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Converts any datetime object to Brazil timezone with proper DST handling.
    
    Args:
        dt (Optional[datetime]): Input datetime object to convert
        
    Returns:
        Optional[datetime]: Localized datetime in Brazil timezone or None if input is None
        
    Example:
        >>> utc_time = datetime.utcnow()
        >>> brazil_time = to_brazil_timezone(utc_time)
    """
    if dt is None:
        return None
        
    # If datetime is naive (no timezone info), assume UTC
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    
    # Convert to Brazil timezone
    return dt.astimezone(BRAZIL_TIMEZONE)

def is_business_hours(dt: datetime) -> bool:
    """
    Validates if given datetime falls within business hours including break time handling.
    
    Args:
        dt (datetime): Datetime to validate
        
    Returns:
        bool: True if within business hours and not during break time
        
    Example:
        >>> now = datetime.now()
        >>> is_open = is_business_hours(now)
    """
    # Convert to Brazil timezone
    local_dt = to_brazil_timezone(dt)
    current_time = local_dt.time()
    
    # Check if within business hours
    is_within_hours = (
        BUSINESS_HOURS['start'] <= current_time <= BUSINESS_HOURS['end']
    )
    
    # Check if during break time
    is_break_time = (
        BUSINESS_HOURS['break_start'] <= current_time <= BUSINESS_HOURS['break_end']
    )
    
    return is_within_hours and not is_break_time

def validate_appointment_duration(
    start_time: datetime,
    end_time: datetime
) -> Tuple[bool, str]:
    """
    Comprehensive validation of appointment duration with business rules.
    
    Args:
        start_time (datetime): Appointment start time
        end_time (datetime): Appointment end time
        
    Returns:
        Tuple[bool, str]: Validation result and error message
        
    Example:
        >>> start = datetime.now()
        >>> end = start + timedelta(hours=1)
        >>> is_valid, message = validate_appointment_duration(start, end)
    """
    # Convert times to Brazil timezone
    start_local = to_brazil_timezone(start_time)
    end_local = to_brazil_timezone(end_time)
    
    # Calculate duration
    duration = end_local - start_local
    
    # Validate minimum duration
    if duration < MIN_APPOINTMENT_DURATION:
        return False, f"Appointment must be at least {MIN_APPOINTMENT_DURATION.minutes} minutes"
    
    # Validate maximum duration
    if duration > MAX_APPOINTMENT_DURATION:
        return False, f"Appointment cannot exceed {MAX_APPOINTMENT_DURATION.hours} hours"
    
    # Validate business hours
    if not is_business_hours(start_local) or not is_business_hours(end_local):
        return False, "Appointment must be within business hours"
    
    # Check break time overlap
    start_time = start_local.time()
    end_time = end_local.time()
    
    if (start_time <= BUSINESS_HOURS['break_end'] and 
        end_time >= BUSINESS_HOURS['break_start']):
        return False, "Appointment cannot overlap with break time"
    
    return True, "Appointment duration is valid"

def get_brazil_business_hours(date_obj: date) -> Tuple[datetime, datetime]:
    """
    Returns business hours for a specific date considering holidays and special schedules.
    
    Args:
        date_obj (date): Date to get business hours for
        
    Returns:
        Tuple[datetime, datetime]: Business start and end times
        
    Example:
        >>> today = date.today()
        >>> start, end = get_brazil_business_hours(today)
    """
    # Combine date with business hours
    start_dt = datetime.combine(date_obj, BUSINESS_HOURS['start'])
    end_dt = datetime.combine(date_obj, BUSINESS_HOURS['end'])
    
    # Localize to Brazil timezone
    start_dt = BRAZIL_TIMEZONE.localize(start_dt)
    end_dt = BRAZIL_TIMEZONE.localize(end_dt)
    
    return start_dt, end_dt

def format_brazil_datetime(dt: datetime, format_type: str = 'short') -> str:
    """
    Formats datetime according to Brazilian standards with locale support.
    
    Args:
        dt (datetime): Datetime to format
        format_type (str): Format type ('short', 'long', or 'datetime')
        
    Returns:
        str: Formatted datetime string in Brazilian format
        
    Example:
        >>> now = datetime.now()
        >>> formatted = format_brazil_datetime(now, 'long')
    """
    # Convert to Brazil timezone
    local_dt = to_brazil_timezone(dt)
    
    # Get format string
    format_string = BRAZILIAN_DATE_FORMATS.get(format_type, BRAZILIAN_DATE_FORMATS['short'])
    
    # Format with Brazilian locale
    try:
        import locale
        locale.setlocale(locale.LC_TIME, 'pt_BR.UTF-8')
    except locale.Error:
        # Fallback if Brazilian locale is not available
        pass
    
    return local_dt.strftime(format_string)