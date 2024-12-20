"""
Initialization module for the Porfin platform scripts package.

This module provides centralized access to utility scripts for setting up, configuring,
and managing the Porfin platform with comprehensive logging, error handling, and
execution order management.

Version: 1.0.0
"""

# Standard library imports
import logging
from typing import List, Dict, Optional, Type, ModuleType
import sys

# Internal imports - version specified in comments
from scripts.generate_keys import main as generate_keys  # v1.0.0
from scripts.init_knowledge_base import main as init_knowledge_base  # v1.0.0
from scripts.seed_data import main as seed_data  # v1.0.0
from scripts.setup_firebase import main as setup_firebase  # v1.0.0

# Configure module logger
logger = logging.getLogger(__name__)

# Script module registry with execution order and dependencies
SCRIPT_MODULES = [
    generate_keys,
    init_knowledge_base,
    seed_data,
    setup_firebase
]

# Define execution order (lower number = earlier execution)
SCRIPT_EXECUTION_ORDER = {
    'setup_firebase': 1,  # Must run first to initialize Firebase
    'generate_keys': 2,   # Security keys needed before other operations
    'init_knowledge_base': 3,  # Knowledge base before seeding data
    'seed_data': 4  # Data seeding runs last
}

# Define script dependencies
SCRIPT_DEPENDENCIES = {
    'init_knowledge_base': ['setup_firebase'],  # Needs Firebase for storage
    'seed_data': ['setup_firebase', 'generate_keys']  # Needs both Firebase and security keys
}

def configure_script_logging() -> None:
    """
    Configure comprehensive logging for script execution with proper handlers and formatters.
    
    Sets up both file and console logging with appropriate log levels and rotation.
    """
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Configure file handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        filename='logs/scripts.log',
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    
    # Configure console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    logger.info("Script logging configured successfully")

def validate_script_dependencies(script_name: str) -> bool:
    """
    Validates that all required script dependencies are available.
    
    Args:
        script_name: Name of the script to validate
        
    Returns:
        bool: True if all dependencies are satisfied
    """
    if script_name not in SCRIPT_DEPENDENCIES:
        return True
        
    dependencies = SCRIPT_DEPENDENCIES[script_name]
    available_scripts = {
        script.__name__.split('.')[-1]: script 
        for script in SCRIPT_MODULES
    }
    
    for dependency in dependencies:
        if dependency not in available_scripts:
            logger.error(
                f"Missing required dependency '{dependency}' for script '{script_name}'"
            )
            return False
            
        # Check dependency's execution order
        if (SCRIPT_EXECUTION_ORDER[dependency] >= 
            SCRIPT_EXECUTION_ORDER[script_name]):
            logger.error(
                f"Invalid dependency order: {dependency} must run before {script_name}"
            )
            return False
    
    return True

def get_script_modules() -> List[ModuleType]:
    """
    Returns a list of available script modules in their proper execution order.
    
    Returns:
        List[ModuleType]: Ordered list of available script modules
        
    Raises:
        ValueError: If script dependencies or execution order are invalid
    """
    try:
        # Sort modules by execution order
        sorted_modules = sorted(
            SCRIPT_MODULES,
            key=lambda m: SCRIPT_EXECUTION_ORDER.get(
                m.__name__.split('.')[-1], 
                sys.maxsize
            )
        )
        
        # Validate dependencies for each module
        for module in sorted_modules:
            script_name = module.__name__.split('.')[-1]
            if not validate_script_dependencies(script_name):
                raise ValueError(
                    f"Dependency validation failed for script: {script_name}"
                )
        
        logger.info(
            "Script modules validated and sorted successfully",
            extra={"module_count": len(sorted_modules)}
        )
        
        return sorted_modules
        
    except Exception as e:
        logger.error(f"Failed to get script modules: {str(e)}")
        raise

# Initialize logging when module is imported
configure_script_logging()

# Export script entry points and utilities
__all__ = [
    'generate_keys',
    'init_knowledge_base',
    'seed_data',
    'setup_firebase',
    'get_script_modules',
    'validate_script_dependencies'
]