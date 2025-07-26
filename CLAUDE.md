# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan & Review
* Before starting work
- Always in plan mode to make a plan
- After get the plan, make sure you Write the plan to .claude/tasks/TASK_NAME.md.
- The plan should be a detailed implementation plan and the reasoning behind them, as well as tasks broken down.
- If the task require external knowledge or certain package, also research to get latest knowledge (Use Task tool for research)
- Don't over plan it, always think MVP.
- Once you write the plan, firstly ask me to review it. Do not continue until I approve the plan.

### While implementing
- You should update the plan as you work.
- After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made, so following tasks can be easily hand over to other engineers.

## Essential Commands

### Development
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
npm run test:watch  # Watch mode

# Lint code
npm run lint
npm run lint:fix

# Clean build artifacts
npm run clean
```

### Running the CLI Locally
```bash
# Development mode (TypeScript)
npm run dev -- <command>

# Built version
npm start -- <command>

# Example: Run a task in dev mode
npm run dev -- run test-task --provider aws --interactive
```

## Architecture Overview

### Core Components

1. **CLI Entry Point** (`src/cli.ts`)
   - Commander-based CLI with subcommands
   - Main commands: run, tasks, config, status, session, ec2, ecs, init

2. **Provider System** (`src/services/compute/providers/`)
   - **ProviderFactory**: Central factory for creating compute providers
   - **ECSProvider** (`ecs-ec2/ecs-provider.ts`): AWS ECS implementation
   - **EC2Provider** (`src/compute/providers/ec2-provider.ts`): Legacy EC2 direct SSH
   - **CodespaceProvider**: GitHub Codespaces integration

3. **Configuration Hierarchy** (`src/cli/utils/config-v2.ts`)
   - Three-tier configuration: defaults → global (~/.rclauderc) → project (.rclaude.json)
   - Unified AWS backend with modes: ec2, ecs, shared
   - Per-backend configuration sections

4. **Task System** (`src/cli/utils/task-registry.ts`)
   - Tasks stored in `~/.rclaude/tasks.json`
   - Task IDs are reusable configurations
   - Tasks include: repository, branch, description, default options

5. **AWS Integration**
   - **ECS Mode** (primary): Uses ECS + EC2 for container orchestration
   - **EC2 Mode** (legacy): Direct SSH to EC2 instances
   - **Shared Mode** (planned): Multi-tenant EC2 instances
   - CloudFormation deployment in `deploy/aws/`

### Key Flows

#### Task Execution Flow
1. User runs `rclaude run <task-id>`
2. Task registry checks if task exists or creates new
3. ProviderFactory initializes appropriate provider (aws/codespace/fly)
4. For AWS: ECSProvider creates/reuses service, runs task
5. For interactive: Connects via ECS Exec (AWS) or SSH (EC2)
6. For non-interactive: Executes command and returns

#### ECS Architecture
- Cluster: `remote-claude-cluster`
- Services: One per repository (reused across tasks)
- Tasks: One per execution
- Container: `claude-code` with Node.js base image
- Networking: awsvpc mode with public IPs

### Important Implementation Details

1. **ECS Exec Status**: Partially implemented. Interactive mode works via AWS CLI, but non-interactive command execution returns mock responses. Full implementation requires WebSocket handling.

2. **Session Management**: 
   - ECS sessions tracked by task ID
   - Mapping stored in memory (not persistent)
   - Use `rclaude ecs list/connect/terminate` for management

3. **Auto-start Behavior**:
   - EC2: Claude Code auto-starts via `/etc/profile.d/claude-autostart.sh`
   - ECS: Startup script prepared but Claude Code binary not yet available

4. **Configuration Precedence**:
   - CLI flags override everything
   - Project config overrides global config
   - Global config overrides defaults

5. **AWS Credentials**:
   - Uses standard AWS SDK credential chain
   - No credentials stored in Remote Claude config
   - Checks for credentials before operations

### Current Limitations

1. **Claude Code Binary**: Using placeholder commands since `@anthropic-ai/claude-code` package doesn't exist yet
2. **ECS Exec**: Non-interactive commands not fully implemented
3. **File Persistence**: ECS tasks are ephemeral, no persistent storage yet
4. **Cost Tracking**: Basic estimates only, no real cost API integration

### Testing Approach

- Unit tests for providers: `src/compute/providers/__tests__/`
- Integration testing requires AWS account with deployed infrastructure
- Use `--verbose` flag for detailed logging during development

### Deployment

AWS infrastructure deployment:
```bash
rclaude init-deployment --mode self-hosted
```

This runs CloudFormation to create:
- VPC with public/private subnets
- ECS cluster with EC2 capacity
- IAM roles and security groups
- Auto-scaling configuration