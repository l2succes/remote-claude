# Remote Claude System Architecture

## Overview

Remote Claude is a distributed system that enables running the Claude Agent SDK remotely in cloud environments. The architecture separates the CLI client from the Agent SDK execution, allowing for scalable and flexible AI task execution.

## Core Components

### 1. CLI Client (`apps/cli`)

The command-line interface that users interact with locally:

- **Commands**: Run tasks, manage configurations, connect to servers
- **WebSocket Client**: Maintains persistent connection to Agent Server
- **Task Management**: Save and reuse task configurations
- **Provider Integration**: Creates cloud resources (EC2, Codespaces, ACI)

### 2. Agent Server (`services/agent-server`)

The WebSocket server that wraps the Claude Agent SDK:

```typescript
// Key responsibilities:
- WebSocket server on port 8080
- Wraps Claude Agent SDK in AgentExecutor class
- Handles message protocol (query, response, tool use, etc.)
- Manages MCP server integration
- Streams responses back to CLI
```

**Key Files:**
- `index.ts` - WebSocket server implementation
- `executor.ts` - Claude Agent SDK wrapper
- `mcp-manager.ts` - MCP server management
- `logger.ts` - Logging utilities

### 3. Core Library (`packages/core`)

Business logic and provider abstractions:

- **Providers**: Cloud provider implementations (EC2, Codespaces, ACI)
- **Task Management**: Task storage, history, and execution
- **SSH Management**: Key generation and SSH connections
- **Configuration**: Settings and preferences management

### 4. Shared Protocol (`packages/shared`)

Common types and WebSocket protocol definitions:

```typescript
// Message types
interface QueryMessage {
  type: 'query';
  payload: {
    prompt: string;
    sessionId: string;
    options?: QueryOptions;
  };
}

interface ResponseMessage {
  type: 'response';
  payload: {
    content: ContentBlock[];
    turn: number;
    done: boolean;
  };
}
```

## How Claude Agent SDK is Integrated

### 1. Dynamic Import

The SDK is dynamically imported in `executor.ts`:

```typescript
const sdk = await import('@anthropic-ai/claude-agent-sdk');
const ClaudeSDKClient = sdk.ClaudeSDKClient || sdk.default;
```

### 2. Configuration

SDK options are built from incoming WebSocket messages:

```typescript
const options = {
  systemPrompt: config.systemPrompt,
  maxTurns: config.maxTurns || 50,
  allowedTools: ['Read', 'Write', 'Bash', 'WebSearch'],
  permissionMode: 'acceptEdits',
  cwd: config.workingDirectory,
  mcpServers: config.mcpServers
};
```

### 3. Execution Flow

```
1. CLI sends query via WebSocket
2. Agent Server creates AgentExecutor instance
3. AgentExecutor initializes Claude SDK client
4. SDK executes query with tool support
5. Responses stream back via WebSocket
6. CLI displays results to user
```

## Deployment Architecture

### Local Development

```
┌──────────────┐     WebSocket      ┌──────────────┐
│  rclaude CLI │◄───────────────────►│ Docker       │
│  (localhost) │     Port 8080       │ Container    │
└──────────────┘                     └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ Claude SDK   │
                                     │ /workspace   │
                                     └──────────────┘
```

### Cloud Deployment (EC2 Example)

```
┌──────────────┐     SSH Tunnel     ┌──────────────┐
│  rclaude CLI │◄───────────────────►│ EC2 Instance │
│  (local)     │     WebSocket       │              │
└──────────────┘                     └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ Docker       │
                                     │ Container    │
                                     └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ Claude SDK   │
                                     │ with Tools   │
                                     └──────────────┘
```

## WebSocket Protocol

### Message Flow

1. **Connection**: CLI connects to Agent Server WebSocket
2. **Authentication**: API key passed in configuration
3. **Query**: CLI sends prompt with options
4. **Progress**: Server sends status updates
5. **Tool Use**: Real-time tool execution notifications
6. **Response**: Streaming Claude responses
7. **Completion**: Final status with metrics

### Error Handling

- Automatic reconnection on disconnect
- Graceful error recovery
- Session cleanup on failure
- Rate limit handling

## Security Considerations

1. **API Keys**: Never stored in containers, passed at runtime
2. **WebSocket**: TLS encryption for production
3. **SSH Keys**: Generated per-session for EC2
4. **Resource Cleanup**: Auto-termination of cloud resources
5. **Workspace Isolation**: Each session has isolated workspace

## Monorepo Management

Using Bun workspaces for:

- **Dependency Management**: Shared packages use `workspace:*`
- **Build Orchestration**: Parallel builds with `bun run build`
- **Development**: Hot reload with `bun run dev`
- **Testing**: Unified test runner

## Container Strategy

### Production Container

- Multi-stage build for minimal size
- Node.js 20 slim base image
- Non-root user execution
- Health checks and monitoring

### Development Container

- Source code mounting
- Hot reload support
- Debug logging enabled
- Extended tooling

## MCP Integration

Model Context Protocol servers extend Claude's capabilities:

```javascript
mcpServers: {
  "filesystem": {
    "command": "mcp-server-filesystem",
    "args": ["--root", "/workspace"]
  },
  "git": {
    "command": "mcp-server-git",
    "args": ["--repo", "."]
  }
}
```

## Performance Optimizations

1. **Streaming Responses**: No buffering, direct streaming
2. **Connection Pooling**: Reuse WebSocket connections
3. **Lazy Loading**: Dynamic imports for SDK
4. **Resource Limits**: Configurable timeouts and max turns
5. **Spot Instances**: Cost optimization for EC2

## Monitoring & Observability

- Health check endpoints (`/health`, `/ready`)
- Session tracking (`/sessions`)
- Structured logging with levels
- Metrics collection (tokens, duration, turns)
- Error tracking and reporting

## Future Considerations

1. **Horizontal Scaling**: Multiple Agent Server instances
2. **Queue System**: Task queue for async execution
3. **Caching**: Response caching for common queries
4. **Multi-tenancy**: User isolation and quotas
5. **GPU Support**: For enhanced model capabilities