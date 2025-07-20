# Fly.io Provider Design for Remote Claude

## Overview
Fly.io offers unique advantages for Remote Claude with its edge computing model, automatic scaling, and pay-per-second billing. This design outlines how to implement a Fly.io provider that maintains compatibility with our existing architecture.

## Why Fly.io is Perfect for Remote Claude

### Key Advantages
1. **Machines Sleep When Idle**: Automatic cost savings
2. **Sub-second Wake Time**: Fast response when needed
3. **Global Edge Deployment**: Run near users
4. **Built-in Proxy**: WebSocket support out of the box
5. **Persistent Volumes**: Data survives restarts
6. **Pay Per Second**: Only pay for actual compute time

## Architecture Design

### Container-per-Repository Model on Fly.io
```
┌─────────────────────────────────────────────────┐
│             Fly.io Edge Network                 │
├─────────────────────────────────────────────────┤
│  Region: iad (primary)                          │
│  ┌─────────────────────────────────────────┐   │
│  │   App: remote-claude-webapp              │   │
│  │   Machine: webapp-abc123 (sleeping)      │   │
│  │   Volume: webapp-data (10GB)             │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │   App: remote-claude-backend             │   │
│  │   Machine: backend-def456 (running)      │   │
│  │   Volume: backend-data (20GB)            │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  Region: lhr (replica)                          │
│  └─ Machines auto-replicate here if needed     │
└─────────────────────────────────────────────────┘
```

## Implementation Strategy

### 1. Fly.io Machine Configuration
```toml
# fly.toml for each repository
app = "claude-{repo-name}"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile.claude"

[env]
  PROVIDER = "fly"
  REMOTE_CLAUDE = "true"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

  [[services.ports]]
    port = 443
    handlers = ["http", "tls"]

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"

[mounts]
  source = "claude_workspace"
  destination = "/workspace"
  initial_size = "10gb"
```

### 2. Fly.io Provider Implementation
```typescript
export class FlyProvider implements ComputeProvider {
  readonly name = 'fly'
  private flyClient: FlyClient // Custom client using Fly API
  
  async createSession(options: SessionOptions): Promise<ComputeSession> {
    const appName = this.getAppName(options.repository)
    
    // Create or wake machine
    const machine = await this.getOrCreateMachine(appName, {
      image: 'anthropic/claude-code:latest',
      size: options.resources?.size || 'shared-cpu-1x',
      env: {
        REPOSITORY: options.repository,
        BRANCH: options.branch || 'main',
        TASK_ID: options.taskId,
      },
      mounts: [{
        volume: `${appName}_workspace`,
        path: '/workspace'
      }]
    })
    
    return {
      id: options.taskId,
      provider: this.name,
      status: 'active',
      metadata: {
        machineId: machine.id,
        appName,
        region: machine.region,
        privateIp: machine.private_ip,
      }
    }
  }
  
  async executeTask(sessionId: string, command: string): Promise<TaskResult> {
    // Use Fly Machines API to exec commands
    const result = await this.flyClient.exec(sessionId, command)
    
    return {
      success: result.exit_code === 0,
      output: result.stdout,
      error: result.stderr,
    }
  }
}
```

### 3. Key Features to Leverage

#### Auto-scaling with Fly Machines
```typescript
// Machines automatically sleep after 1 minute of inactivity
// Wake up in <300ms when request arrives
const machineConfig = {
  auto_destroy: false, // Keep machine around
  restart: {
    policy: 'always',
    max_retries: 3,
  },
  services: [{
    ports: [{ port: 8080 }],
    protocol: 'tcp',
    internal_port: 8080,
    auto_stop_machines: true,
    auto_start_machines: true,
    min_machines_running: 0, // Allow complete scale to zero
  }]
}
```

#### Persistent Volumes
```typescript
// Create volume for repository workspace
await flyClient.createVolume({
  app_id: appName,
  name: `${repoName}_workspace`,
  size_gb: 10,
  region: 'iad',
  encrypted: true,
})
```

#### Global Deployment
```typescript
// Deploy to multiple regions for low latency
const regions = ['iad', 'lhr', 'nrt', 'syd']
for (const region of regions) {
  await flyClient.createMachine({
    ...machineConfig,
    region,
  })
}
```

### 4. Cost Optimization Features

#### Sleep/Wake Pattern
```typescript
class FlyMachineManager {
  async ensureMachineRunning(machineId: string): Promise<void> {
    const status = await this.flyClient.getMachineStatus(machineId)
    
    if (status === 'stopped') {
      // Machine wakes automatically on request
      // But we can pre-wake if needed
      await this.flyClient.startMachine(machineId)
      await this.waitForRunning(machineId)
    }
  }
  
  async allowMachineToSleep(machineId: string): Promise<void> {
    // Fly automatically stops machines after inactivity
    // But we can force stop if needed
    const activeTasks = await this.getActiveTasks(machineId)
    if (activeTasks.length === 0) {
      await this.flyClient.stopMachine(machineId)
    }
  }
}
```

