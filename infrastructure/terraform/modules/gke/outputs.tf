# Core cluster outputs
output "cluster_id" {
  description = "The unique identifier of the GKE cluster"
  value       = google_container_cluster.primary.id
}

output "cluster_name" {
  description = "The name of the GKE cluster"
  value       = google_container_cluster.primary.name
}

output "cluster_location" {
  description = "The region or zone where the GKE cluster is deployed"
  value       = google_container_cluster.primary.location
}

output "cluster_endpoint" {
  description = "The IP address of the Kubernetes API server"
  value       = google_container_cluster.primary.endpoint
}

output "cluster_ca_certificate" {
  description = "The base64-encoded certificate authority data for the cluster"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

# Node pool information
output "node_pools" {
  description = "Map of node pool names to their configurations and status"
  value = {
    for pool in google_container_node_pool.primary_nodes : pool.name => {
      name           = pool.name
      node_count     = pool.node_count
      machine_type   = pool.node_config[0].machine_type
      disk_size_gb   = pool.node_config[0].disk_size_gb
      locations      = pool.node_locations
      min_count      = pool.autoscaling[0].min_node_count
      max_count      = pool.autoscaling[0].max_node_count
      service_account = pool.node_config[0].service_account
    }
  }
}

# Cluster version and configuration
output "cluster_version" {
  description = "The current version of the GKE cluster"
  value       = google_container_cluster.primary.master_version
}

# Monitoring configuration
output "cluster_monitoring_config" {
  description = "Monitoring configuration for the cluster"
  value = {
    enable_components     = google_container_cluster.primary.monitoring_config[0].enable_components
    managed_prometheus    = google_container_cluster.primary.monitoring_config[0].managed_prometheus[0].enabled
    logging_components   = google_container_cluster.primary.logging_config[0].enable_components
  }
}

# Auto-scaling configuration
output "cluster_scaling_config" {
  description = "Auto-scaling configuration for the cluster"
  value = {
    vertical_pod_autoscaling = google_container_cluster.primary.vertical_pod_autoscaling[0].enabled
    node_pools = {
      for pool in google_container_node_pool.primary_nodes : pool.name => {
        min_nodes = pool.autoscaling[0].min_node_count
        max_nodes = pool.autoscaling[0].max_node_count
      }
    }
  }
}

# Network configuration
output "cluster_network_config" {
  description = "Network configuration details for the cluster"
  value = {
    network           = google_container_cluster.primary.network
    subnetwork        = google_container_cluster.primary.subnetwork
    networking_mode   = google_container_cluster.primary.networking_mode
    pod_range_name    = google_container_cluster.primary.ip_allocation_policy[0].cluster_secondary_range_name
    service_range_name = google_container_cluster.primary.ip_allocation_policy[0].services_secondary_range_name
    private_nodes     = google_container_cluster.primary.private_cluster_config[0].enable_private_nodes
    private_endpoint  = google_container_cluster.primary.private_cluster_config[0].enable_private_endpoint
    master_ipv4_cidr = google_container_cluster.primary.private_cluster_config[0].master_ipv4_cidr_block
  }
}

# Workload identity configuration
output "workload_identity_config" {
  description = "Workload identity configuration for the cluster"
  value = {
    workload_pool = google_container_cluster.primary.workload_identity_config[0].workload_pool
  }
}

# Security configuration
output "security_config" {
  description = "Security-related configuration for the cluster"
  value = {
    network_policy_enabled = google_container_cluster.primary.network_policy[0].enabled
    binary_authorization   = google_container_cluster.primary.binary_authorization[0].evaluation_mode
    shielded_nodes        = true
    master_authorized_networks = [
      for block in google_container_cluster.primary.master_authorized_networks_config[0].cidr_blocks : {
        cidr_block   = block.cidr_block
        display_name = block.display_name
      }
    ]
  }
}