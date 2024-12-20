# Terraform variables for Porfin platform infrastructure
# Version: 1.0.0

# Core project variables
variable "project_id" {
  type        = string
  description = "The GCP project ID where resources will be deployed"
}

variable "region" {
  type        = string
  description = "The GCP region for resource deployment"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod/dr)"
  
  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr."
  }
}

# GKE cluster configuration
variable "gke_config" {
  type = object({
    cluster_name     = string
    node_pools = list(object({
      name          = string
      machine_type  = string
      min_count     = number
      max_count     = number
      disk_size_gb  = number
      preemptible   = bool
    }))
    min_master_version = string
    network_policy_enabled = bool
    pod_security_policy_enabled = bool
    max_pods_per_node = number
    enable_autopilot = bool
  })
  description = "GKE cluster configuration settings"

  validation {
    condition     = var.gke_config.max_pods_per_node <= 1000
    error_message = "Maximum pods per node cannot exceed 1000."
  }
}

# Load balancer configuration
variable "load_balancer_config" {
  type = object({
    name = string
    type = string
    ssl_certificates = list(string)
    enable_cdn = bool
    security_policy = string
    max_rps = number
    connection_draining_timeout_sec = number
  })
  description = "Load balancer configuration supporting high throughput"

  validation {
    condition     = var.load_balancer_config.max_rps <= 100000
    error_message = "Maximum requests per second cannot exceed 100k."
  }
}

# Firestore configuration
variable "firestore_config" {
  type = object({
    location_id = string
    database_type = string
    enable_multi_region = bool
    backup_schedule = string
    retention_days = number
    max_capacity = number
  })
  description = "Firestore configuration with multi-region support"

  validation {
    condition     = var.firestore_config.max_capacity <= 10000
    error_message = "Maximum database capacity cannot exceed 10TB."
  }
}

# Redis configuration
variable "redis_config" {
  type = object({
    tier = string
    memory_size_gb = number
    version = string
    auth_enabled = bool
    transit_encryption_mode = string
    maintenance_policy = object({
      day = string
      hour = number
    })
  })
  description = "Redis cache configuration for session management"

  validation {
    condition     = var.redis_config.memory_size_gb <= 300
    error_message = "Redis memory size cannot exceed 300GB."
  }
}

# PubSub configuration
variable "pubsub_config" {
  type = object({
    topic_configs = list(object({
      name = string
      message_retention_duration = string
      message_storage_policy = object({
        allowed_persistence_regions = list(string)
      })
      max_message_size = number
    }))
    subscription_configs = list(object({
      name = string
      ack_deadline_seconds = number
      message_retention_duration = string
      retain_acked_messages = bool
      enable_message_ordering = bool
    }))
  })
  description = "PubSub configuration for message processing"

  validation {
    condition     = length(var.pubsub_config.topic_configs) > 0
    error_message = "At least one PubSub topic must be configured."
  }
}

# Network configuration
variable "network_config" {
  type = object({
    network_name = string
    subnet_configs = list(object({
      name = string
      ip_cidr_range = string
      region = string
      secondary_ip_ranges = map(string)
    }))
    enable_private_google_access = bool
    enable_flow_logs = bool
    firewall_rules = list(object({
      name = string
      direction = string
      priority = number
      ranges = list(string)
      ports = list(string)
    }))
  })
  description = "Network configuration including VPC and security"

  validation {
    condition     = length(var.network_config.subnet_configs) > 0
    error_message = "At least one subnet must be configured."
  }
}

# Monitoring configuration
variable "monitoring_config" {
  type = object({
    notification_channels = list(object({
      type = string
      labels = map(string)
    }))
    alert_policies = list(object({
      display_name = string
      conditions = list(object({
        display_name = string
        threshold = number
        duration = string
      }))
      notification_channels = list(string)
    }))
    uptime_check_configs = list(object({
      display_name = string
      period = string
      timeout = string
      content_matchers = list(object({
        content = string
        matcher = string
      }))
    }))
  })
  description = "Monitoring and alerting configuration"

  validation {
    condition     = length(var.monitoring_config.alert_policies) > 0
    error_message = "At least one alert policy must be configured."
  }
}

# Backup configuration
variable "backup_config" {
  type = object({
    schedule = string
    retention_days = number
    geo_redundant = bool
    backup_regions = list(string)
    encryption_key = string
  })
  description = "Backup and disaster recovery configuration"

  validation {
    condition     = var.backup_config.retention_days >= 7
    error_message = "Backup retention must be at least 7 days."
  }
}