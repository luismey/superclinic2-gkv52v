# Staging environment variables for Porfin platform
# Version: 1.0.0

# GKE node pool configuration for staging environment
variable "gke_node_pool_config" {
  type = object({
    name = string
    machine_type = string
    min_nodes = number
    max_nodes = number
    disk_size_gb = number
    preemptible = bool
    labels = map(string)
    taints = list(object({
      key = string
      value = string
      effect = string
    }))
    oauth_scopes = list(string)
  })

  description = "GKE node pool configuration for staging cluster"

  default = {
    name = "staging-pool"
    machine_type = "e2-standard-4"  # 4 vCPU, 16GB memory
    min_nodes = 3
    max_nodes = 15
    disk_size_gb = 100
    preemptible = true  # Cost optimization for staging
    labels = {
      environment = "staging"
      pool-type = "general"
    }
    taints = []  # No taints for staging environment
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring"
    ]
  }
}

# Cloud Run service scaling configuration
variable "cloud_run_scaling" {
  type = object({
    min_instances = number
    max_instances = number
    cpu = string
    memory = string
    request_timeout = string
    max_requests_per_container = number
  })

  description = "Cloud Run service scaling parameters for staging"

  default = {
    min_instances = 1
    max_instances = 10
    cpu = "2"  # 2 vCPU cores
    memory = "2Gi"  # 2GB memory
    request_timeout = "300s"
    max_requests_per_container = 1000
  }
}

# Firestore configuration for staging
variable "firestore_location" {
  type        = string
  description = "Firestore database location for staging"
  default     = "us-central1"  # Single region for staging
}

# Redis configuration for staging cache
variable "redis_tier" {
  type        = string
  description = "Redis memory store tier for staging cache"
  default     = "STANDARD_HA"  # High availability for staging

  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be either BASIC or STANDARD_HA."
  }
}

# PubSub message retention configuration
variable "pubsub_message_retention" {
  type        = string
  description = "PubSub message retention duration for staging"
  default     = "24h"  # 24-hour retention for staging

  validation {
    condition     = can(regex("^[0-9]+[hd]$", var.pubsub_message_retention))
    error_message = "Message retention must be specified in hours (h) or days (d)."
  }
}

# Monitoring notification channels
variable "monitoring_notification_channels" {
  type        = list(string)
  description = "Monitoring notification channels for staging alerts"
  default     = []  # Will be populated with actual notification channel IDs
}

# Load balancer configuration for staging
variable "load_balancer_config" {
  type = object({
    ssl_policy = string
    cdn_policy = object({
      cache_mode = string
      default_ttl = string
    })
    security_policy = string
    max_rate_per_endpoint = number
  })

  description = "Load balancer configuration for staging environment"

  default = {
    ssl_policy = "modern"
    cdn_policy = {
      cache_mode = "USE_ORIGIN_HEADERS"
      default_ttl = "3600s"
    }
    security_policy = "staging-security-policy"
    max_rate_per_endpoint = 1000  # Requests per endpoint
  }
}

# Backup configuration for staging
variable "backup_config" {
  type = object({
    enabled = bool
    schedule = string
    retention_days = number
  })

  description = "Backup configuration for staging environment"

  default = {
    enabled = true
    schedule = "0 0 * * *"  # Daily backups at midnight
    retention_days = 7  # One week retention for staging
  }
}

# Resource quotas for staging environment
variable "resource_quotas" {
  type = object({
    cpu_limit = string
    memory_limit = string
    pod_limit = number
    persistent_volume_limit = number
  })

  description = "Resource quotas for staging namespace"

  default = {
    cpu_limit = "50"
    memory_limit = "100Gi"
    pod_limit = 500
    persistent_volume_limit = 100
  }
}

# Network configuration for staging
variable "network_config" {
  type = object({
    subnet_cidr = string
    pod_cidr = string
    service_cidr = string
    master_authorized_networks = list(string)
  })

  description = "Network configuration for staging environment"

  default = {
    subnet_cidr = "10.10.0.0/20"
    pod_cidr = "10.20.0.0/16"
    service_cidr = "10.30.0.0/16"
    master_authorized_networks = ["0.0.0.0/0"]  # Allow all for staging
  }
}