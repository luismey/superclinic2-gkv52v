# Output configuration for PubSub topics and subscriptions
# Supports 1M messages/second throughput with 7-day retention

# Map of all topic IDs for reference by other modules
output "topic_ids" {
  description = "Map of topic names to their GCP resource IDs, supporting high-throughput message processing (1M messages/second)"
  value = {
    for topic in local.topic_names : topic => google_pubsub_topic.topics[topic].id
  }
}

# Map of all topic names for cross-project references
output "topic_names" {
  description = "Map of topic names to their fully qualified names for cross-project message routing"
  value = {
    for topic in local.topic_names : topic => google_pubsub_topic.topics[topic].name
  }
}

# Map of all subscription IDs for reference by other modules
output "subscription_ids" {
  description = "Map of subscription names to their GCP resource IDs, configured with 7-day message retention"
  value = {
    for key, subscription in google_pubsub_subscription.subscriptions : key => subscription.id
  }
}

# Map of all subscription names for cross-project references
output "subscription_names" {
  description = "Map of subscription names to their fully qualified names for cross-project message consumption"
  value = {
    for key, subscription in google_pubsub_subscription.subscriptions : key => subscription.name
  }
}

# Individual topic IDs for specific service integrations
output "whatsapp_topic_id" {
  description = "Resource ID of the WhatsApp messages topic for high-throughput message processing (100+ messages/second)"
  value       = google_pubsub_topic.topics["whatsapp"].id
}

output "ai_topic_id" {
  description = "Resource ID of the AI processing topic for GPT-4 integration and virtual assistant communication"
  value       = google_pubsub_topic.topics["ai"].id
}

output "analytics_topic_id" {
  description = "Resource ID of the analytics events topic for real-time business metrics processing"
  value       = google_pubsub_topic.topics["analytics"].id
}

output "campaigns_topic_id" {
  description = "Resource ID of the campaign events topic for automated message campaign orchestration"
  value       = google_pubsub_topic.topics["campaigns"].id
}

# Subscription sets by topic for service-specific access
output "whatsapp_subscriptions" {
  description = "Map of WhatsApp message handling subscription IDs including message handler, AI processor, and backup processor"
  value = {
    for key, subscription in google_pubsub_subscription.subscriptions : 
    key => subscription.id
    if can(regex("^whatsapp-", key))
  }
}

output "ai_subscriptions" {
  description = "Map of AI processing subscription IDs including response handler and error handler"
  value = {
    for key, subscription in google_pubsub_subscription.subscriptions : 
    key => subscription.id
    if can(regex("^ai-", key))
  }
}

output "analytics_subscriptions" {
  description = "Map of analytics subscription IDs including metrics processor, reports generator, and audit logger"
  value = {
    for key, subscription in google_pubsub_subscription.subscriptions : 
    key => subscription.id
    if can(regex("^analytics-", key))
  }
}

output "campaign_subscriptions" {
  description = "Map of campaign subscription IDs including scheduler, executor, and monitor"
  value = {
    for key, subscription in google_pubsub_subscription.subscriptions : 
    key => subscription.id
    if can(regex("^campaigns-", key))
  }
}