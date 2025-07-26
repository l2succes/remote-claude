# Remote Claude SSH Quick Start

This guide covers the SSH v0 implementation that allows you to quickly spin up and connect to Claude Code containers via SSH.

## Prerequisites

- AWS account with ECS configured
- Remote Claude CLI installed (`rclaude`)
- SSH client installed

## Setup

1. **Initialize Remote Claude** (if not already done):
   ```bash
   rclaude init
   rclaude init-deployment --mode self-hosted
   ```

2. **Build SSH Container** (optional, if using custom image):
   ```bash
   cd docker/ssh-container
   ./build.sh
   ```

## Usage

### Create SSH Container

Create a new SSH-enabled container:

```bash
rclaude ssh create
```

This will:
- Generate a unique SSH key pair
- Launch an ECS task with SSH enabled
- Wait for the container to be ready
- Display connection information

### List SSH Containers

View all active SSH containers:

```bash
rclaude ssh list
```

Output:
```
Active SSH Containers:

ID                  Status    Public IP         Created
──────────────────────────────────────────────────────────────────────
task-abc123         running   54.123.45.67      5m ago
task-def456         running   54.123.45.68      1h ago
```

### Connect to Container

Connect using the Remote Claude CLI:

```bash
rclaude ssh connect task-abc123
```

Or connect directly with SSH:

```bash
ssh -i ~/.rclaude/ssh/rclaude-ssh-1234567890 claude@54.123.45.67
```

### Inside the Container

Once connected, you have access to:

- **Development Tools**: Node.js, npm, git, vim, tmux
- **ViberKit SDK**: For AI agent development (when integrated)
- **Claude Code CLI**: For AI assistance (when available)
- **Workspace**: `/workspace` directory for your projects

Example session:
```bash
claude@container:~$ cd /workspace
claude@container:/workspace$ npm init -y
claude@container:/workspace$ npm install express
claude@container:/workspace$ node app.js
```

### Stop Container

When done, stop the container:

```bash
rclaude ssh stop task-abc123
```

This will:
- Stop the ECS task
- Clean up resources
- Remove the SSH key pair

## Security

- Each container gets a unique SSH key pair
- Keys are stored in `~/.rclaude/ssh/` with proper permissions
- Containers run as non-root user (`claude`)
- SSH password authentication is disabled
- Only key-based authentication is allowed

## Configuration

Configure SSH containers in your `.rclaude/config.json`:

```json
{
  "aws": {
    "ecs": {
      "sshImage": "remote-claude/ssh-container:latest",
      "instanceType": "t3.medium",
      "securityGroups": ["sg-xxx"],
      "subnets": ["subnet-xxx", "subnet-yyy"]
    }
  }
}
```

## Troubleshooting

### Container fails to start

Check ECS logs:
```bash
aws ecs describe-tasks --cluster remote-claude-cluster --tasks task-abc123
```

### SSH connection refused

1. Verify security group allows SSH (port 22)
2. Check if container has public IP
3. Ensure SSH key permissions are correct (600)

### Container stops immediately

Check task definition has enough CPU/memory allocated.

## Cost Optimization

- Containers are billed per second while running
- Remember to stop containers when not in use
- Use `rclaude ssh list` to check for forgotten containers
- Consider using smaller instance types for light workloads

## Next Steps

- Install your dotfiles and tools in the container
- Clone your project repositories
- Set up your development environment
- Experiment with ViberKit for AI agent development

## Future Enhancements

- Persistent workspace volumes
- Container templates with pre-installed tools
- Integration with Claude Code SDK
- Automated cleanup of idle containers
- Cost tracking and alerts