#!/bin/bash
set -e

echo "🚀 Remote Claude - Full Deployment"
echo "==================================="

# 1. Setup Supabase (if not done)
if [ ! -f ".env.local" ]; then
    echo "Running Supabase setup..."
    ./scripts/setup-supabase.sh
fi

# 2. Build and deploy to Render
echo ""
echo "📦 Deploying to Render..."
git add .
git commit -m "Deploy: $(date +%Y-%m-%d_%H:%M:%S)" || true
git push origin main

echo "✅ Pushed to GitHub (Render will auto-deploy)"

# 3. Deploy frontend to Vercel
echo ""
echo "🌐 Deploying frontend to Vercel..."
cd website
vercel --prod

# 4. Get URLs
echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📍 Your URLs:"
echo "  - Frontend: (Vercel will display URL above)"
echo "  - Agent Server: https://remote-claude-agent.onrender.com"
echo "  - Supabase: $SUPABASE_URL"
echo ""
echo "🔧 Next Steps:"
echo "1. Set ANTHROPIC_API_KEY in Render dashboard"
echo "2. Test sign-in with GitHub"
echo "3. Create a workspace"
