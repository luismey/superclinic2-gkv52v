"""
Brazilian-specific utility functions for data formatting and validation.
Provides secure handling of CPF, CNPJ, phone numbers, and currency formatting
following Brazilian conventions and standards.

Version: 1.0.0
"""

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# Constants for Brazilian formatting
CURRENCY_CODE = "BRL"
DECIMAL_SEPARATOR = ","
THOUSAND_SEPARATOR = "."
PHONE_REGEX = r"^\+55\s?\(?[1-9]{2}\)?\s?(?:9\s?)?[0-9]{4}[-\s]?[0-9]{4}$"
CPF_REGEX = r"^\d{3}\.?\d{3}\.?\d{3}[-]?\d{2}$"
CNPJ_REGEX = r"^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-]?\d{2}$"
MAX_INPUT_LENGTH = 50
VALID_AREA_CODES = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
    37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
    65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
    89, 91, 92, 93, 94, 95, 96, 97, 98, 99
]

def format_currency(value: Decimal, include_symbol: bool = True, 
                   decimal_places: Optional[int] = 2) -> str:
    """
    Formats a numeric value as Brazilian Real (BRL) currency.
    
    Args:
        value: Decimal value to format
        include_symbol: Whether to include the R$ symbol
        decimal_places: Number of decimal places (default 2)
    
    Returns:
        Formatted currency string following Brazilian conventions
    
    Raises:
        ValueError: If value is None or invalid
        TypeError: If value is not a Decimal
    """
    if not isinstance(value, Decimal):
        raise TypeError("Value must be a Decimal instance")
    
    if decimal_places is None:
        decimal_places = 2
    
    # Round to specified decimal places
    rounded = value.quantize(Decimal(f'0.{"0" * decimal_places}'), 
                           rounding=ROUND_HALF_UP)
    
    # Split into integer and decimal parts
    int_part, dec_part = str(abs(rounded)).split('.')
    
    # Add thousand separators
    int_part = f"{int_part:,}".replace(',', THOUSAND_SEPARATOR)
    
    # Format decimal part
    dec_part = dec_part.ljust(decimal_places, '0')
    
    # Combine parts with proper separators
    formatted = f"{int_part}{DECIMAL_SEPARATOR}{dec_part}"
    
    # Add symbol and handle negative values
    if include_symbol:
        if value < 0:
            return f"-R$ {formatted}"
        return f"R$ {formatted}"
    
    if value < 0:
        return f"-{formatted}"
    return formatted

def validate_cpf(cpf: str) -> bool:
    """
    Validates a Brazilian CPF number with comprehensive checks.
    
    Args:
        cpf: CPF number string with or without formatting
    
    Returns:
        True if CPF is valid, False otherwise
    """
    if not cpf or not isinstance(cpf, str) or len(cpf) > MAX_INPUT_LENGTH:
        return False
    
    # Remove formatting characters
    cpf = re.sub(r'[^\d]', '', cpf)
    
    if len(cpf) != 11:
        return False
    
    # Check for known invalid patterns
    if len(set(cpf)) == 1:
        return False
    
    # Calculate first check digit
    sum_1 = sum(int(cpf[i]) * (10 - i) for i in range(9))
    check_1 = (sum_1 * 10) % 11
    if check_1 == 10:
        check_1 = 0
    if int(cpf[9]) != check_1:
        return False
    
    # Calculate second check digit
    sum_2 = sum(int(cpf[i]) * (11 - i) for i in range(10))
    check_2 = (sum_2 * 10) % 11
    if check_2 == 10:
        check_2 = 0
    if int(cpf[10]) != check_2:
        return False
    
    return True

def validate_cnpj(cnpj: str) -> bool:
    """
    Validates a Brazilian CNPJ number with comprehensive checks.
    
    Args:
        cnpj: CNPJ number string with or without formatting
    
    Returns:
        True if CNPJ is valid, False otherwise
    """
    if not cnpj or not isinstance(cnpj, str) or len(cnpj) > MAX_INPUT_LENGTH:
        return False
    
    # Remove formatting characters
    cnpj = re.sub(r'[^\d]', '', cnpj)
    
    if len(cnpj) != 14:
        return False
    
    # Check for known invalid patterns
    if len(set(cnpj)) == 1:
        return False
    
    # Calculate first check digit
    weights_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    sum_1 = sum(int(cnpj[i]) * weights_1[i] for i in range(12))
    check_1 = 11 - (sum_1 % 11)
    if check_1 >= 10:
        check_1 = 0
    if int(cnpj[12]) != check_1:
        return False
    
    # Calculate second check digit
    weights_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    sum_2 = sum(int(cnpj[i]) * weights_2[i] for i in range(13))
    check_2 = 11 - (sum_2 % 11)
    if check_2 >= 10:
        check_2 = 0
    if int(cnpj[13]) != check_2:
        return False
    
    return True

