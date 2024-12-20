"""
Core utility module providing standardized formatting functions for data types.
Implements Brazilian-specific formatting rules with security and performance optimizations.

Version: 1.0.0
"""

import re
from typing import Union, Optional
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from app.utils.datetime import format_brazil_datetime
from app.utils.brazilian import format_currency

# Global constants for formatting
DATE_FORMAT = "dd/MM/yyyy"
TIME_FORMAT = "HH:mm"
DATETIME_FORMAT = "dd/MM/yyyy HH:mm"
MAX_MESSAGE_LENGTH = 4096
URL_PATTERN = r"(https?://\S+)"

# Precompile regex patterns for performance
_url_regex = re.compile(URL_PATTERN)
_whitespace_regex = re.compile(r'\s+')
_control_char_regex = re.compile(r'[\x00-\x1F\x7F]')
_name_particles = {'de', 'da', 'do', 'das', 'dos'}

def format_message(message: str, remove_urls: bool = False) -> str:
    """
    Formats a message string according to WhatsApp requirements with security validations.
    
    Args:
        message: Input message string to format
        remove_urls: Flag to remove URLs from message
    
    Returns:
        Formatted message string
        
    Raises:
        ValueError: If message is invalid or exceeds length limits
    """
    if not isinstance(message, str):
        raise ValueError("Message must be a string")
        
    # Initial sanitization
    message = message.strip()
    
    # Remove URLs if requested
    if remove_urls:
        message = _url_regex.sub('', message)
    
    # Normalize whitespace
    message = _whitespace_regex.sub(' ', message)
    
    # Truncate if exceeds maximum length
    if len(message) > MAX_MESSAGE_LENGTH:
        message = message[:MAX_MESSAGE_LENGTH-3] + '...'
    
    # Final validation
    if not message:
        raise ValueError("Message cannot be empty after formatting")
        
    return message

def format_name(name: str) -> str:
    """
    Formats a person's name following Brazilian conventions.
    
    Args:
        name: Input name string
    
    Returns:
        Formatted name string
        
    Raises:
        ValueError: If name is invalid
    """
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Invalid name input")
    
    # Initial cleaning
    name = name.strip().lower()
    
    # Split into words
    words = _whitespace_regex.sub(' ', name).split()
    
    # Process each word
    formatted_words = []
    for word in words:
        # Preserve hyphenated names
        if '-' in word:
            parts = word.split('-')
            formatted_words.append('-'.join(
                p.capitalize() if p not in _name_particles else p
                for p in parts
            ))
        # Handle regular words
        else:
            formatted_words.append(
                word if word in _name_particles else word.capitalize()
            )
    
    return ' '.join(formatted_words)

def format_number(value: Union[int, float, Decimal], decimal_places: int = 2) -> str:
    """
    Formats a number using Brazilian conventions with decimal handling.
    
    Args:
        value: Numeric value to format
        decimal_places: Number of decimal places
    
    Returns:
        Formatted number string
        
    Raises:
        ValueError: If value or decimal_places is invalid
    """
    if not isinstance(decimal_places, int) or decimal_places < 0:
        raise ValueError("Invalid decimal places")
    
    # Convert to Decimal for precise handling
    try:
        if not isinstance(value, Decimal):
            value = Decimal(str(value))
    except (TypeError, ValueError, decimal.InvalidOperation):
        raise ValueError("Invalid numeric value")
    
    # Round to specified decimal places
    rounded = value.quantize(
        Decimal(f'0.{"0" * decimal_places}'),
        rounding=ROUND_HALF_UP
    )
    
    # Split into integer and decimal parts
    int_part, dec_part = str(abs(rounded)).split('.')
    
    # Add thousand separators
    int_part = f"{int_part:,}".replace(',', '.')
    
    # Format decimal part
    dec_part = dec_part.ljust(decimal_places, '0')
    
    # Combine with proper separators
    formatted = f"{int_part},{dec_part}" if decimal_places > 0 else int_part
    
    # Handle negative values
    return f"-{formatted}" if value < 0 else formatted

def format_percentage(value: Union[int, float, Decimal], decimal_places: int = 1) -> str:
    """
    Formats a number as a percentage using Brazilian conventions.
    
    Args:
        value: Numeric value (0.15 for 15%)
        decimal_places: Number of decimal places
    
    Returns:
        Formatted percentage string
        
    Raises:
        ValueError: If value is invalid
    """
    try:
        if not isinstance(value, Decimal):
            value = Decimal(str(value))
    except (TypeError, ValueError, decimal.InvalidOperation):
        raise ValueError("Invalid numeric value")
    
    # Convert to percentage
    percentage_value = value * 100
    
    # Format the number
    formatted_number = format_number(percentage_value, decimal_places)
    
    return f"{formatted_number}%"

def sanitize_text(text: str) -> str:
    """
    Sanitizes text input with enhanced security measures.
    
    Args:
        text: Input text to sanitize
    
    Returns:
        Sanitized text string
        
    Raises:
        ValueError: If text is invalid
    """
    if not isinstance(text, str):
        raise ValueError("Input must be a string")
    
    # Remove control characters
    text = _control_char_regex.sub('', text)
    
    # Normalize whitespace
    text = _whitespace_regex.sub(' ', text.strip())
    
    # Basic XSS prevention
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Normalize Unicode characters
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    
    return text