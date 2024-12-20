# Provider configuration for Google Cloud with required versions
# Provider version: >=4.0.0
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">=4.0.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">=4.0.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Main Firestore database resource
resource "google_firestore_database" "main" {
  provider = google-beta
  project  = var.project_id
  name     = var.firestore_config.database_id
  
  # Location configuration for multi-region setup
  location_id = var.firestore_config.location_id
  type        = var.firestore_config.type
  
  # Advanced database configuration
  concurrency_mode           = var.firestore_config.concurrency_mode
  app_engine_integration_mode = var.firestore_config.app_engine_integration_mode

  # Multi-region configuration
  dynamic "location_config" {
    for_each = var.firestore_config.multi_region.enabled ? [1] : []
    content {
      locations   = var.firestore_config.multi_region.locations
      replication_type = var.firestore_config.multi_region.replication_type
    }
  }

  # Database capacity configuration
  capacity_config {
    maximum_capacity_gb = var.firestore_config.capacity_config.max_capacity_gb
    provisioned_concurrency_units = var.firestore_config.capacity_config.provisioned_concurrency_units
  }

  labels = var.labels

  lifecycle {
    prevent_destroy = true
  }
}

# Automated backup configuration
resource "google_firestore_backup_schedule" "daily" {
  provider = google-beta
  project  = var.project_id
  database = google_firestore_database.main.name
  
  retention_days = var.backup_config.retention_days
  schedule      = var.backup_config.schedule
  location      = var.backup_config.location

  dynamic "backup_config" {
    for_each = var.backup_config.backup_types
    content {
      backup_type = backup_config.value
    }
  }

  protection_config {
    deletion_protection = var.backup_config.protection_config.deletion_protection
    early_deletion_allowed_days = var.backup_config.protection_config.early_deletion_days
  }
}

# Security rules configuration
resource "google_firestore_database_security_rules" "rules" {
  provider = google-beta
  project  = var.project_id
  database = google_firestore_database.main.name

  rules     = file(var.security_rules.rules_file)
  location_id = var.firestore_config.location_id

  # Field-level encryption configuration
  dynamic "encryption_config" {
    for_each = length(var.security_rules.encryption_config.field_encryption) > 0 ? [1] : []
    content {
      kms_key_name = var.security_rules.encryption_config.kms_key_name
      dynamic "field_encryption" {
        for_each = var.security_rules.encryption_config.field_encryption
        content {
          field_path = field_encryption.value.field_path
          key_name   = field_encryption.value.key_name
        }
      }
    }
  }
}

# Monitoring alert policies
resource "google_monitoring_alert_policy" "firestore_alerts" {
  provider = google-beta
  project  = var.project_id
  display_name = "Firestore Performance Alerts"
  combiner     = "OR"

  conditions {
    display_name = "High Latency Alert"
    condition_threshold {
      filter          = "resource.type = \"firestore_instance\" AND metric.type = \"firestore.googleapis.com/document/read/latency\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 500 # 500ms threshold
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }

  conditions {
    display_name = "Storage Capacity Alert"
    condition_threshold {
      filter          = "resource.type = \"firestore_instance\" AND metric.type = \"firestore.googleapis.com/storage/utilized_bytes\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = var.firestore_config.capacity_config.max_capacity_gb * 0.85 * 1024 * 1024 * 1024 # 85% of max capacity
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [] # Configure notification channels as needed

  documentation {
    content   = "Firestore performance and capacity alerts for the Porfin platform"
    mime_type = "text/markdown"
  }
}

# IAM policy for Firestore access control
resource "google_firestore_database_iam_policy" "policy" {
  provider = google-beta
  project  = var.project_id
  database = google_firestore_database.main.name
  location = var.firestore_config.location_id

  policy_data = data.google_iam_policy.firestore.policy_data
}

data "google_iam_policy" "firestore" {
  binding {
    role = "roles/datastore.user"
    members = [
      "serviceAccount:${var.project_id}@appspot.gserviceaccount.com",
    ]
    condition {
      title       = "IP-based access"
      description = "Allow access only from specified IP ranges"
      expression  = "request.origin.ip in ${jsonencode(var.security_rules.access_control.allowed_ip_ranges)}"
    }
  }
}