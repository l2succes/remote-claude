#!/bin/bash
set -e

# Configuration
IMAGE_NAME="remote-claude/ssh-container"
TAG="${1:-latest}"
REGISTRY="${DOCKER_REGISTRY:-}"

# Full image name
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$TAG"
else
    FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
fi

echo "Building SSH container image..."
echo "Image: $FULL_IMAGE_NAME"

# Build the image
docker build -t "$FULL_IMAGE_NAME" .

echo "✓ Image built successfully"

# Push to registry if specified
if [ -n "$REGISTRY" ]; then
    echo "Pushing to registry: $REGISTRY"
    docker push "$FULL_IMAGE_NAME"
    echo "✓ Image pushed successfully"
fi

echo ""
echo "To test locally:"
echo "  docker run -p 2222:22 -e SSH_PUBLIC_KEY=\"\$(cat ~/.ssh/id_rsa.pub)\" $FULL_IMAGE_NAME"
echo "  ssh -p 2222 claude@localhost"