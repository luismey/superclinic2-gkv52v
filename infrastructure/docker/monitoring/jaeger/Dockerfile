# Use official Jaeger all-in-one image as base
FROM jaegertracing/all-in-one:1.45

# Labels for container metadata
LABEL maintainer="Porfin Platform Team" \
      description="Production-ready Jaeger all-in-one container for distributed tracing" \
      version="1.0.0"

# Set environment variables for optimized configuration
ENV JAEGER_SAMPLING_RATE=1.0 \
    JAEGER_BATCH_WORKERS=4 \
    JAEGER_QUEUE_SIZE=2000 \
    COLLECTOR_ZIPKIN_HOST_PORT=:9411 \
    MEMORY_MAX_TRACES=50000 \
    SPAN_STORAGE_TYPE=memory \
    QUERY_BASE_PATH=/jaeger \
    COLLECTOR_OTLP_ENABLED=true \
    METRICS_STORAGE_TYPE=prometheus \
    HEALTH_CHECK_HTTP_PORT=16686

# Create necessary directories
RUN mkdir -p /etc/jaeger/config /etc/jaeger/certs && \
    chown -R jaeger:jaeger /etc/jaeger

# Set working directory
WORKDIR /etc/jaeger

# Expose required ports
# UI and API endpoint
EXPOSE 16686/tcp
# gRPC collector
EXPOSE 14250/tcp
# Zipkin collector compatibility
EXPOSE 9411/tcp
# OTLP gRPC endpoint
EXPOSE 4317/tcp
# OTLP HTTP endpoint
EXPOSE 4318/tcp

# Volume mounts for configurations and certificates
VOLUME ["/etc/jaeger/config", "/etc/jaeger/certs"]

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:16686/jaeger/health || exit 1

# Resource limits (applied at runtime)
# memory=2Gi
# cpu=1000m
# storage=20Gi

# Enhanced entrypoint script for production configuration
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user for security
USER jaeger

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command (can be overridden)
CMD ["--sampling.strategies-file=/etc/jaeger/config/sampling.json", \
     "--collector.zipkin.host-port=:9411", \
     "--memory.max-traces=50000", \
     "--query.base-path=/jaeger", \
     "--collector.otlp.enabled=true", \
     "--collector.otlp.grpc.host-port=:4317", \
     "--collector.otlp.http.host-port=:4318", \
     "--agent.tags=environment=production,platform=porfin", \
     "--metrics-storage-type=prometheus", \
     "--health-check-http-port=16686"]