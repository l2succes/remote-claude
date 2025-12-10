# MCP (Model Context Protocol) Integration Guide

## Overview

MCP servers extend Claude's capabilities by providing access to external tools and services. In Remote Claude, MCP servers can be configured at multiple levels:

1. **Default MCPs** - Configured in `container/mcps/default.json`
2. **Runtime MCPs** - Passed via CLI or WebSocket messages
3. **Custom MCPs** - Your own MCP server implementations

## How MCP Works in Remote Claude

```
Claude Agent SDK
       ↓
  MCP Manager
       ↓
  MCP Servers
   ├── filesystem (file access)
   ├── github (repo operations)
   ├── fetch (web content)
   └── custom (your servers)
```

## Available MCP Servers

### 1. Filesystem MCP
Provides file system access within the workspace:

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
    "description": "File system access for the workspace directory"
  }
}
```

### 2. GitHub MCP
Enables GitHub repository operations:

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
    },
    "description": "GitHub repository access"
  }
}
```

### 3. Fetch MCP
Web content fetching:

```json
{
  "fetch": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-fetch"],
    "description": "Web fetch capabilities"
  }
}
```

## Adding New MCP Servers

### Method 1: Update Default Configuration

Edit `container/mcps/default.json`:

```json
{
  "mcpServers": {
    "your-mcp": {
      "command": "your-mcp-command",
      "args": ["--arg1", "value1"],
      "env": {
        "YOUR_ENV": "value"
      },
      "description": "Your MCP description"
    }
  }
}
```

### Method 2: Pass at Runtime

Via CLI when connecting:

```bash
rclaude connect ws://localhost:8080 \
  --mcp-server github="npx -y @modelcontextprotocol/server-github" \
  --mcp-env github.GITHUB_TOKEN="$GITHUB_TOKEN"
```

Via WebSocket message:

```javascript
{
  "type": "configure",
  "payload": {
    "mcpServers": {
      "custom": {
        "command": "custom-mcp",
        "args": ["--config", "/path/to/config"],
        "env": {
          "API_KEY": "your-key"
        }
      }
    }
  }
}
```

## Cloning GitHub Repositories

### Option 1: Using GitHub MCP

The GitHub MCP server provides tools for repository operations:

```bash
# 1. Ensure GITHUB_TOKEN is set
export GITHUB_TOKEN=ghp_your_token_here

# 2. Start server with GitHub MCP enabled
docker-compose up -d

# 3. Use in your query
rclaude query "Clone the repository https://github.com/user/repo and analyze the code"
```

### Option 2: Direct Git Commands

Claude can use the Bash tool to clone repos:

```bash
rclaude query "Clone https://github.com/user/repo to /workspace/repo using git clone, then analyze the structure"
```

### Option 3: Pre-mount Repository

Mount a local repo into the container:

```yaml
# docker-compose.yml
services:
  agent:
    volumes:
      - ./workspace:/workspace
      - /path/to/your/repo:/workspace/repo:ro
```

## Custom MCP Server Example

Create your own MCP server:

```javascript
// custom-mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'custom-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Add your tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'custom_tool',
      description: 'My custom tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        }
      }
    }
  ]
}));

// Handle tool execution
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'custom_tool') {
    // Your tool logic here
    return {
      content: [
        {
          type: 'text',
          text: `Processed: ${request.params.arguments.input}`
        }
      ]
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Environment Setup for GitHub Repo Work

### 1. Create .env file

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-key-here

# For GitHub MCP
GITHUB_TOKEN=ghp_your_github_token

# Optional
LOG_LEVEL=debug
```

### 2. Update docker-compose for development

```yaml
# docker-compose.yml - add this under agent service
services:
  agent:
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - ./workspace:/workspace
      - ./repos:/workspace/repos  # For cloned repositories
```

## Troubleshooting MCP Servers

### Check MCP Server Status

```bash
# In the agent server logs
docker-compose logs -f agent | grep MCP
```

### Debug MCP Communication

Set log level to debug:

```bash
LOG_LEVEL=debug docker-compose up
```

### Common Issues

1. **MCP server not starting**: Check command exists in container
2. **Authentication errors**: Verify environment variables
3. **Permission denied**: Check file permissions in workspace
4. **Command not found**: Install MCP server in container

## Best Practices

1. **Security**: Never hardcode credentials in MCP configs
2. **Isolation**: Run untrusted MCPs in separate containers
3. **Monitoring**: Check MCP server logs for errors
4. **Performance**: Limit concurrent MCP servers
5. **Testing**: Test MCPs locally before production