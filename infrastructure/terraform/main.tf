# Provider configuration
# hashicorp/google v4.0
# hashicorp/google-beta v4.0
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

# Configure the Google Cloud provider
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Local variables for resource naming and tagging
locals {
  project         = var.project_id
  region          = var.region
  environment     = var.environment
  resource_prefix = "porfin-${var.environment}"
  
  labels = {
    environment = var.environment
    managed_by  = "terraform"
    project     = "porfin"
  }
}

# GKE Cluster Module
module "gke" {
  source = "./modules/gke"

  project_id = local.project
  region     = local.region
  environment = local.environment

  cluster_config = {
    name       = "${local.resource_prefix}-cluster"
    network    = module.vpc.network_name
    subnetwork = module.vpc.subnet_name
  }

  node_pools = {
    general = {
      machine_type       = "e2-standard-4"
      initial_node_count = 3
      min_count         = 3
      max_count         = 15
      disk_size_gb      = 100
      service_account   = google_service_account.gke_nodes.email
      labels = {
        pool = "general"
      }
    }
    memory_optimized = {
      machine_type       = "e2-highmem-8"
      initial_node_count = 2
      min_count         = 2
      max_count         = 10
      disk_size_gb      = 200
      service_account   = google_service_account.gke_nodes.email
      labels = {
        pool = "memory-optimized"
      }
    }
  }
}

# Cloud Run Service for Frontend
resource "google_cloud_run_service" "frontend" {
  name     = "${local.resource_prefix}-frontend"
  location = local.region

  template {
    spec {
      containers {
        image = "gcr.io/${local.project}/frontend:latest"
        resources {
          limits = {
            cpu    = "2.0"
            memory = "2Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Firestore Database
resource "google_firestore_database" "database" {
  project                     = local.project
  name                       = "(default)"
  location_id                = "nam5"  # Multi-region deployment
  type                       = "FIRESTORE_NATIVE"
  concurrency_mode           = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  depends_on = [
    google_project_service.firestore
  ]
}

# Redis Instance for Caching
resource "google_redis_instance" "cache" {
  name           = "${local.resource_prefix}-cache"
  tier           = "STANDARD_HA"
  memory_size_gb = 5
  region         = local.region

  authorized_network = module.vpc.network_id
  connect_mode      = "PRIVATE_SERVICE_ACCESS"

  redis_version     = "REDIS_6_X"
  display_name      = "Porfin Cache"
  
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
      }
    }
  }

  labels = local.labels
}

# Load Balancer
resource "google_compute_global_forwarding_rule" "default" {
  name                  = "${local.resource_prefix}-lb"
  target                = google_compute_target_https_proxy.default.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL"
}

# Cloud Armor Security Policy
resource "google_compute_security_policy" "policy" {
  name = "${local.resource_prefix}-security-policy"

  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["9.9.9.0/24"]  # Example blocked range
      }
    }
    description = "Deny access to specified IPs"
  }

  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default rule"
  }
}

# Cloud Storage for Media and Static Files
resource "google_storage_bucket" "media" {
  name          = "${local.resource_prefix}-media"
  location      = local.region
  force_destroy = false

  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  labels = local.labels
}

# PubSub Topics for Message Queue
resource "google_pubsub_topic" "messages" {
  name = "${local.resource_prefix}-messages"

  message_retention_duration = "86600s"
  
  labels = local.labels
}

# Monitoring and Alerting
resource "google_monitoring_alert_policy" "latency_alert" {
  display_name = "${local.resource_prefix}-latency-alert"
  combiner     = "OR"

  conditions {
    display_name = "High Latency"
    condition_threshold {
      filter          = "metric.type=\"loadbalancing.googleapis.com/https/request_latencies\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 500  # 500ms latency threshold
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.name
  ]

  user_labels = local.labels
}

# Outputs
output "gke_cluster" {
  value = {
    cluster_name = module.gke.cluster_name
    location     = module.gke.location
    master_auth  = module.gke.master_auth
  }
}

output "cloud_run" {
  value = {
    service_name    = google_cloud_run_service.frontend.name
    location        = google_cloud_run_service.frontend.location
    resource_limits = google_cloud_run_service.frontend.template[0].spec[0].containers[0].resources[0].limits
  }
}

output "firestore" {
  value = {
    database_id     = google_firestore_database.database.name
    location_id     = google_firestore_database.database.location_id
    backup_schedule = null  # Managed by backup policy
  }
}

output "redis" {
  value = {
    instance_id     = google_redis_instance.cache.name
    tier           = google_redis_instance.cache.tier
    memory_size_gb = google_redis_instance.cache.memory_size_gb
  }
}