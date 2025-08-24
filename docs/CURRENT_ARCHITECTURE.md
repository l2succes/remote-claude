# Remote Claude - Current Architecture (VibeKit Migration)

## 🎯 Project Goal
Enable developers to run Claude Code in persistent, configurable cloud environments using VibeKit's sandbox infrastructure.

## 📊 Current Status

### Migration from AWS ECS/EC2 to VibeKit
We're pivoting from complex AWS infrastructure to VibeKit's simpler sandbox abstraction:

**Previous Approach (Being Removed):**
- ❌ AWS ECS cluster management
- ❌ EC2 instance provisioning
- ❌ Complex networking setup
- ❌ Session Manager Plugin requirements

**New Approach (VibeKit):**
- ✅ E2B sandbox provider (primary)
- ✅ Simple API abstraction
- ✅ Built-in persistence
- ✅ No infrastructure management

## 🏗️ New Architecture with VibeKit

```
┌────────────────────────────────────────────────────────┐
│                    User Interface                       │
│                  (Web UI / CLI)                         │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Remote Claude API                       │
│              (Next.js + TypeScript)                     │
├────────────────────────────────────────────────────────┤
│  • Session Management    • Task Management             │
│  • Repository Management • Billing & Usage             │
│  • User Authentication   • WebSocket Streaming         │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   VibeKit SDK                          │
│            (Sandbox & Agent Abstraction)               │
├────────────────────────────────────────────────────────┤
│  • Sandbox Lifecycle     • Claude Integration          │
│  • File Operations       • Command Execution           │
│  • GitHub Integration    • Resource Management         │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Sandbox Providers                       │
├────────────────────────────────────────────────────────┤
│    E2B Cloud    │    Daytona    │    Northflank       │
└────────────────────────────────────────────────────────┘
```

## 📦 Component Status

### ✅ Components to Keep
1. **CLI Framework** (`/src/cli/`) - Adapt for VibeKit
2. **Task Management** (`/src/services/tasks/`) - Repository-centric model
3. **WebSocket Layer** (`/src/services/websocket/`) - For streaming
4. **Web UI Structure** (`/website/`) - Next.js app

### ❌ Components to Remove
1. **ECS Provider** (`/src/services/compute/providers/ecs-ec2/`) - Replace with VibeKit
2. **EC2 Management** - No longer needed
3. **AWS Infrastructure** - Handled by E2B
4. **Session Manager Plugin** - Not required

### 🆕 Components to Add
1. **VibeKit Client** (`/src/core/vibekit/`) - ✅ Started
2. **Session Manager** (`/src/core/sessions/`) - In progress
3. **Repository Manager** (`/src/core/repositories/`) - Planned
4. **Billing Integration** (`/src/core/billing/`) - Stripe
5. **Database Layer** (`/src/core/database/`) - Supabase

## 🔄 Migration Progress

### Phase 1: Foundation (Week 1) ✅
- [x] Create comprehensive PRD
- [x] Design migration plan
- [x] Set up development environment
- [x] Initialize VibeKit integration

### Phase 2: Core Integration (Week 2) 🔄
- [x] Remove AWS/ECS code
- [x] Install VibeKit dependencies
- [x] Create VibeKit client wrapper
- [ ] Implement session manager
- [ ] Build repository manager
- [ ] Set up Supabase database

### Phase 3: API & Features (Week 3)
- [ ] Build REST API endpoints
- [ ] Implement WebSocket streaming
- [ ] Add billing with Stripe
- [ ] Create basic web UI
- [ ] Update CLI commands

### Phase 4: Testing & Launch (Week 4)
- [ ] Comprehensive testing
- [ ] Documentation update
- [ ] Deploy to production
- [ ] Launch marketing site

## 🚀 Current Implementation

### VibeKit Client (`/src/core/vibekit/client.ts`)
```typescript
export class VibeKitClient {
  // Core methods implemented
  async createSession(repository: string): Promise<Session>
  async executeCommand(command: string): Promise<CommandResult>
  async readFile(path: string): Promise<string>
  async writeFile(path: string, content: string): Promise<void>
  async pauseSession(): Promise<void>
  async resumeSession(sessionId: string): Promise<void>
}
```

### Session Flow
1. **User starts session**: `rclaude start github.com/user/repo`
2. **VibeKit creates sandbox**: E2B provisions container
3. **Repository cloned**: Git operations in sandbox
4. **Claude Code runs**: Tasks executed with AI
5. **State persisted**: Files saved to cloud storage
6. **Session paused/resumed**: State maintained

## 💰 Cost Model

### Per-Session Economics
```
E2B Sandbox:     $0.04/hour
Claude API:      $0.02/hour
Infrastructure:  $0.01/hour
─────────────────────────
Total Cost:      $0.07/hour
Selling Price:   $0.10/hour
Gross Margin:    30%
```

### Pricing Tiers
- **Active Sessions**: $0.10/hour
- **Persistent Storage**: $5/month per repository
- **Paused Sessions**: No charge

## 🎯 Next Steps

### Immediate (Today)
1. Complete session manager implementation
2. Create repository manager
3. Set up Supabase schema

### This Week
1. Build API endpoints
2. Implement WebSocket streaming
3. Create billing integration
4. Update CLI commands

### Next Week
1. Build web dashboard
2. Add authentication
3. Deploy to staging
4. Begin testing

## 📂 New Repository Structure

```
remote-claude/
├── src/
│   ├── core/              # Core business logic
│   │   ├── vibekit/       # VibeKit integration ✅
│   │   ├── sessions/      # Session management 🔄
│   │   ├── repositories/  # Repository management
│   │   ├── billing/       # Stripe integration
│   │   └── database/      # Supabase layer
│   ├── api/               # REST API endpoints
│   ├── cli/               # CLI commands (updated)
│   └── utils/             # Shared utilities
├── website/               # Next.js web app
├── docs/                  # Documentation ✅
└── tests/                 # Test suites
```

## 🔑 Key Decisions Made

1. **VibeKit over AWS ECS**: Simpler, faster to market
2. **E2B as primary provider**: Best Claude Code support
3. **Repository-centric model**: One container per repo
4. **Supabase for database**: Includes auth & real-time
5. **Stripe for billing**: Industry standard
6. **Next.js 14**: Modern React framework

## 📊 Success Metrics

### Technical
- Session start time < 30s
- Command latency < 100ms
- 99.9% uptime

### Business
- $1,000 MRR in 3 months
- 50 active users
- 30% gross margin

## 🚦 Status Summary

**Migration Status**: 🟡 In Progress (Week 2 of 4)
**Blockers**: None currently
**Risk Level**: Low
**Confidence**: High

The pivot to VibeKit significantly simplifies our architecture and reduces time to market from 3 months to 4 weeks.