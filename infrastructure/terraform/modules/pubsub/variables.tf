# Terraform variables configuration file for Google Cloud PubSub resources
# Version: hashicorp/terraform >= 1.0.0

variable "project_id" {
  type        = string
  description = "The Google Cloud project ID where PubSub resources will be created"
}

variable "environment" {
  type        = string
  description = "The deployment environment (dev/staging/prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "message_retention_duration" {
  type        = string
  description = "Duration to retain unacknowledged messages in the subscription (maximum 7 days per requirements)"
  default     = "604800s" # 7 days in seconds
  
  validation {
    condition     = can(regex("^[0-9]+s$", var.message_retention_duration))
    error_message = "Message retention duration must be specified in seconds with 's' suffix."
  }
}

variable "ack_deadline_seconds" {
  type        = number
  description = "Maximum time in seconds for subscribers to acknowledge received messages"
  default     = 20 # Standard deadline for processing high-volume messages

  validation {
    condition     = var.ack_deadline_seconds >= 10 && var.ack_deadline_seconds <= 600
    error_message = "Acknowledgement deadline must be between 10 and 600 seconds."
  }
}

variable "retry_policy" {
  type = object({
    minimum_backoff = string
    maximum_backoff = string
    maximum_retries = number
  })
  description = "Message retry configuration for failed deliveries"
  default = {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
    maximum_retries = 5
  }

  validation {
    condition     = can(regex("^[0-9]+s$", var.retry_policy.minimum_backoff)) && can(regex("^[0-9]+s$", var.retry_policy.maximum_backoff))
    error_message = "Backoff durations must be specified in seconds with 's' suffix."
  }
}

variable "service_account_roles" {
  type        = list(string)
  description = "List of IAM roles to assign to the PubSub service account"
  default = [
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
    "roles/pubsub.viewer"
  ]

  validation {
    condition     = length(var.service_account_roles) > 0
    error_message = "At least one IAM role must be specified for the service account."
  }
}

variable "topic_labels" {
  type        = map(string)
  description = "Labels to apply to PubSub topics for better resource organization"
  default = {
    managed_by = "terraform"
  }
}

variable "subscription_labels" {
  type        = map(string)
  description = "Labels to apply to PubSub subscriptions for better resource organization"
  default = {
    managed_by = "terraform"
  }
}

variable "enable_message_ordering" {
  type        = bool
  description = "Enable message ordering for topics (recommended for event-driven architecture)"
  default     = true
}

variable "message_storage_policy" {
  type = object({
    allowed_persistence_regions = list(string)
  })
  description = "Policy for message storage location constraints"
  default = {
    allowed_persistence_regions = ["southamerica-east1"] # Brazil region for LGPD compliance
  }

  validation {
    condition     = length(var.message_storage_policy.allowed_persistence_regions) > 0
    error_message = "At least one persistence region must be specified."
  }
}