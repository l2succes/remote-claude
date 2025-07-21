# Shared EC2 Instance Architecture Design

## Overview

This document outlines the architectural changes needed to support shared EC2 instances for Remote Claude, where one EC2 instance can handle multiple tasks across different repositories, and integration with Claude Code SDK for building a task management UI.

## Current Architecture vs. Proposed Architecture

### Current: One Instance Per Task
```
User A → Task 1 → EC2 Instance 1 → Terminate
User A → Task 2 → EC2 Instance 2 → Terminate
User B → Task 3 → EC2 Instance 3 → Terminate
```

### Proposed: Shared Instance Pool
```
User A → Task 1 ┐
User A → Task 2 ├→ Load Balancer → EC2 Instance Pool → Container Orchestrator
User B → Task 3 ┘                    ├── Instance 1 (4 tasks)
                                     ├── Instance 2 (3 tasks)
                                     └── Instance 3 (idle)
```

## Architecture Components

### 1. Instance Pool Manager
```typescript
interface InstancePoolManager {
  // Instance lifecycle
  createInstance(config: InstanceConfig): Promise<EC2Instance>
  terminateInstance(instanceId: string): Promise<void>
  
  // Pool management
  getAvailableInstance(requirements: TaskRequirements): Promise<EC2Instance>
  scalePool(targetSize: number): Promise<void>
  
  // Health monitoring
  healthCheck(instanceId: string): Promise<HealthStatus>
  rebalanceTasks(): Promise<void>
}
```

### 2. Task Scheduler
```typescript
interface TaskScheduler {
  // Task assignment
  assignTask(task: Task, userId: string): Promise<TaskAssignment>
  
  // Resource management
  checkResourceAvailability(requirements: ResourceRequirements): boolean
  reserveResources(taskId: string, resources: Resources): Promise<void>
  
  // Queue management
  queueTask(task: Task): Promise<QueuePosition>
  getQueueStatus(): QueueStatus
}
```

### 3. Container Orchestration Layer
Each task runs in an isolated container with:
- User-specific namespaces
- Resource limits (CPU, memory, disk)
- Network isolation
- Filesystem isolation via volumes

```yaml
# Docker Compose example for task isolation
version: '3.8'
services:
  task-${TASK_ID}:
    image: claude-code:latest
    container_name: task-${TASK_ID}
    user: ${USER_ID}:${GROUP_ID}
    environment:
      - TASK_ID=${TASK_ID}
      - USER_ID=${USER_ID}
      - REPO_URL=${REPO_URL}
    volumes:
      - /workspace/${USER_ID}/${TASK_ID}:/workspace
      - /tmp/${USER_ID}/${TASK_ID}:/tmp
    networks:
      - task-network-${USER_ID}
    cpus: ${CPU_LIMIT}
    mem_limit: ${MEMORY_LIMIT}
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
```

### 4. Session Router
Routes WebSocket connections to the appropriate instance/container:

```typescript
interface SessionRouter {
  // Connection routing
  routeConnection(userId: string, taskId: string): Promise<ConnectionRoute>
  
  // Session management
  createSession(userId: string, taskId: string): Promise<Session>
  terminateSession(sessionId: string): Promise<void>
  
  // Load balancing
  getOptimalRoute(requirements: RouteRequirements): Route
}
```

## Implementation Plan

### Phase 1: Basic Instance Sharing (Same User)
Allow a single user to run multiple tasks on the same instance:
- Implement container-based task isolation
- Add basic resource management
- Modify EC2Provider to support multiple tasks

### Phase 2: Multi-User Support
Enable multiple users to share instances:
- Implement user isolation and security
- Add resource quotas per user
- Build queue management system

### Phase 3: Advanced Features
- Auto-scaling based on load
- Spot instance integration
- Cross-region support
- Advanced scheduling algorithms

## Claude Code SDK Integration

### UI Architecture
```
┌─────────────────────────────────────┐
│      Remote Claude Web UI           │
│  (Next.js + Claude Code SDK)        │
├─────────────────────────────────────┤
│         API Gateway                 │
│    (REST + WebSocket)               │
├─────────────────────────────────────┤
│     Task Management Service         │
│  - Task CRUD operations             │
│  - Status monitoring                │
│  - Resource tracking                │
├─────────────────────────────────────┤
│      Session Router                 │
│  - WebSocket proxying               │
│  - Connection management            │
├─────────────────────────────────────┤
│    EC2 Instance Pool                │
│  - Shared instances                 │
│  - Container orchestration          │
└─────────────────────────────────────┘
```

### Claude Code SDK Usage

