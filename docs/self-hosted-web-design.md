# Self-Hosted Remote Claude Web Design

This document outlines the architecture and implementation plan for a self-hosted web version of Remote Claude that provides Claude Code instances through a web interface.

## Overview

The self-hosted Remote Claude web version would allow organizations to deploy their own instance of Remote Claude with:
- Web-based interface for managing Claude Code sessions
- Multi-user support with authentication
- Isolated compute environments for each session
- File management and code execution capabilities
- Real-time collaboration features

## Architecture Components

### 1. Frontend (Web UI)

**Technology Stack:**
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Zustand/Redux for state management
- Socket.io for real-time updates
- Monaco Editor for code editing
- xterm.js for terminal emulation

**Key Features:**
```typescript
interface WebUIFeatures {
  // Authentication & User Management
  auth: {
    login: () => void;
    logout: () => void;
    sso: 'oauth' | 'saml' | 'ldap';
  };
  
  // Session Management
  sessions: {
    create: (config: SessionConfig) => Session;
    list: () => Session[];
    connect: (sessionId: string) => void;
    terminate: (sessionId: string) => void;
  };
  
  // File Explorer
  fileExplorer: {
    browse: (path: string) => FileNode[];
    upload: (files: File[]) => void;
    download: (path: string) => void;
    edit: (path: string) => void;
  };
  
  // Claude Interaction
  claude: {
    chat: (message: string) => void;
    executeTask: (task: Task) => void;
    viewHistory: () => Message[];
  };
  
  // Terminal Access
  terminal: {
    connect: (sessionId: string) => void;
    execute: (command: string) => void;
  };
}
```

### 2. Backend API

**Technology Stack:**
- Node.js with Express/Fastify
- TypeScript
- PostgreSQL for metadata
- Redis for session management
- S3-compatible storage for artifacts
- WebSocket for real-time communication

**API Design:**
```typescript
// Core API endpoints
interface APIEndpoints {
  // Authentication
  'POST /auth/login': (credentials: Credentials) => Token;
  'POST /auth/logout': () => void;
  'GET /auth/user': () => User;
  
  // Session Management
  'POST /sessions': (config: SessionConfig) => Session;
  'GET /sessions': () => Session[];
  'GET /sessions/:id': () => Session;
  'DELETE /sessions/:id': () => void;
  'POST /sessions/:id/execute': (command: Command) => Result;
  
  // File Management
  'GET /sessions/:id/files': (path: string) => FileNode[];
  'POST /sessions/:id/files': (file: File) => void;
  'GET /sessions/:id/files/*': () => FileContent;
  'PUT /sessions/:id/files/*': (content: string) => void;
  'DELETE /sessions/:id/files/*': () => void;
  
  // Claude Integration
  'POST /sessions/:id/claude/chat': (message: string) => Response;
  'POST /sessions/:id/claude/task': (task: Task) => void;
  'GET /sessions/:id/claude/history': () => Message[];
  
  // WebSocket endpoints
  'WS /sessions/:id/terminal': TerminalSocket;
  'WS /sessions/:id/claude': ClaudeSocket;
  'WS /sessions/:id/files': FileWatchSocket;
}
```

### 3. Remote Claude Agent

**Purpose:**
A lightweight agent that runs inside containers/VMs to provide WebSocket-based communication between the web UI and compute environments.

**Technology Stack:**
- Node.js runtime
- WebSocket server for real-time communication
- Claude Code SDK integration
- Terminal multiplexing with node-pty
- File system access APIs

