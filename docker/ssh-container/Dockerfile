FROM node:20

# Install SSH and development tools
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    git \
    vim \
    nano \
    tmux \
    screen \
    htop \
    curl \
    wget \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages
RUN npm install -g \
    typescript \
    tsx \
    nodemon \
    prettier \
    eslint

# TODO: Install Claude Code CLI when available
# RUN npm install -g @anthropic/claude-code

# Install ViberKit SDK globally
RUN npm install -g @vibe-kit/sdk

# Configure SSH
RUN mkdir /var/run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    echo "AllowUsers claude" >> /etc/ssh/sshd_config

# Create user with sudo access
RUN useradd -m -s /bin/bash claude && \
    echo 'claude ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers && \
    mkdir -p /home/claude/.ssh && \
    chown -R claude:claude /home/claude/.ssh && \
    chmod 700 /home/claude/.ssh

# Copy setup scripts
COPY setup-ssh.sh /usr/local/bin/
COPY entrypoint.sh /usr/local/bin/
COPY vibekit-setup.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/setup-ssh.sh /usr/local/bin/entrypoint.sh /usr/local/bin/vibekit-setup.sh

# Set up workspace
RUN mkdir -p /workspace && chown claude:claude /workspace

# Switch to claude user for setup
USER claude
WORKDIR /home/claude

# Configure bash
RUN echo 'export PS1="\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> ~/.bashrc && \
    echo 'alias ll="ls -alF"' >> ~/.bashrc && \
    echo 'alias la="ls -A"' >> ~/.bashrc && \
    echo 'alias l="ls -CF"' >> ~/.bashrc && \
    echo 'cd /workspace' >> ~/.bashrc

# Run ViberKit setup as claude user
RUN /usr/local/bin/vibekit-setup.sh

# Create welcome message
RUN echo '#!/bin/bash' > ~/.welcome.sh && \
    echo 'echo "=========================================="' >> ~/.welcome.sh && \
    echo 'echo "Welcome to Remote Claude SSH Container!"' >> ~/.welcome.sh && \
    echo 'echo "=========================================="' >> ~/.welcome.sh && \
    echo 'echo ""' >> ~/.welcome.sh && \
    echo 'echo "Available tools:"' >> ~/.welcome.sh && \
    echo 'echo "- Node.js $(node --version)"' >> ~/.welcome.sh && \
    echo 'echo "- npm $(npm --version)"' >> ~/.welcome.sh && \
    echo 'echo "- ViberKit SDK (run: cd ~/vibekit-workspace)"' >> ~/.welcome.sh && \
    echo 'echo ""' >> ~/.welcome.sh && \
    echo 'echo "Workspace: /workspace"' >> ~/.welcome.sh && \
    echo 'echo "ViberKit: ~/vibekit-workspace"' >> ~/.welcome.sh && \
    echo 'echo ""' >> ~/.welcome.sh && \
    echo 'echo "To use ViberKit:"' >> ~/.welcome.sh && \
    echo 'echo "1. cd ~/vibekit-workspace"' >> ~/.welcome.sh && \
    echo 'echo "2. cp .env.example .env && nano .env"' >> ~/.welcome.sh && \
    echo 'echo "3. node vibekit-cli.js \"Create a React app\""' >> ~/.welcome.sh && \
    echo 'echo ""' >> ~/.welcome.sh && \
    chmod +x ~/.welcome.sh && \
    echo '~/.welcome.sh' >> ~/.bashrc

# Switch back to root for entrypoint
USER root

# Expose SSH port
EXPOSE 22

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV WORKSPACE=/workspace

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]