def format_phone(phone_number: str, include_country_code: bool = True) -> str:
    """
    Formats a Brazilian phone number with proper separators and optional country code.
    
    Args:
        phone_number: Phone number string with or without formatting
        include_country_code: Whether to include the +55 country code
    
    Returns:
        Formatted phone number string
    
    Raises:
        ValueError: If phone number is invalid
    """
    if not phone_number or not isinstance(phone_number, str) or \
       len(phone_number) > MAX_INPUT_LENGTH:
        raise ValueError("Invalid phone number")
    
    # Remove all non-digit characters
    clean_number = re.sub(r'[^\d]', '', phone_number)
    
    # Remove country code if present
    if clean_number.startswith('55'):
        clean_number = clean_number[2:]
    
    if len(clean_number) not in (10, 11):
        raise ValueError("Invalid phone number length")
    
    # Extract and validate area code
    area_code = int(clean_number[:2])
    if area_code not in VALID_AREA_CODES:
        raise ValueError("Invalid area code")
    
    # Format based on length (mobile vs landline)
    if len(clean_number) == 11:  # Mobile
        formatted = f"({clean_number[:2]}) {clean_number[2:3]} " \
                   f"{clean_number[3:7]}-{clean_number[7:]}"
    else:  # Landline
        formatted = f"({clean_number[:2]}) {clean_number[2:6]}-{clean_number[6:]}"
    
    if include_country_code:
        return f"+55 {formatted}"
    return formatted

def validate_phone(phone_number: str) -> bool:
    """
    Validates a Brazilian phone number with area code verification.
    
    Args:
        phone_number: Phone number string with or without formatting
    
    Returns:
        True if phone number is valid, False otherwise
    """
    if not phone_number or not isinstance(phone_number, str) or \
       len(phone_number) > MAX_INPUT_LENGTH:
        return False
    
    # Remove all non-digit characters
    clean_number = re.sub(r'[^\d]', '', phone_number)
    
    # Remove country code if present
    if clean_number.startswith('55'):
        clean_number = clean_number[2:]
    
    if len(clean_number) not in (10, 11):
        return False
    
    # Validate area code
    try:
        area_code = int(clean_number[:2])
        if area_code not in VALID_AREA_CODES:
            return False
    except ValueError:
        return False
    
    # Validate mobile number format (must start with 9)
    if len(clean_number) == 11 and clean_number[2] != '9':
        return False
    
    return True

def format_decimal(value: Decimal, decimal_places: int = 2, 
                  use_grouping: bool = True) -> str:
    """
    Formats a decimal number using Brazilian conventions.
    
    Args:
        value: Decimal value to format
        decimal_places: Number of decimal places
        use_grouping: Whether to use thousand separators
    
    Returns:
        Formatted decimal string
    
    Raises:
        ValueError: If decimal_places is negative
        TypeError: If value is not a Decimal
    """
    if not isinstance(value, Decimal):
        raise TypeError("Value must be a Decimal instance")
    
    if decimal_places < 0:
        raise ValueError("Decimal places must be non-negative")
    
    # Round to specified decimal places
    rounded = value.quantize(Decimal(f'0.{"0" * decimal_places}'), 
                           rounding=ROUND_HALF_UP)
    
    # Split into integer and decimal parts
    int_part, dec_part = str(abs(rounded)).split('.')
    
    # Add thousand separators if requested
    if use_grouping:
        int_part = f"{int_part:,}".replace(',', THOUSAND_SEPARATOR)
    
    # Format decimal part
    dec_part = dec_part.ljust(decimal_places, '0')
    
    # Combine parts with proper separator
    formatted = f"{int_part}{DECIMAL_SEPARATOR}{dec_part}"
    
    # Handle negative values
    if value < 0:
        return f"-{formatted}"
    return formatted