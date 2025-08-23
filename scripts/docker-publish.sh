#!/bin/bash

# Docker publish script for Remote Claude
# Usage: ./scripts/docker-publish.sh [tag]

set -e

# Configuration
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io"}
DOCKER_ORG=${DOCKER_ORG:-"remoteclaude"}
IMAGE_NAME="remote-claude"
DEFAULT_TAG=${1:-"latest"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Remote Claude Docker Publisher${NC}"
echo "=================================="

# Check if logged in to Docker Hub
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo -e "${YELLOW}⚠️  Not logged in to Docker Hub${NC}"
    echo "Please run: docker login"
    exit 1
fi

# Build the image
echo -e "${GREEN}📦 Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:${DEFAULT_TAG} .

# Tag for registry
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${DOCKER_ORG}/${IMAGE_NAME}"
echo -e "${GREEN}🏷️  Tagging image as ${FULL_IMAGE_NAME}:${DEFAULT_TAG}${NC}"
docker tag ${IMAGE_NAME}:${DEFAULT_TAG} ${FULL_IMAGE_NAME}:${DEFAULT_TAG}

# Also tag with version from package.json if available
if [ -f "package.json" ]; then
    VERSION=$(node -p "require('./package.json').version")
    echo -e "${GREEN}🏷️  Also tagging as version ${VERSION}${NC}"
    docker tag ${IMAGE_NAME}:${DEFAULT_TAG} ${FULL_IMAGE_NAME}:${VERSION}
fi

# Push to registry
echo -e "${GREEN}⬆️  Pushing to Docker Hub...${NC}"
docker push ${FULL_IMAGE_NAME}:${DEFAULT_TAG}

if [ ! -z "$VERSION" ]; then
    docker push ${FULL_IMAGE_NAME}:${VERSION}
fi

echo -e "${GREEN}✅ Docker image published successfully!${NC}"
echo ""
echo "Pull with:"
echo "  docker pull ${FULL_IMAGE_NAME}:${DEFAULT_TAG}"

# Update ECS task definition example
echo ""
echo -e "${YELLOW}📝 To use in ECS, update your task definition:${NC}"
echo "  \"image\": \"${FULL_IMAGE_NAME}:${DEFAULT_TAG}\""