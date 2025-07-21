# Remote Claude Deployment Models

## Overview
Remote Claude will support two deployment models:
1. **Self-Serve**: Users deploy and manage their own instance
2. **Hosted SaaS**: Managed service with freemium model

## Current Architecture Analysis

### Core Components
- **CLI Client** (`rclaude`): Command-line interface for task management
- **Task Manager**: Handles task queuing and execution
- **Compute Providers**: Multiple backend options (Codespaces, EC2, ECS, Fly.io)
- **Configuration System**: Local config management
- **Authentication**: GitHub token-based auth

### Key Features
- Remote task execution
- Multiple compute provider support
- Task history and results
- Interactive and batch modes
- Git integration (auto-commit, PR creation)

## Model 1: Self-Serve Deployment

### Architecture
```
User's Machine                    User's Cloud Account
┌─────────────┐                  ┌────────────────────┐
│   rclaude   │                  │   ECS/EC2/etc      │
│     CLI     │───────API───────►│   Claude Runner    │
└─────────────┘                  └────────────────────┘
```

### Components Needed
1. **Installation Package**
   - Standalone CLI binary
   - Infrastructure as Code templates (Terraform/CloudFormation)
   - Setup wizard for cloud configuration

2. **Cloud Templates**
   - AWS: ECS cluster, VPC, IAM roles, S3 bucket
   - GCP: Cloud Run, VPC, IAM, Cloud Storage
   - Azure: Container Instances, VNet, RBAC, Blob Storage

3. **Configuration**
   - Local config file (~/.rclaude/config.json)
   - Cloud credentials management
   - Provider selection

### User Journey
1. Download rclaude CLI
2. Run `rclaude init --self-hosted`
3. Choose cloud provider
4. Deploy infrastructure (one-click with our templates)
5. Configure CLI with cloud endpoints
6. Start using `rclaude run <task>`

## Model 2: Hosted SaaS (Freemium)

### Architecture
```
User's Machine          Our Infrastructure
┌─────────────┐        ┌─────────────────┐       ┌──────────────┐
│   rclaude   │        │   API Gateway   │       │  Task Queue  │
│     CLI     │───────►│   + Auth        │──────►│  (SQS/Redis) │
└─────────────┘        └─────────────────┘       └──────────────┘
                                │                          │
                                ▼                          ▼
                        ┌─────────────────┐       ┌──────────────┐
                        │   User Service  │       │ Task Runner  │
                        │   (Database)    │       │  (ECS/K8s)   │
                        └─────────────────┘       └──────────────┘
```

### New Components Needed

#### 1. Authentication Service
- OAuth2 providers (GitHub, Google)
- JWT token management
- API key generation for CLI
- Session management

#### 2. User Management Service
- User profiles and settings
- Team/organization support
- Usage quotas and limits
- Billing integration

#### 3. API Gateway
- RESTful API for task management
- WebSocket for real-time updates
- Rate limiting
- Request routing

#### 4. Multi-Tenant Task Execution
- User isolation (containers/VMs)
- Resource limits per tier
- Task scheduling with priorities
- Cost allocation

#### 5. Web Dashboard
- Task management UI
- Usage analytics
- Billing and subscription management
- API key management

#### 6. Billing System
- Usage metering
- Stripe/payment integration
- Invoice generation
- Free tier limits

### Freemium Tiers

#### Free Tier
- 100 task executions/month
- 2 vCPU, 4GB RAM per task
- 30 min max task duration
- Community support

#### Pro Tier ($29/month)
- 1000 task executions/month
- 4 vCPU, 8GB RAM per task
- 2 hour max task duration
- Email support
- Team collaboration (up to 5 users)

#### Enterprise Tier (Custom)
- Unlimited executions
- Custom resources
- Dedicated infrastructure option
- SLA guarantees
- Priority support

## Implementation Phases

### Phase 1: Self-Serve MVP (2-3 weeks)
1. Create AWS CloudFormation template
2. Document installation process
3. Add `rclaude init` command
4. Test end-to-end deployment

### Phase 2: Basic SaaS (4-6 weeks)
1. Build authentication service
2. Create API gateway
3. Implement multi-tenant execution
4. Basic web dashboard

### Phase 3: Freemium Features (3-4 weeks)
1. Usage metering
2. Billing integration
3. Tier enforcement
4. Enhanced dashboard

### Phase 4: Scale & Polish (Ongoing)
1. Add more cloud providers
2. Enterprise features
3. Advanced analytics
4. Performance optimization

## Security Considerations

### Self-Serve
- Users manage their own security
- Provide security best practices docs
- Secure default configurations
- Secrets management guidance

### Hosted SaaS
- SOC 2 compliance roadmap
- Data encryption at rest/transit
- User isolation and sandboxing
- Regular security audits
- GDPR/privacy compliance

## Technical Decisions Needed

1. **API Framework**: FastAPI vs Express vs Go
2. **Database**: PostgreSQL vs DynamoDB
3. **Queue System**: SQS vs Redis vs RabbitMQ
4. **Container Orchestration**: ECS vs Kubernetes
5. **Authentication**: Auth0 vs Cognito vs Custom
6. **Payment Processing**: Stripe vs Paddle
7. **Monitoring**: DataDog vs CloudWatch vs Prometheus

## Next Steps
1. Validate technical architecture
2. Create proof of concept for SaaS API
3. Design database schema
4. Build authentication prototype
5. Create infrastructure templates for self-serve