```typescript
// Example: Task Management UI Component
import { ClaudeCode } from '@anthropic/claude-code-sdk'

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([])
  const claudeCode = new ClaudeCode({
    apiKey: process.env.CLAUDE_API_KEY,
  })

  async function createTask(description: string, repository: string) {
    // Create task in our backend
    const task = await api.createTask({
      description,
      repository,
      provider: 'ec2-shared',
    })

    // Initialize Claude Code session
    const session = await claudeCode.createSession({
      taskId: task.id,
      workspace: `/workspace/${task.userId}/${task.id}`,
      capabilities: ['read', 'write', 'execute'],
    })

    // Connect to remote instance via WebSocket
    const connection = await connectToInstance(task.instanceId, session.id)
    
    return { task, session, connection }
  }

  return (
    <div className="task-manager">
      <TaskList tasks={tasks} />
      <TaskDetails selectedTask={selectedTask} />
      <ClaudeAssistant session={currentSession} />
    </div>
  )
}
```

### UI Features
1. **Task Dashboard**
   - List all running/completed tasks
   - Resource usage per task
   - Quick actions (stop, restart, logs)

2. **Live Task View**
   - Real-time output streaming
   - File browser
   - Terminal access
   - Claude conversation history

3. **Resource Monitor**
   - Instance utilization
   - Cost tracking
   - Queue status

4. **Collaboration Features**
   - Share task sessions
   - Team workspaces
   - Audit logs

## Configuration

### Instance Pool Configuration
```json
{
  "ec2": {
    "pooling": {
      "enabled": true,
      "minInstances": 1,
      "maxInstances": 10,
      "instanceType": "t3.large",
      "idleTimeout": 900,
      "taskTimeout": 3600,
      "maxTasksPerInstance": 5,
      "scaling": {
        "enabled": true,
        "targetUtilization": 0.7,
        "scaleUpThreshold": 0.8,
        "scaleDownThreshold": 0.3,
        "cooldownPeriod": 300
      }
    },
    "security": {
      "isolation": "container",
      "networkMode": "bridge",
      "enableUserNamespaces": true,
      "resourceLimits": {
        "cpu": "2",
        "memory": "4G",
        "disk": "10G"
      }
    }
  }
}
```

### User Configuration
```json
{
  "users": {
    "quotas": {
      "maxConcurrentTasks": 3,
      "maxResourcesPerTask": {
        "cpu": "1",
        "memory": "2G",
        "disk": "5G"
      },
      "maxMonthlyHours": 100
    },
    "preferences": {
      "defaultProvider": "ec2-shared",
      "autoTerminate": true,
      "notifications": {
        "taskComplete": true,
        "resourceWarnings": true
      }
    }
  }
}
```

## Migration Strategy

### 1. Backward Compatibility
- Keep existing single-instance mode as default
- Add `--shared` flag for shared instance mode
- Gradual migration path for existing users

### 2. Feature Flags
```typescript
const features = {
  sharedInstances: process.env.ENABLE_SHARED_INSTANCES === 'true',
  webUI: process.env.ENABLE_WEB_UI === 'true',
  autoScaling: process.env.ENABLE_AUTO_SCALING === 'true',
}
```

### 3. Testing Strategy
- Unit tests for new components
- Integration tests for instance sharing
- Load testing for multi-user scenarios
- Security testing for isolation

## Security Considerations

### 1. Container Isolation
- Use Docker security profiles
- Enable user namespaces
- Restrict capabilities
- Network segmentation

### 2. Resource Limits
- CPU and memory quotas
- Disk space limits
- Network bandwidth throttling
- Process count limits

### 3. Access Control
- JWT-based authentication
- Role-based permissions
- Audit logging
- Session management

### 4. Data Protection
- Encrypted volumes
- Secure file transfer
- Environment variable isolation
- Secret management

## Cost Optimization

### 1. Instance Utilization
- Pack multiple tasks per instance
- Auto-scale based on demand
- Use spot instances for non-critical tasks
- Terminate idle instances

### 2. Resource Allocation
- Right-size containers
- Dynamic resource adjustment
- Task priority queuing
- Preemptible tasks

### 3. Monitoring and Alerts
- Cost tracking per user/task
- Budget alerts
- Usage reports
- Optimization recommendations

## Next Steps

1. **Prototype Development**
   - Build basic instance sharing for single user
   - Test container isolation approach
   - Measure performance impact

2. **UI Development**
   - Create task management interface
   - Integrate Claude Code SDK
   - Build real-time monitoring

3. **Production Readiness**
   - Security audit
   - Load testing
   - Documentation
   - Deployment automation

## Open Questions

1. **Persistent Storage**: Should we use EFS for shared storage across instances?
2. **Geographic Distribution**: How to handle multi-region deployments?
3. **Compliance**: What compliance requirements need to be considered?
4. **Pricing Model**: How to price shared vs. dedicated instances?
5. **SLA**: What uptime guarantees can we provide?

## Conclusion

Moving to a shared instance architecture will significantly improve resource utilization and reduce costs while maintaining security through container isolation. The Claude Code SDK integration will provide a rich UI experience for managing and monitoring tasks. This architecture sets the foundation for a scalable, multi-tenant platform while preserving the option for dedicated instances when needed.