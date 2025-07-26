#!/bin/bash
set -e

# Run SSH setup
/usr/local/bin/setup-ssh.sh

# Start SSH daemon
echo "Starting SSH daemon..."
/usr/sbin/sshd -D &
SSH_PID=$!

# Function to handle shutdown
cleanup() {
    echo "Shutting down SSH daemon..."
    kill $SSH_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Log container information
echo "Container started successfully"
echo "Hostname: $(hostname)"
echo "IP Address: $(hostname -I | awk '{print $1}')"
echo "SSH Port: 22"
echo ""
echo "To connect: ssh claude@<container-ip>"
echo ""

# Keep container running and wait for signals
wait $SSH_PID