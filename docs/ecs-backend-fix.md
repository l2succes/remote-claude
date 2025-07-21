# ECS Backend Configuration Fix

## Issue
The command `rclaude config backend ecs-ec2` was failing with:
```
❌ Invalid backend. Choose from: codespace, ec2
```

## Root Cause
The config backend command only supported the original backends (codespace, ec2) and hadn't been updated to support the new provider types (ecs-ec2, ec2-shared, fly).

## Fix Applied

### 1. Updated ConfigV2 Interface
- Added new backend types to the `defaultBackend` type definition
- Updated `configureBackend()` method signature
- Updated `getDefaultBackend()` return type

### 2. Updated config-backend Command
- Added new backend choices to the interactive menu:
  - AWS ECS + EC2 (ecs-ec2)
  - AWS EC2 Shared (ec2-shared)
  - Fly.io (coming soon)
- Updated validation to accept new backends
- Added ECS-specific configuration prompts
- Updated help text and examples

### 3. Files Modified
- `src/cli/utils/config-v2.ts`
- `src/cli/commands/config-backend.ts`

## Usage

### Set ECS as Default Backend
```bash
# Interactive mode
rclaude config backend

# Direct command
rclaude config backend ecs-ec2

# After setting, you can run tasks with:
rclaude run <task-id>  # Uses default backend (ecs-ec2)

# Or override for specific tasks:
rclaude run <task-id> --provider codespace
rclaude run <task-id> --provider ec2
rclaude run <task-id> --provider ecs-ec2
```

### Full Workflow for ECS
1. Deploy infrastructure:
   ```bash
   rclaude init-deployment --mode self-hosted
   ```

2. Set ECS as default backend:
   ```bash
   rclaude config backend ecs-ec2
   ```

3. Run tasks:
   ```bash
   rclaude run <task-id>
   ```

## Verification
```bash
$ rclaude config backend ecs-ec2
✅ Default backend set to: ecs-ec2 (global)

$ cat ~/.rclauderc
{
  "defaultBackend": "ecs-ec2"
}
```

The ECS backend is now fully supported in the configuration system!