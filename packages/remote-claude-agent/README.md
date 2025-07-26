# Remote Claude Agent

WebSocket-based agent that runs inside containers to provide terminal access, file system operations, and Claude Code integration for Remote Claude.

## Features

- **Terminal Multiplexing**: Create and manage multiple terminal sessions
- **File System API**: Browse, read, write, and watch files
- **Claude Code Integration**: AI-powered code assistance (mock implementation for now)
- **WebSocket Communication**: Real-time bidirectional communication
- **Security**: Token-based authentication and path sandboxing

## Architecture

```
┌─────────────────┐
│   Web Client    │
│                 │
└────────┬────────┘
         │ WebSocket
         │
┌────────▼────────┐
│  Remote Claude  │
│     Agent       │
├─────────────────┤
│ Terminal Manager│
│ File System API │
│ Claude Manager  │
└─────────────────┘
```

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

```bash
npm install
```

### Running locally

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

### Environment Variables

- `AGENT_PORT`: WebSocket server port (default: 8080)
- `AGENT_AUTH_TOKENS`: Comma-separated list of valid auth tokens
- `LOG_LEVEL`: Logging level (default: info)
- `WORKSPACE_ROOT`: Root directory for file operations (default: /workspace)
- `NODE_ENV`: Environment (development/production)

## WebSocket Protocol

### Connection

Connect to `ws://agent:8080/?token=YOUR_TOKEN`

### Message Format

All messages follow this structure:

```typescript
{
  type: string
  payload: any
}
```

### Message Types

#### Client to Agent

**Terminal Operations**
- `terminal:create` - Create new terminal
- `terminal:write` - Send input to terminal
- `terminal:resize` - Resize terminal
- `terminal:close` - Close terminal

**File System Operations**
- `fs:list` - List directory contents
- `fs:read` - Read file contents
- `fs:write` - Write file contents
- `fs:delete` - Delete file or directory
- `fs:mkdir` - Create directory
- `fs:watch` - Watch path for changes
- `fs:unwatch` - Stop watching path

**Claude Operations**
- `claude:create` - Create Claude session
- `claude:message` - Send message to Claude
- `claude:close` - Close Claude session

#### Agent to Client

**Terminal Events**
- `terminal:created` - Terminal created successfully
- `terminal:output` - Terminal output data
- `terminal:exit` - Terminal process exited

**File System Events**
- `fs:list:response` - Directory listing
- `fs:read:response` - File contents
- `fs:write:response` - Write confirmation
- `fs:changed` - File system change notification

**Claude Events**
- `claude:created` - Session created
- `claude:response` - Claude's response

**System Events**
- `connected` - Connection established
- `error` - Error occurred

## Docker

### Building the image

```bash
docker build -t remote-claude-agent .
```

### Running the container

```bash
docker run -p 8080:8080 \
  -e AGENT_AUTH_TOKENS=your-secret-token \
  -v $(pwd):/workspace \
  remote-claude-agent
```

## Security

- Token-based authentication required for connections
- File system access restricted to workspace directory
- Non-root user in container
- Input validation on all operations

## API Reference

See [WebSocket Protocol](#websocket-protocol) section for detailed API documentation.

## License

MIT