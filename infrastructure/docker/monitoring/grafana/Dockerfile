# Use official Grafana image as base
# grafana/grafana version: 9.5.3
FROM grafana/grafana:9.5.3

# Add metadata labels
LABEL app="grafana" \
    component="monitoring" \
    part-of="porfin" \
    version="9.5.3" \
    environment="production"

# Set environment variables for security and plugins
ENV GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER} \
    GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD} \
    GF_SECURITY_SECRET_KEY=${GRAFANA_SECRET_KEY} \
    GF_INSTALL_PLUGINS="grafana-piechart-panel,grafana-worldmap-panel" \
    GF_AUTH_ANONYMOUS_ENABLED="false" \
    GF_SECURITY_ALLOW_EMBEDDING="false"

# Create necessary directories with proper permissions
USER root
RUN mkdir -p /etc/grafana \
    /var/lib/grafana \
    /var/log/grafana && \
    chown -R grafana:grafana /etc/grafana \
    /var/lib/grafana \
    /var/log/grafana && \
    chmod -R 755 /etc/grafana \
    /var/lib/grafana \
    /var/log/grafana

# Copy configuration files
COPY --chown=grafana:grafana ./config/grafana.ini /etc/grafana/grafana.ini
COPY --chown=grafana:grafana ./config/datasources /etc/grafana/provisioning/datasources
COPY --chown=grafana:grafana ./config/dashboards /etc/grafana/provisioning/dashboards

# Install additional plugins
RUN grafana-cli plugins install ${GF_INSTALL_PLUGINS}

# Set correct file permissions
RUN chmod 644 /etc/grafana/grafana.ini && \
    chmod -R 644 /etc/grafana/provisioning/datasources/* && \
    chmod -R 644 /etc/grafana/provisioning/dashboards/*

# Expose Grafana web interface port
EXPOSE 3000/tcp

# Configure healthcheck
HEALTHCHECK --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health || exit 1

# Volume configuration for persistence
VOLUME ["/etc/grafana", "/var/lib/grafana", "/var/log/grafana"]

# Switch to non-root user
USER grafana

# Default command (inherited from base image)
CMD ["/run.sh"]