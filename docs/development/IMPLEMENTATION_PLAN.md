# Implementation Plan: Making Tasks UI & Session Hub Functional

## Overview
This document outlines the plan to connect the existing Tasks Dashboard and Session Hub UI with real functionality through the Claude Agent SDK and WebSocket communication.

## Current State

### Existing Components
1. **Tasks Dashboard** (`/apps/web/app/tasks/page.tsx`)
   - URL: http://localhost:3020/tasks
   - Shows list of all tasks with statistics
   - Currently using mock data

2. **Task Detail/Session Hub** (`/apps/web/app/tasks/[taskId]/page.tsx`)
   - URL: http://localhost:3020/tasks/[taskId]
   - Shows individual task with Claude interaction
   - Includes ClaudeCodeView, TaskProgress, and TaskList components

3. **Agent Server** (`/services/agent-server/`)
   - WebSocket server running on port 8080
   - Claude Agent SDK integration (working)
   - Currently handles single query/response pattern

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   Tasks UI      │◄──────────────────►│  Agent Server    │
│  (React/Next)   │                     │  (Node/Express)  │
└─────────────────┘                     └──────────────────┘
        │                                       │
        │                                       ▼
        │                               ┌──────────────────┐
        │                               │  Claude Agent    │
        └──────────────────────────────►│      SDK         │
                                        └──────────────────┘
```

## Implementation Phases

### Phase 1: Backend Infrastructure

#### 1.1 Task Management Service
**File:** `services/agent-server/src/task-manager.ts`

```typescript
interface Task {
  id: string;
  name: string;
  description: string;
  repository: string;
  branch: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  sessionId: string;
  messages: Message[];
  todos: Todo[];
  fileChanges: FileChange[];
  resources: {
    cpu: number;
    memory: number;
    tokensUsed: number;
    cost: number;
  };
}

class TaskManager {
  private tasks: Map<string, Task>;
  private activeSessions: Map<string, AgentExecutor>;

  createTask(params: CreateTaskParams): Task;
  startTask(taskId: string): void;
  pauseTask(taskId: string): void;
  stopTask(taskId: string): void;
  getTask(taskId: string): Task;
  listTasks(filter?: TaskFilter): Task[];
  updateTaskProgress(taskId: string, progress: number): void;
  addMessage(taskId: string, message: Message): void;
}
```

#### 1.2 WebSocket Protocol Extension
**File:** `services/agent-server/src/protocols.ts`

```typescript
// Task-related message types
interface TaskMessage {
  type: 'task.create' | 'task.update' | 'task.delete' | 'task.list' | 'task.control';
  taskId?: string;
  payload: any;
}

interface TaskEventMessage {
  type: 'task.status' | 'task.progress' | 'task.message' | 'task.resource';
  taskId: string;
  payload: any;
}

// Extended WebSocket message handler
class WebSocketHandler {
  handleTaskMessage(message: TaskMessage): void;
  broadcastTaskUpdate(taskId: string, update: any): void;
  subscribeToTask(clientId: string, taskId: string): void;
  unsubscribeFromTask(clientId: string, taskId: string): void;
}
```

#### 1.3 Resource Monitoring
**File:** `services/agent-server/src/resource-monitor.ts`

```typescript
class ResourceMonitor {
  private monitors: Map<string, NodeJS.Timer>;

  startMonitoring(taskId: string, processId?: number): void;
  stopMonitoring(taskId: string): void;
  getResourceUsage(taskId: string): ResourceUsage;
  calculateCost(tokensUsed: number, duration: number): number;
}
```

### Phase 2: Frontend Integration

#### 2.1 Task Store (Zustand)
**File:** `apps/web/store/tasks.ts`

```typescript
interface TaskStore {
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<Task>;
  updateTask: (taskId: string, update: Partial<Task>) => void;
  selectTask: (taskId: string) => void;
  controlTask: (taskId: string, action: TaskAction) => Promise<void>;

