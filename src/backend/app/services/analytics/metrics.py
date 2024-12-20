"""
Core analytics metrics service for the Porfin platform.
Provides high-performance calculation and analysis of business and performance metrics
with optimized caching, batch processing, and real-time analytics capabilities.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Any
import logging

# Third-party imports
import pandas as pd  # version: ^2.0.0
import numpy as np  # version: ^1.24.0
from cachetools import TTLCache  # version: ^5.0.0

# Internal imports
from app.schemas.analytics import (
    BaseAnalyticsSchema,
    ConversionSchema,
    MessageMetricsSchema,
    MetricType
)
from app.db.firestore import db
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

# Configure logger
logger = get_logger(__name__)

# Constants
METRIC_COLLECTIONS = {
    'conversions': 'analytics_conversions',
    'messages': 'analytics_messages',
    'performance': 'analytics_performance',
    'ai_metrics': 'analytics_ai_performance'
}

METRIC_CACHE_TTL = 300  # 5 minutes
BATCH_SIZE = 100
MAX_CACHE_SIZE = 1000
RETRY_ATTEMPTS = 3

class MetricsService:
    """
    Enhanced service class for calculating and processing analytics metrics with 
    optimized caching and batch processing.
    """

    def __init__(self, cache_ttl: int = METRIC_CACHE_TTL, 
                 max_cache_size: int = MAX_CACHE_SIZE):
        """
        Initialize metrics service with enhanced caching and monitoring.

        Args:
            cache_ttl: Cache time-to-live in seconds
            max_cache_size: Maximum cache size
        """
        # Initialize TTL cache for metrics
        self._metric_cache = TTLCache(maxsize=max_cache_size, ttl=cache_ttl)
        self._last_cache_refresh = datetime.utcnow()
        self._performance_metrics = {}

    def calculate_conversion_metrics(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        conversion_type: str
    ) -> Dict[str, Any]:
        """
        Calculate conversion rates and related metrics with batch processing.

        Args:
            user_id: User ID to calculate metrics for
            start_date: Start date for metric calculation
            end_date: End date for metric calculation
            conversion_type: Type of conversion to analyze

        Returns:
            Dict containing conversion metrics, trends and confidence intervals

        Raises:
            ValidationError: If input parameters are invalid
        """
        try:
            # Validate input parameters
            ConversionSchema.validate_conversion_type(conversion_type)
            BaseAnalyticsSchema.validate_date_range(start_date, end_date)

            # Check cache first
            cache_key = f"conv_{user_id}_{conversion_type}_{start_date.date()}_{end_date.date()}"
            if cache_key in self._metric_cache:
                logger.info("Returning cached conversion metrics", 
                          extra={"cache_key": cache_key})
                return self._metric_cache[cache_key]

            # Query conversion data in batches
            conversion_data = []
            query = (db.query_documents(METRIC_COLLECTIONS['conversions'])
                    .where('user_id', '==', user_id)
                    .where('conversion_type', '==', conversion_type)
                    .where('timestamp', '>=', start_date)
                    .where('timestamp', '<=', end_date))

            # Process in batches for performance
            for batch in query.stream(batch_size=BATCH_SIZE):
                conversion_data.extend([doc.to_dict() for doc in batch])

            # Convert to pandas DataFrame for efficient analysis
            df = pd.DataFrame(conversion_data)
            if df.empty:
                return {
                    'conversion_rate': 0.0,
                    'total_conversions': 0,
                    'trend': 'neutral',
                    'confidence_interval': (0.0, 0.0)
                }

            # Calculate core metrics
            total_attempts = len(df)
            successful_conversions = len(df[df['value'] > 0])
            conversion_rate = (successful_conversions / total_attempts) * 100

            # Calculate trend
            df['date'] = pd.to_datetime(df['timestamp'])
            df.set_index('date', inplace=True)
            daily_rates = df.resample('D')['value'].mean().fillna(0)
            trend = 'increasing' if daily_rates.is_monotonic_increasing else \
                   'decreasing' if daily_rates.is_monotonic_decreasing else 'neutral'

            # Calculate confidence interval using numpy
            confidence_level = 0.95
            z_score = 1.96  # 95% confidence
            std_error = np.sqrt((conversion_rate * (100 - conversion_rate)) / total_attempts)
            margin_of_error = z_score * std_error
            ci_lower = max(0, conversion_rate - margin_of_error)
            ci_upper = min(100, conversion_rate + margin_of_error)

            # Calculate ROI impact if available
            roi_impact = None
            if 'conversion_value' in df.columns:
                total_value = df['conversion_value'].sum()
                roi_impact = {
                    'total_value': float(total_value),
                    'average_value': float(total_value / successful_conversions) if successful_conversions > 0 else 0.0
                }

            # Prepare result
            result = {
                'conversion_rate': round(float(conversion_rate), 2),
                'total_conversions': successful_conversions,
                'total_attempts': total_attempts,
                'trend': trend,
                'confidence_interval': (round(float(ci_lower), 2), round(float(ci_upper), 2)),
                'daily_rates': daily_rates.to_dict(),
                'roi_impact': roi_impact,
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            }

            # Cache the result
            self._metric_cache[cache_key] = result
            
            # Log success
            logger.info(
                "Conversion metrics calculated successfully",
                extra={
                    "user_id": user_id,
                    "conversion_type": conversion_type,
                    "metrics": {
                        "conversion_rate": result['conversion_rate'],
                        "total_conversions": result['total_conversions']
                    }
                }
            )

            return result

        except Exception as e:
            logger.error(
                "Error calculating conversion metrics",
                extra={
                    "error": str(e),
                    "user_id": user_id,
                    "conversion_type": conversion_type
                }
            )
            raise ValidationError(
                message="Failed to calculate conversion metrics",
                details={"error": str(e)}
            )

    def analyze_ai_performance(
        self,
        start_date: datetime,
        end_date: datetime,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze AI assistant performance metrics with statistical analysis.

        Args:
            start_date: Start date for analysis
            end_date: End date for analysis
            user_id: Optional user ID to filter metrics

        Returns:
            Dict containing AI performance metrics and analysis
        """
        try:
            # Validate date range
            BaseAnalyticsSchema.validate_date_range(start_date, end_date)

            # Build query
            query = db.query_documents(METRIC_COLLECTIONS['ai_metrics'])\
                     .where('timestamp', '>=', start_date)\
                     .where('timestamp', '<=', end_date)

            if user_id:
                query = query.where('user_id', '==', user_id)

            # Process data in batches
            ai_data = []
            for batch in query.stream(batch_size=BATCH_SIZE):
                ai_data.extend([doc.to_dict() for doc in batch])

            df = pd.DataFrame(ai_data)
            if df.empty:
                return {
                    'response_time_avg': 0.0,
                    'accuracy_rate': 0.0,
                    'total_interactions': 0
                }

            # Calculate performance metrics
            metrics = {
                'response_time_avg': float(df['response_time'].mean()),
                'response_time_p95': float(df['response_time'].quantile(0.95)),
                'accuracy_rate': float((df['correct_responses'].sum() / len(df)) * 100),
                'total_interactions': len(df),
                'unique_users': len(df['user_id'].unique()),
                'performance_by_type': df.groupby('interaction_type')['response_time'].agg([
                    'mean', 'count', 'std'
                ]).to_dict('index')
            }

            return metrics

        except Exception as e:
            logger.error(
                "Error analyzing AI performance",
                extra={"error": str(e)}
            )
            raise ValidationError(
                message="Failed to analyze AI performance",
                details={"error": str(e)}
            )

    def calculate_response_metrics(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Calculate message response metrics with performance analysis.

        Args:
            user_id: User ID to calculate metrics for
            start_date: Start date for calculation
            end_date: End date for calculation

        Returns:
            Dict containing response metrics and analysis
        """
        try:
            # Validate parameters
            BaseAnalyticsSchema.validate_date_range(start_date, end_date)

            # Query message data
            messages = []
            query = (db.query_documents(METRIC_COLLECTIONS['messages'])
                    .where('user_id', '==', user_id)
                    .where('timestamp', '>=', start_date)
                    .where('timestamp', '<=', end_date))

            for batch in query.stream(batch_size=BATCH_SIZE):
                messages.extend([doc.to_dict() for doc in batch])

            df = pd.DataFrame(messages)
            if df.empty:
                return {
                    'average_response_time': 0.0,
                    'total_messages': 0,
                    'response_rate': 0.0
                }

            # Calculate metrics
            metrics = {
                'average_response_time': float(df['response_time'].mean()),
                'response_time_p95': float(df['response_time'].quantile(0.95)),
                'total_messages': len(df),
                'response_rate': float((df['responded'].sum() / len(df)) * 100),
                'messages_by_type': df['message_type'].value_counts().to_dict(),
                'hourly_distribution': df.groupby(df['timestamp'].dt.hour)['message_type'].count().to_dict()
            }

            return metrics

        except Exception as e:
            logger.error(
                "Error calculating response metrics",
                extra={
                    "error": str(e),
                    "user_id": user_id
                }
            )
            raise ValidationError(
                message="Failed to calculate response metrics",
                details={"error": str(e)}
            )

    def aggregate_performance_metrics(
        self,
        metric_type: str,
        start_date: datetime,
        end_date: datetime,
        group_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Aggregate and analyze platform performance metrics.

        Args:
            metric_type: Type of metrics to aggregate
            start_date: Start date for aggregation
            end_date: End date for aggregation
            group_by: Optional grouping field

        Returns:
            Dict containing aggregated performance metrics
        """
        try:
            # Validate parameters
            BaseAnalyticsSchema.validate_metric_type(metric_type)
            BaseAnalyticsSchema.validate_date_range(start_date, end_date)

            # Query performance data
            query = (db.query_documents(METRIC_COLLECTIONS['performance'])
                    .where('metric_type', '==', metric_type)
                    .where('timestamp', '>=', start_date)
                    .where('timestamp', '<=', end_date))

            performance_data = []
            for batch in query.stream(batch_size=BATCH_SIZE):
                performance_data.extend([doc.to_dict() for doc in batch])

            df = pd.DataFrame(performance_data)
            if df.empty:
                return {
                    'average_value': 0.0,
                    'total_records': 0
                }

            # Calculate basic aggregations
            agg_metrics = {
                'average_value': float(df['value'].mean()),
                'median_value': float(df['value'].median()),
                'min_value': float(df['value'].min()),
                'max_value': float(df['value'].max()),
                'std_deviation': float(df['value'].std()),
                'total_records': len(df)
            }

            # Add grouped metrics if requested
            if group_by and group_by in df.columns:
                grouped_stats = df.groupby(group_by)['value'].agg([
                    'mean', 'median', 'min', 'max', 'count'
                ]).to_dict('index')
                agg_metrics['grouped_metrics'] = grouped_stats

            # Add trend analysis
            df['date'] = pd.to_datetime(df['timestamp'])
            trend_data = df.set_index('date')['value'].resample('D').mean()
            agg_metrics['daily_trends'] = trend_data.to_dict()

            return agg_metrics

        except Exception as e:
            logger.error(
                "Error aggregating performance metrics",
                extra={
                    "error": str(e),
                    "metric_type": metric_type
                }
            )
            raise ValidationError(
                message="Failed to aggregate performance metrics",
                details={"error": str(e)}
            )