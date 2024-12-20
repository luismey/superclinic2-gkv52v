"""
Utility module providing validation functions for data validation across the Porfin platform.
Implements secure input validation, schema validation, and business rule validation with
enhanced security measures and healthcare compliance.

Version: 1.0.0
"""

# Standard library imports
import re
import datetime
from typing import Optional, Dict, Any, Union, Tuple
from functools import wraps

# Third-party imports
from pydantic import BaseModel, ValidationError as PydanticValidationError  # pydantic v2.0+
from cachetools import TTLCache, cached  # cachetools v5.0+

# Internal imports
from app.core.exceptions import ValidationError
from app.utils.brazilian import (
    validate_cpf,
    validate_cnpj,
    validate_phone
)
from app.core.logging import get_logger

# Initialize logger
logger = get_logger(__name__)

# Constants
EMAIL_REGEX = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
PASSWORD_REGEX = r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$"
URL_REGEX = r"^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$"
MAX_VALIDATION_ATTEMPTS = 3
VALIDATION_CACHE_TTL = 300  # 5 minutes

# Initialize validation cache
validation_cache = TTLCache(maxsize=1000, ttl=VALIDATION_CACHE_TTL)

def validation_rate_limit(func):
    """
    Decorator to implement rate limiting for validation functions.
    Prevents brute force attacks by limiting validation attempts.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        cache_key = f"{func.__name__}:{str(args)}"
        attempts = validation_cache.get(cache_key, 0)
        
        if attempts >= MAX_VALIDATION_ATTEMPTS:
            logger.warning(
                f"Validation rate limit exceeded for {func.__name__}",
                extra={"validation_context": {"args": args, "attempts": attempts}}
            )
            raise ValidationError(
                message="Too many validation attempts. Please try again later.",
                details={"rate_limit_exceeded": True}
            )
        
        validation_cache[cache_key] = attempts + 1
        return func(*args, **kwargs)
    return wrapper

def cache_validation_result(func):
    """
    Decorator to cache validation results for improved performance.
    """
    @wraps(func)
    @cached(cache=validation_cache)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@validation_rate_limit
@cache_validation_result
def validate_email(email: str) -> bool:
    """
    Validates email format and domain with enhanced security checks.
    
    Args:
        email: Email address to validate
        
    Returns:
        bool: True if email is valid
        
    Raises:
        ValidationError: If email is invalid or contains malicious patterns
    """
    try:
        # Basic input sanitization
        if not email or not isinstance(email, str):
            return False
            
        # Length validation
        if len(email) < 5 or len(email) > 254:
            return False
            
        # Pattern matching with security-focused regex
        if not re.match(EMAIL_REGEX, email, re.IGNORECASE):
            return False
            
        # Additional security checks
        if '..' in email or '@.' in email:
            return False
            
        # Split email into local and domain parts
        local, domain = email.rsplit('@', 1)
        
        # Validate local part length
        if len(local) > 64:
            return False
            
        # Validate domain part
        if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', domain):
            return False
            
        return True
        
    except Exception as e:
        logger.error(
            "Email validation error",
            extra={"error": str(e), "email": email[:5] + "***"}
        )
        return False

@validation_rate_limit
def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validates password strength and format with security requirements.
    
    Args:
        password: Password to validate
        
    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)
    """
    try:
        if not password or not isinstance(password, str):
            return False, "Password is required"
            
        # Length validation
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
            
        if len(password) > 128:
            return False, "Password exceeds maximum length"
            
        # Pattern matching
        if not re.match(PASSWORD_REGEX, password):
            return False, "Password must contain letters, numbers, and special characters"
            
        # Check for common patterns
        common_patterns = [
            r'12345',
            r'qwerty',
            r'password',
            r'admin'
        ]
        for pattern in common_patterns:
            if re.search(pattern, password.lower()):
                return False, "Password contains common patterns"
                
        return True, None
        
    except Exception as e:
        logger.error("Password validation error", extra={"error": str(e)})
        return False, "Password validation failed"