  // WebSocket subscriptions
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
}
```

#### 2.2 Enhanced WebSocket Hook
**File:** `apps/web/lib/useTaskWebSocket.ts`

```typescript
export function useTaskWebSocket() {
  const { tasks, updateTask } = useTaskStore();
  const ws = useWebSocket({
    url: 'ws://localhost:8080',
    onMessage: (message) => {
      switch (message.type) {
        case 'task.status':
          updateTask(message.taskId, { status: message.payload.status });
          break;
        case 'task.progress':
          updateTask(message.taskId, { progress: message.payload.progress });
          break;
        case 'task.message':
          // Update task messages in real-time
          break;
        case 'task.resource':
          // Update resource usage
          break;
      }
    }
  });

  return ws;
}
```

#### 2.3 Task API Client
**File:** `apps/web/lib/api/tasks.ts`

```typescript
class TasksAPI {
  async list(filter?: TaskFilter): Promise<Task[]>;
  async get(taskId: string): Promise<Task>;
  async create(params: CreateTaskParams): Promise<Task>;
  async update(taskId: string, update: Partial<Task>): Promise<Task>;
  async delete(taskId: string): Promise<void>;
  async control(taskId: string, action: TaskAction): Promise<void>;
}
```

### Phase 3: Feature Implementation

#### 3.1 Real-time Task Updates
- Connect TaskList component to real task data
- Implement live progress updates
- Show actual resource usage

#### 3.2 Claude Integration
- Stream Claude responses to ClaudeCodeView
- Extract TODOs from Claude's responses
- Track file changes from tool usage

#### 3.3 Session Persistence
- Save task state to filesystem
- Implement session recovery
- Add task history and logs

#### 3.4 Task Controls
- Implement start/pause/stop/restart functionality
- Add task queuing system
- Handle concurrent task limits

### Phase 4: Advanced Features

#### 4.1 Session Statistics
- Track uptime, messages, tokens, and cost
- Display project context (files, branch)
- Show resource usage graphs

#### 4.2 File Change Tracking
- Monitor file modifications through tool usage
- Display diff statistics
- Show file tree changes

#### 4.3 Activity Timeline
- Log all task events
- Display activity feed
- Export logs and reports

## Implementation Order

1. **Week 1: Backend Foundation**
   - [ ] Create TaskManager service
   - [ ] Extend WebSocket protocol
   - [ ] Add task CRUD operations
   - [ ] Implement basic resource monitoring

2. **Week 2: Frontend Connection**
   - [ ] Create Zustand task store
   - [ ] Build task API client
   - [ ] Connect TaskList to real data
   - [ ] Implement WebSocket subscriptions

3. **Week 3: Claude Integration**
   - [ ] Connect Claude SDK to tasks
   - [ ] Stream responses to UI
   - [ ] Extract and track TODOs
   - [ ] Monitor file changes

4. **Week 4: Polish & Features**
   - [ ] Add session persistence
   - [ ] Implement all task controls
   - [ ] Add statistics tracking
   - [ ] Create activity timeline

## Testing Strategy

### Unit Tests
- TaskManager service methods
- WebSocket message handlers
- Resource monitoring calculations
- API client methods

### Integration Tests
- WebSocket connection flow
- Task lifecycle (create → start → complete)
- Claude SDK integration
- Real-time updates

### E2E Tests
- Create and run a task
- Monitor progress updates
- Control task state
- View task details

## Migration Strategy

1. **Keep mock data as fallback**
   - Add feature flag for real/mock data
   - Gradual rollout to test stability

2. **Backward compatibility**
   - Support both old and new message formats
   - Migrate existing sessions if needed

3. **Data persistence**
   - Start with in-memory storage
   - Add database later if needed
   - Export/import functionality

## Success Metrics

- **Functionality**
  - [ ] Tasks can be created, started, and completed
  - [ ] Real-time updates work reliably
  - [ ] Claude responses stream correctly
  - [ ] Resource monitoring is accurate

- **Performance**
  - [ ] WebSocket latency < 100ms
  - [ ] UI updates are smooth (60 fps)
  - [ ] Memory usage stays stable
  - [ ] Can handle 10+ concurrent tasks

- **User Experience**
  - [ ] No mock data visible
  - [ ] All controls functional
  - [ ] Error states handled gracefully
  - [ ] Progress tracking accurate

## Next Steps

1. Review and refine this plan
2. Set up development environment
3. Create feature branch
4. Start with Phase 1.1 (TaskManager service)
5. Implement incrementally with tests

## Notes

- Current WebSocket connection is working (ws://localhost:8080)
- Claude Agent SDK is properly integrated
- UI components are already built and styled
- Focus on connecting existing pieces rather than rebuilding

## Dependencies

- `@anthropic-ai/claude-agent-sdk` - Already installed and working
- `ws` - WebSocket server (installed)
- `zustand` - State management (needs installation)
- `date-fns` - Date formatting (installed)
- `framer-motion` - Animations (installed)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WebSocket connection instability | Implement reconnection logic with exponential backoff |
| High memory usage with many tasks | Implement task archiving and pagination |
| Claude SDK rate limits | Add queuing and retry logic |
| Lost task state on server restart | Implement filesystem persistence |
| Concurrent task conflicts | Use task locking and queue management |

## References

- [Claude Agent SDK Documentation](https://github.com/anthropics/claude-agent-sdk)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Next.js App Router](https://nextjs.org/docs/app)