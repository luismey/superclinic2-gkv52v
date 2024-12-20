# Provider configuration for Google Cloud Platform
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# Local variables for staging environment
locals {
  environment = "staging"
  region     = "southamerica-east1"
  labels = {
    environment   = "staging"
    managed_by    = "terraform"
    project       = "porfin"
    debug_enabled = "true"
    cost_center   = "staging"
  }
}

# GKE cluster configuration for staging
module "gke" {
  source = "../../modules/gke"

  project_id = var.project_id
  region     = local.region
  environment = local.environment

  cluster_config = {
    name = "porfin-staging"
    network = "projects/${var.project_id}/global/networks/porfin-staging-vpc"
    subnetwork = "projects/${var.project_id}/regions/${local.region}/subnetworks/porfin-staging-subnet"
  }

  node_pools = {
    default = {
      initial_node_count = 3
      min_count         = 3
      max_count         = 10
      machine_type      = "e2-standard-4"
      disk_size_gb      = 100
      service_account   = "porfin-staging-gke@${var.project_id}.iam.gserviceaccount.com"
      labels = local.labels
    }
  }
}

# Cloud Run services configuration for staging
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id = var.project_id
  region     = local.region
  environment = local.environment

  service_name = "porfin-staging-api"
  image        = "gcr.io/${var.project_id}/porfin-api:staging"
  
  memory_limit = "2Gi"
  cpu_limit    = "2000m"
  
  min_instances = 2
  max_instances = 10
  
  environment_variables = {
    DEBUG_MODE = "true"
    LOG_LEVEL  = "debug"
  }

  service_account_email = "porfin-staging-run@${var.project_id}.iam.gserviceaccount.com"
  vpc_connector        = "projects/${var.project_id}/locations/${local.region}/connectors/porfin-staging-vpc"
  ingress             = "internal-and-cloud-load-balancing"
}

# Firestore configuration for staging
module "firestore" {
  source = "../../modules/firestore"

  project_id = var.project_id
  region     = local.region

  firestore_config = {
    database_id = "porfin-staging"
    location_id = local.region
    type        = "NATIVE_MODE"
    concurrency_mode = "OPTIMISTIC"
    app_engine_integration_mode = "DISABLED"
    
    multi_region = {
      enabled = false
      locations = [local.region]
      replication_type = "NONE"
    }
    
    capacity_config = {
      max_capacity_gb = 100
      provisioned_concurrency_units = 50
    }
  }

  backup_config = {
    retention_days = 7
    schedule      = "0 0 * * *"
    location      = local.region
    backup_types  = ["DAILY"]
    protection_config = {
      deletion_protection = false
      early_deletion_days = 1
    }
  }

  security_rules = {
    rules_file = "${path.module}/firestore.rules"
    encryption_config = {
      kms_key_name = "projects/${var.project_id}/locations/${local.region}/keyRings/porfin-staging/cryptoKeys/firestore"
      field_encryption = []
    }
    access_control = {
      allowed_ip_ranges = ["10.0.0.0/8"]
      auth_mode        = "IAM_ONLY"
    }
  }

  labels = local.labels
}

# Redis configuration for staging
module "redis" {
  source = "../../modules/redis"

  project_id = var.project_id
  environment = local.environment
  
  redis_instance_name = "porfin-cache"
  redis_memory_size_gb = 5
  redis_version = "REDIS_6_X"
  redis_tier = "STANDARD_HA"
  
  location_id = "${local.region}-a"
  alternative_location_id = "${local.region}-b"
  
  authorized_network = "projects/${var.project_id}/global/networks/porfin-staging-vpc"
  
  maintenance_window_day = 7
  maintenance_window_hour = 2
  
  connect_mode = "PRIVATE_SERVICE_ACCESS"
}

# PubSub configuration for staging
module "pubsub" {
  source = "../../modules/pubsub"

  project_id = var.project_id
  environment = local.environment

  message_retention_duration = "86400s"  # 24 hours for staging
  ack_deadline_seconds = 30

  retry_policy = {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
    maximum_retries = 5
  }

  enable_message_ordering = true

  message_storage_policy = {
    allowed_persistence_regions = [local.region]
  }

  topic_labels = merge(local.labels, {
    service = "messaging"
  })

  subscription_labels = merge(local.labels, {
    service = "messaging"
  })
}

# Outputs for staging environment
output "gke_cluster_endpoint" {
  value = module.gke.cluster_endpoint
  description = "GKE cluster endpoint for staging environment"
}

output "cloud_run_url" {
  value = module.cloud_run.service_url
  description = "Cloud Run service URL for staging environment"
}

output "redis_host" {
  value = module.redis.instance.host
  description = "Redis instance host for staging environment"
  sensitive = true
}

output "pubsub_topics" {
  value = module.pubsub.topic_names
  description = "List of PubSub topics created in staging environment"
}