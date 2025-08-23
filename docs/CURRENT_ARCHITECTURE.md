# Remote Claude - Current Architecture & Components

## 🎯 Project Goal
Enable developers to run Claude Code tasks remotely on scalable cloud infrastructure (AWS ECS/EC2) with a task-based workflow model.

## 📊 Current Status & Problem

We've built several components but they're not fully integrated:

1. **CLI Tool** (`rclaude`) - ✅ Works for basic ECS task management
2. **ECS Backend** - ✅ Can spin up containers but limited execution
3. **WebSocket Infrastructure** - ✅ Built but not integrated
4. **Remote Claude Agent** - ✅ Built but not deployed
5. **Docker Images** - ✅ Built but missing Claude Code
6. **Web UI** - ❌ Not started
7. **VibeKit Integration** - 🔄 Being evaluated as alternative

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          USER MACHINE                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │   CLI Tool  │      │   Web UI     │      │   VS Code    │   │
│  │  (rclaude)  │      │  (planned)   │      │  Extension   │   │
│  └──────┬──────┘      └──────┬───────┘      └──────┬───────┘   │
│         │                     │                      │           │
│         └─────────────────────┼──────────────────────┘           │
│                               │                                  │
│                        ┌──────▼───────┐                          │
│                        │   REST API   │                          │
│                        │  (planned)   │                          │
│                        └──────┬───────┘                          │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                          ┌─────▼──────┐
                          │  INTERNET  │
                          └─────┬──────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                           AWS CLOUD                               │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    ECS CLUSTER                            │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │              ECS TASK (Container)                │     │    │
│  │  ├─────────────────────────────────────────────────┤     │    │
│  │  │                                                  │     │    │
│  │  │  ┌──────────────┐      ┌───────────────────┐   │     │    │
│  │  │  │ Claude Code  │◄────►│  Remote Claude    │   │     │    │
│  │  │  │   (future)   │      │     Agent         │   │     │    │
│  │  │  └──────────────┘      └─────────┬─────────┘   │     │    │
│  │  │                                   │             │     │    │
│  │  │         ┌─────────────────────────┼─────┐       │     │    │
│  │  │         │      WebSocket Server   │     │       │     │    │
│  │  │         │        (Port 8080)      ▼     │       │     │    │
│  │  │  ┌──────┴────────┐    ┌─────────────────┐     │     │    │
│  │  │  │ File System   │    │ Command         │     │     │    │
│  │  │  │    API        │    │ Executor        │     │     │    │
│  │  │  └───────────────┘    └─────────────────┘     │     │    │
│  │  │                                                 │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │         EC2 INSTANCE (t3.medium)                │     │    │
│  │  │         - Hosts ECS Tasks                       │     │    │
│  │  │         - Auto-scaling Group                    │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  │                                                           │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## 📦 Component Details

### 1. CLI Tool (`rclaude`)
**Location**: `/src/cli/`
**Status**: ✅ Functional
**Purpose**: Command-line interface for managing remote tasks

**Working Commands**:
- `rclaude init` - Initialize configuration
- `rclaude run <task>` - Run a task (creates ECS container)
- `rclaude ecs list` - List running tasks
- `rclaude ecs stop` - Stop tasks
- `rclaude websocket server` - Start WebSocket server (NEW)

**Issues**:
- Can create containers but can't execute commands inside them (Session Manager Plugin required)
- No real-time communication with containers

### 2. ECS Backend
**Location**: `/src/services/compute/providers/ecs-ec2/`
**Status**: ✅ Partially working
**Purpose**: Manage AWS ECS tasks and EC2 instances

**What Works**:
- Creates ECS cluster with EC2 instances
- Launches ECS tasks (containers)
- Interactive terminal connection (requires Session Manager Plugin)

**What Doesn't**:
- Non-interactive command execution
- Real-time streaming of outputs
- File synchronization

### 3. Remote Claude Agent (NEW)
**Location**: `/packages/remote-claude-agent/`
**Status**: ✅ Built, not deployed
**Purpose**: Runs inside containers to provide WebSocket API for file/command operations

