# Remote Claude SaaS Pricing Model

## Overview
This document outlines the pricing strategy for Remote Claude's hosted SaaS offering, where we manage the infrastructure and users pay for compute time.

## Cost Analysis

### Infrastructure Costs (Per User Session)
- **AWS EC2 (t3.medium spot)**: ~$0.0125/hour
- **Storage/bandwidth**: ~$0.01/hour  
- **Operational overhead**: ~$0.005/hour
- **Total Cost**: ~$0.03/hour per active session

### Target Margins
- Minimum margin: 70%
- Target margin: 80-85%
- This allows for infrastructure growth, R&D, and market competitiveness

## Pricing Tiers

### 1. Pay-As-You-Go
- **Price**: $0.15/hour (5x markup = 80% margin)
- **Billing**: Per minute, 5-minute minimum
- **Target**: Occasional users, trying the service
- **Features**: 
  - No commitment
  - Basic machine types
  - Community support

### 2. Starter Plan - $29/month
- **Included**: 25 hours/month
- **Overage**: $0.12/hour
- **Target**: Individual developers
- **Features**:
  - 1 concurrent session
  - Basic support
  - 7-day log retention

### 3. Professional - $99/month  
- **Included**: 100 hours/month
- **Overage**: $0.10/hour
- **Target**: Full-time developers
- **Features**:
  - 3 concurrent sessions
  - Priority support
  - Custom environments
  - 30-day log retention
  - Advanced machine types

### 4. Team - $299/month
- **Included**: 350 hours/month (shared pool)
- **Overage**: $0.08/hour
- **Target**: Small development teams
- **Features**:
  - 10 concurrent sessions
  - Team management dashboard
  - SSO integration
  - Usage analytics
  - 90-day log retention

### 5. Enterprise - Custom
- **Price**: Starting at $999/month
- **Target**: Large organizations
- **Features**:
  - Unlimited hours
  - Dedicated resources
  - SLA guarantees
  - Custom integrations
  - Dedicated support
  - Compliance features

## Additional Revenue Streams

### Storage & Persistence
- **Persistent Workspace**: $5/month per 50GB
- **Snapshot Backups**: $0.10 per snapshot
- **Extended Retention**: $2/month per 30 days

### Premium Machine Types
| Type | Specs | Additional Cost |
|------|-------|----------------|
| Standard | t3.large (2 vCPU, 8GB) | +$0.05/hour |
| Performance | c5.xlarge (4 vCPU, 8GB) | +$0.15/hour |
| Memory Optimized | r5.large (2 vCPU, 16GB) | +$0.20/hour |
| GPU Enabled | g4dn.xlarge | +$0.50/hour |

### Premium Features
- **Priority Queue**: $10/month (skip the line)
- **Extended Session Timeout**: $5/month (4hr vs 2hr default)
- **Custom Base Images**: $20/month
- **Private GitHub App**: $50/month

## Free Tier Strategy

### Limits
- 5 hours/month
- t3.small instances only
- 1 concurrent session
- Community support only
- 1-day log retention

### Goals
- Conversion target: 5-10% to paid
- Upsell to Starter within 3 months
- Use as marketing tool

## Competitive Analysis

### GitHub Codespaces
- $0.18/hour for 2-core
- $0.36/hour for 4-core
- Free tier: 60 hours/month

### Gitpod
- $0.50/hour for standard
- Free tier: 50 hours/month
- Team plans from $39/user/month

### Our Advantages
- Claude Code integration
- Better pricing for heavy users
- More flexible machine types
- Self-hosted option available

## Implementation Considerations

### Billing System Requirements
1. **Usage Tracking**
   - Minute-level granularity
   - Real-time usage dashboard
   - Overage alerts

2. **Payment Processing**
   - Stripe/Paddle integration
   - Monthly/annual billing
   - Auto-scaling based on usage

3. **Cost Controls**
   - Spending limits
   - Budget alerts
   - Auto-pause on limit

### Metrics to Track
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Churn rate by tier
- Usage patterns
- Margin by tier
- Free-to-paid conversion

## Launch Strategy

### Phase 1: Beta (Months 1-3)
- 50% discount for beta users
- Gather feedback on pricing
- Refine tiers based on usage

### Phase 2: GA Launch (Month 4)
- Full pricing in effect
- Grandfather beta users for 6 months
- Marketing push with free tier

### Phase 3: Optimization (Month 7+)
- A/B test pricing
- Introduce annual plans (20% discount)
- Add enterprise features

## Financial Projections

### Year 1 Targets
- 1,000 free tier users
- 100 paid users (10% conversion)
- Average revenue per user: $75/month
- Monthly recurring revenue: $7,500
- Infrastructure costs: $1,500/month
- Gross margin: 80%

### Break-even Analysis
- Fixed costs: $10,000/month (development, support)
- Break-even: 200 paid users at current pricing
- Target: Break-even by month 6

## Risk Factors
1. AWS price increases
2. Competition from GitHub/Microsoft
3. Lower than expected conversion rates
4. Infrastructure complexity
5. Support costs higher than expected

## Next Steps
1. Implement usage tracking system
2. Set up billing infrastructure
3. Create pricing page and calculator
4. Design free tier onboarding
5. Build admin dashboard for monitoring