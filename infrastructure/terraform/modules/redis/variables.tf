# GCP Project Configuration
variable "project_id" {
  type        = string
  description = "The GCP project ID where Redis instance will be deployed"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be a valid GCP project ID between 6 and 30 characters, starting with a letter and containing only lowercase letters, numbers, and hyphens."
  }
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Environment name (staging/prod) for resource naming and tagging"

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be either 'staging' or 'prod'."
  }
}

# Redis Instance Configuration
variable "redis_instance_name" {
  type        = string
  description = "Base name for the Redis Memorystore instance"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,39}$", var.redis_instance_name))
    error_message = "Redis instance name must be between 3 and 40 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "redis_memory_size_gb" {
  type        = number
  description = "Memory size in GB for Redis instance, minimum 5GB for production workloads"
  default     = 5

  validation {
    condition     = var.redis_memory_size_gb >= 1 && var.redis_memory_size_gb <= 300
    error_message = "Redis memory size must be between 1 and 300 GB."
  }

  validation {
    condition     = floor(var.redis_memory_size_gb) == var.redis_memory_size_gb
    error_message = "Redis memory size must be a whole number."
  }
}

variable "redis_version" {
  type        = string
  description = "Redis version to be used, defaults to Redis 6.x for optimal performance and feature support"
  default     = "REDIS_6_X"

  validation {
    condition     = contains(["REDIS_6_X", "REDIS_5_0", "REDIS_4_0"], var.redis_version)
    error_message = "Redis version must be one of: REDIS_6_X, REDIS_5_0, REDIS_4_0."
  }
}

variable "redis_tier" {
  type        = string
  description = "Service tier for Redis instance, STANDARD_HA recommended for production"
  default     = "STANDARD_HA"

  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be either 'BASIC' or 'STANDARD_HA'."
  }
}

# Location Configuration
variable "location_id" {
  type        = string
  description = "The zone where the Redis instance will be deployed, should be in same region as application"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+-[0-9]$", var.location_id))
    error_message = "Location ID must be a valid GCP zone in the format: region-zone-number."
  }
}

variable "alternative_location_id" {
  type        = string
  description = "The alternative zone for HA Redis instance, required for STANDARD_HA tier"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+-[0-9]$", var.alternative_location_id))
    error_message = "Alternative location ID must be a valid GCP zone in the format: region-zone-number."
  }
}

# Network Configuration
variable "authorized_network" {
  type        = string
  description = "The VPC network authorized to access the Redis instance"

  validation {
    condition     = can(regex("^projects/[^/]+/global/networks/[^/]+$", var.authorized_network))
    error_message = "Authorized network must be a valid VPC network ID in the format: projects/PROJECT_ID/global/networks/NETWORK_NAME."
  }
}

# Maintenance Window Configuration
variable "maintenance_window_day" {
  type        = number
  description = "Day of week (1-7) for maintenance window"
  default     = 7

  validation {
    condition     = var.maintenance_window_day >= 1 && var.maintenance_window_day <= 7
    error_message = "Maintenance window day must be between 1 and 7."
  }
}

variable "maintenance_window_hour" {
  type        = number
  description = "Hour of day (0-23) for maintenance window"
  default     = 23

  validation {
    condition     = var.maintenance_window_hour >= 0 && var.maintenance_window_hour <= 23
    error_message = "Maintenance window hour must be between 0 and 23."
  }
}

# Network Connectivity Configuration
variable "connect_mode" {
  type        = string
  description = "Network connectivity mode for Redis instance"
  default     = "PRIVATE_SERVICE_ACCESS"

  validation {
    condition     = contains(["DIRECT_PEERING", "PRIVATE_SERVICE_ACCESS"], var.connect_mode)
    error_message = "Connect mode must be either 'DIRECT_PEERING' or 'PRIVATE_SERVICE_ACCESS'."
  }
}