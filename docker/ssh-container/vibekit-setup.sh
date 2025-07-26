#!/bin/bash
# ViberKit setup script for SSH containers

echo "Setting up ViberKit environment..."

# Create ViberKit workspace
mkdir -p ~/vibekit-workspace
cd ~/vibekit-workspace

# Create a sample ViberKit project
cat > package.json << 'EOF'
{
  "name": "remote-claude-vibekit",
  "version": "1.0.0",
  "description": "ViberKit integration for Remote Claude",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "@vibe-kit/sdk": "latest",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

# Create environment template
cat > .env.example << 'EOF'
# ViberKit Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key  # Optional
E2B_API_KEY=your-e2b-api-key        # Optional for sandboxing

# Agent Settings
DEFAULT_MODEL=claude-sonnet-4-20250514
DEFAULT_AGENT=claude
EOF

# Create a simple ViberKit wrapper
cat > vibekit-cli.js << 'EOF'
#!/usr/bin/env node
const { VibeKit } = require('@vibe-kit/sdk');
require('dotenv').config();

async function main() {
  const prompt = process.argv.slice(2).join(' ');
  
  if (!prompt) {
    console.log('Usage: vibekit-cli <prompt>');
    console.log('Example: vibekit-cli "Create a React todo app"');
    process.exit(1);
  }

  console.log('🖖 ViberKit: Processing your request...\n');

  try {
    const vibeKit = new VibeKit()
      .withAgent({
        type: process.env.DEFAULT_AGENT || 'claude',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514'
      });

    // Add event listeners
    vibeKit.on('update', (update) => {
      console.log('📝', update.message);
    });

    vibeKit.on('error', (error) => {
      console.error('❌ Error:', error.message);
    });

    // Generate code
    const result = await vibeKit.generateCode({
      prompt,
      mode: 'code'
    });

    console.log('\n✅ Generated code:');
    console.log(result.code);
    
    if (result.explanation) {
      console.log('\n📖 Explanation:');
      console.log(result.explanation);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

main();
EOF

# Create example usage script
cat > examples.sh << 'EOF'
#!/bin/bash
echo "ViberKit Examples:"
echo ""
echo "1. Generate a React component:"
echo "   node vibekit-cli.js 'Create a React button component with Tailwind CSS'"
echo ""
echo "2. Create an Express API:"
echo "   node vibekit-cli.js 'Create an Express REST API for a todo app'"
echo ""
echo "3. Debug code:"
echo "   node vibekit-cli.js 'Debug this function: function add(a,b) { return a + b + c; }'"
echo ""
echo "4. Write tests:"
echo "   node vibekit-cli.js 'Write Jest tests for a user authentication service'"
EOF

chmod +x vibekit-cli.js examples.sh

# Install dependencies if npm is available
if command -v npm &> /dev/null; then
    echo "Installing ViberKit dependencies..."
    npm install
fi

echo ""
echo "✅ ViberKit setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and add your API keys"
echo "2. Run 'node vibekit-cli.js <prompt>' to generate code"
echo "3. See examples.sh for usage examples"
echo ""
echo "ViberKit workspace: ~/vibekit-workspace"