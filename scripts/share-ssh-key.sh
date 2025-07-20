#!/bin/bash

# share-ssh-key.sh - Share SSH key with EC2 instances
# WARNING: This copies your personal SSH key to EC2 (less secure)
# Usage: ./share-ssh-key.sh <ec2-ip> [ec2-user] [ssh-key-path]

EC2_IP=${1:-}
EC2_USER=${2:-ec2-user}
SSH_KEY=${3:-~/.ssh/id_ed25519.pub}
EC2_PEM=${EC2_PEM:-~/.ssh/remote-claude-test.pem}

if [ -z "$EC2_IP" ]; then
    echo "Usage: $0 <ec2-ip> [ec2-user] [ssh-key-path]"
    echo "Example: $0 54.123.45.67 ec2-user ~/.ssh/id_ed25519.pub"
    echo ""
    echo "⚠️  WARNING: This copies your personal SSH key to EC2"
    echo "🔐 SAFER: Use ./setup-ec2-ssh.sh instead (creates dedicated keys)"
    echo ""
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at $SSH_KEY"
    exit 1
fi

if [ ! -f "$EC2_PEM" ]; then
    echo "❌ EC2 PEM key not found at $EC2_PEM"
    echo "Set EC2_PEM environment variable or ensure key exists"
    exit 1
fi

echo "⚠️  WARNING: You're about to copy your PERSONAL SSH key to EC2"
echo "This gives the EC2 instance the same GitHub access as you have."
echo "Consider using dedicated keys instead: ./setup-ec2-ssh.sh"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Use ./setup-ec2-ssh.sh for safer key management."
    exit 1
fi

echo "📤 Copying SSH key to $EC2_USER@$EC2_IP..."

# Test EC2 connection first
if ! ssh -i "$EC2_PEM" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "echo 'test'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to EC2 instance"
    exit 1
fi

# Copy the SSH key
ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
cat "$SSH_KEY" | ssh -i "$EC2_PEM" "$EC2_USER@$EC2_IP" "cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

echo "✅ SSH key copied successfully!"
echo ""
echo "🧪 To test GitHub access from EC2:"
echo "  ssh -i $EC2_PEM $EC2_USER@$EC2_IP 'ssh -T git@github.com'"
echo ""
echo "⚠️  Security reminder:"
echo "  • Your personal SSH key is now on the EC2 instance"
echo "  • Anyone with EC2 access has your GitHub permissions"  
echo "  • Consider rotating your SSH keys when done"