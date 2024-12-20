"""
Analytics endpoints module for the Porfin platform.

Provides REST API endpoints for retrieving business metrics, performance analytics,
and generating reports with enhanced security, caching, and Brazilian locale support.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime, timedelta
import locale
from typing import Dict, Optional, Any
import zoneinfo

# Third-party imports - fastapi v0.100.0
from fastapi import APIRouter, Depends, Query, HTTPException, status
from redis import Redis  # redis v4.5.0

# Internal imports
from app.services.analytics.metrics import MetricsService
from app.schemas.analytics import (
    BaseAnalyticsSchema,
    ConversionType,
    MetricType
)
from app.core.security import verify_token
from app.core.exceptions import ValidationError
from app.utils.brazilian import format_currency, format_percentage
from app.utils.datetime import BRAZIL_TIMEZONE, format_brazil_datetime
from app.core.logging import get_logger

# Initialize router with prefix and tags
router = APIRouter(prefix="/analytics", tags=["analytics"])

# Initialize services and utilities
metrics_service = MetricsService()
logger = get_logger(__name__)

# Configure Brazilian locale
try:
    locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
except locale.Error:
    logger.warning("Brazilian locale not available, falling back to default")

# Redis client for caching
redis_client = Redis(
    host="localhost",
    port=6379,
    db=0,
    decode_responses=True
)

CACHE_TTL = 300  # 5 minutes cache

@router.get("/conversions")
async def get_conversion_metrics(
    user_id: str,
    start_date: datetime = Query(..., description="Start date for metrics"),
    end_date: datetime = Query(..., description="End date for metrics"),
    conversion_type: ConversionType = Query(..., description="Type of conversion to analyze"),
    force_refresh: bool = Query(False, description="Force cache refresh"),
    token: str = Depends(verify_token)
) -> Dict[str, Any]:
    """
    Retrieve conversion rate metrics with Brazilian locale support and caching.
    
    Args:
        user_id: User ID to calculate metrics for
        start_date: Start date for metric calculation
        end_date: End date for metric calculation
        conversion_type: Type of conversion to analyze
        force_refresh: Whether to force cache refresh
        token: JWT token for authentication
        
    Returns:
        Dict containing conversion metrics with Brazilian formatting
        
    Raises:
        ValidationError: If date range or parameters are invalid
        HTTPException: If authentication fails
    """
    try:
        # Convert dates to Brazil timezone
        start_date = start_date.astimezone(BRAZIL_TIMEZONE)
        end_date = end_date.astimezone(BRAZIL_TIMEZONE)
        
        # Validate date range
        BaseAnalyticsSchema.validate_date_range(start_date, end_date)
        
        # Check cache if not forcing refresh
        cache_key = f"conv_metrics:{user_id}:{conversion_type}:{start_date.date()}:{end_date.date()}"
        if not force_refresh:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                logger.info("Returning cached conversion metrics", 
                          extra={"user_id": user_id, "cache_hit": True})
                return eval(cached_data)
        
        # Calculate metrics
        metrics = metrics_service.calculate_conversion_metrics(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            conversion_type=conversion_type.value
        )
        
        # Format values with Brazilian locale
        formatted_metrics = {
            "conversion_rate": format_percentage(metrics["conversion_rate"]),
            "total_conversions": metrics["total_conversions"],
            "total_attempts": metrics["total_attempts"],
            "trend": metrics["trend"],
            "confidence_interval": (
                format_percentage(metrics["confidence_interval"][0]),
                format_percentage(metrics["confidence_interval"][1])
            ),
            "daily_rates": {
                date.strftime("%d/%m/%Y"): format_percentage(rate)
                for date, rate in metrics["daily_rates"].items()
            },
            "period": {
                "start": format_brazil_datetime(start_date),
                "end": format_brazil_datetime(end_date)
            }
        }
        
        # Add ROI impact if available
        if metrics.get("roi_impact"):
            formatted_metrics["roi_impact"] = {
                "total_value": format_currency(metrics["roi_impact"]["total_value"]),
                "average_value": format_currency(metrics["roi_impact"]["average_value"])
            }
        
        # Cache the formatted results
        redis_client.setex(
            cache_key,
            CACHE_TTL,
            str(formatted_metrics)
        )
        
        logger.info(
            "Conversion metrics calculated successfully",
            extra={
                "user_id": user_id,
                "conversion_type": conversion_type.value,
                "metrics": formatted_metrics
            }
        )
        
        return formatted_metrics
        
    except ValidationError as e:
        logger.error(
            "Validation error in conversion metrics",
            extra={"error": str(e), "user_id": user_id}
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Error calculating conversion metrics",
            extra={"error": str(e), "user_id": user_id},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate conversion metrics"
        )

@router.get("/ai-performance")
async def get_ai_performance(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    user_id: Optional[str] = None,
    token: str = Depends(verify_token)
) -> Dict[str, Any]:
    """
    Retrieve AI assistant performance metrics with response time analysis.
    
    Args:
        start_date: Start date for analysis
        end_date: End date for analysis
        user_id: Optional user ID to filter metrics
        token: JWT token for authentication
        
    Returns:
        Dict containing AI performance metrics and analysis
    """
    try:
        # Convert dates to Brazil timezone
        start_date = start_date.astimezone(BRAZIL_TIMEZONE)
        end_date = end_date.astimezone(BRAZIL_TIMEZONE)
        
        # Validate date range
        BaseAnalyticsSchema.validate_date_range(start_date, end_date)
        
        # Calculate metrics
        metrics = metrics_service.analyze_ai_performance(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id
        )
        
        # Format response times
        formatted_metrics = {
            "response_time": {
                "average_ms": round(metrics["response_time_avg"] * 1000, 2),
                "p95_ms": round(metrics["response_time_p95"] * 1000, 2)
            },
            "accuracy": format_percentage(metrics["accuracy_rate"]),
            "total_interactions": metrics["total_interactions"],
            "unique_users": metrics["unique_users"],
            "performance_by_type": {
                type_name: {
                    "mean_response_ms": round(stats["mean"] * 1000, 2),
                    "total_interactions": stats["count"],
                    "std_dev_ms": round(stats["std"] * 1000, 2)
                }
                for type_name, stats in metrics["performance_by_type"].items()
            }
        }
        
        return formatted_metrics
        
    except Exception as e:
        logger.error("Error analyzing AI performance", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze AI performance"
        )

@router.get("/response-metrics")
async def get_response_metrics(
    user_id: str,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    token: str = Depends(verify_token)
) -> Dict[str, Any]:
    """
    Retrieve message response metrics with Brazilian time formatting.
    
    Args:
        user_id: User ID to calculate metrics for
        start_date: Start date for calculation
        end_date: End date for calculation
        token: JWT token for authentication
        
    Returns:
        Dict containing response metrics with Brazilian formatting
    """
    try:
        # Convert dates to Brazil timezone
        start_date = start_date.astimezone(BRAZIL_TIMEZONE)
        end_date = end_date.astimezone(BRAZIL_TIMEZONE)
        
        # Validate date range
        BaseAnalyticsSchema.validate_date_range(start_date, end_date)
        
        # Calculate metrics
        metrics = metrics_service.calculate_response_metrics(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Format metrics with Brazilian locale
        formatted_metrics = {
            "response_time": {
                "average_seconds": round(metrics["average_response_time"], 2),
                "p95_seconds": round(metrics["response_time_p95"], 2)
            },
            "total_messages": metrics["total_messages"],
            "response_rate": format_percentage(metrics["response_rate"]),
            "messages_by_type": metrics["messages_by_type"],
            "hourly_distribution": {
                f"{hour:02d}:00": count
                for hour, count in metrics["hourly_distribution"].items()
            }
        }
        
        return formatted_metrics
        
    except Exception as e:
        logger.error(
            "Error calculating response metrics",
            extra={"error": str(e), "user_id": user_id}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate response metrics"
        )

@router.get("/performance")
async def get_performance_metrics(
    metric_type: MetricType = Query(...),
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    group_by: Optional[str] = None,
    token: str = Depends(verify_token)
) -> Dict[str, Any]:
    """
    Retrieve platform performance metrics with aggregation support.
    
    Args:
        metric_type: Type of metrics to aggregate
        start_date: Start date for aggregation
        end_date: End date for aggregation
        group_by: Optional grouping field
        token: JWT token for authentication
        
    Returns:
        Dict containing aggregated performance metrics
    """
    try:
        # Convert dates to Brazil timezone
        start_date = start_date.astimezone(BRAZIL_TIMEZONE)
        end_date = end_date.astimezone(BRAZIL_TIMEZONE)
        
        # Validate date range
        BaseAnalyticsSchema.validate_date_range(start_date, end_date)
        
        # Calculate metrics
        metrics = metrics_service.aggregate_performance_metrics(
            metric_type=metric_type.value,
            start_date=start_date,
            end_date=end_date,
            group_by=group_by
        )
        
        # Format metrics
        formatted_metrics = {
            "summary": {
                "average": format_number(metrics["average_value"]),
                "median": format_number(metrics["median_value"]),
                "min": format_number(metrics["min_value"]),
                "max": format_number(metrics["max_value"]),
                "std_deviation": format_number(metrics["std_deviation"])
            },
            "total_records": metrics["total_records"],
            "daily_trends": {
                date.strftime("%d/%m/%Y"): format_number(value)
                for date, value in metrics["daily_trends"].items()
            }
        }
        
        # Add grouped metrics if available
        if metrics.get("grouped_metrics"):
            formatted_metrics["grouped_metrics"] = {
                group: {
                    "mean": format_number(stats["mean"]),
                    "median": format_number(stats["median"]),
                    "min": format_number(stats["min"]),
                    "max": format_number(stats["max"]),
                    "count": stats["count"]
                }
                for group, stats in metrics["grouped_metrics"].items()
            }
        
        return formatted_metrics
        
    except Exception as e:
        logger.error(
            "Error calculating performance metrics",
            extra={"error": str(e), "metric_type": metric_type.value}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate performance metrics"
        )