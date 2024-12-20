# Project and Region Configuration
project_id = "porfin-staging"
region     = "southamerica-east1"  # Brazil region for optimal latency
environment = "staging"

# GKE Cluster Configuration
gke_config = {
  cluster_name = "porfin-staging-cluster"
  node_pools = [
    {
      name          = "staging-pool"
      machine_type  = "e2-standard-4"  # 4 vCPU, 16GB memory for staging workloads
      min_count     = 3                # Minimum nodes for high availability
      max_count     = 15               # Scale up to handle load spikes
      disk_size_gb  = 100             # Sufficient for staging workloads
      preemptible   = true            # Cost optimization for staging
    }
  ]
  min_master_version = "1.27"          # Latest stable GKE version
  network_policy_enabled = true
  pod_security_policy_enabled = true
  max_pods_per_node = 110              # Default optimal pod density
  enable_autopilot = false             # Manual node configuration for staging
}

# Load Balancer Configuration
load_balancer_config = {
  name = "porfin-staging-lb"
  type = "EXTERNAL"
  ssl_certificates = []                # Will be populated by SSL cert module
  enable_cdn = true
  security_policy = "staging-security-policy"
  max_rps = 10000                      # Support 100+ msg/sec with headroom
  connection_draining_timeout_sec = 300
}

# Firestore Configuration
firestore_config = {
  location_id = "southamerica-east1"   # Brazil region for data residency
  database_type = "DATASTORE_MODE"
  enable_multi_region = false          # Single region for staging
  backup_schedule = "0 0 * * *"        # Daily backups
  retention_days = 7                   # 7-day backup retention
  max_capacity = 1000                  # 1TB capacity for staging
}

# Redis Configuration
redis_config = {
  tier = "STANDARD_HA"                 # High availability for session management
  memory_size_gb = 5                   # 5GB memory for staging cache
  version = "6.x"
  auth_enabled = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  maintenance_policy = {
    day = "SUNDAY"
    hour = 3                          # Maintenance during low traffic
  }
}

# PubSub Configuration
pubsub_config = {
  topic_configs = [
    {
      name = "whatsapp-messages"
      message_retention_duration = "24h"
      message_storage_policy = {
        allowed_persistence_regions = ["southamerica-east1"]
      }
      max_message_size = 10485760     # 10MB max message size
    },
    {
      name = "ai-processing"
      message_retention_duration = "24h"
      message_storage_policy = {
        allowed_persistence_regions = ["southamerica-east1"]
      }
      max_message_size = 10485760
    }
  ]
  subscription_configs = [
    {
      name = "whatsapp-processor"
      ack_deadline_seconds = 600
      message_retention_duration = "24h"
      retain_acked_messages = false
      enable_message_ordering = true
    },
    {
      name = "ai-processor"
      ack_deadline_seconds = 600
      message_retention_duration = "24h"
      retain_acked_messages = false
      enable_message_ordering = true
    }
  ]
}

# Network Configuration
network_config = {
  network_name = "porfin-staging-vpc"
  subnet_configs = [
    {
      name = "staging-subnet"
      ip_cidr_range = "10.10.0.0/20"
      region = "southamerica-east1"
      secondary_ip_ranges = {
        pods = "10.20.0.0/16"
        services = "10.30.0.0/16"
      }
    }
  ]
  enable_private_google_access = true
  enable_flow_logs = true
  firewall_rules = [
    {
      name = "allow-internal"
      direction = "INGRESS"
      priority = 1000
      ranges = ["10.0.0.0/8"]
      ports = ["0-65535"]
    },
    {
      name = "allow-healthcheck"
      direction = "INGRESS"
      priority = 1000
      ranges = ["35.191.0.0/16", "130.211.0.0/22"]
      ports = ["80", "443"]
    }
  ]
}

# Monitoring Configuration
monitoring_config = {
  notification_channels = [
    {
      type = "email"
      labels = {
        email_address = "staging-alerts@porfin.com"
      }
    }
  ]
  alert_policies = [
    {
      display_name = "High Latency Alert"
      conditions = [
        {
          display_name = "HTTP Response Latency"
          threshold = 500              # 500ms latency threshold
          duration = "300s"
        }
      ]
      notification_channels = ["email"]
    },
    {
      display_name = "Error Rate Alert"
      conditions = [
        {
          display_name = "Error Rate"
          threshold = 5                # 5% error rate threshold
          duration = "300s"
        }
      ]
      notification_channels = ["email"]
    }
  ]
  uptime_check_configs = [
    {
      display_name = "Staging API Health"
      period = "300s"
      timeout = "5s"
      content_matchers = [
        {
          content = "OK"
          matcher = "CONTAINS"
        }
      ]
    }
  ]
}

# Backup Configuration
backup_config = {
  schedule = "0 0 * * *"              # Daily backups at midnight
  retention_days = 7                  # 7-day retention for staging
  geo_redundant = false              # Single region backup for staging
  backup_regions = ["southamerica-east1"]
  encryption_key = ""                # Using Google-managed keys for staging
}