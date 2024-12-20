# Contributing to Porfin

## Table of Contents
- [Introduction](#introduction)
- [Development Environment Setup](#development-environment-setup)
- [Code Standards](#code-standards)
- [Contribution Workflow](#contribution-workflow)
- [Testing Requirements](#testing-requirements)
- [Security Guidelines](#security-guidelines)
- [Documentation](#documentation)

## Introduction

Welcome to Porfin - Brazil's leading AI-powered business management platform for healthcare professionals. We're excited that you're interested in contributing to our platform that helps healthcare providers optimize their patient communications and business processes through WhatsApp integration.

As a healthcare-focused platform operating in Brazil, we maintain strict compliance with LGPD (Lei Geral de Proteção de Dados) and healthcare regulations. All contributions must adhere to these requirements to ensure the security and privacy of sensitive healthcare data.

## Development Environment Setup

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| VS Code | Latest | Primary IDE with required extensions |
| Docker | 24.0+ | Containerization with healthcare security |
| pnpm | 8.0+ | Frontend package management |
| Poetry | 1.5+ | Backend dependency management |

### Setup Steps

1. **Repository Setup**
   ```bash
   # Clone using SSH for security
   git clone git@github.com:porfin/platform.git
   cd platform

   # Install Poetry for backend
   curl -sSL https://install.python-poetry.org | python3 -

   # Install pnpm for frontend
   npm install -g pnpm@8
   ```

2. **Environment Configuration**
   ```bash
   # Create and activate virtual environment
   poetry install
   poetry shell

   # Install frontend dependencies
   pnpm install

   # Configure pre-commit hooks
   pre-commit install
   ```

3. **Required VS Code Extensions**
   - Python
   - TypeScript + JavaScript
   - ESLint
   - Prettier
   - Docker
   - GitLens
   - Python Test Explorer

## Code Standards

### Python Standards

- **Style Guide**: Follow PEP 8 with healthcare-specific naming conventions
  ```python
  # Example of healthcare-specific naming
  class PatientDataProcessor:
      def process_sensitive_health_data(self, patient_data: PatientData) -> ProcessedData:
          """
          Process patient health data with LGPD compliance.
          
          Args:
              patient_data (PatientData): Encrypted patient information
              
          Returns:
              ProcessedData: Processed and sanitized data
          """
          # Implementation
  ```

- **Type Hints**: Mandatory with strict mode
  ```python
  from typing import Optional, List
  
  def get_patient_records(
      patient_id: str,
      date_range: Optional[DateRange] = None
  ) -> List[PatientRecord]:
      # Implementation
  ```

### TypeScript Standards

- **Style Guide**: ESLint + Prettier with healthcare rules
  ```typescript
  // Example of healthcare component
  interface PatientDataProps {
    readonly patientId: string;
    readonly healthcareData: EncryptedHealthData;
  }

  const PatientDataDisplay: React.FC<PatientDataProps> = ({
    patientId,
    healthcareData,
  }) => {
    // Implementation
  };
  ```

## Contribution Workflow

1. **Branch Creation**
   ```bash
   # Feature branch
   git checkout -b feature/PORF-123-patient-data-encryption

   # Bugfix branch
   git checkout -b bugfix/PORF-456-fix-data-leak
   ```

2. **Commit Messages**
   ```
   feat(security): implement LGPD-compliant data encryption
   fix(privacy): resolve patient data exposure in logs
   docs(compliance): update LGPD documentation
   ```

3. **Pull Request Process**
   - Use the provided PR template
   - Complete security checklist
   - Ensure LGPD compliance
   - Add tests with security cases
   - Update documentation

## Testing Requirements

### Backend Testing
```python
# Example test with security focus
def test_patient_data_encryption():
    patient_data = PatientData(name="Test Patient", health_record="Sensitive")
    processor = PatientDataProcessor()
    
    processed_data = processor.process_sensitive_health_data(patient_data)
    
    assert processed_data.is_encrypted
    assert not processed_data.contains_pii
```

### Frontend Testing
```typescript
// Example component test with accessibility
describe('PatientDataComponent', () => {
  it('should not expose sensitive data in DOM', () => {
    const { container } = render(
      <PatientDataComponent patientId="123" healthcareData={mockData} />
    );
    
    expect(container).not.toHaveTextContent(/CPF|RG/);
    expect(container).toBeAccessible();
  });
});
```

## Security Guidelines

### Code Review Security Checklist

- [ ] No sensitive data exposure
- [ ] LGPD compliance verified
- [ ] Proper data encryption
- [ ] Access control implemented
- [ ] Input validation present
- [ ] Audit logging configured
- [ ] Error handling secure
- [ ] Dependencies scanned

### Sensitive Data Handling

```python
# Example of secure data handling
class SensitiveDataHandler:
    def __init__(self):
        self.encryption_key = get_encryption_key()
    
    def process_healthcare_data(self, data: HealthcareData) -> ProcessedData:
        try:
            sanitized_data = self.sanitize_pii(data)
            encrypted_data = self.encrypt_data(sanitized_data)
            return encrypted_data
        except Exception as e:
            log_security_event(e)
            raise SecurityException("Data processing failed")
```

## Documentation

### Code Documentation

- All code must be documented in both Portuguese and English
- Security-sensitive code must include compliance notes
- API endpoints must have OpenAPI documentation
- Components must include accessibility documentation

### Example Documentation
```python
def process_patient_data(patient_data: PatientData) -> ProcessedData:
    """
    Process patient data following LGPD guidelines.
    Processa dados do paciente seguindo diretrizes LGPD.

    Args:
        patient_data (PatientData): Encrypted patient information
                                  Informações criptografadas do paciente

    Returns:
        ProcessedData: Processed and compliant data
                      Dados processados e em conformidade

    Security:
        - Implements LGPD Article 46 encryption requirements
        - Logs all data access attempts
        - Sanitizes PII before processing
    """
    # Implementation
```

## Questions or Need Help?

- Join our Slack channel: #porfin-dev
- Email: dev@porfin.com.br
- Security issues: security@porfin.com.br

Remember: Security and privacy are our top priorities. When in doubt, always err on the side of caution and consult the security team.