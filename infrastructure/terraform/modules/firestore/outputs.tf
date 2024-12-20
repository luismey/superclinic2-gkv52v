# Database identification outputs
output "database_id" {
  description = "The unique identifier of the Firestore database instance"
  value       = google_firestore_database.main.id
  sensitive   = false
}

output "database_name" {
  description = "The fully qualified name of the Firestore database"
  value       = google_firestore_database.main.name
  sensitive   = false
}

# Database configuration outputs
output "database_location" {
  description = "The primary location/region where the Firestore database is deployed"
  value       = google_firestore_database.main.location_id
  sensitive   = false
}

output "database_type" {
  description = "The type of Firestore database (NATIVE_MODE or DATASTORE_MODE)"
  value       = google_firestore_database.main.type
  sensitive   = false
}

# Database endpoint and connection details
output "database_endpoint" {
  description = "The connection endpoint URL for the Firestore database"
  value       = "https://firestore.googleapis.com/v1/projects/${var.project_id}/databases/${google_firestore_database.main.name}"
  sensitive   = false
}

# Multi-region configuration
output "database_locations" {
  description = "List of all regions where the database is replicated (if multi-region is enabled)"
  value       = try(google_firestore_database.main.location_config[0].locations, [google_firestore_database.main.location_id])
  sensitive   = false
}

output "replication_type" {
  description = "The type of replication configured for multi-region setups"
  value       = try(google_firestore_database.main.location_config[0].replication_type, "SINGLE_REGION")
  sensitive   = false
}

# Capacity and performance configuration
output "maximum_capacity_gb" {
  description = "The maximum storage capacity configured for the database in gigabytes"
  value       = google_firestore_database.main.capacity_config[0].maximum_capacity_gb
  sensitive   = false
}

output "provisioned_concurrency_units" {
  description = "The number of provisioned concurrency units for database operations"
  value       = google_firestore_database.main.capacity_config[0].provisioned_concurrency_units
  sensitive   = false
}

# Backup configuration outputs
output "backup_schedule_id" {
  description = "The unique identifier of the configured backup schedule"
  value       = google_firestore_backup_schedule.daily.id
  sensitive   = false
}

output "backup_schedule" {
  description = "The configured backup schedule in cron format"
  value       = google_firestore_backup_schedule.daily.schedule
  sensitive   = false
}

output "backup_retention_days" {
  description = "The number of days that backup data is retained"
  value       = google_firestore_backup_schedule.daily.retention_days
  sensitive   = false
}

# Security configuration
output "security_rules_version" {
  description = "The version identifier of the deployed security rules"
  value       = google_firestore_database_security_rules.rules.id
  sensitive   = false
}

# Monitoring configuration
output "monitoring_policy_id" {
  description = "The identifier of the monitoring alert policy for Firestore"
  value       = google_monitoring_alert_policy.firestore_alerts.id
  sensitive   = false
}

# Labels
output "database_labels" {
  description = "The labels assigned to the Firestore database instance"
  value       = google_firestore_database.main.labels
  sensitive   = false
}