**Agent Architecture:**
```typescript
// packages/remote-claude-agent/src/index.ts
import { WebSocketServer } from 'ws';
import { Claude } from '@anthropic-ai/claude-code';
import { Terminal } from 'node-pty';
import { FileSystemManager } from './fs-manager';

interface AgentMessage {
  id: string;
  type: 'execute' | 'claude' | 'terminal' | 'file' | 'stream';
  payload: any;
}

class RemoteClaudeAgent {
  private wss: WebSocketServer;
  private claude: Claude;
  private terminals: Map<string, Terminal> = new Map();
  private sessions: Map<string, WebSocket> = new Map();
  
  async start(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    
    this.wss.on('connection', (ws, req) => {
      const sessionId = this.extractSessionId(req);
      this.sessions.set(sessionId, ws);
      
      ws.on('message', async (data) => {
        const msg: AgentMessage = JSON.parse(data.toString());
        
        switch (msg.type) {
          case 'execute':
            await this.handleExecute(ws, msg);
            break;
            
          case 'claude':
            await this.handleClaude(ws, msg);
            break;
            
          case 'terminal':
            this.handleTerminal(ws, msg);
            break;
            
          case 'file':
            await this.handleFileOperation(ws, msg);
            break;
        }
      });
      
      ws.on('close', () => {
        this.sessions.delete(sessionId);
        this.cleanupSession(sessionId);
      });
    });
  }
  
  private async handleClaude(ws: WebSocket, msg: AgentMessage) {
    const { prompt, options } = msg.payload;
    
    try {
      // Stream Claude responses
      for await (const chunk of this.claude.query(prompt, options)) {
        ws.send(JSON.stringify({
          id: msg.id,
          type: 'claude-stream',
          payload: chunk
        }));
      }
      
      ws.send(JSON.stringify({
        id: msg.id,
        type: 'claude-complete',
        payload: { success: true }
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        id: msg.id,
        type: 'error',
        payload: { error: error.message }
      }));
    }
  }
}
```

**WebSocket Protocol:**
```typescript
// Message types from client to agent
interface ClientMessages {
  // Execute shell command
  execute: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
  };
  
  // Claude interaction
  claude: {
    prompt: string;
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    };
  };
  
  // Terminal operations
  terminal: {
    action: 'create' | 'write' | 'resize' | 'destroy';
    terminalId?: string;
    data?: string;
    cols?: number;
    rows?: number;
  };
  
  // File operations
  file: {
    action: 'read' | 'write' | 'list' | 'delete' | 'mkdir';
    path: string;
    content?: string;
    encoding?: string;
  };
}

// Message types from agent to client
interface AgentMessages {
  // Command execution results
  executeResult: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
  
  // Claude responses (streamed)
  claudeStream: {
    type: 'text' | 'code' | 'thinking';
    content: string;
  };
  
  // Terminal output
  terminalData: {
    terminalId: string;
    data: string;
  };
  
  // File operation results
  fileResult: {
    success: boolean;
    data?: any;
    error?: string;
  };
}
```

**Container Integration:**
```dockerfile
FROM node:20-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy and install agent
COPY packages/remote-claude-agent/package*.json ./
RUN npm ci --production

COPY packages/remote-claude-agent/dist ./dist

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Expose WebSocket port
EXPOSE 8080

# Start the agent
CMD ["node", "/app/dist/index.js"]
```

### 4. Container Orchestration

**Options:**

#### Option A: Kubernetes-based
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-session
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: claude-code
        image: remote-claude/claude-code:latest
        resources:
          limits:
            cpu: "4"
            memory: "8Gi"
          requests:
            cpu: "2"
            memory: "4Gi"
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: claude-config
          mountPath: /home/user/.config/claude
      - name: session-proxy
        image: remote-claude/session-proxy:latest
        ports:
        - containerPort: 8080
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: session-workspace
      - name: claude-config
        secret:
          secretName: claude-config
```

#### Option B: Docker Compose (Simpler)
```yaml
version: '3.8'

services:
  web:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://api:4000
    depends_on:
      - api
  
  api:
    build: ./api
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/remote_claude
      - REDIS_URL=redis://redis:6379
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=remote_claude
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
  
  redis:
    image: redis:7
    volumes:
      - redis_data:/data
  
  session-manager:
    build: ./session-manager
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - CONTAINER_PREFIX=claude-session
```

### 4. Session Container Design

Each Claude Code session runs in an isolated container:

```dockerfile
FROM ubuntu:22.04

