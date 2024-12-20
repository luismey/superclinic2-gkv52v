# Terraform provider configurations for Porfin platform
# Version: 1.0.0

# Terraform version and provider requirements
terraform {
  required_version = ">=1.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Main Google Cloud provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a" # Primary zone

  # Security and compliance configurations
  request_timeout    = "60s"
  request_reason     = "Porfin Infrastructure Management"
  user_project_override = true

  # Default encryption configuration
  default_encryption_config {
    kms_key_name = "projects/${var.project_id}/locations/global/keyRings/porfin-${var.environment}/cryptoKeys/main"
  }

  # Authentication and access scopes
  scopes = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
  ]

  # Batching configuration for optimal API usage
  batching {
    enable_batching = true
    send_after     = "10s"
  }
}

# Google Beta provider for advanced features
provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a"

  # Security and compliance configurations
  request_timeout    = "60s"
  request_reason     = "Porfin Infrastructure Management (Beta Features)"
  user_project_override = true

  # Default encryption configuration
  default_encryption_config {
    kms_key_name = "projects/${var.project_id}/locations/global/keyRings/porfin-${var.environment}/cryptoKeys/main"
  }

  # Authentication and access scopes
  scopes = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
  ]

  # Batching configuration for optimal API usage
  batching {
    enable_batching = true
    send_after     = "10s"
  }
}

# Random provider for generating unique identifiers
provider "random" {
  # No specific configuration needed for random provider
}

# Provider aliases for multi-region deployment
provider "google" {
  alias   = "dr"
  project = var.project_id
  region  = var.environment == "dr" ? var.region : "southamerica-east1" # DR region
  zone    = var.environment == "dr" ? "${var.region}-a" : "southamerica-east1-a"

  # Security and compliance configurations
  request_timeout    = "60s"
  request_reason     = "Porfin DR Infrastructure Management"
  user_project_override = true

  # Default encryption configuration
  default_encryption_config {
    kms_key_name = "projects/${var.project_id}/locations/global/keyRings/porfin-${var.environment}-dr/cryptoKeys/main"
  }
}

# Provider alias for high-availability configurations
provider "google" {
  alias   = "ha"
  project = var.project_id
  region  = "us-central1" # Global load balancer region
  zone    = "us-central1-a"

  # Security and compliance configurations
  request_timeout    = "60s"
  request_reason     = "Porfin HA Infrastructure Management"
  user_project_override = true
}