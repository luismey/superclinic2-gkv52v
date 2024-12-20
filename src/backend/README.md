# Porfin Backend Service

## Overview

Porfin Backend is an AI-powered business management platform built with FastAPI, designed specifically for healthcare professionals in Brazil. The service provides robust APIs for WhatsApp integration, AI-powered virtual assistants, and comprehensive business analytics.

## Prerequisites

- Python 3.11+
- Poetry 1.5+
- Docker 24.0+
- Docker Compose 3.8
- Google Cloud SDK
- Firebase Admin SDK

## Development Setup

### Environment Configuration

1. **Cloud Service Credentials**
```bash
# GCP Configuration
gcloud auth application-default login
gcloud config set project porfin-production

# Firebase Setup
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
```

2. **Environment Variables**
```bash
# Create .env file
cp .env.example .env

# Required variables
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/porfin
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=your-openai-key
WHATSAPP_API_KEY=your-whatsapp-key
```

### Local Development

1. **Poetry Setup**
```bash
# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate virtual environment
poetry shell
```

2. **Development Server**
```bash
# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Access API documentation
# Browse to http://localhost:8000/docs
```

### Docker Development

1. **Container Setup**
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# Run migrations
docker-compose exec api alembic upgrade head
```

2. **Development Commands**
```bash
# View logs
docker-compose logs -f api

# Execute tests
docker-compose exec api pytest

# Access shell
docker-compose exec api poetry run python
```

## Security Configuration

### Authentication

- JWT-based authentication with Firebase Auth
- OAuth2 integration for social login
- Refresh token rotation
- Rate limiting per user/IP

### Authorization

```python
# RBAC Configuration
ROLE_PERMISSIONS = {
    'admin': ['full_access'],
    'manager': ['read_all', 'write_limited'],
    'secretary': ['read_limited', 'write_basic']
}

# Security Headers
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}
```

### Data Protection

- AES-256 encryption for sensitive data
- TLS 1.3 for all connections
- Field-level encryption in Firestore
- Secure key management with Google KMS

## Testing

### Unit Tests
```bash
# Run tests
poetry run pytest

# With coverage
poetry run pytest --cov=app --cov-report=html

# Run specific tests
poetry run pytest tests/api/test_auth.py -v
```

### Integration Tests
```bash
# Run integration tests
poetry run pytest tests/integration -v

# Run with environment
ENV=staging poetry run pytest tests/integration
```

### Performance Testing
```bash
# Load testing with locust
poetry run locust -f tests/performance/locustfile.py
```

## Deployment

### Environment Setup

1. **Development**
```bash
# Deploy to Cloud Run
gcloud run deploy porfin-api-dev \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated
```

2. **Staging**
```bash
# Deploy to GKE
kubectl apply -f k8s/staging/
kubectl set image deployment/porfin-api \
    api=gcr.io/porfin/api:staging
```

3. **Production**
```bash
# Production deployment
kubectl apply -f k8s/production/
kubectl set image deployment/porfin-api \
    api=gcr.io/porfin/api:production
```

### Monitoring

```bash
# View application logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=porfin-api"

# Monitor metrics
gcloud monitoring dashboards create --config-from-file=monitoring/dashboard.json
```

### Maintenance

```bash
# Database backup
gcloud sql backups create --instance=porfin-db

# Restore from backup
gcloud sql backups restore [BACKUP_ID] --restore-instance=porfin-db
```

## API Documentation

- OpenAPI documentation: `http://localhost:8000/docs`
- ReDoc interface: `http://localhost:8000/redoc`
- Postman collection: `docs/postman/porfin-api.json`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Run tests
5. Submit pull request

## License

Copyright © 2023 Porfin. All rights reserved.

## Support

For technical support, contact:
- Email: tech-support@porfin.com
- Slack: #porfin-backend