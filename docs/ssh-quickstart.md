# Remote Claude SSH Quick Start

This guide covers how to use SSH to connect to Remote Claude EC2 instances with automatic Claude Code startup.

## Prerequisites

- AWS account configured
- Remote Claude CLI installed (`rclaude`)
- SSH client installed
- EC2 key pair created in AWS

## Setup

1. **Initialize Remote Claude** (if not already done):
   ```bash
   rclaude init
   ```

2. **Configure EC2 provider**:
   ```bash
   rclaude config ec2 --region us-east-1 --key-pair your-key-name
   ```

## Usage

### Create EC2 Instance

Create a new EC2 instance with Claude Code:

```bash
rclaude run "My task" --provider ec2 --interactive
```

Or for a specific task:

```bash
rclaude run task-id --provider ec2
```

### List EC2 Instances

View all Remote Claude EC2 instances:

```bash
rclaude ec2 list
```

Output:
```
Instance ID         Status      Type           IP Address      Name                     Created
────────────────────────────────────────────────────────────────────────────────────────────────
i-0123456789abcdef  running     t3.medium      54.123.45.67    remote-claude-123456     2024-01-15
i-0987654321fedcba  stopped     t3.small       -               remote-claude-654321     2024-01-14
```

### Connect to Instance

Connect using the Remote Claude CLI:

```bash
rclaude ec2 connect i-0123456789abcdef
```

**Claude Code will start automatically when you connect!**

### Inside the Instance

When you SSH into a Remote Claude EC2 instance:

1. **Claude Code starts automatically** - No need to run any commands
2. **You'll see a welcome message** with available commands
3. **Full development environment** is ready to use

Example session:
```bash
$ rclaude ec2 connect i-0123456789abcdef
🔗 Connecting to EC2 instance i-0123456789abcdef...
✅ Establishing SSH connection...

🚀 Starting Claude Code...

Welcome to Remote Claude EC2 Instance!
======================================

Available commands:
  claude         - Start Claude Code
  exit           - Exit Claude Code and return to shell
  Ctrl+C         - Interrupt current operation

[Claude Code session starts automatically]
```

### Stop Instance

When done, terminate the instance:

```bash
rclaude ec2 terminate i-0123456789abcdef
```

## Security

- Uses your AWS EC2 key pair for authentication
- SSH key should be in `~/.ssh/your-key-name.pem`
- Instances run with proper IAM roles
- Security groups control network access
- Auto-shutdown after idle timeout (configurable)

## Configuration

Configure EC2 settings:

```bash
# Set region
rclaude config ec2 --region us-west-2

# Set instance type
rclaude config ec2 --instance-type t3.large

# Set idle timeout (minutes)
rclaude config ec2 --idle-timeout 30

# Enable spot instances for cost savings
rclaude config ec2 --spot-instance
```

## Troubleshooting

### Claude Code doesn't start automatically

1. Check if the instance was created with the latest user data script
2. Manually start Claude Code with: `claude`
3. For older instances, install Claude Code:
   ```bash
   sudo npm install -g @anthropic-ai/claude-code
   ```

### SSH connection refused

1. Verify security group allows SSH (port 22) from your IP
2. Check if instance has public IP: `rclaude ec2 list`
3. Ensure SSH key permissions: `chmod 600 ~/.ssh/your-key.pem`

### Instance not found

1. Check correct region: `rclaude config ec2`
2. Verify AWS credentials: `aws configure`

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

## Advanced Features

### SSH Agent Forwarding

Enable GitHub access from the instance:
```bash
rclaude ec2 connect i-0123456789abcdef --forward-agent
```

### Copy SSH Keys

Set up passwordless Git access:
```bash
rclaude ec2 copy-ssh-key i-0123456789abcdef --setup-github
```

### Run Specific Command

Execute a command without interactive session:
```bash
rclaude ec2 connect i-0123456789abcdef --command "npm test"
```