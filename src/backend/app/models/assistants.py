"""
AI virtual assistants data model and business logic for Porfin platform.

This module provides comprehensive data models and business logic for managing AI virtual
assistants with enhanced performance, security, and healthcare compliance features.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional, AsyncGenerator
import asyncio
from functools import cache

# Internal imports
from app.core.logging import get_logger
from app.services.ai.knowledge_base import KnowledgeBaseService
from app.services.ai.gpt import GPTService

# Module configuration
logger = get_logger(__name__)

# Constants
ASSISTANT_TYPES = ["sales", "support", "scheduling", "billing"]
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 2048
CACHE_TTL = 300  # 5 minutes
MAX_REQUESTS_PER_MINUTE = 100
RESPONSE_TIMEOUT = 0.5  # 500ms

@dataclass
class KnowledgeBase:
    """Enhanced data class representing assistant's knowledge base configuration."""
    
    source_type: str
    document_urls: List[str]
    embedding_config: Dict
    last_updated: datetime
    security_config: Dict
    validation_results: Dict
    
    async def update_documents(self, document_urls: List[str], security_config: Dict) -> bool:
        """Updates knowledge base documents with enhanced validation and security."""
        try:
            # Initialize services
            kb_service = KnowledgeBaseService()
            
            # Validate document URLs and formats
            if not all(url.startswith('https://') for url in document_urls):
                raise ValueError("All documents must use HTTPS")
                
            # Check security compliance
            if not security_config.get('virus_scan_enabled'):
                logger.warning("Virus scanning disabled for document processing")
            
            # Process new documents with error handling
            success_count = 0
            for url in document_urls:
                try:
                    result = await kb_service.process_document(
                        document_url=url,
                        document_type=url.split('.')[-1].lower(),
                        assistant_id=str(uuid.uuid4())
                    )
                    if result.get('status') == 'success':
                        success_count += 1
                except Exception as e:
                    logger.error(f"Document processing failed: {str(e)}")
                    
            # Update validation results
            self.validation_results = {
                'total_documents': len(document_urls),
                'successful_updates': success_count,
                'last_validation': datetime.utcnow().isoformat()
            }
            
            # Update metadata
            self.document_urls = document_urls
            self.security_config = security_config
            self.last_updated = datetime.utcnow()
            
            logger.info(
                "Knowledge base updated",
                extra={
                    'document_count': len(document_urls),
                    'success_rate': success_count / len(document_urls)
                }
            )
            
            return success_count > 0
            
        except Exception as e:
            logger.error(f"Knowledge base update failed: {str(e)}")
            return False
            
    def validate_healthcare_content(self, content: str) -> Dict:
        """Validates healthcare-specific content for compliance."""
        validation_results = {
            'is_valid': True,
            'issues': [],
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Check medical terminology
        medical_terms = ['paciente', 'consulta', 'tratamento', 'diagnóstico']
        if not any(term in content.lower() for term in medical_terms):
            validation_results['issues'].append('Missing medical context')
            
        # Verify LGPD compliance
        sensitive_patterns = ['cpf', 'rg', 'telefone', 'endereço']
        for pattern in sensitive_patterns:
            if pattern in content.lower():
                validation_results['issues'].append(f'Contains sensitive data: {pattern}')
                
        # Validate Portuguese language
        non_portuguese_chars = set(content) - set('áéíóúâêîôûãõàèìòùäëïöüçabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?()-')
        if non_portuguese_chars:
            validation_results['issues'].append('Contains invalid characters')
            
        validation_results['is_valid'] = len(validation_results['issues']) == 0
        return validation_results

class Assistant:
    """Enhanced main class representing an AI virtual assistant."""
    
    def __init__(
        self,
        name: str,
        assistant_type: str,
        user_id: str,
        knowledge_base: KnowledgeBase,
        behavior_settings: Dict,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS
    ):
        """Initialize assistant instance with enhanced monitoring."""
        if assistant_type not in ASSISTANT_TYPES:
            raise ValueError(f"Invalid assistant type. Must be one of: {ASSISTANT_TYPES}")
            
        self.id = str(uuid.uuid4())
        self.name = name
        self.assistant_type = assistant_type
        self.user_id = user_id
        self.model_version = "gpt-4"
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.knowledge_base = knowledge_base
        self.behavior_settings = behavior_settings
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.performance_stats = {
            'total_requests': 0,
            'average_latency': 0.0,
            'error_rate': 0.0
        }
        self.error_stats = {
            'total_errors': 0,
            'error_types': {}
        }
        
        # Initialize services
        self._gpt_service = GPTService()
        self._kb_service = KnowledgeBaseService()
        
        logger.info(
            f"Assistant initialized: {self.id}",
            extra={'assistant_type': assistant_type, 'user_id': user_id}
        )
        
    async def process_message(
        self,
        message: str,
        conversation_history: List[Dict]
    ) -> str:
        """Process user message with enhanced performance and monitoring."""
        start_time = datetime.utcnow()
        
        try:
            # Search knowledge base with caching
            kb_results = await self._kb_service.search_knowledge_base(
                query=message,
                assistant_id=self.id,
                limit=3
            )
            
            # Build conversation context
            context = {
                'assistant_id': self.id,
                'assistant_type': self.assistant_type,
                'knowledge_base': kb_results,
                'behavior_settings': self.behavior_settings
            }
            
            # Process message with timeout
            async with asyncio.timeout(RESPONSE_TIMEOUT):
                response = await self._gpt_service.generate_response(
                    message=message,
                    conversation_history=conversation_history,
                    context=context
                )
            
            # Validate healthcare compliance
            validation_results = self.knowledge_base.validate_healthcare_content(response)
            if not validation_results['is_valid']:
                logger.warning(
                    "Response failed healthcare validation",
                    extra={'issues': validation_results['issues']}
                )
                
            # Update performance stats
            duration = (datetime.utcnow() - start_time).total_seconds()
            self.performance_stats['total_requests'] += 1
            self.performance_stats['average_latency'] = (
                (self.performance_stats['average_latency'] * 
                 (self.performance_stats['total_requests'] - 1) + duration) /
                self.performance_stats['total_requests']
            )
            
            return response
            
        except Exception as e:
            # Update error stats
            error_type = type(e).__name__
            self.error_stats['total_errors'] += 1
            self.error_stats['error_types'][error_type] = \
                self.error_stats['error_types'].get(error_type, 0) + 1
            
            logger.error(
                f"Message processing failed: {str(e)}",
                extra={'assistant_id': self.id, 'error_type': error_type}
            )
            raise
            
    async def stream_response(
        self,
        message: str,
        conversation_history: List[Dict]
    ) -> AsyncGenerator[str, None]:
        """Stream assistant's response with performance optimization."""
        try:
            # Initialize stream with timeout
            async with asyncio.timeout(RESPONSE_TIMEOUT):
                response_stream = await self._gpt_service.generate_response(
                    message=message,
                    conversation_history=conversation_history,
                    context={'assistant_id': self.id}
                )
                
            # Yield response chunks
            async for chunk in response_stream:
                # Validate chunk content
                if chunk and isinstance(chunk, str):
                    validation_results = self.knowledge_base.validate_healthcare_content(chunk)
                    if validation_results['is_valid']:
                        yield chunk
                        
        except asyncio.TimeoutError:
            logger.error("Response streaming timeout", extra={'assistant_id': self.id})
            raise
        except Exception as e:
            logger.error(
                f"Stream response failed: {str(e)}",
                extra={'assistant_id': self.id}
            )
            raise

# Export constants and classes
__all__ = [
    'ASSISTANT_TYPES',
    'Assistant',
    'KnowledgeBase'
]