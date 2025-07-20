# Shared EC2 Instance POC Summary

## Overview

We've successfully created a proof of concept for the shared EC2 instance architecture with a key simplification: **one Docker container per repository** instead of per task. This approach significantly reduces complexity while maintaining the benefits of resource sharing.

## Architecture Components

### 1. EC2 Instance Pool (`instance-pool.ts`)
- Manages a pool of EC2 instances (min/max configurable)
- Auto-scales based on utilization
- Tracks running tasks per instance
- Health monitoring and idle instance cleanup

### 2. Container Orchestrator (`container-orchestrator.ts`)
- **Key Change**: Creates one container per repository
- Multiple tasks can share the same container if working on the same repo
- Tracks active tasks per container
- Only stops containers when no tasks are active

### 3. EC2 Shared Provider (`ec2-shared-provider.ts`)
- Implements the ComputeProvider interface
- Coordinates between instance pool and container orchestrator
- Maps tasks to containers based on repository

## How It Works

### Task Flow
```
1. User creates task for repository "github.com/user/project"
   └─> Check if container exists for this repository
       ├─> Yes: Add task to existing container
       └─> No: Create new container and clone repository

2. Multiple tasks on same repository
   Task A: "Fix auth bug" ─┐
   Task B: "Add tests"    ─┼─> Share container for "github.com/user/project"
   Task C: "Update docs"  ─┘

3. Task completion
   └─> Remove task from container's active tasks
       └─> If no active tasks remain, stop container
```

### Container Lifecycle
```
Repository: github.com/user/project
├─> Container Created (first task)
├─> Task A added ─> activeTasks: {A}
├─> Task B added ─> activeTasks: {A, B}
├─> Task A completed ─> activeTasks: {B}
├─> Task C added ─> activeTasks: {B, C}
├─> Task B completed ─> activeTasks: {C}
└─> Task C completed ─> activeTasks: {} ─> Container Stopped
```

## Benefits of This Approach

1. **Resource Efficiency**
   - Shared repository state between tasks
   - No redundant cloning/setup
   - Better utilization of EC2 instances

2. **Simplicity**
   - One container = one repository (easy to understand)
   - Natural task grouping
   - Simpler state management

3. **Performance**
   - Faster task startup (repository already cloned)
   - Shared build artifacts/dependencies
   - Reduced network traffic

4. **Cost Optimization**
   - Fewer containers = less overhead
   - Better instance packing
   - Reduced storage usage

## Key Implementation Details

### Container Naming
```typescript
// Repository URL to container name
"https://github.com/anthropic/claude-code.git" → "repo-anthropic-claude-code-abc123"
```

### Task Tracking
```typescript
interface ContainerInfo {
  containerId: string
  repository: string
  activeTasks: Set<string>  // Track all active tasks
  // ... other fields
}
```

### Session Management
```typescript
// Creating a session adds task to container
await containerOrchestrator.addTaskToContainer(repository, taskId)

// Terminating removes task and checks if container should stop
await containerOrchestrator.removeTaskFromContainer(repository, taskId)
await containerOrchestrator.stopContainerIfEmpty(instanceIp, repository)
```

## Usage Example

```typescript
// Create provider
const provider = new EC2SharedProvider({
  minInstances: 1,
  maxInstances: 5,
  maxTasksPerInstance: 10,
  instanceType: 't3.large'
})

// Task 1 on repo A
const session1 = await provider.createSession({
  taskId: 'fix-auth',
  userId: 'user123',
  repository: 'https://github.com/user/project-a.git',
  branch: 'main'
})

// Task 2 on same repo A (shares container)
const session2 = await provider.createSession({
  taskId: 'add-tests',
  userId: 'user123',
  repository: 'https://github.com/user/project-a.git',
  branch: 'main'
})

// Task 3 on different repo B (new container)
const session3 = await provider.createSession({
  taskId: 'update-docs',
  userId: 'user456',
  repository: 'https://github.com/user/project-b.git',
  branch: 'develop'
})
```

## Security Considerations

- Containers are isolated per repository (not per user)
- Consider adding user-level access controls for shared repositories
- Network isolation between containers
- Resource limits per container

## Next Steps

1. **Production Readiness**
   - Add persistent storage for container state
   - Implement proper instance-to-container mapping
   - Add metrics and monitoring

2. **UI Integration**
   - Build task dashboard showing container status
   - Add repository-centric view
   - Show active tasks per repository

3. **Advanced Features**
   - Container warming (pre-create for popular repos)
   - Branch-specific containers option
   - Container snapshots for faster startup

## Conclusion

This simplified architecture maintains the benefits of resource sharing while being much easier to implement and understand. By organizing containers around repositories instead of tasks, we create a natural and efficient grouping that aligns with how developers actually work.