"""
WhatsApp message template service module for the Porfin platform.

This module provides secure template management with enhanced validation,
variable interpolation, and monitoring features for WhatsApp campaigns.

Version: 1.0.0
"""

# Standard library imports
import re
import uuid
from typing import Dict, List, Optional, Tuple, Any

# Third-party imports - v3.1.2
from jinja2 import (
    Environment,
    StrictUndefined,
    Template as JinjaTemplate,
    TemplateSyntaxError,
    UndefinedError
)

# Internal imports
from app.models.messages import MessageType
from app.models.campaigns import MESSAGE_TEMPLATE_TYPES
from app.utils.validators import validate_url
from app.core.logging import get_logger
from app.core.exceptions import ValidationError

# Initialize logger
logger = get_logger(__name__)

# Constants
TEMPLATE_VARIABLE_PATTERN = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}"
MAX_TEMPLATE_LENGTH = 4096
SUPPORTED_MEDIA_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'video/mp4',
    'audio/mpeg'
]

# Initialize Jinja2 environment with security settings
JINJA_ENV = Environment(
    autoescape=True,
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True
)

class Template:
    """Enhanced WhatsApp message template handler with security features."""

    def __init__(
        self,
        name: str,
        type: MessageType,
        content: str,
        media_url: Optional[str] = None,
        media_type: Optional[str] = None
    ) -> None:
        """
        Initialize template instance with validation state.

        Args:
            name: Template name
            type: Message type
            content: Template content
            media_url: Optional media URL
            media_type: Optional media MIME type

        Raises:
            ValidationError: If template initialization fails
        """
        self.template_id = str(uuid.uuid4())
        self.name = name.strip()
        self.type = type
        self.content = content.strip()
        self.media_url = media_url.strip() if media_url else None
        self.media_type = media_type.strip() if media_type else None
        self._validation_state = {
            'name': False,
            'content': False,
            'media': False,
            'variables': False
        }
        self._compiled_template = None

        # Extract and validate variables
        self.variables = self.extract_variables()

        # Perform initial validation
        is_valid, error = self.validate()
        if not is_valid:
            raise ValidationError(
                message="Template validation failed",
                details={"error": error}
            )

        logger.info(
            f"Template initialized: {self.template_id}",
            extra={
                "template_id": self.template_id,
                "type": self.type.value,
                "variables": self.variables
            }
        )

    def validate(self) -> Tuple[bool, Optional[str]]:
        """
        Comprehensive template validation with security checks.

        Returns:
            Tuple[bool, Optional[str]]: Validation result and error message
        """
        try:
            # Validate name
            if not self.name or len(self.name) < 3:
                return False, "Template name must be at least 3 characters"
            self._validation_state['name'] = True

            # Validate content length
            if not self.content or len(self.content) > MAX_TEMPLATE_LENGTH:
                return False, f"Content length must be between 1 and {MAX_TEMPLATE_LENGTH}"

            # Check for malicious patterns
            malicious_patterns = [
                r"<script",
                r"javascript:",
                r"data:",
                r"vbscript:",
                r"onload=",
                r"onerror="
            ]
            for pattern in malicious_patterns:
                if re.search(pattern, self.content, re.IGNORECASE):
                    logger.warning(
                        f"Malicious pattern detected in template: {self.template_id}",
                        extra={"pattern": pattern}
                    )
                    return False, "Invalid content pattern detected"
            self._validation_state['content'] = True

            # Validate media if present
            if self.type in [MessageType.IMAGE, MessageType.DOCUMENT]:
                if not self.media_url:
                    return False, f"Media URL required for {self.type.value} templates"
                if not validate_url(self.media_url):
                    return False, "Invalid media URL"
                if not self.media_type or self.media_type not in SUPPORTED_MEDIA_TYPES:
                    return False, "Unsupported media type"
            self._validation_state['media'] = True

            # Validate variables
            if not self.variables:
                self._validation_state['variables'] = True
            else:
                # Compile template to validate syntax
                try:
                    self._compiled_template = JINJA_ENV.from_string(self.content)
                    self._validation_state['variables'] = True
                except TemplateSyntaxError as e:
                    return False, f"Template syntax error: {str(e)}"

            return True, None

        except Exception as e:
            logger.error(
                f"Template validation error: {str(e)}",
                extra={"template_id": self.template_id}
            )
            return False, f"Validation error: {str(e)}"

    def extract_variables(self) -> List[str]:
        """
        Extract and validate template variables.

        Returns:
            List[str]: List of validated variable names
        """
        try:
            # Find all variable patterns
            matches = re.finditer(TEMPLATE_VARIABLE_PATTERN, self.content)
            variables = set()

            for match in matches:
                var_name = match.group(1)
                
                # Validate variable name
                if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', var_name):
                    logger.warning(
                        f"Invalid variable name: {var_name}",
                        extra={"template_id": self.template_id}
                    )
                    continue

                # Check for reserved names
                reserved_names = {'self', 'template', 'env', 'globals'}
                if var_name in reserved_names:
                    logger.warning(
                        f"Reserved variable name: {var_name}",
                        extra={"template_id": self.template_id}
                    )
                    continue

                variables.add(var_name)

            return sorted(list(variables))

        except Exception as e:
            logger.error(
                f"Variable extraction error: {str(e)}",
                extra={"template_id": self.template_id}
            )
            return []

    def render(self, variables: Dict[str, Any]) -> str:
        """
        Secure template rendering with variable validation.

        Args:
            variables: Dictionary of variable values

        Returns:
            str: Safely rendered content

        Raises:
            ValidationError: If rendering fails
        """
        try:
            # Validate required variables are provided
            missing_vars = set(self.variables) - set(variables.keys())
            if missing_vars:
                raise ValidationError(
                    message="Missing required variables",
                    details={"missing": list(missing_vars)}
                )

            # Sanitize variable values
            sanitized_vars = {}
            for key, value in variables.items():
                if isinstance(value, str):
                    # Remove potential XSS patterns
                    sanitized = re.sub(r'[<>]', '', value)
                    sanitized_vars[key] = sanitized
                else:
                    sanitized_vars[key] = value

            # Get or create compiled template
            if not self._compiled_template:
                self._compiled_template = JINJA_ENV.from_string(self.content)

            # Render template in sandboxed environment
            rendered = self._compiled_template.render(**sanitized_vars)

            # Validate rendered content
            if len(rendered) > MAX_TEMPLATE_LENGTH:
                raise ValidationError(
                    message="Rendered content exceeds maximum length",
                    details={"max_length": MAX_TEMPLATE_LENGTH}
                )

            logger.info(
                f"Template rendered successfully: {self.template_id}",
                extra={"template_id": self.template_id}
            )

            return rendered

        except (ValidationError, UndefinedError, TemplateSyntaxError) as e:
            logger.error(
                f"Template rendering error: {str(e)}",
                extra={"template_id": self.template_id}
            )
            raise ValidationError(
                message=f"Template rendering failed: {str(e)}",
                details={"template_id": self.template_id}
            )

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert template to secure dictionary format.

        Returns:
            Dict[str, Any]: Sanitized template data
        """
        return {
            'template_id': self.template_id,
            'name': self.name,
            'type': self.type.value,
            'content': self.content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'variables': self.variables,
            'validation_state': self._validation_state
        }

def create_template(template_data: Dict[str, Any]) -> Template:
    """
    Create and validate new message template.

    Args:
        template_data: Template configuration dictionary

    Returns:
        Template: Validated template instance

    Raises:
        ValidationError: If template creation fails
    """
    try:
        # Validate template type
        if 'type' not in template_data or template_data['type'] not in MESSAGE_TEMPLATE_TYPES:
            raise ValidationError(
                message="Invalid template type",
                details={"valid_types": MESSAGE_TEMPLATE_TYPES}
            )

        # Create template instance
        template = Template(
            name=template_data.get('name', ''),
            type=MessageType(template_data['type']),
            content=template_data.get('content', ''),
            media_url=template_data.get('media_url'),
            media_type=template_data.get('media_type')
        )

        logger.info(
            f"Template created: {template.template_id}",
            extra={"template_data": template.to_dict()}
        )

        return template

    except Exception as e:
        logger.error(
            f"Template creation error: {str(e)}",
            extra={"template_data": template_data}
        )
        raise ValidationError(
            message=f"Failed to create template: {str(e)}",
            details={"template_data": template_data}
        )

def validate_template_variables(content: str) -> Tuple[bool, Optional[str]]:
    """
    Enhanced template variable validation.

    Args:
        content: Template content string

    Returns:
        Tuple[bool, Optional[str]]: Validation result and error
    """
    try:
        # Find all variables
        variables = re.finditer(TEMPLATE_VARIABLE_PATTERN, content)
        var_names = set()

        for match in variables:
            var_name = match.group(1)
            
            # Validate variable name syntax
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', var_name):
                return False, f"Invalid variable name: {var_name}"

            # Check for reserved names
            if var_name in {'self', 'template', 'env', 'globals'}:
                return False, f"Reserved variable name: {var_name}"

            var_names.add(var_name)

        # Validate variable count
        if len(var_names) > 20:  # Arbitrary limit
            return False, "Too many unique variables"

        return True, None

    except Exception as e:
        logger.error(f"Variable validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"