"""
Knowledge base service module for Porfin platform.

This module provides secure document processing, efficient embedding generation,
and advanced semantic search capabilities with caching and batch processing support.

Version: 1.0.0
"""

# Standard library imports
import asyncio
import hashlib
from typing import Dict, List, Optional, Union
from datetime import datetime
import re

# Third-party imports
import PyPDF2  # v3.0.0
from docx import Document  # python-docx v0.8.11
import pandas as pd  # v2.0.0
import aiohttp  # v3.8.0
import redis  # v4.5.0
from prometheus_client import Counter, Histogram

# Internal imports
from app.core.logging import get_logger
from app.services.ai.embeddings import EmbeddingService
from app.db.firestore import FirestoreClient
from app.core.exceptions import PorfinBaseException

# Module configuration
logger = get_logger(__name__)

# Constants
SUPPORTED_DOCUMENT_TYPES = ["pdf", "docx", "xlsx", "txt"]
COLLECTION_NAME = "knowledge_base"
CHUNK_SIZE = 1000
OVERLAP_SIZE = 100
MAX_RETRIES = 3
CACHE_TTL = 3600
BATCH_SIZE = 50

# Prometheus metrics
METRICS_PREFIX = "porfin_knowledge_base"
document_operations = Counter(
    f"{METRICS_PREFIX}_operations_total",
    "Total knowledge base operations",
    ["operation_type", "document_type", "status"]
)
processing_latency = Histogram(
    f"{METRICS_PREFIX}_processing_latency_seconds",
    "Document processing latency",
    ["operation_type", "document_type"]
)

class KnowledgeBaseError(PorfinBaseException):
    """Custom exception for knowledge base operations."""
    
    def __init__(
        self,
        message: str,
        details: Dict = None,
        error_code: str = None,
        operation_id: str = None
    ) -> None:
        super().__init__(
            message=message,
            details=details,
            status_code=500,
            correlation_id=operation_id
        )
        self.error_code = error_code
        
        logger.error(
            f"Knowledge base error: {message}",
            extra={
                "error_code": error_code,
                "operation_id": operation_id,
                "details": details
            }
        )

