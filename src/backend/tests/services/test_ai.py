"""
Comprehensive test suite for AI services including GPT integration, embeddings,
intent classification, and knowledge base operations.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import json
from datetime import datetime
from typing import Dict, List

# Third-party imports
import pytest  # v7.0.0
import pytest_asyncio  # v0.21.0
import pytest_benchmark  # v4.0.0
import numpy as np  # v1.24.0
from unittest.mock import Mock, patch, AsyncMock

# Internal imports
from app.services.ai.gpt import GPTService, GPTError
from app.services.ai.embeddings import EmbeddingService
from app.services.ai.intent_classifier import IntentClassifier, INTENT_CATEGORIES
from app.services.ai.knowledge_base import KnowledgeBaseService, SUPPORTED_DOCUMENT_TYPES

# Test constants
TEST_MESSAGES = [
    'Olá, gostaria de marcar uma consulta',
    'Qual o preço da limpeza?',
    'Preciso remarcar minha consulta',
    'Vocês atendem convênio?',
    'Tem horário disponível amanhã?'
]

TEST_CONTEXT = {
    'user_id': 'test_user',
    'assistant_id': 'test_assistant',
    'language': 'pt-BR',
    'timezone': 'America/Sao_Paulo',
    'security_context': {
        'role': 'healthcare_provider',
        'permissions': ['read', 'write']
    }
}

TEST_DOCUMENTS = {
    'pdf_url': 'test_doc.pdf',
    'docx_url': 'test_doc.docx',
    'xlsx_url': 'test_doc.xlsx',
    'security_level': 'confidential',
    'access_control': ['healthcare_provider']
}

PERFORMANCE_THRESHOLDS = {
    'response_time_ms': 500,
    'messages_per_second': 100,
    'embedding_batch_size': 50
}

class MockOpenAI:
    """Enhanced mock class for OpenAI API responses with Portuguese support."""
    
    def __init__(self, language: str = 'pt-BR'):
        self.language = language
        self._responses = {
            'gpt': {
                'appointment_scheduling': 'Entendi que você quer marcar uma consulta.',
                'price_inquiry': 'Vou verificar o preço para você.',
                'general_question': 'Posso ajudar com sua dúvida.'
            },
            'embeddings': {
                'vector_dim': 1536,
                'sample_vector': np.random.rand(1536)
            }
        }
        
    async def create_completion(self, **kwargs):
        """Mock GPT completion with language-aware responses."""
        prompt = kwargs.get('prompt', '')
        
        # Simulate processing delay
        await asyncio.sleep(0.1)
        
        # Select appropriate response based on content
        if 'consulta' in prompt.lower():
            response = self._responses['gpt']['appointment_scheduling']
        elif 'preço' in prompt.lower():
            response = self._responses['gpt']['price_inquiry']
        else:
            response = self._responses['gpt']['general_question']
            
        return Mock(choices=[Mock(text=response)])
    
    async def create_embedding(self, **kwargs):
        """Mock embedding generation with consistent dimensions."""
        await asyncio.sleep(0.05)
        return Mock(
            data=[Mock(embedding=self._responses['embeddings']['sample_vector'].tolist())]
        )

@pytest.fixture
async def gpt_service():
    """Fixture for GPT service with mocked OpenAI client."""
    with patch('app.services.ai.gpt.openai.Client') as mock_client:
        mock_client.return_value = MockOpenAI()
        service = GPTService()
        yield service

@pytest.fixture
async def embedding_service():
    """Fixture for embedding service with mocked vector operations."""
    with patch('app.services.ai.embeddings.openai.Client') as mock_client:
        mock_client.return_value = MockOpenAI()
        service = EmbeddingService()
        yield service

@pytest.fixture
async def intent_classifier():
    """Fixture for intent classifier with mocked dependencies."""
    with patch('app.services.ai.intent_classifier.EmbeddingService') as mock_embed:
        with patch('app.services.ai.intent_classifier.GPTService') as mock_gpt:
            classifier = IntentClassifier()
            yield classifier

@pytest.mark.asyncio
@pytest.mark.benchmark
async def test_gpt_response_generation(gpt_service, benchmark):
    """Test GPT service response generation with Portuguese support."""
    
    # Test basic response generation
    for message in TEST_MESSAGES:
        start_time = datetime.now()
        response = await gpt_service.generate_response(
            message=message,
            conversation_history=[],
            context=TEST_CONTEXT
        )
        duration = (datetime.now() - start_time).total_seconds() * 1000
        
        # Validate response
        assert response is not None
        assert isinstance(response, str)
        assert len(response) > 0
        assert duration < PERFORMANCE_THRESHOLDS['response_time_ms']
        
        # Verify Portuguese language
        assert any(word in response.lower() for word in ['consulta', 'preço', 'horário'])
    
    # Test context building
    context = await gpt_service.build_context(TEST_MESSAGES[0], TEST_CONTEXT)
    assert context is not None
    assert 'profissional' in context.lower()
    assert 'paciente' in context.lower()
    
    # Test response validation
    valid_response = await gpt_service.validate_response(
        "Olá, posso ajudar com sua consulta?"
    )
    assert valid_response is not None
    assert len(valid_response) > 0
    
    # Test error handling
    with pytest.raises(GPTError):
        await gpt_service.generate_response("", [], {})
    
    # Benchmark performance
    async def benchmark_response():
        await gpt_service.generate_response(
            TEST_MESSAGES[0],
            [],
            TEST_CONTEXT
        )
    
    benchmark(benchmark_response)

@pytest.mark.asyncio
@pytest.mark.benchmark
async def test_embedding_generation(embedding_service, benchmark):
    """Test embedding generation and similarity search with benchmarks."""
    
    # Test single embedding generation
    embedding = await embedding_service.generate_embedding(
        TEST_MESSAGES[0],
        category='test'
    )
    assert isinstance(embedding, np.ndarray)
    assert embedding.shape == (1536,)
    
    # Test batch embedding generation
    start_time = datetime.now()
    embeddings = await embedding_service.batch_generate_embeddings(
        TEST_MESSAGES,
        category='test',
        batch_size=PERFORMANCE_THRESHOLDS['embedding_batch_size']
    )
    duration = (datetime.now() - start_time).total_seconds()
    
    assert len(embeddings) == len(TEST_MESSAGES)
    messages_per_second = len(TEST_MESSAGES) / duration
    assert messages_per_second >= PERFORMANCE_THRESHOLDS['messages_per_second']
    
    # Test similarity search
    results = await embedding_service.search_similar(
        embedding,
        category='test',
        limit=3,
        similarity_threshold=0.7
    )
    assert isinstance(results, list)
    assert len(results) <= 3
    
    # Benchmark batch processing
    async def benchmark_batch():
        await embedding_service.batch_generate_embeddings(
            TEST_MESSAGES[:10],
            category='test'
        )
    
    benchmark(benchmark_batch)

@pytest.mark.asyncio
async def test_intent_classification(intent_classifier):
    """Test intent classification with Portuguese message support."""
    
    # Test basic classification
    for message in TEST_MESSAGES:
        result = await intent_classifier.classify_intent(message, TEST_CONTEXT)
        
        assert result is not None
        assert 'intent' in result
        assert result['intent'] in INTENT_CATEGORIES
        assert 'confidence' in result
        assert 0 <= result['confidence'] <= 1
        
        # Verify entities for specific intents
        if result['intent'] == 'appointment_scheduling':
            assert 'entities' in result
            entities = result['entities']
            assert isinstance(entities, dict)
    
    # Test preprocessing
    processed = intent_classifier.preprocess_message("Vc tem horário hj?")
    assert "você" in processed
    assert "hoje" in processed
    
    # Test confidence thresholds
    high_confidence = await intent_classifier.classify_intent(
        "Quero marcar uma consulta para amanhã às 15h",
        TEST_CONTEXT
    )
    assert high_confidence['confidence'] > 0.8

@pytest.mark.asyncio
async def test_knowledge_base_operations(embedding_service):
    """Test knowledge base operations with security validation."""
    kb_service = KnowledgeBaseService()
    
    # Test document processing
    for doc_type in SUPPORTED_DOCUMENT_TYPES:
        result = await kb_service.process_document(
            document_url=TEST_DOCUMENTS[f'{doc_type}_url'],
            document_type=doc_type,
            assistant_id=TEST_CONTEXT['assistant_id']
        )
        
        assert result['status'] == 'success'
        assert result['document_count'] > 0
        assert result['processing_time'] < PERFORMANCE_THRESHOLDS['response_time_ms'] / 1000
    
    # Test knowledge base search
    search_results = await kb_service.search_knowledge_base(
        query="Horários de atendimento",
        assistant_id=TEST_CONTEXT['assistant_id'],
        limit=5
    )
    
    assert isinstance(search_results, list)
    assert len(search_results) <= 5
    
    # Test security validation
    with pytest.raises(Exception):
        await kb_service.process_document(
            document_url="invalid_url",
            document_type="unsupported",
            assistant_id="invalid"
        )

@pytest.mark.asyncio
async def test_integration_flow():
    """Test complete AI service integration flow."""
    
    # Initialize services
    gpt = GPTService()
    embeddings = EmbeddingService()
    intent = IntentClassifier()
    kb = KnowledgeBaseService()
    
    # Test complete flow
    message = "Preciso marcar uma consulta para amanhã"
    
    # 1. Classify intent
    intent_result = await intent.classify_intent(message, TEST_CONTEXT)
    assert intent_result['intent'] == 'appointment_scheduling'
    
    # 2. Generate embedding
    embedding = await embeddings.generate_embedding(message, 'conversation')
    assert embedding is not None
    
    # 3. Search knowledge base
    kb_results = await kb.search_knowledge_base(
        message,
        TEST_CONTEXT['assistant_id']
    )
    assert isinstance(kb_results, list)
    
    # 4. Generate response
    response = await gpt.generate_response(
        message=message,
        conversation_history=[],
        context={**TEST_CONTEXT, 'kb_results': kb_results}
    )
    assert response is not None
    assert 'consulta' in response.lower()

if __name__ == '__main__':
    pytest.main(['-v', __file__])