# Core infrastructure outputs
output "project_id" {
  description = "The GCP project ID where resources are deployed"
  value       = var.project_id
}

output "region" {
  description = "The primary GCP region for resource deployment"
  value       = var.region
}

output "environment" {
  description = "The current deployment environment"
  value       = var.environment
}

# Network outputs
output "vpc_name" {
  description = "The name of the VPC network"
  value       = var.network_config.network_name
}

output "subnet_name" {
  description = "The name of the primary subnet"
  value       = var.network_config.subnet_configs[0].name
}

# GKE cluster outputs
output "gke_cluster_id" {
  description = "The unique identifier of the GKE cluster"
  value       = module.gke_cluster.cluster_id
  sensitive   = true
}

output "gke_cluster_endpoint" {
  description = "The endpoint for accessing the GKE cluster"
  value       = module.gke_cluster.cluster_endpoint
  sensitive   = true
}

# Cloud Run outputs
output "cloud_run_url" {
  description = "The URL of the deployed Cloud Run service"
  value       = module.cloud_run.service_url
}

# Firestore outputs
output "firestore_database_id" {
  description = "The identifier of the Firestore database"
  value       = module.firestore.database_id
}

# Redis outputs
output "redis_instance_id" {
  description = "The identifier of the Redis instance"
  value       = module.redis.instance_id
  sensitive   = true
}

# PubSub outputs
output "pubsub_topic_id" {
  description = "The identifier of the primary PubSub topic"
  value       = module.pubsub.topic_id
}

# Monitoring and observability outputs
output "monitoring_endpoints" {
  description = "Map of monitoring endpoints for infrastructure components"
  value = {
    gke_monitoring     = "https://console.cloud.google.com/monitoring/dashboards/custom/${var.project_id}-gke"
    cloud_run_metrics  = "https://console.cloud.google.com/run/detail/${var.region}/${module.cloud_run.service_name}/metrics"
    firestore_metrics  = "https://console.cloud.google.com/firestore/databases/-/monitoring"
    redis_monitoring   = "https://console.cloud.google.com/memorystore/redis/locations/${var.region}/instances/${module.redis.instance_id}/monitoring"
    pubsub_monitoring = "https://console.cloud.google.com/monitoring/pubsub"
  }
}

# Scaling metrics outputs
output "scaling_metrics" {
  description = "Current scaling parameters for all services"
  value = {
    gke_node_count     = module.gke_cluster.current_node_count
    cloud_run_instances = module.cloud_run.instance_count
    redis_memory_usage = module.redis.memory_usage_percentage
    pubsub_throughput  = module.pubsub.message_throughput
  }
}

# Availability zone outputs
output "availability_zones" {
  description = "List of availability zones where resources are deployed"
  value = distinct(concat(
    [var.region],
    var.network_config.subnet_configs[*].region
  ))
}

# Service endpoints outputs
output "service_endpoints" {
  description = "Map of service endpoints with their health status"
  value = {
    api_gateway = {
      url     = module.cloud_run.service_url
      status  = "active"
      version = module.cloud_run.latest_ready_revision_name
    }
    gke_services = {
      endpoint = module.gke_cluster.cluster_endpoint
      version  = module.gke_cluster.cluster_version
    }
    database = {
      endpoint = module.firestore.database_endpoint
      mode     = module.firestore.database_type
    }
    cache = {
      endpoint = module.redis.instance_host
      version  = module.redis.redis_version
    }
  }
  sensitive = true
}

# Resource quotas outputs
output "resource_quotas" {
  description = "Map of resource allocation and limits"
  value = {
    gke = {
      max_nodes        = var.gke_config.node_pools[0].max_count
      max_pods_per_node = var.gke_config.max_pods_per_node
    }
    cloud_run = {
      max_instances    = var.load_balancer_config.max_rps
      memory_limit     = "2Gi"
      cpu_limit       = "2000m"
    }
    firestore = {
      max_capacity_gb = var.firestore_config.max_capacity
    }
    redis = {
      memory_size_gb = var.redis_config.memory_size_gb
    }
  }
}

# Backup configuration outputs
output "backup_status" {
  description = "Map of backup configurations and status"
  value = {
    firestore = {
      retention_days = var.firestore_config.retention_days
      schedule      = var.firestore_config.backup_schedule
      location      = var.firestore_config.location_id
    }
    redis = {
      backup_enabled = true
      retention_days = 7
    }
  }
  sensitive = true
}