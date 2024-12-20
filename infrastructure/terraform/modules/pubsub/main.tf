# Provider configuration for Google Cloud Platform
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

# Local variables for resource configuration
locals {
  # Topic names for different message types
  topic_names = ["whatsapp", "ai", "analytics", "campaigns"]
  
  # Subscription configurations per topic
  subscription_configs = {
    whatsapp = ["message_handler", "ai_processor", "backup_processor"]
    ai       = ["response_handler", "error_handler"]
    analytics = ["metrics_processor", "reports_generator", "audit_logger"]
    campaigns = ["scheduler", "executor", "monitor"]
  }

  # Message filters for different topics
  message_filters = {
    whatsapp   = "attributes.type = 'whatsapp'"
    ai         = "attributes.type = 'ai'"
    analytics  = "attributes.type = 'analytics'"
    campaigns  = "attributes.type = 'campaign'"
  }

  # Common resource name prefix
  name_prefix = "porfin-${var.environment}"
}

# Create PubSub topics with enhanced security and compliance features
resource "google_pubsub_topic" "topics" {
  for_each = toset(local.topic_names)

  project = var.project_id
  name    = "${local.name_prefix}-${each.key}-topic"

  message_storage_policy {
    allowed_persistence_regions = var.message_storage_policy.allowed_persistence_regions
  }

  # Enable message ordering for event consistency
  message_ordering = var.enable_message_ordering

  # Configure message retention duration
  message_retention_duration = var.message_retention_duration

  # Apply resource labels
  labels = merge(var.topic_labels, {
    environment = var.environment
    type        = each.key
  })

  # Enable customer managed encryption key if provided
  depends_on = [google_pubsub_topic_iam_binding.publisher_bindings]
}

# Create PubSub subscriptions with advanced delivery guarantees
resource "google_pubsub_subscription" "subscriptions" {
  for_each = {
    for pair in flatten([
      for topic, subs in local.subscription_configs : [
        for sub in subs : {
          topic = topic
          name  = sub
        }
      ]
    ]) : "${pair.topic}-${pair.name}" => pair
  }

  project = var.project_id
  name    = "${local.name_prefix}-${each.value.topic}-${each.value.name}-sub"
  topic   = google_pubsub_topic.topics[each.value.topic].name

  # Configure message acknowledgement deadline
  ack_deadline_seconds = var.ack_deadline_seconds

  # Enable exactly-once delivery for critical messages
  enable_exactly_once_delivery = true

  # Enable message ordering if specified
  enable_message_ordering = var.enable_message_ordering

  # Configure message filtering
  filter = local.message_filters[each.value.topic]

  # Configure retry policy for failed messages
  retry_policy {
    minimum_backoff = var.retry_policy.minimum_backoff
    maximum_backoff = var.retry_policy.maximum_backoff
    maximum_retry_duration = "86400s" # 24 hours
  }

  # Configure dead letter policy
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.topics["${each.value.topic}"].id
    max_delivery_attempts = 5
  }

  # Apply resource labels
  labels = merge(var.subscription_labels, {
    environment = var.environment
    topic       = each.value.topic
    handler     = each.value.name
  })

  depends_on = [google_pubsub_topic.topics]
}

# Configure IAM bindings for PubSub topics
resource "google_pubsub_topic_iam_binding" "publisher_bindings" {
  for_each = toset(local.topic_names)

  project = var.project_id
  topic   = google_pubsub_topic.topics[each.key].name
  role    = "roles/pubsub.publisher"
  members = [
    "serviceAccount:${var.project_id}@appspot.gserviceaccount.com",
    "serviceAccount:cloud-functions@${var.project_id}.iam.gserviceaccount.com"
  ]
}

# Configure IAM bindings for PubSub subscriptions
resource "google_pubsub_subscription_iam_binding" "subscriber_bindings" {
  for_each = {
    for pair in flatten([
      for topic, subs in local.subscription_configs : [
        for sub in subs : {
          topic = topic
          name  = sub
        }
      ]
    ]) : "${pair.topic}-${pair.name}" => pair
  }

  project      = var.project_id
  subscription = google_pubsub_subscription.subscriptions["${each.value.topic}-${each.value.name}"].name
  role         = "roles/pubsub.subscriber"
  members = [
    "serviceAccount:${var.project_id}@appspot.gserviceaccount.com",
    "serviceAccount:cloud-functions@${var.project_id}.iam.gserviceaccount.com"
  ]
}

# Configure monitoring alerts for PubSub metrics
resource "google_monitoring_alert_policy" "pubsub_alerts" {
  provider = google-beta
  project  = var.project_id
  
  display_name = "${local.name_prefix}-pubsub-alerts"
  combiner     = "OR"

  conditions {
    display_name = "High message backlog"
    condition_threshold {
      filter          = "resource.type = \"pubsub_subscription\" AND metric.type = \"pubsub.googleapis.com/subscription/num_undelivered_messages\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 1000
    }
  }

  notification_channels = [] # Add notification channels as needed

  alert_strategy {
    auto_close = "86400s" # Auto-close after 24 hours
  }
}