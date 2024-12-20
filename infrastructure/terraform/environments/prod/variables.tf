# Production environment Terraform variables for Porfin platform
# Version: 1.0.0

# Environment identifier
variable "environment" {
  description = "Production environment identifier"
  type        = string
  default     = "prod"

  validation {
    condition     = var.environment == "prod"
    error_message = "Environment must be 'prod' for production configuration"
  }
}

# GKE cluster configuration
variable "gke_config" {
  description = "Production GKE cluster configuration"
  type = object({
    cluster_name       = string
    min_master_version = string
    node_pools = map(object({
      machine_type   = string
      min_node_count = number
      max_node_count = number
      disk_size_gb   = number
      disk_type      = string
      preemptible    = bool
    }))
    networking = object({
      enable_private_nodes     = bool
      enable_network_policy    = bool
      pods_ipv4_cidr_block    = string
    })
  })

  default = {
    cluster_name       = "porfin-prod"
    min_master_version = "1.27"
    node_pools = {
      default-pool = {
        machine_type   = "e2-standard-4"  # 4 vCPU, 16GB RAM
        min_node_count = 3                # Minimum 3 nodes for HA
        max_node_count = 15               # Scale up to 15 nodes
        disk_size_gb   = 100             # 100GB SSD per node
        disk_type      = "pd-ssd"        # SSD for better performance
        preemptible    = false           # Non-preemptible for production
      }
      high-memory-pool = {
        machine_type   = "e2-highmem-8"  # 8 vCPU, 64GB RAM
        min_node_count = 2                # Minimum 2 nodes for AI workloads
        max_node_count = 10               # Scale up to 10 nodes
        disk_size_gb   = 200             # 200GB SSD per node
        disk_type      = "pd-ssd"
        preemptible    = false
      }
    }
    networking = {
      enable_private_nodes     = true     # Private GKE cluster
      enable_network_policy    = true     # Enable network policies
      pods_ipv4_cidr_block    = "10.0.0.0/14"  # Pod IP range
    }
  }
}

# Cloud Run configuration
variable "cloud_run_config" {
  description = "Production Cloud Run service configuration"
  type = object({
    memory_limit      = string
    cpu_limit        = string
    min_instances    = number
    max_instances    = number
    request_timeout  = string
  })

  default = {
    memory_limit     = "2Gi"      # 2GB memory per instance
    cpu_limit       = "2"        # 2 vCPU per instance
    min_instances   = 2          # Minimum 2 instances for HA
    max_instances   = 100        # Scale up to 100 instances
    request_timeout = "300s"     # 5-minute timeout
  }
}

# Firestore configuration
variable "firestore_config" {
  description = "Production Firestore database configuration"
  type = object({
    location        = string
    retention_days  = number
    multi_region    = bool
    backup_schedule = string
  })

  default = {
    location        = "southamerica-east1"  # Brazil region
    retention_days  = 30                    # 30-day retention
    multi_region    = true                  # Multi-region for HA
    backup_schedule = "0 */6 * * *"         # Backup every 6 hours
  }
}

# Redis configuration
variable "redis_config" {
  description = "Production Redis cache configuration"
  type = object({
    memory_size_gb     = number
    version           = string
    tier              = string
    read_replicas_mode = string
  })

  default = {
    memory_size_gb     = 5          # 5GB memory
    version           = "6.x"       # Redis 6.x
    tier              = "STANDARD_HA"  # HA configuration
    read_replicas_mode = "READ_REPLICAS_ENABLED"  # Enable read replicas
  }
}

# PubSub configuration
variable "pubsub_config" {
  description = "Production PubSub configuration"
  type = object({
    message_retention_duration = string
    topic_configs = map(object({
      retention_days = number
      message_storage_policy = string
    }))
  })

  default = {
    message_retention_duration = "7d"  # 7-day message retention
    topic_configs = {
      whatsapp-messages = {
        retention_days = 7
        message_storage_policy = "PERSISTENT"
      }
      ai-processing = {
        retention_days = 1
        message_storage_policy = "PERSISTENT"
      }
      campaign-events = {
        retention_days = 7
        message_storage_policy = "PERSISTENT"
      }
      analytics-events = {
        retention_days = 30
        message_storage_policy = "PERSISTENT"
      }
    }
  }

  validation {
    condition     = length(var.pubsub_config.topic_configs) >= 2
    error_message = "At least WhatsApp messages and AI processing topics must be configured."
  }
}