def validate_date_range(
    start_date: datetime.datetime,
    end_date: datetime.datetime,
    max_range_days: int = 365
) -> bool:
    """
    Validates date range for appointments and campaigns.
    
    Args:
        start_date: Start datetime
        end_date: End datetime
        max_range_days: Maximum allowed range in days
        
    Returns:
        bool: True if date range is valid
    """
    try:
        # Type validation
        if not isinstance(start_date, datetime.datetime) or \
           not isinstance(end_date, datetime.datetime):
            return False
            
        # Basic range validation
        if start_date >= end_date:
            return False
            
        # Check if dates are in the past
        now = datetime.datetime.now(datetime.timezone.utc)
        if start_date < now:
            return False
            
        # Validate range duration
        range_days = (end_date - start_date).days
        if range_days > max_range_days:
            return False
            
        return True
        
    except Exception as e:
        logger.error("Date range validation error", extra={"error": str(e)})
        return False

@validation_rate_limit
def validate_document(
    document: str,
    doc_type: str = "cpf"
) -> bool:
    """
    Validates Brazilian documents (CPF/CNPJ) with enhanced security.
    
    Args:
        document: Document number to validate
        doc_type: Document type ('cpf' or 'cnpj')
        
    Returns:
        bool: True if document is valid
    """
    try:
        # Input sanitization
        if not document or not isinstance(document, str):
            return False
            
        # Remove formatting characters
        clean_doc = re.sub(r'[^0-9]', '', document)
        
        # Validate based on document type
        if doc_type.lower() == "cpf":
            return validate_cpf(clean_doc)
        elif doc_type.lower() == "cnpj":
            return validate_cnpj(clean_doc)
        else:
            logger.warning(f"Invalid document type: {doc_type}")
            return False
            
    except Exception as e:
        logger.error(
            "Document validation error",
            extra={
                "error": str(e),
                "doc_type": doc_type,
                "doc_length": len(document) if document else 0
            }
        )
        return False

@validation_rate_limit
@cache_validation_result
def validate_url(url: str) -> bool:
    """
    Validates URLs with security checks and protocol validation.
    
    Args:
        url: URL to validate
        
    Returns:
        bool: True if URL is valid and secure
    """
    try:
        # Basic input validation
        if not url or not isinstance(url, str):
            return False
            
        # Length validation
        if len(url) > 2048:  # Standard URL length limit
            return False
            
        # Pattern matching
        if not re.match(URL_REGEX, url):
            return False
            
        # Protocol validation
        if not url.startswith(('http://', 'https://')):
            return False
            
        # Additional security checks
        security_risks = [
            'javascript:',
            'data:',
            'vbscript:',
            'file:',
            '<script'
        ]
        if any(risk in url.lower() for risk in security_risks):
            logger.warning("Potentially malicious URL detected", extra={"url": url[:30]})
            return False
            
        return True
        
    except Exception as e:
        logger.error("URL validation error", extra={"error": str(e)})
        return False

def validate_phone_number(phone: str) -> bool:
    """
    Validates Brazilian phone numbers with enhanced security checks.
    
    Args:
        phone: Phone number to validate
        
    Returns:
        bool: True if phone number is valid
    """
    try:
        # Use Brazilian phone validation with additional security
        if not validate_phone(phone):
            return False
            
        # Additional security checks
        clean_number = re.sub(r'[^0-9]', '', phone)
        
        # Validate length after country code
        if len(clean_number) > 13:  # Including country code
            return False
            
        # Check for repeated digits
        if any(clean_number.count(str(i)) > 8 for i in range(10)):
            return False
            
        return True
        
    except Exception as e:
        logger.error("Phone validation error", extra={"error": str(e)})
        return False

# Export validation functions
__all__ = [
    'validate_email',
    'validate_password',
    'validate_url',
    'validate_date_range',
    'validate_document',
    'validate_phone_number'
]