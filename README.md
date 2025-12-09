██████╗ ███████╗███╗   ███╗ ██████╗ ████████╗███████╗
██╔══██╗██╔════╝████╗ ████║██╔═══██╗╚══██╔══╝██╔════╝
██████╔╝█████╗  ██╔████╔██║██║   ██║   ██║   █████╗
██╔══██╗██╔══╝  ██║╚██╔╝██║██║   ██║   ██║   ██╔══╝
██║  ██║███████╗██║ ╚═╝ ██║╚██████╔╝   ██║   ███████╗
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚══════╝

 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝

# Remote Claude - Run Claude Agent SDK Anywhere

> **Run Claude Agent SDK remotely on GitHub Codespaces, AWS EC2, or Azure Container Instances with full task management, WebSocket communication, and MCP support**

[![npm version](https://badge.fury.io/js/remote-claude.svg)](https://badge.fury.io/js/remote-claude)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## 🏗️ System Architecture

Remote Claude is a distributed system that allows you to run the Claude Agent SDK remotely in cloud environments. Here's how it works:

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│                 │◄──────────────────────────►│                  │
│   CLI Client    │                            │  Agent Server    │
│   (rclaude)     │         Commands &         │  (Container)     │
│                 │         Responses          │                  │
└─────────────────┘                            └──────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
┌─────────────────┐                            ┌──────────────────┐
│  Local Machine  │                            │ Claude Agent SDK │
│  - Config files │                            │  - Tool execution│
│  - Task storage │                            │  - MCP servers   │
│  - SSH keys     │                            │  - File access   │
└─────────────────┘                            └──────────────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │ Cloud Provider   │
                                               │ - GitHub Spaces  │
                                               │ - AWS EC2        │
                                               │ - Azure ACI      │
                                               └──────────────────┘
```

### Components

1. **CLI Client (`apps/cli`)** - Command-line interface for users
2. **Agent Server (`services/agent-server`)** - WebSocket server wrapping Claude Agent SDK
3. **Core Library (`packages/core`)** - Provider abstractions and task management
4. **Shared Protocol (`packages/shared`)** - WebSocket protocol definitions
5. **Web Interface (`apps/web`)** - Optional web UI for monitoring

## 🚀 Quick Start

```bash
# Install globally
npm install -g remote-claude

# Initialize project
rclaude init

# Connect to a running agent server
rclaude connect ws://localhost:8080

# Run a query
rclaude query "Help me understand this codebase"
```

## 🎯 How Claude Agent SDK is Integrated

The Claude Agent SDK is wrapped by our **Agent Server** service, which:

### 1. **Agent Server (`services/agent-server/src/executor.ts`)**

The `AgentExecutor` class wraps the Claude Agent SDK:

```typescript
// Dynamic import of the SDK
const sdk = await import('@anthropic-ai/claude-agent-sdk');

// Configure SDK with options
const client = new ClaudeSDKClient({
  systemPrompt: config.systemPrompt,
  maxTurns: config.maxTurns || 50,
  allowedTools: ['Read', 'Write', 'Bash', 'WebSearch'],
  permissionMode: 'acceptEdits',
  cwd: config.workingDirectory,
  mcpServers: config.mcpServers
});

// Execute queries and stream responses
await client.query(prompt);
for await (const message of client.receiveResponse()) {
  // Process and forward via WebSocket
}
```

### 2. **WebSocket Protocol (`packages/shared/src/protocol.ts`)**

Communication between CLI and Agent Server uses a structured protocol:

- **Query Messages** - Send prompts to Claude
- **Response Messages** - Stream Claude's responses
- **Tool Use/Result** - Real-time tool execution updates
- **Progress Messages** - Status updates during execution
- **Error Handling** - Graceful error recovery

### 3. **Container Deployment (`container/Dockerfile`)**

The Agent Server runs in containers with:

- Node.js 20 runtime
- Claude Agent SDK dependencies
- MCP server configurations
- Workspace volume mounting
- Health checks and monitoring

## 📦 Monorepo Structure (Bun Workspaces)

```
.
├── apps/                    # Applications
│   ├── cli/                # Command-line interface
│   │   ├── src/
│   │   │   ├── index.ts    # CLI entry point
│   │   │   └── commands/   # CLI commands
│   │   └── package.json
│   ├── web/                # Next.js web interface
│   │   ├── app/           # App router pages
│   │   └── package.json
│   └── api/               # REST API (optional)
│
├── packages/              # Shared packages
│   ├── core/             # Core business logic
│   │   ├── src/
│   │   │   ├── providers/    # Cloud provider integrations
│   │   │   ├── tasks/        # Task management
│   │   │   └── types/        # TypeScript types
│   │   └── package.json
│   ├── shared/           # Shared protocol & types
│   │   ├── src/
│   │   │   ├── protocol.ts   # WebSocket protocol
│   │   │   └── types.ts      # Shared types
│   │   └── package.json
│   └── ui/               # UI components & utilities
│
├── services/             # Microservices
│   ├── agent-server/     # Claude Agent SDK server
│   │   ├── src/
│   │   │   ├── index.ts      # WebSocket server
│   │   │   ├── executor.ts   # SDK wrapper
│   │   │   └── mcp-manager.ts # MCP integration
│   │   └── package.json
│   └── notifications/    # Notification service
│
├── container/           # Docker configurations
│   ├── Dockerfile      # Production container
│   ├── Dockerfile.dev  # Development container
│   └── mcps/          # MCP server configs
│
├── docs/              # Documentation
├── scripts/           # Build & utility scripts
├── package.json       # Root package.json (bun workspaces)
├── bun.lock          # Bun lockfile
└── docker-compose.yml # Local development setup
```

## 🔧 Development Setup

### Prerequisites

- **Bun** (v1.0+) - Fast JavaScript runtime and package manager
- **Node.js** (v18+) - For running the services
- **Docker** - For containerized development
- **Anthropic API Key** - For Claude Agent SDK

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/remote-claude.git
cd remote-claude

# Install dependencies with bun
bun install

# Copy environment variables
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run development servers (all packages)
bun run dev

# Or run specific services
bun run --filter @remote-claude/agent-server dev
bun run --filter @remote-claude/cli dev
bun run --filter website dev
```

### Docker Development

```bash
# Start the agent server
docker-compose up -d

# View logs
docker-compose logs -f agent

# Connect CLI to local server
rclaude connect ws://localhost:8080
```

## 🌐 Cloud Deployment

### GitHub Codespaces

The system can deploy an agent server to a GitHub Codespace:

1. CLI creates a new Codespace via GitHub API
2. Codespace runs the agent-server container
3. CLI connects via WebSocket to the Codespace URL
4. Tasks execute in the cloud environment

### AWS EC2

For EC2 deployments:

1. CLI provisions an EC2 instance with user data script
2. Instance installs Docker and runs agent-server
3. CLI establishes SSH tunnel for WebSocket connection
4. Auto-terminates after task completion

### Azure Container Instances

For serverless container execution:

1. CLI creates an ACI with the agent-server image
2. Container runs with public IP and WebSocket port
3. CLI connects directly to the container
4. Auto-deletes after task completion

## 🔌 MCP (Model Context Protocol) Support

The Agent Server supports MCP servers for extended capabilities:

```javascript
// Configure MCP servers
const mcpServers = {
  "filesystem": {
    "command": "mcp-server-filesystem",
    "args": ["--root", "/workspace"]
  },
  "git": {
    "command": "mcp-server-git",
    "args": ["--repo", "."]
  }
};

// Pass to executor
new AgentExecutor({
  mcpServers: mcpServers,
  // ... other options
});
```

## 📡 WebSocket Protocol

The CLI and Agent Server communicate using a structured WebSocket protocol:

### Message Types

**Client → Server:**
- `query` - Execute a Claude query
- `cancel` - Cancel running task
- `configure` - Update configuration
- `ping` - Keep connection alive

**Server → Client:**
- `response` - Claude's response chunks
- `tool_use` - Tool execution started
- `tool_result` - Tool execution completed
- `progress` - Status updates
- `error` - Error messages
- `complete` - Task completion

### Example Flow

```javascript
// Client sends query
{
  "type": "query",
  "payload": {
    "prompt": "Help me debug this code",
    "sessionId": "uuid",
    "options": {
      "maxTurns": 10,
      "allowedTools": ["Read", "Write"]
    }
  }
}

// Server streams responses
{
  "type": "response",
  "payload": {
    "content": [
      { "type": "text", "text": "I'll help you debug..." }
    ],
    "turn": 1,
    "done": false
  }
}

// Tool execution
{
  "type": "tool_use",
  "payload": {
    "toolId": "tool_123",
    "toolName": "Read",
    "input": { "file": "main.js" }
  }
}

// Completion
{
  "type": "complete",
  "payload": {
    "status": "success",
    "totalTurns": 3,
    "tokensUsed": 1500
  }
}
```

## 🔧 Available Tools

The Claude Agent SDK can use these tools:

- **Read** - Read files from the workspace
- **Write** - Write/create files
- **Bash** - Execute shell commands
- **WebSearch** - Search the web
- **WebFetch** - Fetch web content
- **Edit** - Edit existing files
- **TodoWrite** - Manage task lists

## 🚀 CLI Commands

### Connection Management

```bash
# Connect to agent server
rclaude connect ws://localhost:8080

# Connect with custom options
rclaude connect ws://remote-server:8080 \
  --api-key $ANTHROPIC_API_KEY \
  --working-dir /custom/path
```

### Query Execution

```bash
# Send a query
rclaude query "Explain the architecture of this project"

# Query with options
rclaude query "Fix the authentication bug" \
  --max-turns 20 \
  --tools Read,Write,Bash \
  --timeout 300
```

### Task Management

```bash
# Create and run a task
rclaude run fix-auth-bug

# List tasks
rclaude tasks

# Show task details
rclaude tasks show fix-auth-bug
```

## 📚 Key Features

### 1. **Distributed Architecture**
- CLI runs locally, Agent SDK runs remotely
- WebSocket for real-time communication
- Automatic reconnection and error recovery

### 2. **Multi-Cloud Support**
- GitHub Codespaces integration
- AWS EC2 with spot instances
- Azure Container Instances
- Local Docker development

### 3. **Task Management**
- Save and reuse task configurations
- Track task history and results
- Parallel task execution

### 4. **Real-time Streaming**
- Stream Claude's responses as they generate
- Live tool execution updates
- Progress indicators for long operations

### 5. **MCP Integration**
- Extend capabilities with MCP servers
- Custom tool implementations
- Third-party integrations

### 6. **Security**
- API keys never stored in containers
- Secure WebSocket connections
- Automatic resource cleanup

## 🛠️ Building & Testing

```bash
# Build all packages
bun run build

# Run tests
bun run test

# Lint code
bun run lint

# Clean build artifacts
bun run clean

# Build specific package
bun run --filter @remote-claude/core build
```

## 🔍 Debugging

### Enable Debug Logging

```bash
# Set log level
export LOG_LEVEL=debug

# Run with debug output
rclaude query "test" --debug
```

### Check Agent Server Health

```bash
# Health endpoint
curl http://localhost:8080/health

# List active sessions
curl http://localhost:8080/sessions
```

### View Container Logs

```bash
# Docker logs
docker logs remote-claude-agent

# Docker Compose logs
docker-compose logs -f agent
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Style

- TypeScript for all code
- ESLint for linting
- Prettier for formatting
- Conventional commits

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- Powered by [Bun](https://bun.sh) for fast development
- WebSocket protocol inspired by best practices
- MCP integration for extensibility

## 🔗 Links

- [Documentation](./docs)
- [API Reference](./docs/api.md)
- [WebSocket Protocol](./docs/protocol.md)
- [Provider Setup](./docs/providers.md)
- [MCP Configuration](./docs/mcp.md)

---

<div align="center">
  <strong>Remote Claude - Distributed AI Development with Claude Agent SDK ☁️</strong>
  <br>
  <sub>Run Claude anywhere, build anything</sub>
</div>