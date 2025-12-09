#!/bin/bash

echo "🧪 Testing Remote Claude MVP"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}Checking agent server health...${NC}"
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is healthy${NC}"
else
    echo -e "${RED}❌ Server not running. Run ./start-mvp.sh first${NC}"
    exit 1
fi

# Test 1: Simple query
echo ""
echo -e "${BLUE}Test 1: Simple Query${NC}"
echo "------------------------"
echo "Sending: 'What tools do you have available?'"
echo ""

cd apps/cli
bun run src/index.ts query "What tools do you have available? List each one." \
  --url ws://localhost:8080 \
  --timeout 30

echo ""
echo -e "${BLUE}Test 2: File Operations${NC}"
echo "------------------------"
echo "Creating and reading a test file..."
echo ""

bun run src/index.ts query "Create a file called test.txt in /workspace with the content 'Hello from Claude!' then read it back to confirm" \
  --url ws://localhost:8080 \
  --timeout 30

echo ""
echo -e "${BLUE}Test 3: GitHub Repository Clone${NC}"
echo "------------------------"
echo "Cloning a small repository..."
echo ""

bun run src/index.ts query "Use git to clone https://github.com/sindresorhus/is-docker to /workspace/repos/is-docker, then tell me what the package does by reading its package.json and README" \
  --url ws://localhost:8080 \
  --timeout 60

echo ""
echo -e "${BLUE}Test 4: Code Analysis${NC}"
echo "------------------------"
echo "Analyzing the cloned repository..."
echo ""

bun run src/index.ts query "Look at the is-docker repository in /workspace/repos/is-docker and explain how the main code works. What's the core logic?" \
  --url ws://localhost:8080 \
  --timeout 60

echo ""
echo "============================"
echo -e "${GREEN}✅ MVP Tests Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check workspace/ directory for created files"
echo "2. View full logs: docker-compose logs agent"
echo "3. Try your own queries!"
echo ""