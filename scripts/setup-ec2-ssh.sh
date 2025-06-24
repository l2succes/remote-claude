#!/bin/bash

# setup-ec2-ssh.sh - Set up dedicated SSH keys for EC2 instances
# This is SAFER than copying personal SSH keys

set -e

EC2_IP=${1:-}
EC2_USER=${2:-ec2-user}
EC2_PEM=${3:-~/.ssh/remote-claude-test.pem}
DEDICATED_KEY=${4:-~/.ssh/remote-claude-github}

if [ -z "$EC2_IP" ]; then
    echo "Usage: $0 <ec2-ip> [ec2-user] [ec2-pem] [dedicated-key]"
    echo "Example: $0 54.123.45.67 ec2-user ~/.ssh/remote-claude-test.pem"
    echo ""
    echo "This script creates a DEDICATED SSH key for EC2 GitHub access"
    echo "instead of copying your personal SSH keys (which is unsafe)."
    exit 1
fi

echo "🔐 Setting up dedicated SSH key for EC2 GitHub access..."
echo "EC2 Instance: $EC2_USER@$EC2_IP"
echo "Dedicated Key: $DEDICATED_KEY"
echo ""

# Check if EC2 PEM key exists
if [ ! -f "$EC2_PEM" ]; then
    echo "❌ EC2 PEM key not found: $EC2_PEM"
    echo "Make sure you have the correct EC2 key pair configured."
    exit 1
fi

# Generate dedicated key if it doesn't exist
if [ ! -f "$DEDICATED_KEY" ]; then
    echo "🔑 Generating dedicated SSH key for EC2 GitHub access..."
    ssh-keygen -t ed25519 -f "$DEDICATED_KEY" -C "remote-claude-ec2-github" -N ""
    echo "✅ Generated dedicated key: $DEDICATED_KEY"
    echo ""
    echo "📋 ADD THIS PUBLIC KEY TO YOUR GITHUB REPOSITORIES:"
    echo "───────────────────────────────────────────────────"
    cat "${DEDICATED_KEY}.pub"
    echo "───────────────────────────────────────────────────"
    echo ""
    echo "Go to GitHub → Repository Settings → Deploy Keys → Add Deploy Key"
    echo "Or for broader access: GitHub Settings → SSH Keys → New SSH Key"
    echo ""
    read -p "Press Enter when you've added the key to GitHub..."
else
    echo "✅ Using existing dedicated key: $DEDICATED_KEY"
fi

# Test EC2 connection
echo "🔗 Testing EC2 connection..."
if ! ssh -i "$EC2_PEM" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "echo 'Connection successful'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to EC2 instance. Check:"
    echo "   - Instance is running and accessible"
    echo "   - Security group allows SSH (port 22)"
    echo "   - EC2 PEM key is correct: $EC2_PEM"
    exit 1
fi
echo "✅ EC2 connection successful"

# Copy dedicated key to EC2 instance
echo "📤 Copying dedicated SSH key to EC2 instance..."

# Create .ssh directory and set permissions
ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "mkdir -p ~/.ssh && chmod 700 ~/.ssh"

# Copy the private key (dedicated, not personal)
scp -i "$EC2_PEM" "$DEDICATED_KEY" "$EC2_USER@$EC2_IP:~/.ssh/github_key"
ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "chmod 600 ~/.ssh/github_key"

# Set up SSH config for GitHub
ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "cat > ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_key
    StrictHostKeyChecking no
EOF"

ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "chmod 600 ~/.ssh/config"

echo "✅ SSH key setup complete!"
echo ""

# Test GitHub access
echo "🧪 Testing GitHub access from EC2..."
if ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "ssh -T git@github.com" 2>&1 | grep -q "successfully authenticated"; then
    echo "✅ GitHub access working!"
else
    echo "⚠️  GitHub access test inconclusive. Try manually:"
    echo "   ssh -i $EC2_PEM $EC2_USER@$EC2_IP"
    echo "   ssh -T git@github.com"
fi

echo ""
echo "🎉 Setup complete! You can now:"
echo "   • Clone private repos: git clone git@github.com:owner/repo.git"
echo "   • Push changes from the EC2 instance"
echo "   • Use Git normally on the EC2 instance"
echo ""
echo "🔐 Security notes:"
echo "   • This uses a DEDICATED key, not your personal SSH key"
echo "   • The key is only for GitHub access from EC2"
echo "   • You can revoke it anytime from GitHub settings"