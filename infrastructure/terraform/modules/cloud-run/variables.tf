terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
  }
}

variable "project_id" {
  description = "The Google Cloud project ID where the Cloud Run service will be deployed"
  type        = string

  validation {
    condition     = length(var.project_id) > 0
    error_message = "Project ID must not be empty"
  }
}

variable "region" {
  description = "The region where the Cloud Run service will be deployed, supporting multi-region deployment for DR"
  type        = string
  default     = "southamerica-east1"

  validation {
    condition     = contains(["southamerica-east1", "us-central1"], var.region)
    error_message = "Region must be either southamerica-east1 (São Paulo) or us-central1 (DR site)"
  }
}

variable "service_name" {
  description = "Name of the Cloud Run service following GCP naming conventions"
  type        = string

  validation {
    condition     = can(regex("^[a-z][-a-z0-9]*[a-z0-9]$", var.service_name)) && length(var.service_name) <= 63
    error_message = "Service name must be lowercase, max 63 chars, and contain only letters, numbers, and hyphens"
  }
}

variable "image" {
  description = "Container image to deploy to Cloud Run, must be in Artifact Registry"
  type        = string

  validation {
    condition     = can(regex("^[a-z][-a-z0-9./]*[a-z0-9]$", var.image))
    error_message = "Image name must be a valid container image reference"
  }
}

variable "memory_limit" {
  description = "Memory limit for the Cloud Run service as per technical specifications"
  type        = string
  default     = "2Gi"

  validation {
    condition     = can(regex("^[0-9]+[MGT]i$", var.memory_limit))
    error_message = "Memory limit must be specified in Mi, Gi, or Ti"
  }
}

variable "cpu_limit" {
  description = "CPU limit for the Cloud Run service as per technical specifications"
  type        = string
  default     = "2000m"

  validation {
    condition     = can(regex("^[0-9]+m$", var.cpu_limit))
    error_message = "CPU limit must be specified in millicores (e.g., 2000m)"
  }
}

variable "min_instances" {
  description = "Minimum number of instances to maintain for high availability"
  type        = number
  default     = 1

  validation {
    condition     = var.min_instances >= 0 && var.min_instances <= 100
    error_message = "Minimum instances must be between 0 and 100"
  }
}

variable "max_instances" {
  description = "Maximum number of instances to scale to based on load"
  type        = number
  default     = 100

  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 1000
    error_message = "Maximum instances must be between 1 and 1000"
  }
}

variable "environment_variables" {
  description = "Environment variables for service configuration, supporting LGPD compliance"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "service_account_email" {
  description = "Service account email with minimum required permissions"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{6,30}@[a-z0-9-]{4,28}.iam.gserviceaccount.com$", var.service_account_email))
    error_message = "Service account email must be valid"
  }
}

variable "vpc_connector" {
  description = "VPC connector for secure internal service communication"
  type        = string
  default     = null

  validation {
    condition     = var.vpc_connector == null || can(regex("^projects/[^/]+/locations/[^/]+/connectors/[^/]+$", var.vpc_connector))
    error_message = "VPC connector must be a valid resource name"
  }
}

variable "ingress" {
  description = "Ingress settings for the Cloud Run service security"
  type        = string
  default     = "internal-and-cloud-load-balancing"

  validation {
    condition     = contains(["all", "internal", "internal-and-cloud-load-balancing"], var.ingress)
    error_message = "Ingress must be one of: all, internal, internal-and-cloud-load-balancing"
  }
}