class KnowledgeBaseService:
    """Service for managing and querying the AI virtual assistant's knowledge base."""
    
    _instance = None
    
    def __new__(cls):
        """Ensure singleton instance."""
        if cls._instance is None:
            cls._instance = super(KnowledgeBaseService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self, security_config: Dict = None):
        """Initialize knowledge base service with security configuration."""
        if not hasattr(self, '_initialized'):
            # Initialize services
            self._embedding_service = EmbeddingService()
            self._db_client = FirestoreClient()
            
            # Initialize Redis cache
            self._cache_client = redis.Redis(
                host="localhost",
                port=6379,
                db=0,
                decode_responses=True
            )
            
            # Configure document processors
            self._document_processors = {
                "pdf": self._process_pdf,
                "docx": self._process_docx,
                "xlsx": self._process_xlsx,
                "txt": self._process_text
            }
            
            # Security configuration
            self._security_config = security_config or {
                "max_file_size": 10 * 1024 * 1024,  # 10MB
                "allowed_mime_types": [
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "text/plain"
                ],
                "virus_scan_enabled": True
            }
            
            self._initialized = True
            logger.info("Knowledge base service initialized")
    
    @staticmethod
    def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap_size: int = OVERLAP_SIZE) -> List[str]:
        """Split text into overlapping chunks with content sanitization."""
        if not text or chunk_size <= 0 or overlap_size < 0:
            raise ValueError("Invalid chunking parameters")
            
        # Sanitize text
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        chunks = []
        start = 0
        
        while start < len(text):
            # Extract chunk with overlap
            end = start + chunk_size
            chunk = text[start:end]
            
            # Ensure chunk ends at word boundary
            if end < len(text):
                last_space = chunk.rfind(' ')
                if last_space != -1:
                    chunk = chunk[:last_space]
                    end = start + last_space
            
            # Validate and add chunk
            if chunk.strip():
                chunks.append(chunk.strip())
            
            # Move start position considering overlap
            start = end - overlap_size
            
        return chunks
    
    async def _download_document(self, document_url: str) -> bytes:
        """Download document with retry mechanism and security checks."""
        async with aiohttp.ClientSession() as session:
            for attempt in range(MAX_RETRIES):
                try:
                    async with session.get(document_url) as response:
                        if response.status != 200:
                            raise KnowledgeBaseError(
                                message=f"Failed to download document: {response.status}",
                                error_code="DOWNLOAD_ERROR"
                            )
                        
                        content = await response.read()
                        
                        # Security checks
                        if len(content) > self._security_config["max_file_size"]:
                            raise KnowledgeBaseError(
                                message="Document exceeds size limit",
                                error_code="SIZE_LIMIT_EXCEEDED"
                            )
                            
                        content_type = response.headers.get("Content-Type", "")
                        if content_type not in self._security_config["allowed_mime_types"]:
                            raise KnowledgeBaseError(
                                message=f"Unsupported content type: {content_type}",
                                error_code="INVALID_CONTENT_TYPE"
                            )
                            
                        return content
                        
                except Exception as e:
                    if attempt == MAX_RETRIES - 1:
                        raise KnowledgeBaseError(
                            message="Max retry attempts reached",
                            details={"error": str(e)},
                            error_code="DOWNLOAD_RETRY_FAILED"
                        )
                    await asyncio.sleep(2 ** attempt)
    
    async def _process_pdf(self, content: bytes) -> str:
        """Process PDF document with security checks."""
        try:
            reader = PyPDF2.PdfReader(content)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            raise KnowledgeBaseError(
                message="Failed to process PDF document",
                details={"error": str(e)},
                error_code="PDF_PROCESSING_ERROR"
            )
    
    async def _process_docx(self, content: bytes) -> str:
        """Process DOCX document with content validation."""
        try:
            doc = Document(content)
            return "\n".join([paragraph.text for paragraph in doc.paragraphs])
        except Exception as e:
            raise KnowledgeBaseError(
                message="Failed to process DOCX document",
                details={"error": str(e)},
                error_code="DOCX_PROCESSING_ERROR"
            )
    
    async def _process_xlsx(self, content: bytes) -> str:
        """Process XLSX document with data sanitization."""
        try:
            df = pd.read_excel(content)
            return df.to_string(index=False)
        except Exception as e:
            raise KnowledgeBaseError(
                message="Failed to process XLSX document",
                details={"error": str(e)},
                error_code="XLSX_PROCESSING_ERROR"
            )
    
    async def _process_text(self, content: bytes) -> str:
        """Process text document with encoding handling."""
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return content.decode('latin-1')
            except Exception as e:
                raise KnowledgeBaseError(
                    message="Failed to process text document",
                    details={"error": str(e)},
                    error_code="TEXT_PROCESSING_ERROR"
                )
    
    async def process_document(
        self,
        document_url: str,
        document_type: str,
        assistant_id: str
    ) -> Dict:
        """Process and store document in knowledge base with security validation."""
        start_time = datetime.now()
        
        try:
            # Validate document type
            if document_type not in SUPPORTED_DOCUMENT_TYPES:
                raise KnowledgeBaseError(
                    message=f"Unsupported document type: {document_type}",
                    error_code="INVALID_DOCUMENT_TYPE"
                )
            
            # Download and process document
            content = await self._download_document(document_url)
            processor = self._document_processors[document_type]
            text = await processor(content)
            
            # Generate chunks
            chunks = self.chunk_text(text)
            
            # Generate embeddings in batches
            embeddings = await self._embedding_service.batch_generate_embeddings(
                chunks,
                category="knowledge_base",
                batch_size=BATCH_SIZE
            )
            
            # Store in database
            documents = []
            for chunk, embedding in zip(chunks, embeddings):
                if embedding is not None:
                    doc_id = hashlib.sha256(chunk.encode()).hexdigest()
                    document = {
                        "id": doc_id,
                        "text": chunk,
                        "embedding": embedding.tolist(),
                        "assistant_id": assistant_id,
                        "document_url": document_url,
                        "document_type": document_type,
                        "created_at": datetime.utcnow().isoformat(),
                        "metadata": {
                            "source": document_url,
                            "type": document_type
                        }
                    }
                    documents.append(document)
            
            # Batch store documents
            for i in range(0, len(documents), BATCH_SIZE):
                batch = documents[i:i + BATCH_SIZE]
                for doc in batch:
                    self._db_client.create_document(COLLECTION_NAME, doc, doc["id"])
            
            # Record metrics
            duration = (datetime.now() - start_time).total_seconds()
            document_operations.labels(
                operation_type="process",
                document_type=document_type,
                status="success"
            ).inc()
            processing_latency.labels(
                operation_type="process",
                document_type=document_type
            ).observe(duration)
            
            return {
                "status": "success",
                "document_count": len(documents),
                "processing_time": duration
            }
            
        except Exception as e:
            document_operations.labels(
                operation_type="process",
                document_type=document_type,
                status="error"
            ).inc()
            raise KnowledgeBaseError(
                message="Document processing failed",
                details={"error": str(e)},
                error_code="PROCESSING_ERROR"
            )
    
    async def search_knowledge_base(
        self,
        query: str,
        assistant_id: str,
        limit: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[Dict]:
        """Search knowledge base for relevant content with caching and scoring."""
        try:
            # Generate query embedding
            query_embedding = await self._embedding_service.generate_embedding(
                query,
                category="search"
            )
            
            # Search similar embeddings
            results = await self._embedding_service.search_similar(
                query_embedding,
                category="knowledge_base",
                limit=limit,
                similarity_threshold=similarity_threshold
            )
            
            # Filter by assistant
            filtered_results = [
                result for result in results
                if result.get("metadata", {}).get("assistant_id") == assistant_id
            ]
            
            return filtered_results
            
        except Exception as e:
            raise KnowledgeBaseError(
                message="Knowledge base search failed",
                details={"error": str(e)},
                error_code="SEARCH_ERROR"
            )

# Export service class and constants
__all__ = [
    "KnowledgeBaseService",
    "SUPPORTED_DOCUMENT_TYPES"
]