#### Resource Sizing
```typescript
const machineSizes = {
  'dev': 'shared-cpu-1x',      // 1 shared CPU, 256MB RAM
  'standard': 'shared-cpu-2x',  // 2 shared CPU, 512MB RAM  
  'performance': 'dedicated-cpu-1x', // 1 dedicated CPU, 2GB RAM
  'high-perf': 'dedicated-cpu-2x',   // 2 dedicated CPU, 4GB RAM
}
```

### 5. WebSocket and Streaming Support

```typescript
// Fly.io has built-in WebSocket proxy
export class FlyWebSocketManager {
  async createTunnel(machineId: string): Promise<WebSocketTunnel> {
    // Fly automatically proxies WebSocket connections
    const endpoint = `wss://${appName}.fly.dev/ws/${machineId}`
    
    return {
      endpoint,
      connect: async () => {
        const ws = new WebSocket(endpoint)
        // Fly handles SSL termination and routing
        return ws
      }
    }
  }
}
```

### 6. Monitoring and Metrics

```typescript
// Fly provides built-in metrics
export class FlyMetricsCollector {
  async getResourceUsage(machineId: string): Promise<ResourceMetrics> {
    const metrics = await this.flyClient.getMachineMetrics(machineId)
    
    return {
      cpu: metrics.cpu_percentage,
      memory: metrics.memory_used_bytes,
      disk: metrics.disk_used_bytes,
      network: {
        rx: metrics.network_rx_bytes,
        tx: metrics.network_tx_bytes,
      },
      cost: this.calculateCost(metrics),
    }
  }
  
  private calculateCost(metrics: any): number {
    // Fly charges per second of runtime
    const runtimeSeconds = metrics.runtime_seconds
    const cpuSeconds = metrics.cpu_seconds
    
    // Pricing example (not real)
    const baseCost = runtimeSeconds * 0.0000022  // $0.0000022/second
    const cpuCost = cpuSeconds * 0.0000011       // $0.0000011/CPU second
    
    return baseCost + cpuCost
  }
}
```

## Migration Path from ECS

### Phase 1: Dual Provider Support
```typescript
// Add Fly as an option alongside ECS
const providers = {
  'ecs-ec2': new ECSProvider(ecsConfig),
  'fly': new FlyProvider(flyConfig),
}

// Let users choose per task
const provider = task.preferredProvider || 'ecs-ec2'
```

### Phase 2: Intelligent Routing
```typescript
// Route based on task characteristics
function selectProvider(task: Task): string {
  if (task.expectedDuration < 300) {
    return 'fly' // Better for short tasks
  }
  if (task.requiresGPU) {
    return 'ecs-ec2' // Fly doesn't have GPU yet
  }
  if (task.region === 'edge') {
    return 'fly' // Better global distribution
  }
  return 'ecs-ec2' // Default for long-running
}
```

### Phase 3: Full Migration
- Move all workloads to Fly
- Keep ECS as backup/overflow
- Use Fly's global presence

## Unique Fly.io Features to Exploit

### 1. **Fly Postgres**
```typescript
// Attach database to machines
const db = await flyClient.createPostgres({
  name: 'claude-metadata',
  region: 'iad',
  size: 'shared-1x',
})
```

### 2. **Fly Proxy**
- Automatic SSL certificates
- Built-in DDoS protection
- HTTP/2 and HTTP/3 support
- WebSocket multiplexing

### 3. **Fly Machines API**
- GraphQL API for management
- Real-time event streams
- Detailed metrics and logs

### 4. **Multi-region Replication**
```typescript
// Replicate data across regions
await flyClient.createVolumeSnapshot({
  volume_id: primaryVolume.id,
  destination_regions: ['lhr', 'nrt'],
})
```

## Cost Comparison

| Scenario | ECS + EC2 | Fly.io | Savings |
|----------|-----------|---------|---------|
| 100 tasks/day (5 min each) | $120/mo | $15/mo | 87% |
| Always-on repository | $60/mo | $40/mo | 33% |
| Bursty workload | $200/mo | $30/mo | 85% |
| Global deployment | $500/mo | $100/mo | 80% |

## Implementation Timeline

### Month 1: Prototype
- Basic Fly provider implementation
- Single region deployment
- Manual testing

### Month 2: Production Features
- Multi-region support
- Volume management
- Monitoring integration

### Month 3: Migration Tools
- Automated migration from ECS
- Performance optimization
- Cost tracking

## Conclusion

Fly.io provides an excellent complement to ECS for Remote Claude:
- **Use ECS**: For predictable, long-running workloads with AWS integration needs
- **Use Fly**: For bursty, global, cost-sensitive workloads

The architecture supports both providers transparently, allowing users to optimize for their specific needs.