# Remote Claude CLI

A CLI tool for running Claude Code in GitHub Codespaces with remote task execution and notification capabilities.

## Overview

This tool allows you to:
- Start long-running Claude Code tasks in GitHub Codespaces
- Close your local machine while tasks continue remotely
- Receive notifications when tasks complete
- Monitor task progress from anywhere
- Resume or review completed work

## Problem Statement

When working with Claude Code on complex tasks:
- Long-running tasks tie up your local machine
- Connection interruptions can break task continuity
- No way to get notified when remote tasks complete
- Limited ability to run tasks overnight or while away

## Solution

A CLI wrapper that:
1. Spins up GitHub Codespaces with Claude Code pre-configured
2. Executes tasks remotely with persistent sessions
3. Monitors task completion and sends notifications
4. Provides task management and result retrieval

## Key Features

### Remote Execution
- Launch Claude Code tasks in isolated Codespaces
- Persistent sessions that survive connection drops
- Automatic environment setup and dependency management

### Notification System
- Email notifications on task completion
- Slack integration for team notifications
- Mobile push notifications via supported services
- Webhook support for custom integrations

### Task Management
- Queue multiple tasks for sequential execution
- Monitor running tasks and their status
- Cancel or pause running tasks
- Resume interrupted tasks

### Result Management
- Automatically save task outputs and artifacts
- Git integration for committing completed work
- Download results to local machine
- Share results with team members

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Local CLI     │───▶│  GitHub API     │───▶│   Codespaces    │
│                 │    │                 │    │                 │
│ - Task Queue    │    │ - Codespace     │    │ - Claude Code   │
│ - Status Monitor│    │   Management    │    │ - Task Runner   │
│ - Notifications │    │ - Webhook       │    │ - Status API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │              ┌─────────────────┐             │
         └─────────────▶│  Notification   │◀────────────┘
                        │    Services     │
                        │                 │
                        │ - Email/SMTP    │
                        │ - Slack         │
                        │ - Webhooks      │
                        └─────────────────┘
```

## Quick Start

```bash
# Install the CLI
npm install -g remote-claude-cli

# Configure GitHub access
rcli config github --token YOUR_GITHUB_TOKEN

# Configure notifications
rcli config notify --email your@email.com --slack YOUR_SLACK_WEBHOOK

# Run a task remotely
rcli run "Fix all TypeScript errors in the codebase" --repo owner/repo --notify-on-complete

# Monitor running tasks
rcli status

# Get results
rcli results task-id-123
```

## Use Cases

### Overnight Code Refactoring
```bash
rcli run "Refactor payment module to use new architecture" \
  --timeout 8h \
  --notify email,slack \
  --auto-commit \
  --branch refactor/payment-module
```

### CI/CD Integration
```bash
rcli run "Analyze test failures and suggest fixes" \
  --trigger webhook \
  --context ci-failure \
  --notify slack:#dev-team
```

### Code Review Preparation
```bash
rcli run "Review PR #123 and provide detailed feedback" \
  --repo owner/repo \
  --pr 123 \
  --output code-review.md \
  --notify email
```

## Next Steps

See the following documentation:
- [Architecture](./architecture.md) - Detailed system design
- [Setup](./setup-codespaces.md) - GitHub Codespaces configuration
- [Notifications](./notifications.md) - Notification system setup
- [Implementation](./implementation-plan.md) - Development roadmap