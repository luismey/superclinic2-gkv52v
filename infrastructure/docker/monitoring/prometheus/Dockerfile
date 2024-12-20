# Start with official Prometheus base image
# prom/prometheus:v2.45.0
FROM prom/prometheus:v2.45.0 AS builder

# Build arguments
ARG PROMETHEUS_VERSION=v2.45.0
ARG CONFIG_VERSION=v1

# Labels for container identification and compliance
LABEL app="porfin" \
    component="monitoring" \
    service="prometheus" \
    version="${PROMETHEUS_VERSION}" \
    config_version="${CONFIG_VERSION}" \
    security.compliance="high"

# Environment variables for configuration
ENV PROMETHEUS_CONFIG_PATH=/etc/prometheus/prometheus.yml \
    PROMETHEUS_STORAGE_PATH=/prometheus \
    PROMETHEUS_RETENTION_PERIOD=15d \
    PROMETHEUS_STORAGE_MAX_BLOCKS=5 \
    PROMETHEUS_QUERY_MAX_SAMPLES=50000000

# Create necessary directories with correct permissions
RUN mkdir -p /etc/prometheus/rules && \
    mkdir -p "${PROMETHEUS_STORAGE_PATH}" && \
    chown -R nobody:nobody /etc/prometheus "${PROMETHEUS_STORAGE_PATH}"

# Copy Prometheus configuration files
COPY --chown=nobody:nobody prometheus.yml /etc/prometheus/
COPY --chown=nobody:nobody recording_rules.yml /etc/prometheus/rules/
COPY --chown=nobody:nobody alerting_rules.yml /etc/prometheus/rules/

# Validate configuration files
RUN promtool check config /etc/prometheus/prometheus.yml && \
    promtool check rules /etc/prometheus/rules/*.yml

# Set up optimized storage settings
RUN echo "storage:" >> /etc/prometheus/prometheus.yml && \
    echo "  tsdb:" >> /etc/prometheus/prometheus.yml && \
    echo "    retention.time: ${PROMETHEUS_RETENTION_PERIOD}" >> /etc/prometheus/prometheus.yml && \
    echo "    max_blocks: ${PROMETHEUS_STORAGE_MAX_BLOCKS}" >> /etc/prometheus/prometheus.yml && \
    echo "    wal:" >> /etc/prometheus/prometheus.yml && \
    echo "      retention.time: 12h" >> /etc/prometheus/prometheus.yml

# Configure security settings
USER nobody
WORKDIR /prometheus

# Expose Prometheus web interface
EXPOSE 9090

# Volume configuration
VOLUME ["/etc/prometheus", "/prometheus"]

# Health check configuration
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy || exit 1

# Command to run Prometheus with optimized settings
CMD [ \
    "--config.file=/etc/prometheus/prometheus.yml", \
    "--storage.tsdb.path=/prometheus", \
    "--storage.tsdb.retention.time=${PROMETHEUS_RETENTION_PERIOD}", \
    "--storage.tsdb.max-block-duration=2h", \
    "--storage.tsdb.min-block-duration=2h", \
    "--web.console.libraries=/usr/share/prometheus/console_libraries", \
    "--web.console.templates=/usr/share/prometheus/consoles", \
    "--web.enable-lifecycle", \
    "--web.enable-admin-api=false", \
    "--web.max-connections=512", \
    "--query.max-samples=${PROMETHEUS_QUERY_MAX_SAMPLES}", \
    "--log.level=info" \
]

# Security hardening
STOPSIGNAL SIGTERM

# Read-only root filesystem
RUN chmod -R 444 /etc/prometheus && \
    chmod -R 444 /usr/share/prometheus && \
    chmod -R 755 /prometheus

# Drop all capabilities and enforce security context
SECURITY_OPT --cap-drop=ALL --security-opt=no-new-privileges:true \
    --security-opt=seccomp=unconfined

# Set resource limits
LIMIT_CPU=2
LIMIT_MEMORY=4Gi
REQUEST_CPU=500m
REQUEST_MEMORY=2Gi