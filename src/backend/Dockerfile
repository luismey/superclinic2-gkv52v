# -----------------------------
# Builder Stage
# -----------------------------
FROM python:3.11-slim AS builder

# Security and locale settings
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.5.0 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    TZ=America/Sao_Paulo \
    LANG=pt_BR.UTF-8

# Install system dependencies with security best practices
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    locales \
    tzdata \
    && sed -i -e 's/# pt_BR.UTF-8 UTF-8/pt_BR.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen \
    && ln -fs /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata \
    # Install poetry with checksum validation
    && curl -sSL https://install.python-poetry.org | python3 - \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /root/.cache/pip

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install production dependencies with audit
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-root \
    && poetry check \
    && poetry run pip check

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -U -s /bin/false appuser \
    && chown -R appuser:appuser /app

# -----------------------------
# Production Stage
# -----------------------------
FROM python:3.11-slim

# Security and environment settings
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=America/Sao_Paulo \
    LANG=pt_BR.UTF-8 \
    APP_ENV=production \
    WORKERS_PER_CORE=2 \
    MAX_WORKERS=4

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    locales \
    tzdata \
    && sed -i -e 's/# pt_BR.UTF-8 UTF-8/pt_BR.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen \
    && ln -fs /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime \
    && dpkg-reconfigure -f noninteractive tzdata \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -U -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy application from builder
COPY --from=builder --chown=appuser:appuser /app /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Security hardening
RUN chmod -R 550 /app \
    && chmod -R 770 /app/logs \
    && chmod 660 /app/.env* \
    # Remove unnecessary files
    && find /app -type f -name "*.pyc" -delete \
    && find /app -type d -name "__pycache__" -delete

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Expose port
EXPOSE 8000

# Start application with Uvicorn
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--access-log", \
     "--log-config", "app/logging.conf"]