# Install Claude Code and dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    git \
    python3 \
    build-essential \
    curl \
    wget

# Install Claude Code CLI
RUN npm install -g @anthropic/claude-code

# Create user with proper permissions
RUN useradd -m -s /bin/bash claude && \
    usermod -aG sudo claude

# Setup workspace
WORKDIR /workspace
RUN chown -R claude:claude /workspace

# Copy session management scripts
COPY scripts/session-init.sh /usr/local/bin/
COPY scripts/session-monitor.sh /usr/local/bin/

# Switch to non-root user
USER claude

# Entry point that initializes session
ENTRYPOINT ["/usr/local/bin/session-init.sh"]
```

### 5. Security Architecture

**Multi-layer Security:**

```typescript
interface SecurityLayers {
  // Network Isolation
  network: {
    vlan: 'per-user' | 'per-session';
    firewall: FirewallRules;
    proxy: 'traefik' | 'nginx' | 'envoy';
  };
  
  // Container Security
  container: {
    runtime: 'gvisor' | 'kata' | 'docker';
    seccomp: SeccompProfile;
    apparmor: AppArmorProfile;
    capabilities: string[];
  };
  
  // Data Security
  data: {
    encryption: 'at-rest' | 'in-transit';
    backup: BackupStrategy;
    retention: RetentionPolicy;
  };
  
  // Access Control
  access: {
    authentication: 'oauth' | 'saml' | 'ldap';
    authorization: 'rbac' | 'abac';
    audit: AuditConfig;
  };
}
```

### 6. Database Schema

```sql
-- Users and authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    status VARCHAR(50), -- 'starting', 'running', 'stopped', 'error'
    container_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP,
    terminated_at TIMESTAMP
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id UUID REFERENCES sessions(id),
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id UUID REFERENCES sessions(id),
    action VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Web UI to Agent Communication

### Connection Flow

```typescript
// In the web UI backend
class SessionManager {
  async connectToSession(sessionId: string, userId: string) {
    // 1. Get task/container info from ECS/K8s
    const taskInfo = await this.getTaskInfo(sessionId);
    
    // 2. Get private IP of the container
    const privateIp = taskInfo.networkInterfaces[0].privateIpv4Address;
    
    // 3. Create WebSocket proxy connection
    const agentUrl = `ws://${privateIp}:8080`;
    const agentWs = new WebSocket(agentUrl);
    
    // 4. Proxy messages between client and agent
    return this.createProxy(userId, agentWs);
  }
  
  private createProxy(userId: string, agentWs: WebSocket) {
    // Create a secure WebSocket endpoint for the client
    const clientEndpoint = `/api/sessions/${userId}/ws`;
    
    // Proxy messages with authentication and filtering
    this.wss.on('connection', (clientWs, req) => {
      if (!this.authenticateRequest(req)) {
        clientWs.close(1008, 'Unauthorized');
        return;
      }
      
      // Forward messages from client to agent
      clientWs.on('message', (data) => {
        const msg = JSON.parse(data);
        // Add authentication/filtering here
        agentWs.send(JSON.stringify(msg));
      });
      
      // Forward messages from agent to client
      agentWs.on('message', (data) => {
        clientWs.send(data);
      });
    });
  }
}
```

### Security Considerations

1. **Network Isolation**: Agent runs in private subnet, only accessible from backend
2. **Authentication**: All WebSocket connections authenticated at the backend
3. **Message Filtering**: Backend validates and filters messages before forwarding
4. **Rate Limiting**: Prevent abuse of compute resources
5. **Audit Logging**: Track all operations for compliance

### Frontend Integration

```typescript
// In the React frontend
import { useWebSocket } from '@/hooks/useWebSocket';

