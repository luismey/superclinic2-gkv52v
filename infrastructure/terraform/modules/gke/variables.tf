# GKE Module Variables for Porfin Platform
# Terraform >= 1.0.0

variable "environment" {
  description = "Deployment environment (staging or production)"
  type        = string
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be either 'staging' or 'prod'"
  }
}

variable "cluster_config" {
  description = "GKE cluster configuration settings"
  type = object({
    name                           = string
    min_master_version            = string
    release_channel               = string
    initial_node_count           = number
    networking_mode              = string
    enable_workload_identity     = bool
    enable_binary_authorization  = bool
    enable_network_policy        = bool
    enable_vertical_pod_autoscaling = bool
    max_pods_per_node           = number
    enable_autopilot            = bool
    enable_cluster_autoscaling  = bool
    cluster_autoscaling_profile = string
    resource_limits = object({
      cpu = object({
        min = number
        max = number
      })
      memory = object({
        min = string
        max = string
      })
    })
  })

  default = {
    name                           = "porfin"
    min_master_version            = "1.27"
    release_channel               = "REGULAR"
    initial_node_count           = 3
    networking_mode              = "VPC_NATIVE"
    enable_workload_identity     = true
    enable_binary_authorization  = true
    enable_network_policy        = true
    enable_vertical_pod_autoscaling = true
    max_pods_per_node           = 1000
    enable_autopilot            = false
    enable_cluster_autoscaling  = true
    cluster_autoscaling_profile = "BALANCED"
    resource_limits = {
      cpu = {
        min = 1
        max = 200
      }
      memory = {
        min = "4Gi"
        max = "800Gi"
      }
    }
  }

  validation {
    condition     = var.cluster_config.max_pods_per_node <= 1000
    error_message = "Maximum pods per node cannot exceed 1000 as per technical specifications."
  }
}

variable "node_pools" {
  description = "Configuration for GKE node pools"
  type = map(object({
    machine_type  = string
    disk_size_gb  = number
    disk_type     = string
    min_node_count = number
    max_node_count = number
    auto_repair    = bool
    auto_upgrade   = bool
    preemptible    = bool
    oauth_scopes   = list(string)
    labels         = map(string)
    taints        = list(object({
      key    = string
      value  = string
      effect = string
    }))
    tags          = list(string)
  }))

  default = {
    "default-pool" = {
      machine_type  = "e2-standard-4"
      disk_size_gb  = 100
      disk_type     = "pd-ssd"
      min_node_count = 3
      max_node_count = 15
      auto_repair    = true
      auto_upgrade   = true
      preemptible    = false
      oauth_scopes   = ["https://www.googleapis.com/auth/cloud-platform"]
      labels = {
        environment = "prod"
        pool-type   = "default"
      }
      taints = []
      tags   = ["porfin-gke-node"]
    }
    "high-memory-pool" = {
      machine_type  = "e2-highmem-8"
      disk_size_gb  = 200
      disk_type     = "pd-ssd"
      min_node_count = 1
      max_node_count = 10
      auto_repair    = true
      auto_upgrade   = true
      preemptible    = false
      labels = {
        environment = "prod"
        pool-type   = "high-memory"
      }
      taints = []
      tags   = ["porfin-gke-node"]
      oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    }
  }
}

variable "network_config" {
  description = "Network configuration for GKE cluster"
  type = object({
    network_name               = string
    subnet_name               = string
    master_ipv4_cidr_block    = string
    pods_ipv4_cidr_block      = string
    services_ipv4_cidr_block  = string
    enable_intranode_visibility = bool
    enable_dataplane_v2        = bool
    enable_l4_ilb_subsetting   = bool
    dns_config = object({
      cluster_dns       = string
      cluster_dns_scope = string
      enable_logging    = bool
    })
  })

  default = {
    network_name               = "porfin-vpc"
    subnet_name               = "porfin-subnet"
    master_ipv4_cidr_block    = "172.16.0.0/28"
    pods_ipv4_cidr_block      = "10.0.0.0/14"
    services_ipv4_cidr_block  = "10.4.0.0/19"
    enable_intranode_visibility = true
    enable_dataplane_v2        = true
    enable_l4_ilb_subsetting   = true
    dns_config = {
      cluster_dns       = "CLOUD_DNS"
      cluster_dns_scope = "VPC_SCOPE"
      enable_logging    = true
    }
  }
}

variable "security_config" {
  description = "Security configuration for GKE cluster"
  type = object({
    enable_private_nodes     = bool
    enable_private_endpoint  = bool
    master_authorized_networks = list(object({
      cidr_block   = string
      display_name = string
    }))
    enable_shielded_nodes        = bool
    enable_secure_boot           = bool
    enable_integrity_monitoring  = bool
    enable_identity_service      = bool
    workload_identity_config     = object({
      identity_namespace = string
    })
    pod_security_policy_config   = object({
      enabled = bool
    })
    master_auth = object({
      client_certificate_config = object({
        issue_client_certificate = bool
      })
    })
  })

  default = {
    enable_private_nodes     = true
    enable_private_endpoint  = false
    master_authorized_networks = [
      {
        cidr_block   = "10.0.0.0/8"
        display_name = "Internal VPC"
      }
    ]
    enable_shielded_nodes        = true
    enable_secure_boot           = true
    enable_integrity_monitoring  = true
    enable_identity_service      = true
    workload_identity_config     = {
      identity_namespace = "project_id.svc.id.goog"
    }
    pod_security_policy_config   = {
      enabled = true
    }
    master_auth = {
      client_certificate_config = {
        issue_client_certificate = false
      }
    }
  }
}

variable "maintenance_config" {
  description = "Maintenance window and update configuration"
  type = object({
    maintenance_start_time = string
    maintenance_end_time   = string
    maintenance_recurrence = string
    maintenance_exclusion_timewindow = list(object({
      start_time      = string
      end_time        = string
      exclusion_name  = string
    }))
    notification_config = object({
      pubsub = object({
        enabled = bool
        topic   = string
      })
    })
  })

  default = {
    maintenance_start_time = "02:00"
    maintenance_end_time   = "06:00"
    maintenance_recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    maintenance_exclusion_timewindow = [
      {
        start_time      = "2023-12-20T00:00:00Z"
        end_time        = "2024-01-05T00:00:00Z"
        exclusion_name  = "yearend-freeze"
      }
    ]
    notification_config = {
      pubsub = {
        enabled = true
        topic   = "projects/project_id/topics/gke-notifications"
      }
    }
  }
}