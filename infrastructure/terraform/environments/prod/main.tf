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

  backend "gcs" {
    bucket = "porfin-terraform-state"
    prefix = "env/prod"
  }
}

# Local variables for production environment
locals {
  environment = "prod"
  resource_prefix = "porfin-prod"
  
  # GKE node pool configurations
  gke_node_pools = {
    default = {
      machine_type = "e2-standard-4"
      min_count    = 3
      max_count    = 15
      disk_size_gb = 100
      disk_type    = "pd-ssd"
      auto_repair  = true
      auto_upgrade = true
    }
    high_memory = {
      machine_type = "e2-highmem-8"
      min_count    = 2
      max_count    = 10
      disk_size_gb = 200
      disk_type    = "pd-ssd"
      auto_repair  = true
      auto_upgrade = true
    }
  }

  # Monitoring configuration
  monitoring_config = {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    logging_service = "logging.googleapis.com/kubernetes"
    monitoring_service = "monitoring.googleapis.com/kubernetes"
  }
}

# VPC Network configuration
resource "google_compute_network" "vpc" {
  name                    = "${local.resource_prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnet configuration
resource "google_compute_subnetwork" "subnet" {
  name          = "${local.resource_prefix}-subnet"
  project       = var.project_id
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_ranges = {
    pods     = "10.1.0.0/16"
    services = "10.2.0.0/20"
  }

  private_ip_google_access = true
}

# GKE cluster module
module "gke" {
  source = "../../modules/gke"

  project_id = var.project_id
  region     = var.region
  environment = local.environment

  cluster_config = {
    name       = "${local.resource_prefix}-cluster"
    network    = google_compute_network.vpc.name
    subnetwork = google_compute_subnetwork.subnet.name
  }

  node_pools = local.gke_node_pools
}

# Cloud Run module for serverless components
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id = var.project_id
  region     = var.region
  environment = local.environment

  service_name = "${local.resource_prefix}-api"
  memory_limit = "2Gi"
  cpu_limit    = "2000m"
  min_instances = 2
  max_instances = 100

  vpc_connector = google_vpc_access_connector.connector.id
}

# Firestore module for database
module "firestore" {
  source = "../../modules/firestore"

  project_id = var.project_id
  region     = var.region

  firestore_config = {
    database_id = "${local.resource_prefix}-db"
    location_id = var.region
    type        = "NATIVE_MODE"
    multi_region = {
      enabled = true
      locations = ["southamerica-east1", "us-central1"]
      replication_type = "SYNCHRONOUS"
    }
    capacity_config = {
      max_capacity_gb = 10240 # 10TB as per requirements
      provisioned_concurrency_units = 1000
    }
  }

  backup_config = {
    retention_days = 30
    schedule      = "0 0 * * *"
    location      = var.region
    backup_types  = ["AUTOMATED"]
    protection_config = {
      deletion_protection = true
      early_deletion_days = 7
    }
  }
}

# Redis module for caching
module "redis" {
  source = "../../modules/redis"

  project_id = var.project_id
  environment = local.environment
  
  redis_instance_name = "${local.resource_prefix}-cache"
  redis_memory_size_gb = 5
  redis_version = "REDIS_6_X"
  redis_tier = "STANDARD_HA"
  
  location_id = "${var.region}-a"
  alternative_location_id = "${var.region}-b"
  
  authorized_network = google_compute_network.vpc.id
}

# PubSub module for message queuing
module "pubsub" {
  source = "../../modules/pubsub"

  project_id = var.project_id
  environment = local.environment

  message_retention_duration = "604800s" # 7 days
  ack_deadline_seconds = 60
  enable_message_ordering = true

  message_storage_policy = {
    allowed_persistence_regions = [var.region]
  }

  retry_policy = {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
    maximum_retries = 5
  }
}

# VPC Access Connector for serverless to VPC connectivity
resource "google_vpc_access_connector" "connector" {
  name          = "${local.resource_prefix}-connector"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"

  machine_type = "e2-standard-4"
  min_instances = 2
  max_instances = 10
}

# Cloud Armor security policy
resource "google_compute_security_policy" "policy" {
  name        = "${local.resource_prefix}-security-policy"
  project     = var.project_id
  description = "Security policy for Porfin production environment"

  rule {
    action   = "allow"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["0.0.0.0/0"]
      }
    }
    description = "Allow all traffic"
  }

  # OWASP Top 10 protection
  rule {
    action   = "deny(403)"
    priority = "2000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-stable')"
      }
    }
    description = "Deny XSS attacks"
  }
}

# Outputs
output "vpc_network" {
  value = {
    name = google_compute_network.vpc.name
    id   = google_compute_network.vpc.id
    subnet_ids = [google_compute_subnetwork.subnet.id]
  }
}

output "gke_cluster" {
  value = {
    cluster_id  = module.gke.cluster_id
    endpoint    = module.gke.endpoint
    master_auth = module.gke.master_auth
  }
  sensitive = true
}

output "firestore_instance" {
  value = {
    database_id = module.firestore.database_id
    backup_schedule = module.firestore.backup_schedule
  }
}

output "redis_instance" {
  value = {
    instance_id = module.redis.instance_id
    host        = module.redis.host
  }
  sensitive = true
}

output "pubsub_resources" {
  value = {
    topic_id = module.pubsub.topic_id
    subscription_id = module.pubsub.subscription_id
    dlq_topic_id = module.pubsub.dlq_topic_id
  }
}