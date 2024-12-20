"""
Enterprise-grade data seeding script for Porfin platform.

This script provides comprehensive functionality for seeding test data into Firestore
with transaction support, validation, and error handling for development and testing.

Version: 1.0.0
"""

# Standard library imports
import argparse
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import sys

# Third-party imports
import firebase_admin
from firebase_admin import credentials, firestore

# Internal imports
from app.models.users import UserModel
from app.models.campaigns import Campaign
from app.models.assistants import Assistant, KnowledgeBase
from app.core.logging import get_logger

# Initialize logger
logger = get_logger(__name__)

# Constants
DEFAULT_SEED_PATH = Path('src/backend/scripts/seed_data')
SCHEMA_VERSION = '1.0'
REQUIRED_COLLECTIONS = ['users', 'campaigns', 'assistants', 'knowledge_base']

async def validate_seed_data(seed_path: Path, entity_type: str) -> bool:
    """
    Validates seed data files against defined schemas.
    
    Args:
        seed_path: Path to seed data directory
        entity_type: Type of entity to validate
        
    Returns:
        bool: True if validation passes
        
    Raises:
        ValidationError: If validation fails
    """
    try:
        # Construct file paths
        data_file = seed_path / f"{entity_type}.json"
        
        # Verify file exists
        if not data_file.exists():
            raise FileNotFoundError(f"Seed data file not found: {data_file}")
            
        # Load and validate data
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Validate schema version
        if data.get('schema_version') != SCHEMA_VERSION:
            raise ValueError(f"Invalid schema version in {entity_type}.json")
            
        # Validate required fields based on entity type
        if entity_type == 'users':
            required_fields = {'email', 'full_name', 'role', 'password'}
        elif entity_type == 'campaigns':
            required_fields = {'name', 'target_type', 'message_template'}
        elif entity_type == 'assistants':
            required_fields = {'name', 'assistant_type', 'knowledge_base'}
        else:
            raise ValueError(f"Unknown entity type: {entity_type}")
            
        # Check each record
        for record in data.get('records', []):
            missing_fields = required_fields - set(record.keys())
            if missing_fields:
                raise ValueError(
                    f"Missing required fields in {entity_type}: {missing_fields}"
                )
                
        logger.info(
            f"Seed data validation successful for {entity_type}",
            extra={'record_count': len(data.get('records', []))}
        )
        return True
        
    except Exception as e:
        logger.error(
            f"Seed data validation failed for {entity_type}",
            extra={'error': str(e)}
        )
        raise

async def seed_users(seed_path: Path) -> Dict[str, str]:
    """
    Seeds test user accounts with transaction support.
    
    Args:
        seed_path: Path to seed data directory
        
    Returns:
        Dict[str, str]: Mapping of user IDs to roles
        
    Raises:
        Exception: If seeding fails
    """
    try:
        # Validate user seed data
        await validate_seed_data(seed_path, 'users')
        
        # Load user data
        with open(seed_path / 'users.json', 'r', encoding='utf-8') as f:
            user_data = json.load(f)
            
        user_map = {}
        created_users = []
        
        # Create users with transaction support
        for record in user_data.get('records', []):
            try:
                # Create user with enhanced security
                user = await UserModel.create({
                    'email': record['email'],
                    'full_name': record['full_name'],
                    'password': record['password'],
                    'role': record['role'],
                    'is_active': True,
                    'created_by': 'seed_script'
                })
                
                user_map[user.id] = user.role
                created_users.append(user)
                
                logger.info(
                    f"Created test user: {user.email}",
                    extra={'user_id': user.id, 'role': user.role}
                )
                
            except Exception as e:
                logger.error(
                    f"Failed to create user: {record['email']}",
                    extra={'error': str(e)}
                )
                # Cleanup created users on failure
                for created_user in created_users:
                    await created_user.delete()
                raise
                
        return user_map
        
    except Exception as e:
        logger.error("User seeding failed", extra={'error': str(e)})
        raise

async def seed_campaigns(seed_path: Path, user_map: Dict[str, str]) -> List[str]:
    """
    Seeds test marketing campaigns with transaction support.
    
    Args:
        seed_path: Path to seed data directory
        user_map: Mapping of user IDs to roles
        
    Returns:
        List[str]: List of created campaign IDs
        
    Raises:
        Exception: If seeding fails
    """
    try:
        # Validate campaign seed data
        await validate_seed_data(seed_path, 'campaigns')
        
        # Load campaign data
        with open(seed_path / 'campaigns.json', 'r', encoding='utf-8') as f:
            campaign_data = json.load(f)
            
        campaign_ids = []
        created_campaigns = []
        
        # Create campaigns with transaction support
        for record in campaign_data.get('records', []):
            try:
                # Assign to random manager user
                manager_ids = [
                    uid for uid, role in user_map.items()
                    if role in ['admin', 'manager']
                ]
                if not manager_ids:
                    raise ValueError("No manager users available")
                    
                # Create campaign
                campaign = Campaign(
                    name=record['name'],
                    description=record.get('description', ''),
                    user_id=manager_ids[0],
                    status=record.get('status', 'draft'),
                    target_type=record['target_type'],
                    target_audience_ids=record.get('target_audience_ids', []),
                    message_template=record['message_template']
                )
                
                # Validate and save
                if campaign.validate():
                    await campaign.save()
                    campaign_ids.append(campaign.id)
                    created_campaigns.append(campaign)
                    
                    logger.info(
                        f"Created test campaign: {campaign.name}",
                        extra={'campaign_id': campaign.id}
                    )
                    
            except Exception as e:
                logger.error(
                    f"Failed to create campaign: {record['name']}",
                    extra={'error': str(e)}
                )
                # Cleanup created campaigns on failure
                for created_campaign in created_campaigns:
                    await created_campaign.delete()
                raise
                
        return campaign_ids
        
    except Exception as e:
        logger.error("Campaign seeding failed", extra={'error': str(e)})
        raise

