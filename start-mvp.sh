#!/bin/bash

echo "🚀 Remote Claude MVP Setup"
echo "=========================="

# Check for .env file
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your ANTHROPIC_API_KEY"
    echo "   You can get one from: https://console.anthropic.com/settings/keys"
    exit 1
fi

# Check if ANTHROPIC_API_KEY is set
source .env
if [[ "$ANTHROPIC_API_KEY" == "sk-ant-..." ]] || [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY not configured in .env!"
    echo "Please edit .env and add your API key"
    exit 1
fi

echo "✅ API key configured"

# Create workspace directory
echo "📁 Creating workspace directory..."
mkdir -p workspace
mkdir -p workspace/repos

# Build the services
echo "🔨 Building services..."
bun install
bun run build

# Option to install Agent SDK (optional as we have mock mode)
echo ""
echo "📦 Agent SDK Installation (Optional)"
echo "The system can run in mock mode without the SDK."
read -p "Install @anthropic-ai/claude-agent-sdk? (y/N): " install_sdk

if [[ "$install_sdk" == "y" ]] || [[ "$install_sdk" == "Y" ]]; then
    echo "Installing Claude Agent SDK..."
    cd services/agent-server
    npm install @anthropic-ai/claude-agent-sdk
    cd ../..
    echo "✅ Agent SDK installed"
else
    echo "⚠️  Running in mock mode (SDK not installed)"
fi

# Start services
echo ""
echo "🐳 Starting services with Docker Compose..."
docker-compose down
docker-compose up -d --build

# Wait for health check
echo "⏳ Waiting for agent server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Agent server is healthy!"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "==============================================="
echo "✨ MVP is ready!"
echo "==============================================="
echo ""
echo "📍 Agent Server: http://localhost:8080"
echo "📍 Health Check: http://localhost:8080/health"
echo ""
echo "🔧 Quick Test Commands:"
echo ""
echo "1. Test WebSocket connection:"
echo "   bun run --filter @remote-claude/cli dev connect ws://localhost:8080"
echo ""
echo "2. Send a simple query:"
echo "   bun run --filter @remote-claude/cli dev query \"Hello, can you see this?\""
echo ""
echo "3. Clone and analyze a repo:"
echo "   bun run --filter @remote-claude/cli dev query \"Clone https://github.com/sindresorhus/awesome and tell me what it contains\""
echo ""
echo "📊 Monitor logs:"
echo "   docker-compose logs -f agent"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""