# Backend configuration for Porfin infrastructure state management
# Version: 1.0.0
# Provider version: google ~> 4.0

terraform {
  backend "gcs" {
    # Bucket name follows the pattern: project_id-tfstate-environment
    bucket = "${var.project_id}-tfstate-${var.environment}"
    
    # State file organization
    prefix = "terraform/state"
    
    # Multi-regional storage configuration for high availability
    storage_class = "MULTI_REGIONAL"
    location      = var.region
    
    # Enable object versioning for state history and recovery
    versioning = true
    
    # Security configurations
    enable_bucket_policy_only = true # Enforce uniform bucket-level access
    
    # Labels for resource organization and cost tracking
    labels = {
      environment = var.environment
      managed-by  = "terraform"
      project     = var.project_id
    }
    
    # Additional security settings
    encryption {
      default_kms_key_name = "projects/${var.project_id}/locations/global/keyRings/terraform-state/cryptoKeys/state-encryption"
    }
    
    # IAM configuration
    iam = {
      role_bindings = [
        {
          role    = "roles/storage.objectViewer"
          members = ["serviceAccount:terraform@${var.project_id}.iam.gserviceaccount.com"]
        },
        {
          role    = "roles/storage.objectAdmin"
          members = ["serviceAccount:terraform@${var.project_id}.iam.gserviceaccount.com"]
        }
      ]
    }
    
    # Lifecycle rules for state management
    lifecycle_rules = [
      {
        action = {
          type = "SetStorageClass"
          storage_class = "COLDLINE"
        }
        condition = {
          age = 90 # Move to cold storage after 90 days
          with_state = "ARCHIVED"
        }
      }
    ]
    
    # Enable audit logging
    logging = {
      log_bucket        = "${var.project_id}-tfstate-logs"
      log_object_prefix = "terraform-state-access"
    }
    
    # Configure retention policy
    retention_policy = {
      is_locked        = true
      retention_period = 2592000 # 30 days in seconds
    }
  }
}

# Configure required providers
required_providers {
  google = {
    source  = "hashicorp/google"
    version = "~> 4.0"
  }
}

# Local backend configuration for development
locals {
  backend_config = {
    bucket_name = "${var.project_id}-tfstate-${var.environment}"
    state_path  = "terraform/state"
    
    # Monitoring metrics
    monitoring_config = {
      metrics = [
        "storage.googleapis.com/storage/object_count",
        "storage.googleapis.com/storage/bytes_used",
        "storage.googleapis.com/storage/object_downloads",
        "storage.googleapis.com/storage/object_uploads"
      ]
      
      alert_conditions = {
        state_access_errors = {
          display_name = "Terraform State Access Errors"
          condition_threshold = {
            filter          = "metric.type=\"storage.googleapis.com/api/request_count\" resource.type=\"gcs_bucket\" metric.label.\"response_code\"!=\"200\""
            duration       = "300s"
            threshold_value = 5
            comparison     = "COMPARISON_GT"
          }
        }
      }
    }
  }
}