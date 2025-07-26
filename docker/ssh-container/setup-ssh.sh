#!/bin/bash
set -e

# This script sets up SSH keys from environment variables or ECS metadata

echo "Setting up SSH access..."

# Check if SSH public key is provided via environment variable
if [ -n "$SSH_PUBLIC_KEY" ]; then
    echo "Adding SSH public key from environment..."
    mkdir -p /home/claude/.ssh
    echo "$SSH_PUBLIC_KEY" > /home/claude/.ssh/authorized_keys
    chown -R claude:claude /home/claude/.ssh
    chmod 700 /home/claude/.ssh
    chmod 600 /home/claude/.ssh/authorized_keys
    echo "SSH public key added successfully"
else
    echo "Warning: No SSH_PUBLIC_KEY environment variable found"
    
    # Try to get from ECS metadata if available
    if [ -n "$ECS_CONTAINER_METADATA_URI_V4" ]; then
        echo "Attempting to retrieve SSH key from ECS metadata..."
        # This would need to be implemented based on your metadata service
    fi
fi

# Ensure SSH host keys exist
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    ssh-keygen -A
fi

echo "SSH setup complete"