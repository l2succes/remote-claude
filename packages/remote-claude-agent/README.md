# Remote Claude Agent

WebSocket-based agent for Remote Claude container communication. This agent runs inside containers to provide file system access, command execution, and real-time streaming capabilities.

## Features

- 🔌 **WebSocket Server**: Real-time bidirectional communication
- 📁 **File System API**: Secure file operations within container
- 💻 **Command Execution**: Run commands with streaming output
- 📊 **Stream Management**: Handle multiple concurrent streams
- 🔄 **Auto-reconnection**: Resilient client connections
- 🔒 **Security**: Path validation and sandboxed execution

## Installation

```bash
npm install @remote-claude/agent
```

## Usage

### Starting the Agent (Inside Container)

```javascript
import { RemoteClaudeAgent } from '@remote-claude/agent'

const agent = new RemoteClaudeAgent({
  port: 8080,
  host: '0.0.0.0',
  workDir: '/workspace'
})

await agent.start()
console.log('Agent running on port 8080')
```

Or use the CLI:

```bash
# Using environment variables
export AGENT_PORT=8080
export AGENT_HOST=0.0.0.0
npx @remote-claude/agent

# Or directly
node dist/index.js
```

### Connecting from Host (Client)

```javascript
import { RemoteClaudeClient } from '@remote-claude/agent'

const client = new RemoteClaudeClient({
  url: 'ws://localhost:8080',
  reconnect: true
})

await client.connect()

// File operations
await client.writeFile('test.txt', 'Hello World')
const content = await client.readFile('test.txt')
const files = await client.listFiles('.', true)

// Command execution
const exitCode = await client.executeCommand('npm', ['install'])

// Watch for changes
const unwatch = client.watchFile('.', (event) => {
  console.log('File changed:', event)
})

// Clean up
unwatch()
client.disconnect()
```

## API Reference

### Agent Configuration

```typescript
interface AgentConfig {
  port: number           // WebSocket server port
  host: string          // Bind address (0.0.0.0 for all interfaces)
  workDir: string       // Working directory root
  maxConnections?: number    // Max concurrent connections
  heartbeatInterval?: number // Connection heartbeat interval
}
```

### File System Operations

```typescript
// Read file
await client.readFile(path: string): Promise<string>

// Write file
await client.writeFile(path: string, content: string): Promise<void>

// Delete file or directory
await client.deleteFile(path: string): Promise<void>

// List directory contents
await client.listFiles(path: string, recursive?: boolean): Promise<FileInfo[]>

// Watch for changes
client.watchFile(path: string, callback: (event) => void): () => void
```

### Command Execution

```typescript
// Execute command
await client.executeCommand(
  command: string,
  args?: string[],
  options?: {
    cwd?: string,
    env?: Record<string, string>,
    timeout?: number
  }
): Promise<number>

// Kill process
await client.killProcess(pid: number): Promise<boolean>
```

### Events

The client emits the following events:

- `connected`: Connected to agent
- `disconnected`: Disconnected from agent
- `reconnecting`: Attempting to reconnect
- `error`: Error occurred
- `message`: Raw message received
- `command:stdout`: Command stdout data
- `command:stderr`: Command stderr data
- `command:exit`: Command exited
- `file:changed`: File system change detected

## Message Protocol

The agent uses a JSON-based message protocol over WebSocket:

```typescript
interface Message {
  id: string        // Unique message ID
  type: string      // Message type
  payload?: any     // Message data
  timestamp: number // Unix timestamp
}
```

### Request Types

- `file:read` - Read file contents
- `file:write` - Write file contents
- `file:delete` - Delete file or directory
- `file:list` - List directory contents
- `file:watch` - Watch for file changes
- `command:execute` - Execute command
- `command:kill` - Kill process
- `ping` - Health check

### Response Types

- `{type}:response` - Success response
- `error` - Error response
- `command:stdout` - Command output stream
- `command:stderr` - Command error stream
- `command:exit` - Command exit code
- `file:changed` - File change event

## Docker Integration

Add the agent to your Docker image:

```dockerfile
# Install agent globally
RUN npm install -g @remote-claude/agent

# Expose WebSocket port
EXPOSE 8080

# Start agent on container start
CMD ["npx", "@remote-claude/agent"]
```

Or add to existing entrypoint:

```bash
#!/bin/bash
# Start agent in background
npx @remote-claude/agent &

# Your existing entrypoint
exec "$@"
```

## Security Considerations

1. **Path Validation**: All file operations are restricted to the configured workDir
2. **Command Sandboxing**: Commands run with container's permissions
3. **Connection Limits**: Configure maxConnections to prevent DoS
4. **Network Security**: Use container networking to restrict access

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## License

MIT