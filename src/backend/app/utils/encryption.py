"""
Encryption utility module for the Porfin platform.

This module provides secure encryption and decryption functions using AES-256 encryption
with Fernet implementation. It ensures thread-safe operations and comprehensive error
handling for protecting sensitive data in compliance with LGPD requirements.

Version: 1.0.0
"""

# Standard library imports
import base64
import hashlib
import threading
from typing import Dict, List, Any
from copy import deepcopy

# Third-party imports
from cryptography.fernet import Fernet, InvalidToken  # v41.0.0
from cryptography.exceptions import InvalidKey

# Internal imports
from app.config.settings import settings

# Constants
ENCODING = 'utf-8'
KEY_LENGTH = 32

# Thread-local storage for Fernet instances
_fernet_instance = threading.local()

class EncryptionError(Exception):
    """Base exception class for encryption-related errors."""
    pass

class DecryptionError(Exception):
    """Base exception class for decryption-related errors."""
    pass

def derive_key() -> bytes:
    """
    Securely derive a 32-byte key from the master secret key using SHA-256.
    
    Returns:
        bytes: 32-byte derived key for Fernet encryption
        
    Raises:
        EncryptionError: If key derivation fails or master key is invalid
    """
    try:
        if not settings.SECRET_KEY:
            raise EncryptionError("Master secret key is not configured")
        
        # Convert master key to bytes and derive fixed-length key
        master_key = settings.SECRET_KEY.encode(ENCODING)
        derived_key = hashlib.sha256(master_key).digest()
        
        if len(derived_key) != KEY_LENGTH:
            raise EncryptionError(f"Derived key length {len(derived_key)} != {KEY_LENGTH}")
        
        return derived_key
    except Exception as e:
        raise EncryptionError(f"Key derivation failed: {str(e)}")

def get_fernet() -> Fernet:
    """
    Get or create a thread-safe Fernet instance using the derived key.
    
    Returns:
        Fernet: Thread-local Fernet instance for encryption/decryption
        
    Raises:
        EncryptionError: If Fernet instance creation fails
    """
    try:
        if not hasattr(_fernet_instance, 'fernet'):
            key = derive_key()
            _fernet_instance.fernet = Fernet(base64.urlsafe_b64encode(key))
        return _fernet_instance.fernet
    except Exception as e:
        raise EncryptionError(f"Failed to create Fernet instance: {str(e)}")

def encrypt_value(value: str) -> str:
    """
    Encrypt a string value using thread-safe Fernet encryption.
    
    Args:
        value: String value to encrypt
        
    Returns:
        str: Base64-encoded encrypted value
        
    Raises:
        EncryptionError: If encryption fails or input is invalid
    """
    try:
        if not isinstance(value, str):
            raise EncryptionError("Input must be a string")
        if not value:
            raise EncryptionError("Input string cannot be empty")
            
        # Get thread-safe Fernet instance and encrypt
        fernet = get_fernet()
        encrypted_bytes = fernet.encrypt(value.encode(ENCODING))
        return base64.urlsafe_b64encode(encrypted_bytes).decode(ENCODING)
    
    except Exception as e:
        raise EncryptionError(f"Encryption failed: {str(e)}")

def decrypt_value(encrypted_value: str) -> str:
    """
    Decrypt a Fernet-encrypted string value.
    
    Args:
        encrypted_value: Base64-encoded encrypted string
        
    Returns:
        str: Decrypted original string
        
    Raises:
        DecryptionError: If decryption fails or input is invalid
    """
    try:
        if not isinstance(encrypted_value, str):
            raise DecryptionError("Input must be a string")
        if not encrypted_value:
            raise DecryptionError("Input string cannot be empty")
            
        # Get thread-safe Fernet instance and decrypt
        fernet = get_fernet()
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode(ENCODING))
        decrypted_bytes = fernet.decrypt(encrypted_bytes)
        return decrypted_bytes.decode(ENCODING)
        
    except InvalidToken:
        raise DecryptionError("Invalid or corrupted encrypted data")
    except Exception as e:
        raise DecryptionError(f"Decryption failed: {str(e)}")

def encrypt_dict(data: Dict[str, Any], fields_to_encrypt: List[str]) -> Dict[str, Any]:
    """
    Securely encrypt specified fields in a dictionary.
    
    Args:
        data: Dictionary containing fields to encrypt
        fields_to_encrypt: List of field names to encrypt
        
    Returns:
        dict: Dictionary with specified fields encrypted
        
    Raises:
        EncryptionError: If encryption fails or input is invalid
    """
    try:
        if not isinstance(data, dict):
            raise EncryptionError("Input must be a dictionary")
        if not isinstance(fields_to_encrypt, list):
            raise EncryptionError("fields_to_encrypt must be a list")
        if not fields_to_encrypt:
            return data
            
        # Create deep copy to avoid modifying original
        encrypted_data = deepcopy(data)
        
        # Validate all fields exist before starting encryption
        missing_fields = [f for f in fields_to_encrypt if f not in data]
        if missing_fields:
            raise EncryptionError(f"Fields not found in data: {', '.join(missing_fields)}")
            
        # Encrypt specified fields
        for field in fields_to_encrypt:
            if not isinstance(data[field], str):
                raise EncryptionError(f"Field '{field}' must be a string")
            encrypted_data[field] = encrypt_value(data[field])
            
        return encrypted_data
        
    except Exception as e:
        raise EncryptionError(f"Dictionary encryption failed: {str(e)}")

def decrypt_dict(data: Dict[str, Any], fields_to_decrypt: List[str]) -> Dict[str, Any]:
    """
    Securely decrypt specified fields in a dictionary.
    
    Args:
        data: Dictionary containing encrypted fields
        fields_to_decrypt: List of field names to decrypt
        
    Returns:
        dict: Dictionary with specified fields decrypted
        
    Raises:
        DecryptionError: If decryption fails or input is invalid
    """
    try:
        if not isinstance(data, dict):
            raise DecryptionError("Input must be a dictionary")
        if not isinstance(fields_to_decrypt, list):
            raise DecryptionError("fields_to_decrypt must be a list")
        if not fields_to_decrypt:
            return data
            
        # Create deep copy to avoid modifying original
        decrypted_data = deepcopy(data)
        
        # Validate all fields exist before starting decryption
        missing_fields = [f for f in fields_to_decrypt if f not in data]
        if missing_fields:
            raise DecryptionError(f"Fields not found in data: {', '.join(missing_fields)}")
            
        # Decrypt specified fields
        for field in fields_to_decrypt:
            if not isinstance(data[field], str):
                raise DecryptionError(f"Field '{field}' must be a string")
            decrypted_data[field] = decrypt_value(data[field])
            
        return decrypted_data
        
    except Exception as e:
        raise DecryptionError(f"Dictionary decryption failed: {str(e)}")

# Export public functions
__all__ = [
    'encrypt_value',
    'decrypt_value',
    'encrypt_dict',
    'decrypt_dict'
]