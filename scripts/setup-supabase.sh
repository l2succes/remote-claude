#!/bin/bash
set -e

echo "🚀 Remote Claude - Supabase Setup"
echo "================================="

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    npm install -g supabase
fi

# Prompt for Supabase credentials
read -p "Enter your Supabase Project URL: " SUPABASE_URL
read -sp "Enter your Supabase Service Role Key: " SUPABASE_SERVICE_KEY
echo ""

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    cat > .env.local <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
EOF
    echo "✅ Created .env.local"
fi

# Initialize Supabase project
if [ ! -d "supabase" ]; then
    supabase init
    echo "✅ Initialized Supabase project"
fi

# Link to remote project
echo "Linking to Supabase project..."
supabase link --project-ref $(echo $SUPABASE_URL | sed 's/https:\/\///;s/.supabase.co//')

# Run migrations
echo "Running database migrations..."
supabase db push

# Enable GitHub OAuth
echo ""
echo "📝 Manual Step Required:"
echo "1. Go to https://supabase.com/dashboard/project/_/auth/providers"
echo "2. Enable GitHub provider"
echo "3. Add your GitHub OAuth credentials:"
echo "   - Client ID: (from GitHub OAuth App)"
echo "   - Client Secret: (from GitHub OAuth App)"
echo "   - Callback URL: ${SUPABASE_URL}/auth/v1/callback"
echo ""
read -p "Press Enter when GitHub OAuth is configured..."

echo "✅ Supabase setup complete!"