async def seed_assistants(seed_path: Path, user_map: Dict[str, str]) -> List[str]:
    """
    Seeds test AI assistants and knowledge bases with transaction support.
    
    Args:
        seed_path: Path to seed data directory
        user_map: Mapping of user IDs to roles
        
    Returns:
        List[str]: List of created assistant IDs
        
    Raises:
        Exception: If seeding fails
    """
    try:
        # Validate assistant seed data
        await validate_seed_data(seed_path, 'assistants')
        
        # Load assistant data
        with open(seed_path / 'assistants.json', 'r', encoding='utf-8') as f:
            assistant_data = json.load(f)
            
        assistant_ids = []
        created_assistants = []
        
        # Create assistants with transaction support
        for record in assistant_data.get('records', []):
            try:
                # Create knowledge base
                kb_config = record['knowledge_base']
                knowledge_base = KnowledgeBase(
                    source_type=kb_config['source_type'],
                    document_urls=kb_config['document_urls'],
                    embedding_config=kb_config.get('embedding_config', {}),
                    last_updated=datetime.utcnow(),
                    security_config={
                        'virus_scan_enabled': True,
                        'content_filtering': True
                    },
                    validation_results={}
                )
                
                # Create assistant
                assistant = Assistant(
                    name=record['name'],
                    assistant_type=record['assistant_type'],
                    user_id=list(user_map.keys())[0],  # Assign to first user
                    knowledge_base=knowledge_base,
                    behavior_settings=record.get('behavior_settings', {})
                )
                
                # Initialize knowledge base documents
                await knowledge_base.update_documents(
                    kb_config['document_urls'],
                    {'virus_scan_enabled': True}
                )
                
                assistant_ids.append(assistant.id)
                created_assistants.append(assistant)
                
                logger.info(
                    f"Created test assistant: {assistant.name}",
                    extra={'assistant_id': assistant.id}
                )
                
            except Exception as e:
                logger.error(
                    f"Failed to create assistant: {record['name']}",
                    extra={'error': str(e)}
                )
                # Cleanup created assistants on failure
                for created_assistant in created_assistants:
                    await created_assistant.delete()
                raise
                
        return assistant_ids
        
    except Exception as e:
        logger.error("Assistant seeding failed", extra={'error': str(e)})
        raise

async def cleanup_failed_seed(created_ids: List[str], entity_type: str) -> None:
    """
    Cleans up partially seeded data in case of failures.
    
    Args:
        created_ids: List of created entity IDs
        entity_type: Type of entity to clean up
    """
    try:
        logger.info(f"Starting cleanup for {entity_type}")
        
        db = firestore.client()
        batch = db.batch()
        
        for entity_id in created_ids:
            ref = db.collection(entity_type).document(entity_id)
            batch.delete(ref)
            
        await batch.commit()
        
        logger.info(
            f"Cleanup completed for {entity_type}",
            extra={'cleaned_count': len(created_ids)}
        )
        
    except Exception as e:
        logger.error(
            f"Cleanup failed for {entity_type}",
            extra={'error': str(e)}
        )

async def main() -> int:
    """
    Main function to orchestrate data seeding process.
    
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    parser = argparse.ArgumentParser(description='Seed test data for Porfin platform')
    parser.add_argument(
        '--path',
        type=Path,
        default=DEFAULT_SEED_PATH,
        help='Path to seed data directory'
    )
    parser.add_argument(
        '--clean',
        action='store_true',
        help='Clean existing data before seeding'
    )
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase
        cred = credentials.Certificate('firebase-credentials.json')
        firebase_admin.initialize_app(cred)
        
        # Clean existing data if requested
        if args.clean:
            logger.info("Cleaning existing data")
            db = firestore.client()
            for collection in REQUIRED_COLLECTIONS:
                docs = db.collection(collection).get()
                for doc in docs:
                    doc.reference.delete()
                    
        # Seed data with transaction support
        user_map = await seed_users(args.path)
        logger.info(f"Created {len(user_map)} test users")
        
        campaign_ids = await seed_campaigns(args.path, user_map)
        logger.info(f"Created {len(campaign_ids)} test campaigns")
        
        assistant_ids = await seed_assistants(args.path, user_map)
        logger.info(f"Created {len(assistant_ids)} test assistants")
        
        logger.info("Data seeding completed successfully")
        return 0
        
    except Exception as e:
        logger.error(f"Data seeding failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))