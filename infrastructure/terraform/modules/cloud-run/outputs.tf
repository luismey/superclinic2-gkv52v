# Service identification outputs
output "service_name" {
  description = "Name of the deployed Cloud Run service for resource identification"
  value       = google_cloud_run_service.service.name
  depends_on  = [google_cloud_run_service.service]
}

# Service URL output marked as sensitive for security
output "service_url" {
  description = "The URL where the service is deployed and accessible"
  value       = google_cloud_run_service.service.status[0].url
  sensitive   = true
  depends_on  = [google_cloud_run_service.service]
}

# Deployment tracking outputs
output "latest_revision_name" {
  description = "The name of the latest revision for deployment tracking and rollback support"
  value       = google_cloud_run_service.service.status[0].latest_ready_revision_name
  depends_on  = [google_cloud_run_service.service]
}

# Location and project outputs for cross-service integration
output "location" {
  description = "The region where the service is deployed for cross-service integration"
  value       = google_cloud_run_service.service.location
  depends_on  = [google_cloud_run_service.service]
}

output "project_id" {
  description = "The project ID where the service is deployed for resource management"
  value       = google_cloud_run_service.service.project
  depends_on  = [google_cloud_run_service.service]
}

# Service health and configuration outputs
output "service_status" {
  description = "Current status of the Cloud Run service for health monitoring"
  value       = google_cloud_run_service.service.status[0].conditions[0].status
  depends_on  = [google_cloud_run_service.service]
}

output "ingress_status" {
  description = "Ingress settings status for network configuration validation"
  value       = google_cloud_run_service.service.metadata[0].annotations["run.googleapis.com/ingress"]
  depends_on  = [google_cloud_run_service.service]
}

output "resource_limits" {
  description = "Resource limits configuration for capacity planning"
  value       = google_cloud_run_service.service.template[0].spec[0].containers[0].resources[0].limits
  depends_on  = [google_cloud_run_service.service]
}