function ClaudeSession({ sessionId }: { sessionId: string }) {
  const { send, subscribe, connected } = useWebSocket(
    `/api/sessions/${sessionId}/ws`
  );
  
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    const unsubscribe = subscribe('claude-stream', (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content,
        type: data.type
      }]);
    });
    
    return unsubscribe;
  }, [subscribe]);
  
  const sendPrompt = (prompt: string) => {
    send({
      id: generateId(),
      type: 'claude',
      payload: { prompt }
    });
  };
  
  return (
    <div className="claude-session">
      <MessageList messages={messages} />
      <PromptInput onSubmit={sendPrompt} />
    </div>
  );
}
```

## Implementation Phases

### Phase 1: MVP (4-6 weeks)
- Basic web UI with authentication
- Single-user sessions with Docker
- File browser and editor
- Claude chat interface
- Simple task execution

### Phase 2: Multi-user (4-6 weeks)
- User management and RBAC
- Session isolation and security
- Persistent storage
- Audit logging
- Basic monitoring

### Phase 3: Enterprise Features (6-8 weeks)
- SSO integration (SAML/OAuth)
- Kubernetes orchestration
- Advanced security features
- Team collaboration
- Usage analytics

### Phase 4: Scale & Polish (4-6 weeks)
- Performance optimization
- High availability
- Backup and disaster recovery
- Advanced monitoring
- API for external integrations

## Deployment Options

### 1. Single Server
```bash
# Deploy with Docker Compose
docker-compose up -d

# Access at http://localhost:3000
```

### 2. Kubernetes Cluster
```bash
# Deploy with Helm
helm install remote-claude ./charts/remote-claude \
  --set image.tag=latest \
  --set ingress.enabled=true \
  --set ingress.host=claude.company.com
```

### 3. Cloud Platforms
- **AWS**: ECS/EKS + RDS + ElastiCache
- **GCP**: GKE + Cloud SQL + Memorystore
- **Azure**: AKS + Azure Database + Azure Cache

## Configuration Example

```yaml
# config/remote-claude.yaml
server:
  host: 0.0.0.0
  port: 4000
  
auth:
  provider: oauth
  oauth:
    provider: google
    clientId: ${OAUTH_CLIENT_ID}
    clientSecret: ${OAUTH_CLIENT_SECRET}
    
claude:
  apiKey: ${CLAUDE_API_KEY}
  model: claude-3-opus-20240229
  
sessions:
  maxPerUser: 5
  idleTimeout: 30m
  maxDuration: 8h
  
storage:
  type: s3
  s3:
    bucket: remote-claude-sessions
    region: us-east-1
    
security:
  encryption: true
  audit: true
  allowedDomains:
    - company.com
```

## Monitoring & Observability

```typescript
interface Monitoring {
  metrics: {
    sessions: SessionMetrics;
    usage: UsageMetrics;
    performance: PerformanceMetrics;
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    destinations: ('console' | 'file' | 'elasticsearch')[];
  };
  
  tracing: {
    enabled: boolean;
    exporter: 'jaeger' | 'zipkin' | 'otlp';
  };
  
  alerts: {
    rules: AlertRule[];
    destinations: ('email' | 'slack' | 'pagerduty')[];
  };
}
```

## Cost Considerations

### Resource Requirements per Session:
- CPU: 2-4 cores
- Memory: 4-8 GB
- Storage: 10-50 GB
- Network: 100 Mbps

### Estimated Costs (AWS):
- Small (10 users): ~$500/month
- Medium (50 users): ~$2,000/month
- Large (200 users): ~$7,500/month

## Next Steps

1. **Prototype Development**
   - Build basic web UI
   - Implement session management
   - Integrate Claude Code

2. **Security Review**
   - Threat modeling
   - Penetration testing
   - Compliance assessment

3. **Pilot Deployment**
   - Internal testing
   - Performance tuning
   - User feedback

4. **Production Rollout**
   - Gradual deployment
   - Monitoring setup
   - Documentation

This architecture provides a scalable, secure foundation for self-hosted Remote Claude with web access to Claude Code instances.