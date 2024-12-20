"""
Main entry point for the Porfin platform's utility package.

Provides a comprehensive suite of utility functions specifically designed for
Brazilian healthcare data handling, secure operations, and consistent formatting.
Implements lazy loading for optimal performance and includes extensive type hints
and documentation.

Version: 1.0.0
"""

# Version information
__version__ = "1.0.0"

# Brazilian data handling utilities
from .brazilian import (
    format_cpf,
    format_cnpj,
    format_cep,
    format_phone,
    format_currency,
    validate_cpf,
    validate_cnpj,
    validate_cep,
    validate_phone,
    sanitize_document
)

# Date and time utilities with Brazil-specific handling
from .datetime import (
    get_brazil_now,
    format_date,
    parse_date,
    get_date_range,
    is_business_hours,
    add_business_days,
    BRAZIL_TIMEZONE,
    DATE_FORMAT,
    TIME_FORMAT,
    DATETIME_FORMAT
)

# Secure encryption utilities
from .encryption import (
    encrypt_data,
    decrypt_data,
    encrypt_field,
    decrypt_field,
    FieldEncryption
)

# Data formatting utilities
from .formatters import (
    format_text,
    format_name,
    format_percentage,
    format_number,
    sanitize_html
)

# Data validation utilities
from .validators import (
    validate_email,
    validate_password,
    validate_url,
    validate_user_data,
    validate_campaign_data
)

# Define package-level exports
__all__ = [
    # Brazilian data handling
    "format_cpf",
    "format_cnpj",
    "format_cep",
    "format_phone",
    "format_currency",
    "validate_cpf",
    "validate_cnpj",
    "validate_cep",
    "validate_phone",
    "sanitize_document",
    
    # Date and time
    "get_brazil_now",
    "format_date",
    "parse_date", 
    "get_date_range",
    "is_business_hours",
    "add_business_days",
    "BRAZIL_TIMEZONE",
    "DATE_FORMAT",
    "TIME_FORMAT",
    "DATETIME_FORMAT",
    
    # Encryption
    "encrypt_data",
    "decrypt_data",
    "encrypt_field",
    "decrypt_field",
    "FieldEncryption",
    
    # Formatters
    "format_text",
    "format_name",
    "format_percentage", 
    "format_number",
    "sanitize_html",
    
    # Validators
    "validate_email",
    "validate_password",
    "validate_url",
    "validate_user_data",
    "validate_campaign_data"
]

# Package metadata
__author__ = "Porfin Development Team"
__copyright__ = "Copyright 2023, Porfin"
__license__ = "Proprietary"
__maintainer__ = "Porfin Development Team"
__email__ = "dev@porfin.com"
__status__ = "Production"

# Module documentation
__doc__ = """
Porfin Platform Utility Package

A comprehensive collection of utility functions and tools specifically designed
for Brazilian healthcare data handling and secure operations. Features include:

- Brazilian document formatting and validation (CPF, CNPJ, CEP)
- Healthcare-specific data handling and validation
- Secure encryption and data protection
- Brazil-specific date/time operations
- Data formatting with Brazilian conventions
- Input validation and sanitization

All functions are designed with security, performance, and Brazilian healthcare
compliance in mind.

Example usage:
    from app.utils import format_cpf, validate_phone, encrypt_data
    
    # Format a CPF number
    formatted_cpf = format_cpf("12345678900")
    
    # Validate a phone number
    is_valid = validate_phone("+55 11 98765-4321")
    
    # Encrypt sensitive data
    encrypted = encrypt_data("sensitive information")
"""