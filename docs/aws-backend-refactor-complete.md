# AWS Backend Refactoring - Complete

## Summary
Successfully refactored the backend system to combine `ec2`, `ecs-ec2`, and `ec2-shared` into a single unified `aws` backend. This simplifies the user experience while maintaining all functionality.

## Changes Made

### 1. Configuration System (`src/cli/utils/config-v2.ts`)
- Added unified `aws` configuration with mode selection
- Added `getAWSMode()` method for mode detection
- Added `configureAWS()` method for AWS-specific settings
- Maintained backward compatibility with deprecated backends

### 2. Backend Selection (`src/cli/commands/config-backend.ts`)
- Simplified backend choices to: `codespace`, `aws`, `fly`
- Added AWS mode selection (EC2, ECS, Shared)
- Mode-specific configuration for each AWS mode
- Deprecation warnings for old backends

### 3. Run Command (`src/cli/commands/run.ts`)
- Added `--aws-mode` option for mode override
- Updated `buildComputeConfig()` to handle AWS backend
- Maps AWS modes to appropriate providers internally
- Works seamlessly with existing provider infrastructure

### 4. Types (`src/compute/types.ts`)
- Added `AWS` to `ComputeProviderType` enum
- Updated `ComputeConfig` interface with AWS support

### 5. Deployment Command (`src/cli/commands/init-deployment.ts`)
- Now sets `backend: aws` with `mode: ecs` after deployment
- Maintains backward compatibility

## User Experience

### Before (Confusing)
```bash
❌ Select backend:
  - GitHub Codespaces
  - AWS EC2
  - AWS ECS + EC2  ← What's the difference?
  - AWS EC2 Shared  ← Even more confusing
```

### After (Clear)
```bash
✅ Select backend:
  - GitHub Codespaces
  - Amazon Web Services (AWS)
  - Fly.io

✅ Select AWS deployment mode:
  - EC2 Instances (simple VMs)
  - ECS Containers (scalable)
  - Shared Instances (cost-optimized)
```

## Usage Examples

### Configure AWS Backend
```bash
# Interactive configuration
rclaude config backend aws

# It will ask for:
# 1. AWS deployment mode (EC2, ECS, Shared)
# 2. AWS region
# 3. Mode-specific settings
```

### Run Tasks
```bash
# Use default AWS mode
rclaude run my-task

# Override AWS mode
rclaude run my-task --aws-mode ec2
rclaude run my-task --aws-mode ecs
rclaude run my-task --aws-mode shared
```

### Deploy Infrastructure
```bash
# Sets up AWS with ECS mode
rclaude init-deployment --mode self-hosted
```

## Backward Compatibility

Old backends (`ec2`, `ecs-ec2`, `ec2-shared`) still work but show deprecation warnings:
```
⚠️  Warning: Backend 'ecs-ec2' is deprecated. Please use 'aws' instead.
```

The system automatically maps old backends to the new AWS backend with appropriate modes.

## Configuration Structure

```yaml
# New unified structure
backend: aws
aws:
  mode: ecs          # or 'ec2', 'shared'
  region: us-east-1
  ecs:
    clusterName: remote-claude
    instanceType: t3.medium
  ec2:
    instanceType: t3.medium
    spotInstance: true
  shared:
    instanceType: t3.large
    maxTasksPerInstance: 10
```

## Benefits

1. **Simpler UX**: Users just pick "AWS" instead of multiple AWS options
2. **Provider-based**: Organized by cloud provider, not implementation
3. **Future-proof**: Can add more AWS modes without new backends
4. **Less confusion**: Clear two-step process (provider → mode)
5. **Unified configuration**: All AWS settings in one place

## Testing

✅ `rclaude config backend` - Shows simplified choices
✅ `rclaude config backend aws` - Works with mode selection
✅ `rclaude run task --provider aws` - Uses AWS with default mode
✅ `rclaude run task --provider aws --aws-mode ecs` - Override mode
✅ Old backends still work with deprecation warnings