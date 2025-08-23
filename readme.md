██████╗ ███████╗███╗   ███╗ ██████╗ ████████╗███████╗
██╔══██╗██╔════╝████╗ ████║██╔═══██╗╚══██╔══╝██╔════╝
██████╔╝█████╗  ██╔████╔██║██║   ██║   ██║   █████╗  
██╔══██╗██╔══╝  ██║╚██╔╝██║██║   ██║   ██║   ██╔══╝  
██║  ██║███████╗██║ ╚═╝ ██║╚██████╔╝   ██║   ███████╗
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚══════╝
                                                      
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗     
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝     
██║     ██║     ███████║██║   ██║██║  ██║█████╗       
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝       
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗     
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     

# Remote Claude CLI

> **Run Claude Code tasks remotely on GitHub Codespaces or AWS EC2 with task management and notifications**

[![npm version](https://badge.fury.io/js/remote-claude.svg)](https://badge.fury.io/js/remote-claude)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## 🚀 Quick Start

```bash
# Install
npm install -g remote-claude

# Initialize project (optional)
rclaude init

# Run your first task
rclaude run fix-auth-bug
```

## ✨ Key Features

- **🔄 Task-Based Workflow** - Save and reuse tasks with `rclaude run <task-id>`
- **☁️ Multi-Cloud Support** - GitHub Codespaces and AWS EC2 backends
- **📁 Project Configuration** - Per-project settings with `.rclaude.json`
- **🎯 Smart Defaults** - Automatic backend selection and configuration
- **🔔 Notifications** - Email, Slack, and webhook notifications
- **📊 Task Management** - Track, monitor, and manage multiple tasks
- **🤖 Auto EC2 Connection** - Seamless SSH connection for EC2 tasks

## 📦 Installation

### Prerequisites

- **Node.js 18+** 
- **GitHub account** with Codespaces access
- **GitHub Personal Access Token** ([Create one](https://github.com/settings/tokens))
- **AWS CLI** (for EC2 backend)

### Install

```bash
npm install -g remote-claude
```

## 🎯 Getting Started

### 1. Configure Authentication

```bash
# GitHub authentication (required for Codespaces)
rclaude config github --token YOUR_GITHUB_TOKEN

# Set default backend (optional)
rclaude config backend
```

### 2. Initialize Your Project (Optional)

```bash
# Create project-specific configuration
rclaude init
```

### 3. Create and Run Tasks

```bash
# First run creates the task
rclaude run fix-auth-bug
# -> Prompts for task details, saves for reuse

# Subsequent runs use saved configuration
rclaude run fix-auth-bug
```

### 4. Manage Tasks

```bash
# List all tasks
rclaude tasks

# Show recent tasks
rclaude tasks --recent

# Search tasks
rclaude tasks --search auth
```

## 📖 Task-Based Workflow

Remote Claude uses a task-based workflow where each task has an ID and saved configuration:

```bash
# Create a new task
rclaude run deploy-api
# -> Task name: Deploy API to Production
# -> Description: Build and deploy the API service
# -> Repository: myorg/api-service
# -> Default backend: ec2

# Run the saved task
rclaude run deploy-api

# Override options
rclaude run deploy-api --provider codespace
```

## ⚙️ Configuration

### Global Configuration (`~/.rclauderc`)

```json
{
  "defaultBackend": "codespace",
  "github": {
    "token": "ghp_...",
    "defaultMachine": "basicLinux32gb",
    "defaultIdleTimeout": 30
  },
  "ec2": {
    "region": "us-east-1",
    "instanceType": "t3.medium",
    "spotInstance": true
  }
}
```

### Project Configuration (`.rclaude.json`)

```json
{
  "defaultBackend": "ec2",
  "github": {
    "defaultRepository": "myorg/myapp"
  },
  "defaults": {
    "timeout": 3600,
    "autoCommit": true
  }
}
```

## 🔧 Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `rclaude init` | Initialize project configuration |
| `rclaude run <task-id>` | Execute a saved task (creates if new) |
| `rclaude tasks` | List and manage saved tasks |
| `rclaude status` | View running tasks |
| `rclaude session` | Manage interactive sessions |

### Configuration Commands

| Command | Description |
|---------|-------------|
| `rclaude config` | View configuration |
| `rclaude config backend` | Configure default compute backend |
| `rclaude config github` | Configure GitHub settings |
| `rclaude config ec2` | Configure AWS EC2 settings |
| `rclaude config notify` | Configure notifications |

### EC2 Commands

| Command | Description |
|---------|-------------|
| `rclaude ec2 list` | List EC2 instances |
| `rclaude ec2 connect <id>` | Connect to instance |
| `rclaude ec2 costs` | Show cost estimates |
| `rclaude ec2 terminate <id>` | Terminate instance |

## 🌐 Backend Providers

### GitHub Codespaces (Default)
- Cloud development environments
- Integrated with GitHub repositories
- Pay-as-you-go pricing

```bash
# Use Codespaces
rclaude run my-task --provider codespace
```

### AWS EC2
- Scalable compute instances
- Spot instance support (up to 90% savings)
- Auto-termination after tasks

```bash
# Use EC2
rclaude run my-task --provider ec2

# With specific instance type
rclaude run my-task --provider ec2 --ec2-instance-type t3.large
```

## 📧 Notifications

Configure notifications for task events:

```bash
# Email notifications
rclaude config notify --email your@email.com

# Slack notifications  
rclaude config notify --slack https://hooks.slack.com/...

# Use with tasks
rclaude run my-task --notify-on-complete
```

## 🎮 Interactive Mode

For live coding sessions:

```bash
# Start interactive session
rclaude run debug-task --interactive

# Connect to existing session
rclaude session --connect session-name
```

## 💡 Examples

### Common Workflows

```bash
# High-priority bug fix
rclaude run critical-fix --priority high --notify-on-complete

# Long-running analysis
rclaude run data-analysis --timeout 7200 --provider ec2

# Feature development with PR
rclaude run new-feature --auto-commit --pull-request
```

### Project Setup

```bash
# Initialize project with EC2 backend
rclaude init
# -> Select EC2 as default backend
# -> Configure instance type
# -> Set default timeout

# All tasks in project use EC2 by default
rclaude run any-task
```

## 🆘 Troubleshooting

### Authentication Issues
```bash
# Check GitHub auth
rclaude config github

# Re-authenticate
gh auth login
```

### Task Not Found
```bash
# List all tasks
rclaude tasks

# Create new task
rclaude run new-task-id
```

### EC2 Connection Issues
```bash
# Check AWS credentials
aws sts get-caller-identity

# List instances
rclaude ec2 list
```

## 📚 Documentation

- [Quick Start Guide](./docs/quick-start.md)
- [Configuration Guide](./docs/configuration.md)
- [Task Management](./docs/tasks.md)
- [Backend Providers](./docs/backends.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- Powered by GitHub Codespaces and AWS EC2
- Inspired by the need for scalable AI development

---

<div align="center">
  <strong>Remote Claude - AI Development in the Cloud ☁️</strong>
</div>