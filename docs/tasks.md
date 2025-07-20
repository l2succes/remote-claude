# Task Management Guide

Remote Claude's task-based workflow allows you to save, organize, and reuse common Claude Code operations. This guide covers everything you need to know about managing tasks effectively.

## Table of Contents
- [Understanding Tasks](#understanding-tasks)
- [Creating Tasks](#creating-tasks)
- [Running Tasks](#running-tasks)
- [Managing Tasks](#managing-tasks)
- [Task Organization](#task-organization)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)

## Understanding Tasks

### What is a Task?

A task in Remote Claude is a saved configuration that includes:
- **Task ID**: Unique identifier (e.g., `fix-auth-bug`)
- **Name**: Human-readable name
- **Description**: Instructions for Claude
- **Repository**: Target GitHub repository
- **Default Options**: Backend, timeout, machine type, etc.
- **Run History**: Track when and how often used

### Task Storage

Tasks are stored in `~/.rclaude/tasks.json`:

```json
{
  "id": "fix-auth",
  "name": "Fix Authentication Issues",
  "description": "Debug and fix authentication problems in the login system",
  "repository": "myorg/web-app",
  "branch": "main",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastRunAt": "2024-01-20T14:22:00Z",
  "runCount": 5,
  "defaultOptions": {
    "provider": "codespace",
    "timeout": 1800,
    "priority": "high",
    "autoCommit": true
  }
}
```

## Creating Tasks

### Interactive Creation

The easiest way to create a task is by running a new task ID:

```bash
rclaude run deploy-api
# If task doesn't exist, prompts for:
# - Task name
# - Description
# - Repository
# - Default backend
# - Other options
```

### Task ID Guidelines

Choose meaningful, consistent task IDs:

**Good Examples:**
- `fix-login-bug`
- `add-user-tests`
- `refactor-api-v2`
- `deploy-staging`

**Avoid:**
- `task1`, `temp`, `test`
- Very long IDs
- Special characters (except hyphens)

### Setting Defaults

During creation, you can set task-specific defaults:

```bash
# Task creation prompts
Task name: Deploy API to Production
Description: Build and deploy the API service to production
Repository: myorg/api-service
Default backend: ec2
EC2 instance type: c5.xlarge
Default timeout: 3600
Auto-commit: yes
```

## Running Tasks

### Basic Execution

```bash
# Run with saved defaults
rclaude run deploy-api

# Override specific options
rclaude run deploy-api --provider codespace
rclaude run deploy-api --timeout 7200
rclaude run deploy-api --branch feature/new-api
```

### Interactive Mode

For debugging or exploratory work:

```bash
# Start interactive session
rclaude run debug-issue --interactive

# With custom session ID
rclaude run debug-issue --interactive --session-id debug-auth
```

### Task Options Override

Command-line options always override task defaults:

```bash
# Task default: provider=ec2
# Command overrides to use Codespaces
rclaude run heavy-task --provider codespace

# Task default: timeout=1800
# Command extends timeout
rclaude run long-task --timeout 7200
```

## Managing Tasks

### List Tasks

```bash
# Show all tasks (interactive menu)
rclaude tasks

# Show recently used tasks
rclaude tasks --recent

# Show frequently used tasks
rclaude tasks --frequent

# Filter by repository
rclaude tasks --repository myorg/web-app

# Search tasks
rclaude tasks --search auth

# JSON output for scripting
rclaude tasks --json
```

### Interactive Task Menu

Running `rclaude tasks` provides an interactive menu:

```
📋 All saved tasks:

1. fix-auth - Fix Authentication Issues
   Debug and fix authentication problems in the login system
   📁 myorg/web-app (main) last run 2 days ago (5 runs)
   ☁️ codespace (basicLinux32gb)

2. deploy-api - Deploy API to Production
   Build and deploy the API service to production
   📁 myorg/api-service last run 1 week ago (3 runs)
   🏷️ #production #deployment
   ☁️ ec2 (c5.xlarge)

What would you like to do?
> Run a task
  Edit a task
  Delete a task
  Export tasks
  Exit
```

### Edit Tasks

Update task details through the interactive menu:

```bash
rclaude tasks
# Select "Edit a task"
# Choose task to edit
# Update fields as needed
```

### Delete Tasks

Remove tasks you no longer need:

```bash
rclaude tasks
# Select "Delete a task"
# Confirm deletion
```

## Task Organization

### Using Tags

Organize tasks with tags:

```bash
# During task creation
Tags (comma-separated): backend, api, production

# Search by tags
rclaude tasks --tags backend
```

### Task Naming Conventions

Establish consistent naming patterns:

```bash
# By operation type
fix-*     # Bug fixes: fix-auth, fix-payment
add-*     # Features: add-search, add-export
refactor-* # Refactoring: refactor-api, refactor-db
test-*    # Testing: test-integration, test-e2e
deploy-*  # Deployment: deploy-staging, deploy-prod

# By component
api-*     # API tasks: api-update, api-test
ui-*      # UI tasks: ui-redesign, ui-fix
db-*      # Database: db-migrate, db-optimize
```

### Repository-Specific Tasks

Filter tasks by repository:

```bash
# List tasks for specific repo
rclaude tasks --repository myorg/web-app

# In project directory (auto-detects repo)
cd ~/projects/web-app
rclaude tasks
```

## Advanced Features

### Task Templates

Create template tasks for common operations:

```bash
# Create a template task
rclaude run template-pr-review
# Description: Review and provide feedback on PR changes
# Can be reused across repositories
```

### Bulk Operations

Export and import tasks:

```bash
# Export all tasks
rclaude tasks
# Select "Export tasks"
# Saves to: tasks-export.json

# Import tasks (useful for team sharing)
# Not yet implemented in CLI, manually copy tasks.json
```

### Task Aliases

For frequently used tasks, consider shell aliases:

```bash
# In ~/.bashrc or ~/.zshrc
alias fix-auth="rclaude run fix-auth"
alias deploy-prod="rclaude run deploy-api --branch main"
alias quick-fix="rclaude run quick-fix --provider codespace"
```

### Task Chaining

Run multiple related tasks:

```bash
# Run tests before deployment
rclaude run run-tests && rclaude run deploy-staging

# Or create a composite task
rclaude run full-deployment
# Description: Run tests, build, and deploy to staging
```

## Best Practices

### 1. Descriptive Task IDs

```bash
# Good: Clear and specific
rclaude run fix-user-validation
rclaude run add-payment-gateway
rclaude run optimize-db-queries

# Bad: Vague or temporary
rclaude run fix1
rclaude run temp
rclaude run test-task
```

### 2. Comprehensive Descriptions

```bash
# Good: Detailed instructions
"Fix the user validation bug in signup flow. Check email validation 
regex, ensure proper error messages, and add unit tests."

# Bad: Too vague
"Fix bug"
```

### 3. Appropriate Defaults

Match task requirements to defaults:

```bash
# CPU-intensive task
defaultOptions: {
  "provider": "ec2",
  "ec2InstanceType": "c5.xlarge",
  "timeout": 7200
}

# Quick fix task
defaultOptions: {
  "provider": "codespace",
  "machineType": "basicLinux32gb",
  "timeout": 900
}
```

### 4. Regular Maintenance

```bash
# Review unused tasks
rclaude tasks --frequent
# Consider deleting tasks with 0 runs

# Update outdated tasks
rclaude tasks
# Edit tasks with old configurations
```

### 5. Team Collaboration

Share common tasks with your team:

```bash
# Export team tasks
rclaude tasks --repository myorg/shared
# Export and share tasks-export.json

# Document in README
## Common Tasks
- `fix-build`: Fix build errors
- `update-deps`: Update dependencies
- `run-e2e`: Run end-to-end tests
```

## Task Examples

### Development Tasks

```bash
# Bug fixing
rclaude run fix-memory-leak
rclaude run fix-race-condition

# Feature development
rclaude run add-oauth-provider
rclaude run implement-caching

# Refactoring
rclaude run refactor-auth-module
rclaude run optimize-queries
```

### DevOps Tasks

```bash
# Deployment
rclaude run deploy-staging
rclaude run deploy-production

# Infrastructure
rclaude run update-k8s-config
rclaude run optimize-dockerfile

# Monitoring
rclaude run analyze-logs
rclaude run generate-metrics
```

### Testing Tasks

```bash
# Test creation
rclaude run add-unit-tests
rclaude run create-e2e-tests

# Test execution
rclaude run run-integration-tests
rclaude run stress-test-api
```

## Troubleshooting

### Task Not Found

```bash
# Check exact task ID
rclaude tasks --search my-task

# May have typo
rclaude run my-takk  # ❌
rclaude run my-task  # ✅
```

### Task Configuration Issues

```bash
# Task uses wrong defaults
rclaude tasks
# Edit task and update defaults

# Or override at runtime
rclaude run my-task --provider ec2 --timeout 3600
```

### Task Storage Issues

```bash
# Check tasks file
cat ~/.rclaude/tasks.json | jq .

# Backup tasks
cp ~/.rclaude/tasks.json ~/.rclaude/tasks.backup.json

# Reset if corrupted
rm ~/.rclaude/tasks.json
# Tasks will be recreated as you use them
```