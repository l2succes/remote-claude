# Remote Claude ECS SSH v0 Implementation Plan

## Overview
A simplified v0 that allows users to SSH directly into ECS containers running Claude Code, potentially leveraging ViberKit for the AI agent capabilities.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   rclaude CLI   │────▶│    ECS Task     │────▶│   Container     │
│                 │ SSH │                 │     │                 │
│ - Create task   │     │ - Public IP     │     │ - SSH Server    │
│ - Get SSH info  │     │ - SSH enabled   │     │ - Claude Code   │
│ - Connect SSH   │     │                 │     │ - ViberKit SDK  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Implementation Steps

### 1. Container Setup
- [ ] Create Docker image with:
  - [ ] OpenSSH server
  - [ ] Claude Code CLI
  - [ ] ViberKit SDK
  - [ ] Basic development tools
- [ ] Configure SSH with secure defaults
- [ ] Set up user environment

### 2. ECS Configuration
- [ ] Update task definition for SSH access
- [ ] Configure security group for SSH (port 22)
- [ ] Enable public IP assignment
- [ ] Set up ECS Exec as fallback

### 3. CLI Commands
- [ ] `rclaude ssh create` - Create new SSH-enabled task
- [ ] `rclaude ssh list` - List active SSH sessions
- [ ] `rclaude ssh connect <task-id>` - Connect to container
- [ ] `rclaude ssh stop <task-id>` - Stop container

### 4. ViberKit Integration
- [ ] Research ViberKit SDK usage
- [ ] Create wrapper scripts for Claude Code + ViberKit
- [ ] Set up agent initialization on container start
- [ ] Configure secure sandbox environment

## Container Dockerfile

```dockerfile
FROM node:20

# Install SSH and development tools
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    git \
    vim \
    tmux \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI (when available)
# RUN npm install -g @anthropic/claude-code

# Install ViberKit SDK
RUN npm install -g @vibe-kit/sdk

# Configure SSH
RUN mkdir /var/run/sshd
RUN echo 'PermitRootLogin no' >> /etc/ssh/sshd_config
RUN echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config
RUN echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

# Create user
RUN useradd -m -s /bin/bash claude && \
    echo 'claude ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Set up SSH key injection via environment
COPY setup-ssh.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/setup-ssh.sh

USER claude
WORKDIR /home/claude

# Entry point that sets up SSH keys and starts sshd
ENTRYPOINT ["/usr/local/bin/setup-ssh.sh"]
```

## CLI Usage Flow

```bash
# Create a new SSH-enabled container
$ rclaude ssh create --name "my-project"
Creating SSH-enabled container...
Container ID: task-abc123
Status: Running
SSH: ssh claude@54.123.45.67

# List active sessions
$ rclaude ssh list
ID          NAME         STATUS    SSH_ADDRESS           CREATED
task-abc123 my-project   Running   54.123.45.67         2 min ago

# Connect to container
$ rclaude ssh connect task-abc123
# Or directly:
$ ssh claude@54.123.45.67

# Inside container:
claude@container:~$ claude-code --help
claude@container:~$ vibekit generate "create a React component"

# Stop container
$ rclaude ssh stop task-abc123
Stopping container task-abc123...
```

## Security Considerations

1. **SSH Key Management**
   - Generate ephemeral SSH keys per session
   - Inject public key via ECS environment variables
   - Store private key locally with proper permissions

2. **Network Security**
   - Restrict SSH to user's IP (when possible)
   - Use security groups effectively
   - Consider VPN for production use

3. **Container Security**
   - Non-root user by default
   - Limited sudo access
   - Read-only root filesystem where possible

## ViberKit Integration Benefits

1. **Simplified Agent Development**
   - Pre-built SDK for AI agents
   - Secure sandbox execution
   - Multiple model support

2. **Code Generation**
   - Built-in code generation capabilities
   - Streaming output support
   - Error handling

3. **Extensibility**
   - Can add custom tools
   - Integrate with other services
   - Plugin architecture

## Implementation Priority

1. **Phase 1: Basic SSH Access**
   - Docker image with SSH
   - ECS task configuration
   - CLI commands for create/connect/stop

2. **Phase 2: Claude Code Integration**
   - Add Claude Code CLI (when available)
   - Configure environment
   - Test basic workflows

3. **Phase 3: ViberKit Enhancement**
   - Integrate ViberKit SDK
   - Create agent templates
   - Add code generation commands

## Success Criteria for v0

- [ ] Can create ECS container with SSH access
- [ ] Can connect via SSH from CLI
- [ ] Container has development tools
- [ ] Can run commands and edit files
- [ ] Container persists for session duration
- [ ] Clean shutdown and cleanup

## Next Steps

1. Build Docker image with SSH
2. Update ECS task definition
3. Implement CLI SSH commands
4. Test end-to-end flow
5. Research ViberKit integration
6. Document usage

## Timeline

- Docker image + ECS setup: 1 day
- CLI SSH commands: 1 day
- Testing and refinement: 1 day
- ViberKit research: 1 day
- **Total: 4 days for basic v0**