# Provider configuration for Google Cloud Platform
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Local variables for resource labeling and configuration
locals {
  redis_labels = {
    environment  = var.environment
    managed-by   = "terraform"
    project      = "porfin"
    service      = "cache"
    team         = "platform"
    cost-center  = "infrastructure"
  }

  # Redis configuration parameters based on environment
  redis_configs = {
    # LRU eviction policy for memory management
    maxmemory-policy = "allkeys-lru"
    # Enable keyspace notifications for events
    notify-keyspace-events = "Ex"
    # Connection timeout in seconds
    timeout = "3600"
    # Number of keys to sample for LRU eviction
    maxmemory-samples = "5"
    # TCP keepalive interval in seconds
    tcp-keepalive = "300"
    # Enable active defragmentation for memory optimization
    activedefrag = "yes"
    # Memory fragmentation ratio monitoring
    maxfragmentationmemory-enabled = "yes"
    maxfragmentationmemory-ratio   = "1.3"
  }
}

# Redis Memorystore instance resource
resource "google_redis_instance" "cache" {
  project        = var.project_id
  name           = "${var.redis_instance_name}-${var.environment}"
  memory_size_gb = var.redis_memory_size_gb
  redis_version  = var.redis_version
  
  # High availability configuration
  tier                    = var.redis_tier
  location_id             = var.location_id
  alternative_location_id = var.alternative_location_id
  
  # Network configuration
  authorized_network = var.authorized_network
  connect_mode      = "PRIVATE_SERVICE_ACCESS"
  
  # Redis configuration parameters
  redis_configs = local.redis_configs
  
  # Security configuration
  auth_enabled             = true
  transit_encryption_mode  = "SERVER_AUTHENTICATION"
  
  # Maintenance window configuration
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
      }
    }
  }
  
  # Resource labels
  labels = local.redis_labels

  # Lifecycle management
  lifecycle {
    prevent_destroy = true
    
    ignore_changes = [
      # Prevent unintended maintenance window changes
      maintenance_policy,
      # Preserve customer-managed labels
      labels["customer-managed"]
    ]
  }

  timeouts {
    create = "30m"
    update = "30m"
    delete = "30m"
  }
}

# IAM binding for Redis instance access
resource "google_project_iam_member" "redis_access" {
  project = var.project_id
  role    = "roles/redis.viewer"
  member  = "serviceAccount:${google_redis_instance.cache.persistence_iam_identity}"
}

# Monitoring configuration for Redis metrics
resource "google_monitoring_alert_policy" "redis_memory" {
  project      = var.project_id
  display_name = "Redis Memory Usage - ${var.environment}"
  combiner     = "OR"

  conditions {
    display_name = "Memory Usage Above 80%"
    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${google_redis_instance.cache.name}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.8
    }
  }

  notification_channels = []  # Add notification channels as needed
  
  user_labels = local.redis_labels
}