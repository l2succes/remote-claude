# Advanced Setup Guide

This guide covers advanced configuration options and setup scenarios for Remote Claude.

## Table of Contents

1. [Email Notifications Setup](#email-notifications-setup)
2. [Slack Integration](#slack-integration)
3. [Custom Webhooks](#custom-webhooks)
4. [Team Collaboration](#team-collaboration)
5. [CI/CD Integration](#cicd-integration)
6. [Security Best Practices](#security-best-practices)
7. [Performance Optimization](#performance-optimization)

## Email Notifications Setup

### Gmail Configuration

1. **Enable 2-Factor Authentication** (required for App Passwords)
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**
   - Visit [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and generate password
   - Copy the 16-character password

3. **Configure Remote Claude**
   ```bash
   rclaude config notify \
     --smtp-host smtp.gmail.com \
     --smtp-port 587 \
     --smtp-user your@gmail.com \
     --smtp-pass "xxxx xxxx xxxx xxxx" \
     --email your@gmail.com
   ```

### Outlook/Office 365

```bash
rclaude config notify \
  --smtp-host smtp-mail.outlook.com \
  --smtp-port 587 \
  --smtp-user your@outlook.com \
  --smtp-pass your-password \
  --email your@outlook.com
```

### Custom SMTP Server

```bash
rclaude config notify \
  --smtp-host mail.company.com \
  --smtp-port 465 \
  --smtp-secure true \
  --smtp-user notifications@company.com \
  --smtp-pass smtp-password \
  --email team@company.com
```

### Multiple Recipients

Edit `~/.rclirc`:
```json
{
  "notifications": {
    "email": {
      "to": ["dev@company.com", "ops@company.com", "alerts@company.com"]
    }
  }
}
```

## Slack Integration

### Creating a Slack Webhook

1. **Create Slack App**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name: "Remote Claude Notifications"
   - Choose workspace

2. **Enable Incoming Webhooks**
   - In app settings, click "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" ON
   - Click "Add New Webhook to Workspace"
   - Choose channel
   - Copy webhook URL

3. **Configure Remote Claude**
   ```bash
   rclaude config notify --slack https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
   ```

### Advanced Slack Configuration

Edit `~/.rclirc` for more options:
```json
{
  "notifications": {
    "slack": {
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#dev-notifications",
      "username": "Remote Claude Bot",
      "iconEmoji": ":robot_face:",
      "mentionUsers": ["@johndoe", "@janedoe"],
      "mentionOnFailure": true
    }
  }
}
```

### Multiple Slack Channels

Configure webhooks for different channels:
```json
{
  "notifications": {
    "webhooks": [
      {
        "url": "https://hooks.slack.com/services/...channel1",
        "events": ["task.started", "task.completed"]
      },
      {
        "url": "https://hooks.slack.com/services/...channel2",
        "events": ["task.failed", "task.cancelled"]
      }
    ]
  }
}
```

## Custom Webhooks

### Webhook Payload Format

Remote Claude sends JSON payloads to custom webhooks:

```json
{
  "event": "task.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "task": {
    "id": "abc123",
    "name": "Fix authentication bug",
    "status": "completed",
    "duration": 300,
    "repository": "owner/repo",
    "branch": "fix/auth-bug"
  },
  "results": {
    "filesChanged": 5,
    "additions": 150,
    "deletions": 50,
    "summary": "Fixed authentication bug by updating token validation"
  }
}
```

### Webhook Configuration

```json
{
  "notifications": {
    "webhooks": [
      {
        "url": "https://api.company.com/webhooks/remote-claude",
        "headers": {
          "Authorization": "Bearer webhook-secret-token",
          "X-Custom-Header": "value"
        },
        "events": ["task.completed", "task.failed"],
        "retryAttempts": 3,
        "retryDelay": 1000
      }
    ]
  }
}
```

### Webhook Events

Available events:
- `task.created` - Task added to queue
- `task.started` - Task execution began
- `task.progress` - Progress update (optional)
- `task.completed` - Task finished successfully
- `task.failed` - Task encountered error
- `task.cancelled` - Task was cancelled
- `codespace.created` - Codespace provisioned
- `codespace.ready` - Codespace ready for use
- `codespace.deleted` - Codespace cleaned up

## Team Collaboration

### Shared Configuration

1. **Create team configuration file**
   ```json
   {
     "github": {
       "defaultRepository": "company/main-repo",
       "defaultMachine": "standardLinux32gb"
     },
     "notifications": {
       "slack": {
         "webhook": "https://hooks.slack.com/services/team-webhook"
       }
     },
     "tasks": {
       "maxConcurrent": 5,
       "defaultTimeout": 3600
     }
   }
   ```

2. **Store in repository**
   ```bash
   # In your repository root
   echo '{...}' > .rclirc.json
   git add .rclirc.json
   git commit -m "Add team Remote Claude config"
   ```

3. **Team members use**
   ```bash
   # Clone repo
   git clone company/repo
   cd repo
   
   # Remote Claude will automatically use .rclirc.json
   rclaude run "task"
   ```

### Environment-based Configuration

Use different configs for different environments:

```javascript
// rcli.config.js
module.exports = {
  github: {
    defaultRepository: process.env.RCLI_REPO || 'company/dev-repo',
    defaultMachine: process.env.RCLI_MACHINE || 'basicLinux32gb'
  },
  notifications: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK
    }
  }
};
```

### Access Control

For team usage with organization repositories:

1. **Organization Settings**
   - Enable Codespaces for organization
   - Set spending limits
   - Configure allowed repositories

2. **Team Access Token**
   - Create organization-wide GitHub App
   - Generate installation access token
   - Share securely with team

## CI/CD Integration

### GitHub Actions

```yaml
name: Remote Claude Task
on:
  workflow_dispatch:
    inputs:
      task:
        description: 'Task for Claude Code'
        required: true
        default: 'Review and fix failing tests'

jobs:
  claude-task:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Remote Claude
        run: npm install -g remote-claude
      
      - name: Run Claude Task
        env:
          RCLI_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          rclaude run "${{ github.event.inputs.task }}" \
            --repo ${{ github.repository }} \
            --branch ${{ github.ref_name }} \
            --timeout 3600 \
            --notify slack \
            --notify-on-complete
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    parameters {
        string(name: 'CLAUDE_TASK', defaultValue: 'Code review', description: 'Task for Claude')
    }
    
    environment {
        RCLI_GITHUB_TOKEN = credentials('github-token')
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g remote-claude'
            }
        }
        
        stage('Run Claude Task') {
            steps {
                sh """
                    rclaude run "${params.CLAUDE_TASK}" \
                        --repo owner/repo \
                        --timeout 3600 \
                        --output results.json \
                        --json
                """
            }
        }
        
        stage('Process Results') {
            steps {
                archiveArtifacts artifacts: 'results.json'
            }
        }
    }
}
```

### GitLab CI

```yaml
claude-review:
  image: node:18
  variables:
    RCLI_GITHUB_TOKEN: $GITHUB_TOKEN
  before_script:
    - npm install -g remote-claude
  script:
    - |
      rclaude run "Review merge request changes" \
        --repo $GITHUB_REPO \
        --branch $CI_MERGE_REQUEST_SOURCE_BRANCH_NAME \
        --timeout 1800 \
        --output review.md
  artifacts:
    paths:
      - review.md
    expire_in: 1 week
```

## Security Best Practices

### Token Management

1. **Never commit tokens**
   ```bash
   # Add to .gitignore
   echo ".rclirc" >> .gitignore
   echo "*.token" >> .gitignore
   ```

2. **Use environment variables in CI/CD**
   ```bash
   export RCLI_GITHUB_TOKEN="${SECRET_TOKEN}"
   ```

3. **Rotate tokens regularly**
   - Set calendar reminders
   - Use short-lived tokens when possible
   - Monitor token usage in GitHub settings

### Secure Configuration

1. **Encrypt sensitive config**
   ```bash
   # Encrypt config file
   openssl enc -aes-256-cbc -salt -in .rclirc -out .rclirc.enc
   
   # Decrypt when needed
   openssl enc -d -aes-256-cbc -in .rclirc.enc -out .rclirc
   ```

2. **Use secrets management**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

### Network Security

1. **Webhook security**
   - Use HTTPS endpoints only
   - Implement webhook signature verification
   - Whitelist Remote Claude IPs if possible

2. **Codespace security**
   - Enable 2FA on GitHub account
   - Use organization security policies
   - Regular security audits

## Performance Optimization

### Codespace Prebuilds

1. **Create devcontainer configuration**
   ```json
   {
     "name": "Remote Claude Environment",
     "image": "mcr.microsoft.com/devcontainers/universal:linux",
     "features": {
       "ghcr.io/devcontainers/features/node:1": {
         "version": "18"
       }
     },
     "postCreateCommand": "npm install",
     "customizations": {
       "codespaces": {
         "prebuilds": {
           "autoStart": true
         }
       }
     }
   }
   ```

2. **Enable prebuilds**
   - Go to repository settings
   - Navigate to Codespaces
   - Configure prebuild triggers

### Task Optimization

1. **Batch related tasks**
   ```bash
   # Instead of multiple small tasks
   rclaude run "Fix bug A" && rclaude run "Fix bug B"
   
   # Use a single comprehensive task
   rclaude run "Fix bugs A and B in authentication module"
   ```

2. **Use appropriate timeouts**
   - Small tasks: 300-600 seconds
   - Medium tasks: 1800-3600 seconds
   - Large refactoring: 7200+ seconds

3. **Machine type selection**
   - `basicLinux32gb`: Most tasks
   - `standardLinux32gb`: Compilation-heavy tasks
   - `premiumLinux`: Large codebases

### Resource Management

1. **Auto-cleanup configuration**
   ```json
   {
     "tasks": {
       "autoCleanup": true,
       "retentionHours": 24
     },
     "codespace": {
       "idleTimeoutMinutes": 30,
       "retentionPeriodDays": 7
     }
   }
   ```

2. **Monitor usage**
   ```bash
   # Check active codespaces
   gh codespace list
   
   # Delete unused codespaces
   gh codespace delete -c codespace-name
   ```