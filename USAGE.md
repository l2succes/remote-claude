# Remote Claude CLI - Usage Guide

The Remote Claude CLI (`rclaude`) allows you to execute Claude Code tasks in GitHub Codespaces with comprehensive task management and notification capabilities.

## Table of Contents
- [Installation](#installation)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [Basic Usage](#basic-usage)
- [Commands Reference](#commands-reference)
- [Notification System](#notification-system)
- [Task Management](#task-management)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites
- Node.js 18+ 
- [GitHub CLI](https://cli.github.com/) installed and authenticated
- GitHub account with Codespaces access

### Install from Source
```bash
git clone https://github.com/yourusername/remote-claude
cd remote-claude
npm install
npm run build
npm link
```

### Install from NPM (when published)
```bash
npm install -g @your-org/remote-claude-cli
```

## Authentication

### GitHub Authentication
The CLI supports multiple authentication methods (checked in order):

1. **Stored token** (most secure)
2. **Configuration file**
3. **Environment variable**
4. **GitHub CLI authentication**

#### Set up authentication:
```bash
# Interactive setup
rclaude config github

# Set token directly
rclaude config github --token ghp_your_token_here

# Set default repository
rclaude config github --repository owner/repo-name
```

#### Verify authentication:
```bash
rclaude config github
```

## Configuration

Configuration is stored in `~/.rclirc` using Cosmiconfig format.

### Basic Configuration
```json
{
  "github": {
    "defaultRepository": "owner/repo-name",
    "defaultMachine": "basicLinux32gb",
    "defaultIdleTimeout": 30
  },
  "notifications": {
    "email": "your@email.com",
    "slack": "https://hooks.slack.com/services/...",
    "webhook": "https://your-webhook.com/endpoint"
  },
  "tasks": {
    "maxConcurrent": 3,
    "defaultTimeout": 1800,
    "autoCleanup": true
  }
}
```

### Configure Notifications
```bash
# View current notification settings
rclaude config notify

# Configure email notifications
rclaude config notify --email your@email.com

# Configure Slack notifications  
rclaude config notify --slack https://hooks.slack.com/services/...

# Configure custom webhook
rclaude config notify --webhook https://your-webhook.com/endpoint

# Configure Pushover notifications
rclaude config notify --pushover app-token:user-key
```

## Basic Usage

### Run a Task
```bash
# Basic task execution
rclaude run "Fix the bug in src/utils.js" --repo owner/repo

# With notifications
rclaude run "Add unit tests" --repo owner/repo --notify-on-complete

# With specific branch and timeout
rclaude run "Refactor authentication" --repo owner/repo --branch feature/auth --timeout 3600

# High priority task
rclaude run "Critical security fix" --repo owner/repo --priority high --notify-on-start --notify-on-complete
```

### Check Task Status
```bash
# View all tasks
rclaude status

# View specific task
rclaude status task-id-123

# Watch task progress (updates every 5 seconds)
rclaude status --watch
```

### View Results
```bash
# List all results
rclaude results

# View specific result
rclaude results task-id-123

# Open result in editor
rclaude results task-id-123 --open
```

## Commands Reference

### `rclaude run`
Execute a Claude Code task in a GitHub Codespace.

```bash
rclaude run <task> [options]
```

**Options:**
- `-r, --repo <repository>` - Target repository (owner/repo format)
- `-b, --branch <branch>` - Git branch to use (default: main)
- `-t, --timeout <seconds>` - Task timeout in seconds (default: 1800)
- `-p, --priority <level>` - Task priority: low, medium, high (default: medium)
- `-m, --machine <type>` - Codespace machine type (default: basicLinux32gb)
- `--auto-commit` - Automatically commit changes
- `--pull-request` - Create pull request after completion
- `--keep-codespace` - Don't delete codespace after completion
- `--notify-on-start` - Send notification when task starts
- `--notify-on-complete` - Send notification when task completes
- `--notify-on-fail` - Send notification when task fails

### `rclaude status`
View task status and progress.

```bash
rclaude status [taskId] [options]
```

**Options:**
- `-w, --watch` - Watch for real-time updates
- `-a, --all` - Show completed tasks
- `--json` - Output in JSON format

### `rclaude results`
View and manage task results.

```bash
rclaude results [taskId] [options]
```

**Options:**
- `-o, --open` - Open result in default editor
- `-d, --download <path>` - Download result files
- `--json` - Output in JSON format

### `rclaude cancel`
Cancel running tasks.

```bash
rclaude cancel <taskId>
rclaude cancel --all  # Cancel all running tasks
```

### `rclaude logs`
View task execution logs.

```bash
rclaude logs [taskId] [options]
```

**Options:**
- `-f, --follow` - Follow log output
- `-n, --lines <number>` - Number of lines to show (default: 100)
- `--level <level>` - Filter by log level: debug, info, warn, error

### `rclaude config`
Manage configuration settings.

#### GitHub Configuration
```bash
rclaude config github [options]
```

**Options:**
- `-t, --token <token>` - GitHub personal access token
- `-u, --username <username>` - GitHub username  
- `-r, --repository <repo>` - Default repository

#### Notification Configuration
```bash
rclaude config notify [options]
```

**Options:**
- `-e, --email <email>` - Email address
- `-s, --slack <webhook>` - Slack webhook URL
- `-p, --pushover <config>` - Pushover config (app-token:user-key)
- `-w, --webhook <url>` - Custom webhook URL

## Notification System

The CLI supports multiple notification channels with rich formatting and retry mechanisms.

### Supported Channels
- **Email** - HTML emails with professional formatting
- **Slack** - Rich messages with interactive elements
- **Webhooks** - Custom HTTP endpoints with JSON payloads
- **Pushover** - Mobile push notifications

### Notification Events
- **Task Started** - When task begins execution
- **Task Completed** - When task finishes successfully
- **Task Failed** - When task encounters errors
- **Codespace Created** - When new codespace is provisioned
- **Codespace Deleted** - When codespace is cleaned up

### Email Notifications
Configure SMTP settings in your configuration:

```json
{
  "notifications": {
    "email": {
      "to": "your@email.com",
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your@gmail.com",
          "pass": "your-app-password"
        }
      }
    }
  }
}
```

### Slack Notifications
1. Create a Slack app and incoming webhook
2. Configure the webhook URL:
   ```bash
   rclaude config notify --slack https://hooks.slack.com/services/...
   ```

### Custom Webhooks
Configure custom webhook endpoints to integrate with your existing systems:

```bash
rclaude config notify --webhook https://your-api.com/rclaude-webhook
```

Webhook payload format:
```json
{
  "event": "task_completed",
  "taskId": "task-123",
  "status": "completed",
  "message": "Task completed successfully",
  "timestamp": "2023-12-01T12:00:00Z",
  "metadata": {
    "repository": "owner/repo",
    "branch": "main",
    "duration": 180
  }
}
```

## Task Management

### Task Priorities
- **High** - Executed immediately with dedicated resources
- **Medium** - Standard priority (default)
- **Low** - Executed when resources are available

### Task States
- **Pending** - Queued for execution
- **Running** - Currently being executed
- **Completed** - Finished successfully
- **Failed** - Encountered errors
- **Cancelled** - Manually cancelled

### Storage
- Task data: `~/.rclaude/data/tasks/`
- Results: `~/.rclaude/data/results/`
- Logs: `~/.rclaude/data/logs/`

## Examples

### Development Workflow
```bash
# Start a feature development task
rclaude run "Implement user authentication system" \
  --repo myorg/myapp \
  --branch feature/auth \
  --priority high \
  --notify-on-complete \
  --pull-request

# Check progress
rclaude status --watch

# Review results
rclaude results --open
```

### Bug Fix Workflow
```bash
# Critical bug fix
rclaude run "Fix memory leak in payment processor" \
  --repo myorg/payment-service \
  --priority high \
  --timeout 3600 \
  --notify-on-start \
  --notify-on-complete \
  --auto-commit

# Monitor logs
rclaude logs --follow
```

### Batch Processing
```bash
# Queue multiple tasks
rclaude run "Add unit tests for utils module" --repo myorg/myapp --priority low
rclaude run "Update API documentation" --repo myorg/myapp --priority low  
rclaude run "Refactor database queries" --repo myorg/myapp --priority medium

# Check all task status
rclaude status --all
```

### Code Review Assistance
```bash
# Generate code review
rclaude run "Review the changes in PR #123 and provide feedback" \
  --repo myorg/myapp \
  --branch pr-123 \
  --notify-on-complete

# Check specific files
rclaude run "Analyze security vulnerabilities in src/auth/" \
  --repo myorg/myapp \
  --priority high
```

## Troubleshooting

### Common Issues

#### Authentication Problems
```bash
# Check authentication status
rclaude config github

# Re-authenticate with GitHub CLI
gh auth login

# Verify GitHub CLI access
gh codespace list
```

#### Codespace Creation Failures
- Ensure you have Codespaces enabled in your GitHub account
- Check repository permissions
- Verify the repository exists and is accessible
- Try a different machine type if resources are unavailable

#### Task Execution Issues
```bash
# Check task logs
rclaude logs task-id-123

# Verify Claude Code installation in codespace
# The CLI automatically installs Claude Code, but you can check manually
gh codespace ssh --codespace name-123 -- "claude-code --version"
```

#### Notification Delivery Problems
```bash
# Test notification configuration
rclaude config notify

# Check notification logs
rclaude logs --level warn

# Verify webhook endpoints are accessible
curl -X POST your-webhook-url -H "Content-Type: application/json" -d '{"test": true}'
```

### Performance Optimization

#### Task Queue Management
```json
{
  "tasks": {
    "maxConcurrent": 5,        // Increase for more parallel tasks
    "cleanupInterval": 3600,   // Cleanup frequency in seconds
    "maxResultAge": 604800     // Keep results for 7 days
  }
}
```

#### Codespace Optimization
```json
{
  "github": {
    "defaultMachine": "premiumLinux",  // Use more powerful machines
    "defaultIdleTimeout": 60,          // Longer timeout for complex tasks
    "keepCodespaceOnError": true       // Keep for debugging
  }
}
```

### Getting Help
- Check logs: `rclaude logs --level debug`
- View configuration: `rclaude config github && rclaude config notify`
- Test connectivity: `gh codespace list`
- Report issues: [GitHub Issues](https://github.com/yourusername/remote-claude/issues)

## Advanced Configuration

### Environment Variables
```bash
export RCLAUDE_GITHUB_TOKEN=ghp_your_token
export RCLAUDE_LOG_LEVEL=debug
export RCLAUDE_CONFIG_PATH=/custom/path/.rclirc
```

### Docker Usage
```bash
# Run in Docker container
docker run -it \
  -v ~/.rclirc:/root/.rclirc \
  -v ~/.rclaude:/root/.rclaude \
  -e GITHUB_TOKEN=$GITHUB_TOKEN \
  remote-claude:latest \
  rclaude run "Your task here" --repo owner/repo
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Remote Claude Task
  run: |
    rclaude run "Update dependencies and run tests" \
      --repo ${{ github.repository }} \
      --branch ${{ github.ref_name }} \
      --notify-on-complete \
      --auto-commit
```