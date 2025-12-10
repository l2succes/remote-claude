# 🚀 Quick Start Guide - Get Your MVP Running

## Prerequisites

1. **Anthropic API Key** - Get one from https://console.anthropic.com/settings/keys
2. **GitHub Token** (optional) - For GitHub MCP server
3. **Docker** - For running the agent server
4. **Bun** - For package management

## Step 1: Configure Environment

```bash
# Edit the .env file
nano .env

# Add your API key (required):
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

# Add GitHub token (optional, for repo access):
GITHUB_TOKEN=ghp_your-github-token
```

## Step 2: Start the MVP

```bash
# Run the automated setup script
./start-mvp.sh

# Or manually:
bun install
bun run build
docker-compose up -d
```

## Step 3: Test Basic Connection

```bash
# Test the connection
cd apps/cli
bun run src/index.ts connect ws://localhost:8080

# In another terminal, check health:
curl http://localhost:8080/health
```

## Step 4: Send Your First Query

```bash
# Simple query
bun run src/index.ts query "Hello! What tools do you have available?"

# With more options
bun run src/index.ts query "Create a hello.txt file with 'Hello World'" \
  --endpoint ws://localhost:8080 \
  --timeout 60
```

## Step 5: Clone and Analyze a GitHub Repo

### Method 1: Using Git Command (Simple)

```bash
bun run src/index.ts query "Use git to clone https://github.com/sindresorhus/is-docker to /workspace/is-docker, then analyze the code and tell me what it does"
```

### Method 2: Using GitHub MCP (Advanced)

First, ensure GitHub MCP is configured in your container:

```bash
# The GitHub MCP should be in container/mcps/default.json
# It needs GITHUB_TOKEN environment variable
```

Then query:

```bash
bun run src/index.ts query "Clone and analyze the repository https://github.com/user/repo"
```

### Method 3: Pre-mount a Local Repo

Edit `docker-compose.yml`:

```yaml
services:
  agent:
    volumes:
      - ./workspace:/workspace
      - /path/to/your/local/repo:/workspace/repo:ro  # Add this line
```

Then restart:

```bash
docker-compose down
docker-compose up -d
```

## How MCP Servers Work

### Available MCP Servers

1. **filesystem** - File operations in /workspace
2. **github** - GitHub API operations (needs GITHUB_TOKEN)
3. **fetch** - Web content fetching

### Adding Custom MCP Servers

Edit `container/mcps/default.json`:

```json
{
  "mcpServers": {
    "your-custom-mcp": {
      "command": "your-mcp-command",
      "args": ["--arg1", "value"],
      "env": {
        "API_KEY": "${YOUR_API_KEY}"
      }
    }
  }
}
```

## Running the Test Suite

```bash
# Run all MVP tests
./test-mvp.sh
```

This will test:
1. Basic connection
2. File operations
3. GitHub repo cloning
4. Code analysis

## Troubleshooting

### Server Not Starting

```bash
# Check logs
docker-compose logs -f agent

# Rebuild if needed
docker-compose build --no-cache
docker-compose up -d
```

### API Key Issues

```bash
# Verify .env file
cat .env | grep ANTHROPIC

# Check if it's loaded
docker-compose exec agent env | grep ANTHROPIC
```

### WebSocket Connection Failed

```bash
# Check if port 8080 is available
lsof -i :8080

# Try different port in docker-compose.yml
ports:
  - "8081:8080"  # Change to 8081
```

### Agent SDK Not Found

The system works in **mock mode** without the SDK. To install the real SDK:

```bash
cd services/agent-server
npm install @anthropic-ai/claude-agent-sdk
cd ../..
docker-compose build
docker-compose up -d
```

## Example Workflows

### 1. Analyze a Codebase

```bash
bun run src/index.ts query "Clone https://github.com/tj/commander.js to /workspace/commander, then analyze its architecture and main features"
```

### 2. Create a Project

```bash
bun run src/index.ts query "Create a simple Express.js API in /workspace/my-api with routes for users CRUD operations"
```

### 3. Debug Code

```bash
bun run src/index.ts query "Look at the file /workspace/buggy.js and help me fix any issues you find"
```

## What's Happening Under the Hood

1. **CLI** sends WebSocket message to **Agent Server**
2. **Agent Server** wraps **Claude Agent SDK**
3. **Claude SDK** processes query with **tool support**
4. **MCP Servers** provide extended capabilities
5. **Responses stream back** via WebSocket
6. **CLI displays** results in real-time

## Next Steps

1. ✅ **Basic setup working** - You can query Claude
2. ✅ **File operations** - Create/read files in workspace
3. ✅ **Git operations** - Clone repos with git command
4. 🔧 **MCP servers** - Configure for advanced features
5. 🚀 **Production** - Deploy to cloud providers

## Need Help?

- Check logs: `docker-compose logs -f agent`
- Debug mode: `LOG_LEVEL=debug docker-compose up`
- See architecture: `ARCHITECTURE.md`
- MCP guide: `MCP_GUIDE.md`