#!/usr/bin/env python3
"""
Key Generation Utility for Porfin Platform

This script generates secure cryptographic keys and secrets required for the Porfin platform,
including JWT signing keys, encryption keys, and Firebase integration keys.

Version: 1.0.0
Security: OWASP Compliant, LGPD Ready
"""

import os
import secrets
import argparse
import logging
import tempfile
from datetime import datetime
from functools import wraps
from typing import Callable, Any
from base64 import urlsafe_b64encode
from pathlib import Path

from cryptography.fernet import Fernet  # v41.0.0
from app.config.settings import get_random_secret_key

# Constants
KEY_LENGTH = 32  # 256 bits
SECURE_PERMISSIONS = 0o600  # Read/write for owner only
ENV_FILE_TEMPLATE = """# Porfin Platform Security Keys
# Generated: {timestamp}
# Version: {version}

# WARNING: This file contains sensitive security keys.
# Protect this file with appropriate permissions and never commit to version control.

SECRET_KEY={secret_key}
ENCRYPTION_KEY={encryption_key}
FIREBASE_KEY={firebase_key}
KEY_VERSION={version}
GENERATED_AT={timestamp}
"""

# Configure secure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def validate_key_length(func: Callable) -> Callable:
    """
    Decorator to validate generated key lengths.
    
    Args:
        func: Function that generates a key
        
    Returns:
        Wrapped function with key length validation
    """
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> str:
        key = func(*args, **kwargs)
        # Decode base64 to get raw bytes for length check
        raw_key = urlsafe_b64encode(key.encode()).rstrip(b'=')
        if len(raw_key) < KEY_LENGTH:
            raise ValueError(f"Generated key length ({len(raw_key)}) is less than required ({KEY_LENGTH})")
        return key
    return wrapper

def atomic_write(func: Callable) -> Callable:
    """
    Decorator to ensure atomic file writes with proper permissions.
    
    Args:
        func: Function that writes to a file
        
    Returns:
        Wrapped function with atomic write guarantees
    """
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> None:
        temp_fd, temp_path = tempfile.mkstemp(text=True)
        try:
            os.close(temp_fd)
            result = func(*args, temp_path=temp_path, **kwargs)
            os.chmod(temp_path, SECURE_PERMISSIONS)
            os.replace(temp_path, args[0])
            return result
        finally:
            # Clean up temporary file if still exists
            try:
                os.unlink(temp_path)
            except OSError:
                pass
    return wrapper

@validate_key_length
def generate_encryption_key() -> str:
    """
    Generate a secure AES-256 encryption key using Fernet.
    
    Returns:
        str: Base64-encoded Fernet encryption key
    """
    key = Fernet.generate_key()
    logger.info("Generated new encryption key")
    return key.decode()

@validate_key_length
def generate_firebase_key() -> str:
    """
    Generate a secure random key for Firebase service integration.
    
    Returns:
        str: Base64-encoded Firebase integration key
    """
    key = secrets.token_urlsafe(KEY_LENGTH)
    logger.info("Generated new Firebase integration key")
    return key

@atomic_write
def write_env_file(
    output_path: str,
    secret_key: str,
    encryption_key: str,
    firebase_key: str,
    temp_path: str
) -> None:
    """
    Securely write generated keys to .env file with atomic operation.
    
    Args:
        output_path: Target path for .env file
        secret_key: JWT signing key
        encryption_key: Data encryption key
        firebase_key: Firebase integration key
        temp_path: Temporary file path for atomic write
    """
    timestamp = datetime.utcnow().isoformat()
    version = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    
    content = ENV_FILE_TEMPLATE.format(
        secret_key=secret_key,
        encryption_key=encryption_key,
        firebase_key=firebase_key,
        version=version,
        timestamp=timestamp
    )
    
    with open(temp_path, 'w') as f:
        f.write(content)
    
    logger.info(f"Successfully wrote keys to {output_path}")

def parse_args() -> argparse.Namespace:
    """
    Parse and validate command line arguments.
    
    Returns:
        argparse.Namespace: Parsed command line arguments
    """
    parser = argparse.ArgumentParser(
        description="Generate secure cryptographic keys for Porfin platform"
    )
    parser.add_argument(
        '--output',
        type=str,
        default='.env',
        help='Output file path for environment variables'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing file if present'
    )
    parser.add_argument(
        '--key-length',
        type=int,
        default=KEY_LENGTH,
        help='Length of generated keys in bytes'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate operations without writing files'
    )
    
    args = parser.parse_args()
    
    # Validate output path
    output_path = Path(args.output)
    if output_path.exists() and not args.force:
        parser.error(f"Output file {args.output} already exists. Use --force to overwrite.")
    
    return args

def main() -> int:
    """
    Main script entry point with comprehensive error handling.
    
    Returns:
        int: Exit code (0 for success, non-zero for errors)
    """
    try:
        args = parse_args()
        
        # Generate keys
        secret_key = get_random_secret_key()
        encryption_key = generate_encryption_key()
        firebase_key = generate_firebase_key()
        
        if args.dry_run:
            logger.info("Dry run completed successfully - no files written")
            return 0
            
        # Write keys to file
        write_env_file(
            args.output,
            secret_key,
            encryption_key,
            firebase_key
        )
        
        logger.info("Key generation completed successfully")
        return 0
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return 1
    except OSError as e:
        logger.error(f"File system error: {e}")
        return 2
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 3

if __name__ == '__main__':
    exit(main())