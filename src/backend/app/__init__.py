"""
Porfin - AI-powered business management platform for healthcare professionals in Brazil

This package provides the core backend functionality for the Porfin platform,
implementing REST and WebSocket APIs using FastAPI for high-performance
asynchronous communication.

Version: 1.0.0
Author: Porfin Development Team
License: Proprietary
"""

# Import version and project information from settings
from app.config.settings import VERSION, PROJECT_NAME

# Package metadata exports
__version__ = VERSION
__project__ = PROJECT_NAME
__author__ = "Porfin Development Team"
__doc__ = "Porfin - AI-powered business management platform for healthcare professionals in Brazil"

# Package exports - these are the symbols that will be available when using 'from app import *'
__all__ = [
    "__version__",
    "__project__",
    "__author__",
    "__doc__",
]

# Package initialization code
def _initialize_package():
    """
    Perform any necessary package initialization.
    This is called automatically when the package is imported.
    """
    # Currently no initialization is required, but this function
    # serves as a placeholder for future initialization needs
    pass

# Run initialization when package is imported
_initialize_package()