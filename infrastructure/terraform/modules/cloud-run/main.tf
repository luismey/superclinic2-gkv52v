# Provider configuration for Google Cloud with required versions
# hashicorp/google v4.0
# hashicorp/google-beta v4.0
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# Cloud Run service resource implementing the core service configuration
resource "google_cloud_run_service" "service" {
  provider = google-beta
  name     = var.service_name
  location = var.region
  project  = var.project_id

  template {
    spec {
      containers {
        image = var.image
        
        resources {
          limits = {
            memory = var.memory_limit
            cpu    = var.cpu_limit
          }
        }

        # Configure ports and environment variables
        ports {
          container_port = 8080
        }

        dynamic "env" {
          for_each = var.environment_variables
          content {
            name  = env.key
            value = env.value
          }
        }
      }

      # Service configuration for security and performance
      service_account_name = var.service_account_email
      timeout_seconds     = 300
      container_concurrency = 80
    }

    metadata {
      annotations = {
        # Autoscaling configuration based on technical specifications
        "autoscaling.knative.dev/minScale"      = var.min_instances
        "autoscaling.knative.dev/maxScale"      = var.max_instances
        
        # Performance and execution configurations
        "run.googleapis.com/cpu-throttling"     = "false"
        "run.googleapis.com/execution-environment" = "gen2"
        
        # Networking and security configurations
        "run.googleapis.com/vpc-access-connector" = var.vpc_connector
        "run.googleapis.com/ingress"             = var.ingress
        
        # Client identification for monitoring
        "run.googleapis.com/client-name"         = "terraform"
        
        # Launch stage configuration
        "run.googleapis.com/launch-stage"        = "BETA"
        
        # Conditional CloudSQL configuration
        "run.googleapis.com/cloudsql-instances"  = var.vpc_connector != null ? var.vpc_connector : null
      }

      labels = {
        app         = "porfin"
        environment = var.environment
        managed-by  = "terraform"
      }
    }
  }

  # Traffic configuration for zero-downtime deployments
  traffic {
    percent         = 100
    latest_revision = true
  }

  # Ensure smooth updates with minimal disruption
  autogenerate_revision_name = true

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"]
    ]
  }
}

# IAM configuration for service invocation
resource "google_cloud_run_service_iam_member" "service_invoker" {
  provider = google-beta
  location = var.region
  project  = var.project_id
  service  = google_cloud_run_service.service.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_email}"
}

# Additional IAM binding for load balancer access if required
resource "google_cloud_run_service_iam_member" "load_balancer_invoker" {
  count    = var.ingress == "internal-and-cloud-load-balancing" ? 1 : 0
  provider = google-beta
  location = var.region
  project  = var.project_id
  service  = google_cloud_run_service.service.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_email}-lb@${var.project_id}.iam.gserviceaccount.com"
}

# Outputs for service details
output "service_url" {
  description = "The URL of the deployed Cloud Run service"
  value       = google_cloud_run_service.service.status[0].url
}

output "service_name" {
  description = "The name of the deployed Cloud Run service"
  value       = google_cloud_run_service.service.name
}

output "latest_ready_revision_name" {
  description = "The name of the latest ready revision"
  value       = google_cloud_run_service.service.status[0].latest_ready_revision_name
}

output "service_status" {
  description = "The current status of the Cloud Run service"
  value       = google_cloud_run_service.service.status[0].conditions
}