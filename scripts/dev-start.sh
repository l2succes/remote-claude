#!/bin/bash
set -e

# Load environment variables
if [ -f ".env.local" ]; then
    source .env.local
else
    echo "❌ No .env.local found. Run ./scripts/dev-setup.sh first"
    exit 1
fi

# Default ports
AGENT_PORT=${AGENT_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-10050}

echo "🚀 Starting Remote Claude Development Environment"
echo "================================================="
echo ""
echo "Services starting on:"
echo "  - Agent Server:  http://localhost:${AGENT_PORT}"
echo "  - Frontend:      http://localhost:${FRONTEND_PORT}"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap Ctrl+C to kill all background processes
trap 'echo ""; echo "🛑 Stopping all services..."; kill 0' INT

# Check if Supabase is running
if ! supabase status &>/dev/null; then
    echo "⚠️  Supabase is not running. Starting it..."
    supabase start
fi

# Start Agent Server in background
echo "🤖 Starting Agent Server..."
(
    cd services/agent-server
    PORT=$AGENT_PORT bun run start:dev
) &
AGENT_PID=$!

# Wait a moment for agent server to start
sleep 2

# Start Frontend in background
echo "🌐 Starting Frontend..."
(
    cd website
    npm run dev -- -p $FRONTEND_PORT
) &
FRONTEND_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "📍 URLs:"
echo "  - Frontend:       http://localhost:${FRONTEND_PORT}"
echo "  - Supabase Studio: http://localhost:${SUPABASE_STUDIO_PORT:-54323}"
echo ""
echo "💡 Watching for changes..."
echo ""

# Wait for all background processes
wait
