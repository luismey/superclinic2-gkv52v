# Core project configuration
project_id = "porfin-prod"
region     = "southamerica-east1"  # São Paulo region for Brazilian market
environment = "prod"

# GKE cluster configuration for high availability and performance
gke_config = {
  cluster_name = "porfin-prod-cluster"
  node_pools = [
    {
      name          = "general-pool"
      machine_type  = "e2-standard-4"  # 4 vCPU, 16GB RAM
      min_count     = 3
      max_count     = 15               # Scale up to 15 nodes based on load
      disk_size_gb  = 100
      preemptible   = false           # Use regular nodes for production stability
    },
    {
      name          = "ai-pool"
      machine_type  = "e2-standard-8"  # 8 vCPU, 32GB RAM for AI workloads
      min_count     = 2
      max_count     = 10
      disk_size_gb  = 200
      preemptible   = false
    }
  ]
  min_master_version = "1.27"
  network_policy_enabled = true
  pod_security_policy_enabled = true
  max_pods_per_node = 110             # Kubernetes recommended limit
  enable_autopilot = false            # Custom node configuration needed
}

# Load balancer configuration for high throughput
load_balancer_config = {
  name = "porfin-prod-lb"
  type = "EXTERNAL_MANAGED"
  ssl_certificates = ["porfin-prod-cert"]
  enable_cdn = true
  security_policy = "porfin-prod-security-policy"
  max_rps = 100000                    # Support 100k requests/second
  connection_draining_timeout_sec = 300
}

# Firestore configuration for high availability
firestore_config = {
  location_id = "southamerica-east1"
  database_type = "FIRESTORE_NATIVE"
  enable_multi_region = true
  backup_schedule = "0 */4 * * *"     # Backup every 4 hours
  retention_days = 30
  max_capacity = 5000                 # 5TB initial capacity, can be increased
}

# Redis configuration for session management
redis_config = {
  tier = "STANDARD_HA"
  memory_size_gb = 5                  # 5GB memory for caching
  version = "6.x"
  auth_enabled = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  maintenance_policy = {
    day = "SUNDAY"
    hour = 3                          # Maintenance window at 3 AM
  }
}

# PubSub configuration for message processing
pubsub_config = {
  topic_configs = [
    {
      name = "whatsapp-messages"
      message_retention_duration = "86400s"  # 24 hour retention
      message_storage_policy = {
        allowed_persistence_regions = ["southamerica-east1"]
      }
      max_message_size = 10485760     # 10MB max message size
    },
    {
      name = "ai-processing"
      message_retention_duration = "3600s"   # 1 hour retention
      message_storage_policy = {
        allowed_persistence_regions = ["southamerica-east1"]
      }
      max_message_size = 10485760
    }
  ]
  subscription_configs = [
    {
      name = "whatsapp-processor"
      ack_deadline_seconds = 60
      message_retention_duration = "86400s"
      retain_acked_messages = false
      enable_message_ordering = true
    },
    {
      name = "ai-processor"
      ack_deadline_seconds = 120
      message_retention_duration = "3600s"
      retain_acked_messages = false
      enable_message_ordering = true
    }
  ]
}

# Network configuration with security controls
network_config = {
  network_name = "porfin-prod-vpc"
  subnet_configs = [
    {
      name = "porfin-prod-subnet"
      ip_cidr_range = "10.0.0.0/20"
      region = "southamerica-east1"
      secondary_ip_ranges = {
        pods = "10.1.0.0/16"
        services = "10.2.0.0/20"
      }
    }
  ]
  enable_private_google_access = true
  enable_flow_logs = true
  firewall_rules = [
    {
      name = "allow-healthcheck"
      direction = "INGRESS"
      priority = 1000
      ranges = ["130.211.0.0/22", "35.191.0.0/16"]
      ports = ["80", "443"]
    },
    {
      name = "allow-internal"
      direction = "INGRESS"
      priority = 1000
      ranges = ["10.0.0.0/20"]
      ports = ["0-65535"]
    }
  ]
}

# Monitoring configuration with strict thresholds
monitoring_config = {
  notification_channels = [
    {
      type = "email"
      labels = {
        email_address = "alerts@porfin.com"
      }
    },
    {
      type = "slack"
      labels = {
        channel_name = "#porfin-alerts"
      }
    }
  ]
  alert_policies = [
    {
      display_name = "High Error Rate"
      conditions = [
        {
          display_name = "Error Rate > 0.1%"
          threshold = 0.001
          duration = "300s"
        }
      ]
      notification_channels = ["email", "slack"]
    },
    {
      display_name = "High Latency"
      conditions = [
        {
          display_name = "P95 Latency > 500ms"
          threshold = 500
          duration = "300s"
        }
      ]
      notification_channels = ["email", "slack"]
    }
  ]
  uptime_check_configs = [
    {
      display_name = "HTTPS Uptime Check"
      period = "60s"
      timeout = "5s"
      content_matchers = [
        {
          content = "200 OK"
          matcher = "CONTAINS_STRING"
        }
      ]
    }
  ]
}

# Backup configuration for disaster recovery
backup_config = {
  schedule = "0 0 * * *"             # Daily backups
  retention_days = 30
  geo_redundant = true
  backup_regions = ["us-east1"]      # Secondary region for DR
  encryption_key = "porfin-prod-backup-key"
}