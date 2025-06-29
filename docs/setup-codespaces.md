# GitHub Codespaces Setup

## Prerequisites

- GitHub account with Codespaces access
- Personal Access Token with appropriate scopes
- Repository with development container configuration

## Required GitHub Scopes

Your Personal Access Token needs these permissions:
- `codespace` - Create and manage Codespaces
- `repo` - Access repositories (for private repos)
- `read:user` - Read user profile information
- `workflow` - Trigger GitHub Actions (optional)

## Devcontainer Configuration

Create `.devcontainer/devcontainer.json` in your repository:

```json
{
  "name": "Remote Claude CLI Environment",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/github-cli:1": {
      "version": "latest"
    },
    "ghcr.io/devcontainers/features/docker-in-docker:2": {
      "version": "latest"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-vscode.vscode-typescript-next",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-json"
      ]
    }
  },
  "postCreateCommand": "bash .devcontainer/setup-claude.sh",
  "forwardPorts": [3000, 8080],
  "portsAttributes": {
    "3000": {
      "label": "Status API",
      "onAutoForward": "notify"
    },
    "8080": {
      "label": "Results Server",
      "onAutoForward": "notify"
    }
  },
  "remoteUser": "node"
}
```

## Setup Script

Create `.devcontainer/setup-claude.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up Remote Claude CLI environment..."

# Install Claude Code CLI
echo "Installing Claude Code..."
curl -fsSL https://claude.ai/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Verify installation
claude --version

# Install additional dependencies
npm install -g typescript ts-node nodemon

# Setup task runner environment
mkdir -p /workspace/.rcli
cd /workspace/.rcli

# Initialize task runner
cat > task-runner.ts << 'EOF'
import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import express from 'express';

interface TaskStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

class TaskRunner {
  private tasks: Map<string, TaskStatus> = new Map();
  private app = express();

  constructor() {
    this.setupAPI();
    this.app.listen(3000, () => {
      console.log('Task Runner API listening on port 3000');
    });
  }

  private setupAPI() {
    this.app.use(express.json());
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });

    this.app.get('/tasks/:id', (req, res) => {
      const task = this.tasks.get(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    });

    this.app.get('/tasks', (req, res) => {
      res.json(Array.from(this.tasks.values()));
    });

    this.app.post('/tasks', (req, res) => {
      const { command, id } = req.body;
      this.runTask(id || Date.now().toString(), command);
      res.json({ message: 'Task started', id });
    });
  }

  private async runTask(id: string, command: string) {
    const task: TaskStatus = {
      id,
      status: 'running',
      startTime: new Date()
    };
    
    this.tasks.set(id, task);

    try {
      console.log(`Starting task ${id}: ${command}`);
      
      const process = spawn('claude', [command], {
        cwd: '/workspace',
        env: { ...process.env, CLAUDE_NON_INTERACTIVE: '1' }
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        task.status = code === 0 ? 'completed' : 'failed';
        task.endTime = new Date();
        task.output = output;
        
        if (code !== 0) {
          task.error = `Process exited with code ${code}`;
        }

        this.tasks.set(id, task);
        this.notifyCompletion(task);
        
        console.log(`Task ${id} ${task.status}`);
      });

    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error.message;
      this.tasks.set(id, task);
      console.error(`Task ${id} failed:`, error);
    }
  }

  private async notifyCompletion(task: TaskStatus) {
    // Send webhook to local CLI
    const webhookUrl = process.env.RCLI_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task_completed',
            task: task
          })
        });
        console.log('Notification sent:', response.status);
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    }

    // Save results to file
    writeFileSync(`/workspace/.rcli/results-${task.id}.json`, JSON.stringify(task, null, 2));
  }
}

new TaskRunner();
EOF

# Install task runner dependencies
npm init -y
npm install express @types/express @types/node

# Make scripts executable
chmod +x task-runner.ts

echo "Remote Claude CLI environment setup complete!"
echo "Task Runner API will be available on port 3000"
echo "Use 'ts-node task-runner.ts' to start the task runner"
```

## Environment Variables

Set these in your Codespace or via CLI configuration:

```bash
# GitHub configuration
export GITHUB_TOKEN="your_personal_access_token"
export GITHUB_REPOSITORY="owner/repo"

# Claude Code configuration
export ANTHROPIC_API_KEY="your_anthropic_api_key"

# Notification webhook (set by local CLI)
export RCLI_WEBHOOK_URL="https://your-local-webhook-url"

# Optional: Custom timeout
export RCLI_TASK_TIMEOUT="7200" # 2 hours in seconds
```

## Codespace Creation via API

The local CLI will create Codespaces using the GitHub API:

```javascript
const response = await fetch('https://api.github.com/repos/owner/repo/codespaces', {
  method: 'POST',
  headers: {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ref: 'main', // or specific branch
    location: 'WestUs2', // or preferred region
    machine: 'standardLinux32gb', // adjust based on needs
    idle_timeout_minutes: 30,
    retention_period_minutes: 4320, // 3 days
    devcontainer_path: '.devcontainer/devcontainer.json'
  })
});

const codespace = await response.json();
console.log('Codespace created:', codespace.name);
```

## Monitoring and Debugging

### Health Check Endpoint
```bash
curl https://your-codespace-url:3000/health
```

### Task Status
```bash
curl https://your-codespace-url:3000/tasks/task-id-123
```

### Logs
```bash
# View task runner logs
tail -f /workspace/.rcli/task-runner.log

# View Claude Code logs
tail -f ~/.local/share/claude/logs/claude.log
```

## Resource Management

### Automatic Cleanup
```json
{
  "retention_period_minutes": 4320,
  "idle_timeout_minutes": 30
}
```

### Manual Cleanup
```bash
# Stop Codespace
gh codespace stop -c codespace-name

# Delete Codespace
gh codespace delete -c codespace-name
```

## Troubleshooting

### Common Issues

1. **Codespace creation fails**
   - Check GitHub token permissions
   - Verify repository access
   - Ensure Codespaces are enabled for your account

2. **Claude Code installation fails**
   - Check Anthropic API key is set
   - Verify network connectivity
   - Review setup script logs

3. **Task runner not responding**
   - Check if port 3000 is available
   - Verify environment variables are set
   - Review task runner logs

### Debug Mode
Enable debug logging by setting:
```bash
export RCLI_DEBUG=1
export CLAUDE_DEBUG=1
```