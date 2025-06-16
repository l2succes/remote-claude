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

# Remote Claude (Claude in Cloud)

> **Execute Claude Code tasks remotely in GitHub Codespaces with comprehensive task management and notification capabilities**

[![npm version](https://badge.fury.io/js/remote-claude.svg)](https://badge.fury.io/js/remote-claude)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## 🚀 Overview

Remote Claude (also known as **Claude in Cloud**) is a powerful CLI tool that enables you to execute Claude Code tasks in GitHub Codespaces remotely. It provides seamless integration with GitHub's cloud development environment, allowing you to run AI-powered coding tasks with comprehensive notification and task management capabilities.

### ✨ Key Features

- 🌩️ **Remote Execution**: Run Claude Code tasks in GitHub Codespaces
- 📧 **Multi-Channel Notifications**: Email, Slack, and webhook notifications
- 📊 **Task Management**: Track, monitor, and manage multiple concurrent tasks
- 🔐 **Secure Authentication**: Multiple GitHub authentication methods
- ⚡ **Real-time Updates**: Live task progress monitoring
- 🎯 **Flexible Configuration**: Customizable settings and templates
- 🔄 **Auto-cleanup**: Automatic resource management
- 📈 **Priority Queuing**: Task prioritization and scheduling

## 📦 Installation

### Prerequisites

- **Node.js 18+** 
- **GitHub account** with Codespaces access
- **GitHub Personal Access Token** with `repo` and `codespace` scopes ([Setup Guide](./docs/setup-guide.md#github-personal-access-token))
- **[GitHub CLI](https://cli.github.com/)** (optional, but recommended)

### Install from NPM

```bash
npm install -g remote-claude
```

### Install from Source

```bash
git clone https://github.com/l2succes/remote-claude.git
cd remote-claude
npm install
npm run build
npm link
```

## 🚀 Quick Start

### 1. Install Remote Claude

```bash
npm install -g remote-claude
```

### 2. Setup GitHub Authentication

```bash
# Configure with your GitHub token (get one at https://github.com/settings/tokens)
rclaude config github --token YOUR_GITHUB_TOKEN

# Set your default repository (optional)
rclaude config github --repository owner/repo-name
```

### 3. Run Your First Task

```bash
# Execute a simple task
rclaude run "Fix the bug in src/utils.js" --repo owner/repo

# Or start an interactive session for live coding
rclaude run --interactive "Debug the authentication issue" --repo owner/repo
```

### 4. Monitor Progress

```bash
# Check task status
rclaude status

# List active interactive sessions
rclaude session --list
```

### 5. Common Workflows

```bash
# High priority task with notifications
rclaude run "Critical security fix" --priority high --notify-on-complete

# Long-running task with extended timeout
rclaude run "Overnight analysis" --idle-timeout 480 --machine-type standardLinux32gb

# Auto-commit changes and create PR
rclaude run "Implement new feature" --auto-commit --pull-request

# Connect to existing interactive session
rclaude session --connect codespace-name
```

> **💡 Pro Tip**: Use `--interactive` for live coding sessions that persist even if you disconnect!

## 📖 Usage Examples

### Basic Task Execution

```bash
# Simple task
rclaude run "Refactor the user authentication module"

# With specific repository and branch
rclaude run "Add error handling" --repo owner/repo --branch feature/error-handling

# High priority task with notifications
rclaude run "Critical security fix" --priority high --notify-on-start --notify-on-complete
```

### Advanced Task Management

```bash
# Long-running task with custom timeout
rclaude run "Complete code review and optimization" --timeout 3600

# Auto-commit changes and create PR
rclaude run "Implement new feature" --auto-commit --pull-request

# Keep codespace for debugging
rclaude run "Debug performance issue" --keep-codespace
```

### Task Monitoring

```bash
# View all tasks
rclaude status

# Monitor specific task
rclaude status task-abc123

# View task results
rclaude results task-abc123

# Download result files
rclaude results task-abc123 --download ./results/
```

## ⚙️ Configuration

Configuration is stored in `~/.rclirc` and supports multiple formats (JSON, YAML, JS).

### Example Configuration

```json
{
  "github": {
    "defaultRepository": "owner/repo-name",
    "defaultMachine": "basicLinux32gb",
    "defaultIdleTimeout": 30
  },
  "notifications": {
    "email": {
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your@email.com",
          "pass": "your-app-password"
        }
      },
      "from": "your@email.com",
      "to": "notifications@email.com"
    },
    "slack": {
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#dev-notifications",
      "username": "Remote Claude"
    }
  },
  "tasks": {
    "maxConcurrent": 3,
    "defaultTimeout": 1800,
    "autoCleanup": true
  }
}
```

## 🔧 Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `rclaude run <task>` | Execute a Claude Code task |
| `rclaude status [taskId]` | View task status and progress |
| `rclaude results [taskId]` | View and manage task results |
| `rclaude cancel <taskId>` | Cancel running tasks |
| `rclaude config <section>` | Manage configuration |

### Configuration Commands

| Command | Description |
|---------|-------------|
| `rclaude config github` | Configure GitHub authentication |
| `rclaude config notify` | Configure notification channels |
| `rclaude config tasks` | Configure task defaults |

## 📧 Notification System

Remote Claude supports multiple notification channels to keep you informed about task progress:

### Supported Channels

- **📧 Email (SMTP)**: HTML email templates with attachments
- **💬 Slack**: Rich message formatting with interactive buttons
- **🔗 Custom Webhooks**: JSON payload format for custom integrations

### Notification Events

- **Task Started**: When a task begins execution
- **Task Progress**: Optional progress updates
- **Task Completed**: When a task finishes successfully
- **Task Failed**: When a task encounters an error
- **System Events**: Codespace creation, resource warnings, etc.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Client    │───▶│  Task Manager   │───▶│  GitHub API     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Notification   │    │   Webhook       │    │   Codespace     │
│    System       │    │   Server        │    │   Environment   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/l2succes/remote-claude.git
cd remote-claude
npm install
npm run dev
```

### Running Tests

```bash
npm test
npm run test:watch
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation**:
  - [Setup Guide](./docs/setup-guide.md) - Detailed setup instructions
  - [Persistent Sessions](./docs/persistent-sessions.md) - Interactive session management
  - [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
  - [API Reference](./docs/api-reference.md) - Complete command reference
- 🐛 **Issues**: [GitHub Issues](https://github.com/l2succes/remote-claude/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/l2succes/remote-claude/discussions)

## 🙏 Acknowledgments

- Built with ❤️ using TypeScript and Node.js
- Powered by GitHub Codespaces
- Inspired by the need for remote AI-powered development

---

<div align="center">
  <strong>Remote Claude - Bringing Claude to the Cloud ☁️</strong>
</div>
