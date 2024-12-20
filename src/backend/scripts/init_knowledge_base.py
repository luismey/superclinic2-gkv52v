#!/usr/bin/env python3
"""
Knowledge base initialization script for Porfin platform.

This script initializes and populates the AI virtual assistant's knowledge base with
initial documents and training data, generating embeddings and setting up the search
infrastructure with enhanced security, validation, and monitoring capabilities.

Version: 1.0.0
"""

# Standard library imports
import argparse
import asyncio
from pathlib import Path
import sys
from typing import Dict, List
import yaml

# Third-party imports - version specified as per IE2
from tqdm import tqdm  # v4.65.0

# Internal imports
from app.services.ai.knowledge_base import (
    KnowledgeBaseService,
    SUPPORTED_DOCUMENT_TYPES,
)
from app.core.logging import get_logger
from app.core.security import SecurityValidator
from app.core.exceptions import PorfinBaseException

# Configure logger
logger = get_logger(__name__)

# Constants
DEFAULT_CONFIG_PATH = "config/knowledge_base.yml"
DEFAULT_BATCH_SIZE = 10

# YAML configuration schema
YAML_SCHEMA = {
    "type": "object",
    "required": ["assistant_id", "documents"],
    "properties": {
        "assistant_id": {"type": "string"},
        "documents": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["path", "type"],
                "properties": {
                    "path": {"type": "string"},
                    "type": {"type": "string", "enum": SUPPORTED_DOCUMENT_TYPES},
                    "description": {"type": "string"},
                    "metadata": {"type": "object"}
                }
            }
        },
        "batch_size": {"type": "integer", "minimum": 1},
        "security": {
            "type": "object",
            "properties": {
                "max_file_size": {"type": "integer"},
                "allowed_mime_types": {"type": "array", "items": {"type": "string"}},
                "virus_scan_enabled": {"type": "boolean"}
            }
        }
    }
}

def parse_args() -> argparse.Namespace:
    """
    Parse and validate command line arguments with enhanced security checks.
    
    Returns:
        argparse.Namespace: Validated command line arguments
    """
    parser = argparse.ArgumentParser(
        description="Initialize and populate the AI virtual assistant's knowledge base",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "-c", "--config",
        type=str,
        default=DEFAULT_CONFIG_PATH,
        help="Path to YAML configuration file"
    )
    
    parser.add_argument(
        "-a", "--assistant-id",
        type=str,
        help="Override assistant ID from config"
    )
    
    parser.add_argument(
        "-b", "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Number of documents to process in parallel"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration without processing documents"
    )
    
    args = parser.parse_args()
    
    # Validate config file path
    config_path = Path(args.config)
    if not config_path.is_file():
        parser.error(f"Configuration file not found: {args.config}")
    
    # Validate batch size
    if args.batch_size < 1:
        parser.error("Batch size must be at least 1")
    
    return args

def load_config(config_path: str) -> Dict:
    """
    Securely load and validate knowledge base configuration from YAML file.
    
    Args:
        config_path: Path to YAML configuration file
        
    Returns:
        Dict: Validated configuration dictionary
        
    Raises:
        PorfinBaseException: If configuration is invalid or contains security risks
    """
    try:
        # Load and parse YAML
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Basic schema validation
        if not isinstance(config, dict):
            raise ValueError("Configuration must be a dictionary")
        
        if "assistant_id" not in config:
            raise ValueError("Missing required field: assistant_id")
            
        if "documents" not in config or not isinstance(config["documents"], list):
            raise ValueError("Missing or invalid documents array")
        
        # Validate document configurations
        for doc in config["documents"]:
            if not isinstance(doc, dict):
                raise ValueError("Each document must be a dictionary")
            
            if "path" not in doc or "type" not in doc:
                raise ValueError("Documents must have path and type fields")
                
            if doc["type"] not in SUPPORTED_DOCUMENT_TYPES:
                raise ValueError(f"Unsupported document type: {doc['type']}")
            
            # Convert relative paths to absolute
            doc_path = Path(doc["path"])
            if not doc_path.is_absolute():
                doc["path"] = str(Path(config_path).parent / doc_path)
        
        logger.info(
            "Configuration loaded successfully",
            extra={"document_count": len(config["documents"])}
        )
        
        return config
        
    except Exception as e:
        raise PorfinBaseException(
            message="Failed to load configuration",
            details={"error": str(e)},
            error_code="CONFIG_ERROR"
        )

async def validate_documents(config: Dict) -> bool:
    """
    Comprehensive validation of document paths, types, and content.
    
    Args:
        config: Loaded configuration dictionary
        
    Returns:
        bool: Validation success status
    """
    try:
        security_validator = SecurityValidator()
        kb_service = KnowledgeBaseService()
        
        for doc in config["documents"]:
            doc_path = Path(doc["path"])
            
            # Validate file exists and is accessible
            if not doc_path.is_file():
                raise ValueError(f"Document not found: {doc_path}")
            
            # Security validation
            await security_validator.validate_file_access(
                str(doc_path),
                allowed_types=SUPPORTED_DOCUMENT_TYPES,
                max_size=config.get("security", {}).get("max_file_size", 10 * 1024 * 1024)
            )
            
            # Validate document content
            with open(doc_path, 'rb') as f:
                content = f.read()
                if not await kb_service.validate_document(content, doc["type"]):
                    raise ValueError(f"Invalid document content: {doc_path}")
        
        logger.info("Document validation completed successfully")
        return True
        
    except Exception as e:
        logger.error(
            "Document validation failed",
            extra={"error": str(e)}
        )
        return False

async def main() -> int:
    """
    Main script execution function with enhanced error handling and monitoring.
    
    Returns:
        int: Exit code with detailed status
    """
    try:
        # Parse arguments
        args = parse_args()
        
        # Configure logging
        if args.verbose:
            logger.setLevel("DEBUG")
        
        # Load configuration
        config = load_config(args.config)
        
        # Override assistant ID if provided
        if args.assistant_id:
            config["assistant_id"] = args.assistant_id
        
        # Validate documents
        if not await validate_documents(config):
            return 3
        
        # Exit if dry run
        if args.dry_run:
            logger.info("Dry run completed successfully")
            return 0
        
        # Initialize services
        kb_service = KnowledgeBaseService()
        
        # Process documents with progress bar
        documents = config["documents"]
        batch_size = args.batch_size
        
        with tqdm(total=len(documents), desc="Processing documents") as pbar:
            for i in range(0, len(documents), batch_size):
                batch = documents[i:min(i + batch_size, len(documents))]
                
                # Process batch in parallel
                tasks = [
                    kb_service.process_document(
                        doc["path"],
                        doc["type"],
                        config["assistant_id"]
                    )
                    for doc in batch
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Check for errors
                for result in results:
                    if isinstance(result, Exception):
                        logger.error(f"Document processing failed: {str(result)}")
                    
                pbar.update(len(batch))
        
        logger.info(
            "Knowledge base initialization completed",
            extra={"document_count": len(documents)}
        )
        return 0
        
    except Exception as e:
        logger.error(
            "Knowledge base initialization failed",
            extra={"error": str(e)},
            exc_info=True
        )
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))