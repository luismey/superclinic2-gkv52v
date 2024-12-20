# Terraform >= 1.0.0 required for advanced variable validation and type constraints

variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID where Firestore will be deployed"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  type        = string
  description = "Primary GCP region for Firestore deployment (e.g., southamerica-east1 for Brazil)"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.region))
    error_message = "Region must be a valid GCP region identifier."
  }
}

variable "firestore_config" {
  type = object({
    database_id                 = string
    location_id                = string
    type                       = string
    concurrency_mode           = string
    app_engine_integration_mode = string
    multi_region = object({
      enabled     = bool
      locations   = list(string)
      replication_type = string
    })
    capacity_config = object({
      max_capacity_gb = number
      provisioned_concurrency_units = number
    })
  })
  description = "Comprehensive Firestore database configuration"

  validation {
    condition     = contains(["DATASTORE_MODE", "NATIVE_MODE"], var.firestore_config.type)
    error_message = "Firestore type must be either DATASTORE_MODE or NATIVE_MODE."
  }

  validation {
    condition     = contains(["OPTIMISTIC", "PESSIMISTIC"], var.firestore_config.concurrency_mode)
    error_message = "Concurrency mode must be either OPTIMISTIC or PESSIMISTIC."
  }

  validation {
    condition     = var.firestore_config.capacity_config.max_capacity_gb <= 10240 # 10TB limit
    error_message = "Maximum capacity cannot exceed 10TB (10240GB)."
  }
}

variable "backup_config" {
  type = object({
    retention_days = number
    schedule      = string
    location      = string
    backup_types  = list(string)
    protection_config = object({
      deletion_protection = bool
      early_deletion_days = number
    })
  })
  description = "Configuration for automated Firestore backups"

  validation {
    condition     = var.backup_config.retention_days >= 1 && var.backup_config.retention_days <= 365
    error_message = "Backup retention must be between 1 and 365 days."
  }

  validation {
    condition     = can(regex("^(\\*|[0-9]{1,2}) (\\*|[0-9]{1,2}) (\\*|[0-9]{1,2}) (\\*|[0-9]{1,2}) (\\*|[0-9]{1,2})$", var.backup_config.schedule))
    error_message = "Backup schedule must be a valid cron expression."
  }
}

variable "security_rules" {
  type = object({
    rules_file = string
    encryption_config = object({
      kms_key_name = string
      field_encryption = list(object({
        field_path = string
        key_name   = string
      }))
    })
    access_control = object({
      allowed_ip_ranges = list(string)
      auth_mode        = string
    })
  })
  description = "Security and encryption configuration for Firestore"

  validation {
    condition     = fileexists(var.security_rules.rules_file)
    error_message = "Security rules file must exist at the specified path."
  }

  validation {
    condition     = contains(["IAM_ONLY", "FIREBASE_AUTH"], var.security_rules.access_control.auth_mode)
    error_message = "Auth mode must be either IAM_ONLY or FIREBASE_AUTH."
  }
}

variable "labels" {
  type = map(string)
  description = "Resource labels for Firestore database organization and management"
  default = {
    environment = "production"
    managed_by  = "terraform"
    project     = "porfin"
  }

  validation {
    condition     = length(keys(var.labels)) <= 64
    error_message = "Maximum of 64 labels can be specified."
  }

  validation {
    condition     = alltrue([for k, v in var.labels : can(regex("^[a-z][a-z0-9_-]{0,62}[a-z0-9]$", k))])
    error_message = "Label keys must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores."
  }
}