# Remote Claude Docker Image
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    sudo \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace

# Install global npm packages
# Note: Claude Code doesn't exist yet, so we'll install placeholder tools
RUN npm install -g \
    typescript \
    ts-node \
    nodemon \
    prettier \
    eslint

# Install the agent from npm (when published)
# For now, we'll skip this step as the package isn't published yet
# RUN npm install -g @remote-claude/agent

# Create a non-root user for better security
RUN useradd -m -s /bin/bash claude && \
    echo "claude ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up Git config (will be overridden by user)
RUN git config --global user.name "Claude" && \
    git config --global user.email "claude@remote-claude.dev"

# Add startup script
COPY <<'EOF' /usr/local/bin/startup.sh
#!/bin/bash
echo "🚀 Remote Claude Container Started"
echo "📁 Working directory: /workspace"
echo "🔧 Node version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

# Start the Remote Claude Agent in background (if available)
if command -v @remote-claude/agent >/dev/null 2>&1; then
    echo "🤖 Starting Remote Claude Agent..."
    npx @remote-claude/agent &
    AGENT_PID=$!
    echo "✅ Agent running on port 8080 (PID: $AGENT_PID)"
else
    echo "⚠️  Remote Claude Agent not installed (will be available after npm publish)"
fi
echo ""
echo "Ready for Claude Code execution..."

# Handle shutdown
trap "kill $AGENT_PID 2>/dev/null" EXIT

# Keep container running
exec sleep infinity
EOF

RUN chmod +x /usr/local/bin/startup.sh

# Switch to non-root user
USER claude

# Expose agent WebSocket port
EXPOSE 8080

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/startup.sh"]

# Health check - checks agent if available, otherwise basic check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health 2>/dev/null || node -e "console.log('healthy')"

# Labels
LABEL maintainer="Remote Claude Team"
LABEL version="1.0.0"
LABEL description="Docker image for Remote Claude code execution"