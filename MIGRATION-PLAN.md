# Remote Claude → VibeKit Migration Plan

## Overview
This document outlines the migration from the current ECS/EC2-based architecture to a streamlined VibeKit-powered platform.

## Phase 1: Code Cleanup (Day 1-2)

### Components to REMOVE ❌

```bash
# AWS Infrastructure (Complete removal)
src/services/compute/providers/ecs-ec2/
src/cli/commands/ec2.ts
src/cli/commands/ecs.ts
src/compute/providers/ec2-provider.ts
src/utils/aws-setup-helper.ts
deploy/aws/
scripts/setup-ec2-ssh.sh

# Codespace Provider (Not needed with VibeKit)
src/codespace/
src/compute/providers/codespace-provider.ts
src/cli/commands/init-deployment.ts

# Complex Provider Abstraction (Simplify)
src/services/compute/providers/provider-factory.ts
src/compute/manager.ts

# ECS-specific WebSocket
src/services/websocket/ecs-exec-websocket.ts
```

### Components to KEEP ✅

```bash
# CLI Framework (Valuable)
src/cli/
  ├── cli.ts                 # Main CLI entry
  ├── commands/
  │   ├── run.ts            # Core run command
  │   ├── config.ts         # Configuration
  │   ├── tasks.ts          # Task management
  │   ├── status.ts         # Session status
  │   └── logs.ts           # Log viewing
  └── utils/
      ├── config-v2.ts      # Config system
      └── task-registry.ts  # Task storage

# Task Management (Core feature)
src/tasks/
  ├── manager.ts
  ├── storage.ts
  └── types.ts

# Web UI (Adapt for new backend)
website/
  ├── components/          # Reusable UI components
  └── app/                # Next.js app

# Utilities (Generally useful)
src/utils/
  ├── logger.ts
  └── date.ts
```

## Phase 2: VibeKit Integration (Day 3-7)

### New Directory Structure

```typescript
src/
├── core/                    // Core business logic
│   ├── vibekit/
│   │   ├── client.ts       // VibeKit SDK wrapper
│   │   ├── sandbox.ts      // Sandbox management
│   │   └── providers.ts    // Provider configuration
│   ├── sessions/
│   │   ├── manager.ts      // Session lifecycle
│   │   ├── storage.ts      // Session persistence
│   │   └── types.ts
│   └── repositories/
│       ├── clone.ts        // Repo cloning logic
│       ├── upload.ts       // Direct upload support
│       └── storage.ts      // Repo persistence
├── api/                     // Next.js API routes
│   ├── auth/
│   ├── sessions/
│   ├── billing/
│   └── webhooks/
├── cli/                     // CLI (simplified)
│   ├── index.ts
│   └── commands/
└── web/                     // Web dashboard
    └── dashboard/
```

### Implementation Steps

#### Step 1: Install VibeKit
```bash
npm install @superagent/vibekit
npm install @e2b/sdk  # Primary provider
```

#### Step 2: Create VibeKit Wrapper
```typescript
// src/core/vibekit/client.ts
import { VibeKit } from '@superagent/vibekit';
import { E2BProvider } from '@e2b/sdk';

export class RemoteClaudeClient {
  private vibekit: VibeKit;
  
  constructor() {
    this.vibekit = new VibeKit({
      provider: new E2BProvider({
        apiKey: process.env.E2B_API_KEY
      }),
      agent: 'claude'
    });
  }
  
  async createSession(repo: string, config: Config) {
    const sandbox = await this.vibekit.createSandbox({
      persistent: true,
      environment: config.environment
    });
    
    await sandbox.clone(repo);
    return sandbox;
  }
}
```

#### Step 3: Adapt CLI Commands
```typescript
// src/cli/commands/run.ts (simplified)
export async function run(taskId: string) {
  const client = new RemoteClaudeClient();
  const task = await taskRegistry.get(taskId);
  
  const session = await client.createSession(
    task.repository,
    task.config
  );
  
  // Stream Claude output
  session.on('output', console.log);
  
  await session.execute(task.prompt);
}
```

## Phase 3: Database Schema (Day 8-9)

### PostgreSQL Schema
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  sandbox_id VARCHAR(255) NOT NULL,
  repository_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  total_hours DECIMAL(10,2)
);

-- Tasks table (from existing)
CREATE TABLE tasks (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  description TEXT,
  repository_url VARCHAR(500),
  config JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Phase 4: API Development (Day 10-14)

### Core API Routes
```typescript
// pages/api/sessions/create.ts
export async function POST(req: Request) {
  const { repository, taskId } = await req.json();
  
  // Create VibeKit sandbox
  const sandbox = await vibekit.createSandbox({
    repository,
    persistent: true
  });
  
  // Store in database
  const session = await db.sessions.create({
    userId: req.userId,
    sandboxId: sandbox.id,
    repository
  });
  
  return Response.json({ sessionId: session.id });
}
```

## Phase 5: Testing & Migration (Day 15-20)

### Testing Checklist
- [ ] Basic session creation
- [ ] Repository cloning
- [ ] Claude execution
- [ ] Persistence between sessions
- [ ] Billing integration
- [ ] Error handling
- [ ] Resource cleanup

### Data Migration
```bash
# 1. Export existing tasks
npm run export-tasks

# 2. Transform task format
npm run migrate-tasks

# 3. Import to new database
npm run import-tasks
```

## Phase 6: Deployment (Day 21)

### Deployment Steps
1. **Setup Vercel project**
   ```bash
   vercel init
   vercel env add E2B_API_KEY
   vercel env add DATABASE_URL
   vercel env add STRIPE_SECRET_KEY
   ```

2. **Deploy application**
   ```bash
   vercel --prod
   ```

3. **Update DNS**
   - Point remoteclaude.com to Vercel

4. **Monitor**
   - Set up error tracking (Sentry)
   - Configure analytics (PostHog)

## Rollback Plan

If issues arise:
1. Keep v1 branch with ECS/EC2 code
2. Maintain separate subdomain for v1 (legacy.remoteclaude.com)
3. Database migrations are reversible
4. VibeKit sandboxes can be terminated immediately

## Timeline Summary

| Week | Focus | Deliverable |
|------|-------|------------|
| Week 1 | Cleanup & Integration | VibeKit working locally |
| Week 2 | API & Database | Core API complete |
| Week 3 | Testing & Polish | Beta version ready |
| Week 4 | Launch Prep | Production deployment |

## Key Decisions Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Remove all AWS code | Reduce complexity, focus on VibeKit | Keep as fallback |
| Use E2B as primary provider | Best docs, reliability | Modal, Northflank |
| PostgreSQL over MongoDB | Simpler, better for relational data | MongoDB |
| Vercel deployment | Optimized for Next.js | Self-hosted |
| No free tier initially | Sustainable from day 1 | Freemium model |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| VibeKit API changes | Pin version, maintain abstraction |
| E2B downtime | Add Modal as backup provider |
| Data loss during migration | Comprehensive backups, staged rollout |
| User confusion | Clear communication, migration guide |

## Next Steps

1. **Immediate (Today)**
   - Create `vibekit-migration` branch
   - Start removing AWS code
   - Install VibeKit dependencies

2. **Tomorrow**
   - Implement basic VibeKit wrapper
   - Test sandbox creation
   - Verify Claude execution

3. **This Week**
   - Complete core integration
   - Update CLI commands
   - Begin API development

---

*Ready to begin migration? Start with Phase 1: Code Cleanup*