**Components**:
```
packages/remote-claude-agent/
├── src/
│   ├── agent.ts           # WebSocket server
│   ├── client.ts          # Client library
│   └── services/
│       ├── file-system.ts     # File operations
│       ├── command-executor.ts # Command execution
│       └── stream-manager.ts   # Stream handling
```

**Features**:
- WebSocket server on port 8080
- File system operations (read/write/delete/watch)
- Command execution with streaming
- Health check endpoints

**Integration Status**: 
- ❌ Not published to npm
- ❌ Not included in Docker image
- ❌ Not connected to CLI

### 4. Docker Image
**Location**: `/Dockerfile`
**Status**: ✅ Built
**Purpose**: Container image for running tasks

**Current State**:
- Base Node.js 20 environment
- Development tools installed
- Agent integration prepared (but not active)
- Missing Claude Code CLI

### 5. WebSocket Infrastructure
**Location**: `/src/services/websocket/`
**Status**: ✅ Built
**Purpose**: Real-time communication between CLI and containers

**Components**:
- `ecs-exec-websocket.ts` - WebSocket server/client for ECS Exec
- CLI command: `rclaude websocket server`

## 🔄 Current Workflow (What Should Happen)

1. **User runs task**: `rclaude run "fix authentication bug"`
2. **CLI creates ECS task**: Container starts with Docker image
3. **Agent starts in container**: WebSocket server on port 8080
4. **CLI connects to agent**: Via WebSocket through ECS networking
5. **Claude Code executes**: Agent provides file/command access
6. **Real-time updates**: Stream back to CLI via WebSocket
7. **Task completes**: Results saved, container cleaned up

## ❌ Current Blockers

1. **Claude Code not available**: We're building infrastructure for a tool we don't have
2. **Agent not deployed**: Built but not in Docker image or npm
3. **No WebSocket routing**: Can't connect CLI to container's WebSocket
4. **Session Manager Plugin**: Required for ECS Exec, not user-friendly
5. **No REST API**: Web UI has nothing to connect to

## 🎯 Immediate Next Steps

### Option A: Fix Current Architecture
1. Publish agent to npm: `@remote-claude/agent`
2. Include agent in Docker image
3. Set up WebSocket proxy/tunneling for container access
4. Build REST API for web UI
5. Create basic web UI

### Option B: Switch to VibeKit
1. Complete VibeKit POC (TASK-005)
2. Compare costs with ECS
3. Potentially simpler architecture:
   - VibeKit handles container management
   - Built-in code execution
   - May not need custom agent

## 📝 Key Decisions Needed

1. **Continue with ECS or switch to VibeKit?**
   - ECS: More control, more complex
   - VibeKit: Simpler, less control

2. **How to handle Claude Code availability?**
   - Mock it for now?
   - Wait for official release?
   - Use alternative AI coding tool?

3. **WebSocket routing strategy?**
   - ECS Service Connect?
   - Application Load Balancer with WebSocket support?
   - SSH tunneling?

## 📂 Repository Structure

```
remote-claude/
├── src/                      # Main application code
│   ├── cli/                  # CLI commands
│   ├── services/             # Core services
│   │   ├── compute/          # ECS/EC2 providers
│   │   └── websocket/        # WebSocket infrastructure
│   └── utils/                # Utilities
├── packages/                 # Subpackages
│   └── remote-claude-agent/  # Container agent (NEW)
├── docs/                     # Documentation
├── tasks/                    # Task tracking
├── website/                  # Marketing website
└── Dockerfile               # Container image
```

## 🚀 To Continue Development

Based on where we are, the most logical next steps are:

1. **Decide on VibeKit**: Run the POC to see if it's simpler
2. **If staying with ECS**: 
   - Solve WebSocket routing
   - Deploy the agent
   - Build REST API
3. **If switching to VibeKit**:
   - Complete integration
   - Simplify architecture
   - Remove unnecessary components

The core issue is we're building infrastructure for Claude Code which isn't available yet. We need to either:
- Mock Claude Code functionality for testing
- Pivot to use available AI coding tools
- Wait for Claude Code release