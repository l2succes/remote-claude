#!/bin/bash
set -e

echo "🚀 Remote Claude - Local Development Setup"
echo "=========================================="

# Default ports (can be overridden in .env.local)
AGENT_PORT=${AGENT_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-10050}
SUPABASE_API_PORT=${SUPABASE_API_PORT:-54321}
SUPABASE_DB_PORT=${SUPABASE_DB_PORT:-54322}
SUPABASE_STUDIO_PORT=${SUPABASE_STUDIO_PORT:-54323}

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo ""
    echo "📝 Creating .env.local with default ports..."
    cat > .env.local <<EOF
# Port Configuration
# You can change AGENT_PORT and FRONTEND_PORT if needed
# Supabase ports are fixed by the CLI (54321-54323)
AGENT_PORT=8080
FRONTEND_PORT=10050
SUPABASE_API_PORT=54321
SUPABASE_DB_PORT=54322
SUPABASE_STUDIO_PORT=54323

# Supabase (will be filled after supabase start)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Claude API - Bedrock Configuration
CLAUDE_CODE_USE_BEDROCK=1
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_BEARER_TOKEN_BEDROCK=${AWS_BEARER_TOKEN_BEDROCK:-}
ANTHROPIC_SMALL_FAST_MODEL=${ANTHROPIC_SMALL_FAST_MODEL:-us.anthropic.claude-haiku-4-5-20251001-v1:0}
ANTHROPIC_DEFAULT_HAIKU_MODEL=${ANTHROPIC_DEFAULT_HAIKU_MODEL:-us.anthropic.claude-haiku-4-5-20251001-v1:0}

# Anthropic API (if not using Bedrock)
ANTHROPIC_API_KEY=

# Agent Server (for frontend to connect)
NEXT_PUBLIC_AGENT_SERVER_URL=ws://localhost:8080
EOF
    echo "✅ Created .env.local - You can edit ports here before starting"
else
    # Load existing ports from .env.local
    source .env.local 2>/dev/null || true
fi

# Display port configuration
echo ""
echo "📍 Port Configuration:"
echo "  - Agent Server:      http://localhost:${AGENT_PORT}"
echo "  - Frontend (Next.js): http://localhost:${FRONTEND_PORT}"
echo "  - Supabase API:      http://localhost:${SUPABASE_API_PORT}"
echo "  - Supabase DB:       postgresql://localhost:${SUPABASE_DB_PORT}"
echo "  - Supabase Studio:   http://localhost:${SUPABASE_STUDIO_PORT}"
echo ""

# Check for port conflicts
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "⚠️  WARNING: Port $port ($service) is already in use!"
        echo "    You can change it in .env.local or stop the conflicting service"
        read -p "    Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

echo "🔍 Checking for port conflicts..."
check_port $AGENT_PORT "Agent Server"
check_port $FRONTEND_PORT "Frontend"
echo "   Note: Supabase uses fixed default ports (54321-54323)"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo ""
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

# Check if Supabase is initialized
if [ ! -d "supabase" ]; then
    echo ""
    echo "🔧 Initializing Supabase project..."
    supabase init
fi

# Check if Supabase is running
if ! supabase status &>/dev/null; then
    echo ""
    echo "🚀 Starting local Supabase..."
    echo "   (This may take a minute on first run...)"
    echo "   Using default ports: API=54321, DB=54322, Studio=54323"

    # Start Supabase (uses default ports)
    supabase start

    echo ""
    echo "✅ Supabase started!"

    # Get Supabase credentials and update .env.local
    echo ""
    echo "📝 Updating .env.local with Supabase credentials..."
    ANON_KEY=$(supabase status | grep "anon key:" | awk '{print $3}')
    SERVICE_KEY=$(supabase status | grep "service_role key:" | awk '{print $3}')

    # Update .env.local with credentials
    sed -i '' "s|SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=$ANON_KEY|" .env.local
    sed -i '' "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SERVICE_KEY|" .env.local

    echo "✅ Updated .env.local with Supabase keys"
else
    echo ""
    echo "✅ Supabase is already running"
fi

# Copy .env.local to website directory for Next.js
echo ""
echo "📋 Copying .env.local to website directory..."
cp .env.local website/.env.local

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    bun install
fi

echo ""
echo "✅ Development setup complete!"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Configure Claude API access:"
echo "   Using AWS Bedrock: CLAUDE_CODE_USE_BEDROCK=1 (already configured)"
echo "   Or set ANTHROPIC_API_KEY in .env.local for direct Anthropic API"
echo ""
echo "2. Start all services (in separate terminals):"
echo ""
echo "   Terminal 1 - Agent Server:"
echo "   $ cd services/agent-server"
echo "   $ PORT=${AGENT_PORT} bun run start:dev"
echo ""
echo "   Terminal 2 - Frontend:"
echo "   $ cd website"
echo "   $ npm run dev -- -p ${FRONTEND_PORT}"
echo ""
echo "3. Open your browser:"
echo "   - Frontend:       http://localhost:${FRONTEND_PORT}"
echo "   - Supabase Studio: http://localhost:${SUPABASE_STUDIO_PORT}"
echo ""
echo "💡 Tip: Run 'supabase db push' to apply migrations"
echo "💡 Tip: Run 'supabase status' to see all service URLs"
echo ""
