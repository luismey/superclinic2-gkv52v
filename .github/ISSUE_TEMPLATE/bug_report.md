---
name: Bug Report
about: Report a bug in the Porfin platform
title: '[BUG] '
labels: bug
assignees: ''
---

<!-- 
IMPORTANT: Please ensure no sensitive data or personally identifiable information is included in this report.
All data must comply with LGPD (Brazilian General Data Protection Law) requirements.
-->

## Bug Description

### Summary
<!-- Provide a clear and concise description of the bug -->

### Environment
<!-- Select the environment where the bug was encountered -->
- [ ] Production
- [ ] Staging
- [ ] Development

### Component
<!-- Select the affected component -->
- [ ] Frontend - Web Application
- [ ] Backend - API Service
- [ ] WhatsApp Integration
- [ ] AI Service
- [ ] Analytics Service
- [ ] Payment Processing
- [ ] Calendar Integration
- [ ] Infrastructure
- [ ] Database
- [ ] Cache Layer
- [ ] Message Queue

### Severity
<!-- Select the appropriate severity level -->
- [ ] Critical - Service Outage
- [ ] Critical - Data Loss
- [ ] High - Functionality Broken
- [ ] Medium - Feature Degraded
- [ ] Low - Minor Issue

### Language
<!-- Select the language used when encountering the bug -->
- [ ] Portuguese
- [ ] English

## Reproduction Steps

### Prerequisites
<!-- List any required setup or conditions needed to reproduce the bug -->

### Steps to Reproduce
1. 
2. 
3. 
<!-- Add more steps as needed -->

### Expected Behavior
<!-- Describe what should happen -->

### Actual Behavior
<!-- Describe what actually happens -->

## Technical Details

### Performance Metrics
<!-- Include if performance-related issue -->
- Message Processing Rate: ___ msg/sec
- Latency: ___ ms

### System Metrics
<!-- Include for infrastructure/backend issues -->
- CPU Usage: ____%
- Memory Usage: ____%

### Environment Details
<!-- Include for frontend/UI issues -->
- Browser: <!-- e.g., Chrome 120.0.6099.109 -->
- Device: <!-- e.g., Windows 11, MacBook Pro M1 -->

### Error Logs
<!-- Include relevant error logs or stack traces -->
<details>
<summary>Logs</summary>

```
<!-- Paste logs here -->
```
</details>

### Screenshots
<!-- Attach relevant screenshots. Ensure no sensitive data is visible -->

## Impact Assessment

### Business Impact
<!-- Describe the impact on business operations -->

### Affected Users
- Count: <!-- Number of affected users -->
- Percentage: <!-- % of total user base -->

### Financial Impact
<!-- Optional: Estimated financial impact if known -->

### Workaround
<!-- Describe any temporary workaround if available -->

---

<!-- Automated Validations -->
<!-- The following checks will be automatically enforced -->
- [ ] No sensitive data included in logs or screenshots
- [ ] Critical severity issues trigger immediate team notification
- [ ] Performance metrics included for performance-related issues
- [ ] Minimum 3 clear reproduction steps provided
- [ ] Logs included for backend/infrastructure issues

<!-- 
This issue template is integrated with:
- Backend CI Pipeline (.github/workflows/backend-ci.yml)
- Frontend CI Pipeline (.github/workflows/frontend-ci.yml)
- Automated issue labeling and routing
- SRE escalation for critical issues
-->