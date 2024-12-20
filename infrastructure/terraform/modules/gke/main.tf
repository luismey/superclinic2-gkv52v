# Provider configuration
# hashicorp/google v4.0
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

# Local variables for configuration management
locals {
  cluster_name = "${var.cluster_config.name}-${var.environment}"
  
  # Default node locations for multi-zone deployment
  node_locations = [
    "${var.region}-a",
    "${var.region}-b",
    "${var.region}-c"
  ]

  # Common labels for all resources
  common_labels = {
    environment = var.environment
    managed-by  = "terraform"
    project     = var.project_id
    application = "porfin"
  }

  # Network tags for security
  network_tags = [
    "gke-${local.cluster_name}",
    var.environment
  ]

  # Security configurations
  master_authorized_networks = [
    {
      cidr_block   = "10.0.0.0/8"
      display_name = "Internal VPC"
    }
  ]
}

# Primary GKE cluster resource
resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = local.cluster_name
  location = var.region
  
  # Multi-zone configuration
  node_locations = local.node_locations

  # Networking
  network    = var.cluster_config.network
  subnetwork = var.cluster_config.subnetwork

  # Cluster configuration
  min_master_version = "1.27"
  release_channel {
    channel = "REGULAR"
  }

  # Initial node configuration
  initial_node_count = 3
  
  # Remove default node pool
  remove_default_node_pool = true

  # Networking mode
  networking_mode = "VPC_NATIVE"
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Workload identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Binary authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Resource labels
  resource_labels = local.common_labels

  # Addons configuration
  addons_config {
    http_load_balancing {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    cloud_run_config {
      disabled = false
    }
    gcp_filestore_csi_driver_config {
      enabled = true
    }
  }

  # Network policy
  network_policy {
    enabled = true
    provider = "CALICO"
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block = "172.16.0.0/28"
  }

  # Master authorized networks
  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = local.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Maintenance policy
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T00:00:00Z"
      end_time   = "2023-01-02T00:00:00Z"
      recurrence = "FREQ=WEEKLY"
    }
  }

  # Resource usage export
  resource_usage_export_config {
    enable_network_egress_metering = true
    bigquery_destination {
      dataset_id = "cluster_resource_usage"
    }
  }

  # Vertical pod autoscaling
  vertical_pod_autoscaling {
    enabled = true
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = true
    }
  }
}

# Node pool configuration
resource "google_container_node_pool" "primary_nodes" {
  provider = google-beta

  for_each = var.node_pools

  name       = each.key
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = each.value.initial_node_count

  # Autoscaling configuration
  autoscaling {
    min_node_count = each.value.min_count
    max_node_count = each.value.max_count
  }

  # Node configuration
  node_config {
    machine_type = each.value.machine_type
    disk_size_gb = each.value.disk_size_gb
    disk_type    = "pd-ssd"

    # Labels and tags
    labels = merge(local.common_labels, each.value.labels)
    tags   = local.network_tags

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Service account
    service_account = each.value.service_account
  }

  # Management configuration
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  # Node pool depends on cluster
  depends_on = [
    google_container_cluster.primary
  ]
}

# IAM configuration for workload identity
resource "google_service_account_iam_binding" "workload_identity" {
  for_each = var.node_pools

  service_account_id = each.value.service_account
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[${each.key}]"
  ]
}