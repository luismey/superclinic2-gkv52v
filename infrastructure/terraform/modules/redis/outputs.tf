# Redis instance hostname output
output "redis_host" {
  description = "The IP address or hostname of the Redis instance for secure client connections within the VPC"
  value       = google_redis_instance.cache.host
  
  # Best practice: Add precondition to ensure host is available
  precondition {
    condition     = google_redis_instance.cache.host != ""
    error_message = "Redis instance host cannot be empty."
  }
}

# Redis instance port output
output "redis_port" {
  description = "The port number of the Redis instance for firewall and security group configuration"
  value       = google_redis_instance.cache.port
  
  # Best practice: Add precondition to ensure valid port
  precondition {
    condition     = google_redis_instance.cache.port > 0 && google_redis_instance.cache.port < 65536
    error_message = "Redis instance port must be a valid port number (1-65535)."
  }
}

# Redis instance location output
output "redis_location" {
  description = "The current location/zone of the Redis instance for high-availability and disaster recovery planning"
  value       = google_redis_instance.cache.current_location_id
  
  # Best practice: Add precondition to ensure location is set
  precondition {
    condition     = google_redis_instance.cache.current_location_id != ""
    error_message = "Redis instance location must be specified."
  }
}

# Redis connection string output
output "redis_connection_string" {
  description = "The complete connection string for the Redis instance in standard format (host:port) for application configuration"
  value       = "${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
  
  # Best practice: Add precondition to ensure valid connection string
  precondition {
    condition     = google_redis_instance.cache.host != "" && google_redis_instance.cache.port > 0
    error_message = "Redis connection string components (host and port) must be valid."
  }
}

# Redis instance name output
output "redis_instance_name" {
  description = "The fully qualified name of the Redis instance for reference in other resources and monitoring"
  value       = google_redis_instance.cache.name
}

# Redis instance version output
output "redis_version" {
  description = "The Redis version running on the instance for compatibility verification"
  value       = google_redis_instance.cache.redis_version
}

# Redis instance tier output
output "redis_tier" {
  description = "The service tier of the Redis instance (BASIC or STANDARD_HA) for high-availability validation"
  value       = google_redis_instance.cache.tier
}

# Redis instance state output
output "redis_state" {
  description = "The current state of the Redis instance for operational validation"
  value       = google_redis_instance.cache.state
}

# Redis instance auth mode output
output "redis_auth_enabled" {
  description = "Indicates whether authentication is enabled on the Redis instance for security validation"
  value       = google_redis_instance.cache.auth_enabled
}

# Redis instance network info output
output "redis_network_info" {
  description = "Network configuration details of the Redis instance for connectivity validation"
  value = {
    authorized_network = google_redis_instance.cache.authorized_network
    connect_mode      = google_redis_instance.cache.connect_mode
  }
}

# Redis instance maintenance window output
output "redis_maintenance_window" {
  description = "Maintenance window configuration for the Redis instance for operational planning"
  value = {
    day        = google_redis_instance.cache.maintenance_policy[0].weekly_maintenance_window[0].day
    start_time = google_redis_instance.cache.maintenance_policy[0].weekly_maintenance_window[0].start_time
  }
}