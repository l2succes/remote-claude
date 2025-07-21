# Backend Refactoring Plan

## Current Structure (Too Complex)
- `codespace` - GitHub Codespaces
- `ec2` - Direct EC2 instances
- `ecs-ec2` - ECS with EC2 cluster
- `ec2-shared` - Multi-tenant EC2
- `fly` - Fly.io

## New Structure (Simplified)
- `codespace` - GitHub Codespaces  
- `aws` - All AWS compute options
  - Mode: `ec2` - Simple EC2 instances (one per task)
  - Mode: `ecs` - ECS cluster with containers
  - Mode: `shared` - Shared multi-tenant instances
  - Mode: `fargate` - Serverless containers (future)
- `fly` - Fly.io edge computing

## Benefits
1. **Simpler UX**: Users just pick "AWS" for any AWS deployment
2. **Provider-based**: Organized by cloud provider, not implementation details
3. **Future-proof**: Can add more AWS modes without new top-level backends
4. **Less confusion**: Pick provider first, then deployment mode
5. **Unified configuration**: All AWS settings in one place

## Configuration Example

```yaml
# Single AWS backend with different modes
backend: aws
aws:
  mode: ec2          # or 'ecs', 'shared', 'fargate'
  region: us-east-1
  
  # Mode-specific settings
  ec2:
    instanceType: t3.medium
    spotInstance: true
  
  ecs:
    clusterName: remote-claude
    instanceType: t3.medium
    
  shared:
    instanceType: t3.large
    maxTasksPerInstance: 10
```

## Migration Path
1. Create new unified `aws` backend that handles all AWS modes
2. Deprecate `ec2`, `ecs-ec2`, and `ec2-shared` (keep for backward compatibility)
3. Update `rclaude config backend` to show only `codespace`, `aws`, and `fly`
4. Update documentation and init commands
5. Add migration messages when old backends are used

## CLI Commands

```bash
# Configure AWS backend
rclaude config backend aws

# Interactive flow:
# > Select AWS deployment mode:
#   - EC2 Instances (simple, one instance per task)
#   - ECS Cluster (containers, recommended for production)
#   - Shared Instances (multi-tenant, cost-optimized)
#   - Fargate (serverless containers, coming soon)

# Running tasks (mode specified in config):
rclaude run task-1  # Uses configured AWS mode

# Override mode for specific tasks:
rclaude run task-1 --aws-mode ec2
rclaude run task-2 --aws-mode ecs
rclaude run task-3 --aws-mode shared

# Deployment command stays the same:
rclaude init-deployment --mode self-hosted  # Sets up AWS infrastructure
```

## User Experience

### Before (Confusing)
```
? Select backend:
  - GitHub Codespaces
  - AWS EC2
  - AWS ECS + EC2  ← What's the difference?
  - AWS EC2 Shared  ← Even more confusing
  - Fly.io
```

### After (Clear)
```
? Select backend:
  - GitHub Codespaces
  - Amazon Web Services (AWS)
  - Fly.io

? Select AWS deployment mode:
  - EC2 Instances (simple VMs)
  - ECS Containers (scalable)
  - Shared Instances (cost-optimized)
```