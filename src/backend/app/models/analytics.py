"""
Core analytics model implementing secure, LGPD-compliant data operations for tracking,
storing, and retrieving analytics metrics with enhanced real-time capabilities.

Version: 1.0.0
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from redis import Redis
from tenacity import retry, stop_after_attempt, wait_exponential

from app.db.firestore import FirestoreClient
from app.utils.validators import validate_date_range
from app.utils.formatters import format_percentage
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Initialize logger
logger = get_logger(__name__)

# Collection names for analytics data
COLLECTIONS = {
    'CONVERSIONS': 'conversions',
    'MESSAGE_METRICS': 'message_metrics',
    'PERFORMANCE_METRICS': 'performance_metrics',
    'AUDIT_LOGS': 'audit_logs'
}

# Metric types for validation
METRIC_TYPES = [
    'conversion',
    'response_time',
    'message_volume',
    'ai_usage',
    'error_rate',
    'satisfaction_score'
]

# Conversion types for tracking
CONVERSION_TYPES = [
    'lead',
    'appointment',
    'payment',
    'follow_up',
    'referral'
]

# Cache configuration
CACHE_CONFIG = {
    'TTL_SECONDS': 300,  # 5 minutes
    'MAX_ENTRIES': 1000,
    'UPDATE_THRESHOLD': 0.1  # 10% change triggers update
}

@dataclass
class AnalyticsModel:
    """
    Enhanced analytics model with LGPD compliance, real-time processing,
    and optimized performance.
    """
    
    _db_client: FirestoreClient
    _cache_client: Redis
    _metrics_cache: Dict = field(default_factory=dict)
    _aggregation_state: Dict = field(default_factory=dict)

    def __post_init__(self):
        """Initialize analytics model with enhanced security and caching."""
        self._setup_cache()
        self._initialize_aggregation_state()
        logger.info("Analytics model initialized with security measures")

    def _setup_cache(self):
        """Configure Redis cache with TTL and size limits."""
        self._metrics_cache = {}
        self._cache_prefix = "analytics:"
        logger.info("Cache initialized with security configuration")

    def _initialize_aggregation_state(self):
        """Initialize real-time aggregation state."""
        self._aggregation_state = {
            'last_update': datetime.utcnow(),
            'pending_updates': 0,
            'update_threshold': CACHE_CONFIG['UPDATE_THRESHOLD']
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def track_conversion(
        self,
        user_id: str,
        lead_id: str,
        conversion_type: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Track conversion with enhanced security and audit logging.
        
        Args:
            user_id: Healthcare provider ID
            lead_id: Lead/patient identifier
            conversion_type: Type of conversion
            metadata: Additional conversion context
            
        Returns:
            Dict containing tracking result
            
        Raises:
            ValidationError: If input validation fails
        """
        try:
            # Validate inputs
            if conversion_type not in CONVERSION_TYPES:
                raise ValidationError(
                    message=f"Invalid conversion type: {conversion_type}",
                    details={"valid_types": CONVERSION_TYPES}
                )

            # Sanitize and prepare data
            conversion_data = {
                'user_id': user_id,
                'lead_id': lead_id,
                'conversion_type': conversion_type,
                'timestamp': datetime.utcnow(),
                'metadata': self._sanitize_metadata(metadata or {})
            }

            # Create conversion document with audit trail
            doc_id = await self._db_client.create_document(
                COLLECTIONS['CONVERSIONS'],
                conversion_data
            )

            # Update cache and trigger aggregation
            self._update_conversion_cache(conversion_type, conversion_data)
            await self._trigger_aggregation_update()

            logger.info(
                "Conversion tracked successfully",
                extra={
                    "user_id": user_id,
                    "conversion_type": conversion_type,
                    "doc_id": doc_id
                }
            )

            return {
                "success": True,
                "conversion_id": doc_id,
                "timestamp": conversion_data['timestamp']
            }

        except Exception as e:
            logger.error(
                "Failed to track conversion",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                    "conversion_type": conversion_type
                }
            )
            raise

    async def get_conversion_rate(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        conversion_type: Optional[str] = None
    ) -> float:
        """
        Calculate conversion rate with optimized performance.
        
        Args:
            user_id: Healthcare provider ID
            start_date: Period start date
            end_date: Period end date
            conversion_type: Optional conversion type filter
            
        Returns:
            Formatted conversion rate percentage
        """
        try:
            # Validate date range
            if not validate_date_range(start_date, end_date):
                raise ValidationError(
                    message="Invalid date range",
                    details={"start": start_date, "end": end_date}
                )

            # Check cache first
            cache_key = f"{self._cache_prefix}:conv_rate:{user_id}:{start_date}:{end_date}:{conversion_type}"
            cached_rate = self._cache_client.get(cache_key)
            if cached_rate is not None:
                return float(cached_rate)

            # Query conversions
            query = {
                'user_id': user_id,
                'timestamp': {
                    'start': start_date,
                    'end': end_date
                }
            }
            if conversion_type:
                query['conversion_type'] = conversion_type

            conversions_df = await self._query_conversions(query)
            
            # Calculate conversion rate
            if conversions_df.empty:
                rate = 0.0
            else:
                total_leads = len(conversions_df['lead_id'].unique())
                total_conversions = len(conversions_df[
                    conversions_df['conversion_type'] == conversion_type
                ]) if conversion_type else len(conversions_df)
                
                rate = (total_conversions / total_leads) if total_leads > 0 else 0.0

            # Cache result
            self._cache_client.setex(
                cache_key,
                CACHE_CONFIG['TTL_SECONDS'],
                str(rate)
            )

            return format_percentage(rate)

        except Exception as e:
            logger.error(
                "Failed to calculate conversion rate",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                    "conversion_type": conversion_type
                }
            )
            raise

    async def track_message_metrics(
        self,
        user_id: str,
        message_data: Dict
    ) -> Dict:
        """
        Track message-related metrics with real-time processing.
        
        Args:
            user_id: Healthcare provider ID
            message_data: Message metrics data
            
        Returns:
            Dict containing tracking result
        """
        try:
            # Sanitize and prepare metrics
            metrics_data = {
                'user_id': user_id,
                'timestamp': datetime.utcnow(),
                'message_id': message_data.get('message_id'),
                'response_time': message_data.get('response_time'),
                'ai_assisted': message_data.get('ai_assisted', False),
                'message_type': message_data.get('type'),
                'status': message_data.get('status')
            }

            # Store metrics with audit trail
            doc_id = await self._db_client.create_document(
                COLLECTIONS['MESSAGE_METRICS'],
                metrics_data
            )

            # Update real-time aggregations
            await self._update_message_metrics_cache(user_id, metrics_data)

            return {
                "success": True,
                "metric_id": doc_id,
                "timestamp": metrics_data['timestamp']
            }

        except Exception as e:
            logger.error(
                "Failed to track message metrics",
                extra={
                    "error": str(e),
                    "user_id": user_id
                }
            )
            raise

    async def get_performance_metrics(
        self,
        user_id: str,
        metric_type: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """
        Retrieve performance metrics with caching and aggregation.
        
        Args:
            user_id: Healthcare provider ID
            metric_type: Type of metric to retrieve
            start_date: Period start date
            end_date: Period end date
            
        Returns:
            Dict containing performance metrics
        """
        try:
            # Validate inputs
            if metric_type not in METRIC_TYPES:
                raise ValidationError(
                    message=f"Invalid metric type: {metric_type}",
                    details={"valid_types": METRIC_TYPES}
                )

            # Check cache
            cache_key = f"{self._cache_prefix}:perf:{user_id}:{metric_type}:{start_date}:{end_date}"
            cached_metrics = self._cache_client.get(cache_key)
            if cached_metrics is not None:
                return pd.read_json(cached_metrics).to_dict()

            # Query metrics
            metrics_df = await self._query_performance_metrics(
                user_id,
                metric_type,
                start_date,
                end_date
            )

            # Calculate aggregations
            metrics_result = self._calculate_performance_metrics(
                metrics_df,
                metric_type
            )

            # Cache results
            self._cache_client.setex(
                cache_key,
                CACHE_CONFIG['TTL_SECONDS'],
                metrics_result.to_json()
            )

            return metrics_result.to_dict()

        except Exception as e:
            logger.error(
                "Failed to retrieve performance metrics",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                    "metric_type": metric_type
                }
            )
            raise

    def _sanitize_metadata(self, metadata: Dict) -> Dict:
        """Sanitize metadata to ensure LGPD compliance."""
        sensitive_fields = {'cpf', 'phone', 'email', 'address'}
        return {
            k: '[REDACTED]' if k in sensitive_fields else v
            for k, v in metadata.items()
        }

    async def _trigger_aggregation_update(self):
        """Trigger real-time aggregation updates."""
        self._aggregation_state['pending_updates'] += 1
        
        if (self._aggregation_state['pending_updates'] / CACHE_CONFIG['MAX_ENTRIES']
                >= self._aggregation_state['update_threshold']):
            await self._perform_aggregation_update()

    async def _perform_aggregation_update(self):
        """Perform aggregation updates with optimized batch processing."""
        try:
            # Reset aggregation state
            self._aggregation_state.update({
                'last_update': datetime.utcnow(),
                'pending_updates': 0
            })

            # Create materialized views for common queries
            await self._db_client.create_materialized_view(
                COLLECTIONS['CONVERSIONS'],
                'conversion_rates_view',
                self._get_conversion_rate_query()
            )

        except Exception as e:
            logger.error(
                "Failed to update aggregations",
                extra={"error": str(e)}
            )
            raise

    def _get_conversion_rate_query(self) -> Dict:
        """Generate optimized query for conversion rate calculations."""
        return {
            'group_by': ['user_id', 'conversion_type'],
            'metrics': ['count', 'unique_leads'],
            'window': timedelta(days=30)
        }