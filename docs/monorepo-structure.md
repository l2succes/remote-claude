# Remote Claude Monorepo Structure

## Proposed Monorepo Organization

```
remote-claude/
├── apps/                       # Deployable applications
│   ├── cli/                   # CLI application
│   │   ├── src/
│   │   │   ├── commands/      # CLI commands
│   │   │   ├── utils/         # CLI-specific utilities
│   │   │   └── index.ts       # CLI entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                   # Backend API server
│   │   ├── src/
│   │   │   ├── routes/        # API routes
│   │   │   ├── services/      # Business logic
│   │   │   ├── middleware/    # Express middleware
│   │   │   └── server.ts      # Server entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                   # Frontend web application
│       ├── app/               # Next.js app directory
│       ├── components/        # React components
│       ├── lib/               # Frontend utilities
│       ├── public/            # Static assets
│       ├── package.json
│       └── next.config.js
│
├── packages/                   # Shared packages
│   ├── core/                  # Core business logic
│   │   ├── src/
│   │   │   ├── providers/     # Compute providers (ECS, EC2, Fly)
│   │   │   ├── tasks/         # Task management
│   │   │   ├── mcp/           # MCP management
│   │   │   └── types/         # Shared types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── config/                # Configuration management
│   │   ├── src/
│   │   │   ├── schema/        # Config schemas
│   │   │   └── manager.ts     # Config manager
│   │   └── package.json
│   │
│   ├── sdk/                   # Remote Claude SDK
│   │   ├── src/
│   │   │   ├── client.ts      # SDK client
│   │   │   └── types.ts       # Public API types
│   │   └── package.json
│   │
│   └── ui/                    # Shared UI components
│       ├── src/
│       │   ├── components/    # Reusable React components
│       │   └── styles/        # Shared styles
│       └── package.json
│
├── services/                   # Microservices (if needed)
│   ├── websocket/             # WebSocket server
│   ├── scheduler/             # Task scheduler service
│   └── notifications/         # Notification service
│
├── infrastructure/             # Infrastructure as code
│   ├── aws/                   # AWS CDK/Terraform
│   │   ├── ecs/              # ECS infrastructure
│   │   ├── ec2/              # EC2 infrastructure
│   │   └── networking/        # VPC, ALB, etc.
│   │
│   ├── fly/                   # Fly.io configuration
│   │   └── fly.toml
│   │
│   └── docker/                # Docker configurations
│       ├── claude-code/       # Claude Code container
│       └── api/               # API container
│
├── docs/                       # Documentation
│   ├── architecture/          # Architecture docs
│   ├── api/                   # API documentation
│   └── guides/                # User guides
│
├── scripts/                    # Build and utility scripts
│   ├── build.ts               # Monorepo build script
│   ├── release.ts             # Release automation
│   └── migrate.ts             # Migration utilities
│
├── .github/                    # GitHub configuration
│   ├── workflows/             # CI/CD workflows
│   └── CODEOWNERS
│
├── package.json               # Root package.json
├── pnpm-workspace.yaml        # pnpm workspace config
├── turbo.json                 # Turborepo config
├── tsconfig.json              # Root TypeScript config
└── README.md
```

## Migration Plan from Current Structure

### Current Structure Analysis
```
remote-claude/
├── src/
│   ├── cli/                   # → Move to apps/cli/src
│   ├── services/              # → Move to packages/core/src
│   ├── tasks/                 # → Move to packages/core/src/tasks
│   ├── compute/               # → Move to packages/core/src/providers
│   ├── codespace/             # → Move to packages/core/src/providers/codespace
│   └── utils/                 # → Split between apps/cli/src/utils and packages/core/src/utils
├── website/                   # → Move to apps/web
└── docs/                      # → Keep as docs/
```

### Step-by-Step Migration

#### Phase 1: Set up Monorepo Tools
```bash
# Install pnpm (better for monorepos than npm)
npm install -g pnpm

# Initialize pnpm workspace
pnpm init

# Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << EOF
packages:
  - 'apps/*'
  - 'packages/*'
  - 'services/*'
EOF

# Install Turborepo for build orchestration
pnpm add -D turbo

# Create turbo.json
cat > turbo.json << EOF
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false
    }
  }
}
EOF
```

#### Phase 2: Create Package Structure

```bash
# Create directories
mkdir -p apps/{cli,api,web}
mkdir -p packages/{core,config,sdk,ui}
mkdir -p services/{websocket,scheduler,notifications}
mkdir -p infrastructure/{aws,fly,docker}

# Create package.json for each package
for pkg in apps/cli apps/api apps/web packages/core packages/config packages/sdk packages/ui; do
  mkdir -p $pkg/src
  cat > $pkg/package.json << EOF
{
  "name": "@remote-claude/${pkg##*/}",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest"
  }
}
EOF
done
```

#### Phase 3: Move and Refactor Code

1. **Extract Core Package**
```typescript
// packages/core/src/index.ts
export * from './providers'
export * from './tasks'
export * from './types'
export * from './mcp'

// packages/core/src/providers/index.ts
export * from './ecs-ec2/ecs-provider'
export * from './ec2-shared/ec2-shared-provider'
export * from './fly/fly-provider'
export * from './provider-factory'
```

2. **Update CLI to use Core**
```typescript
// apps/cli/src/commands/run.ts
import { 
  ProviderFactory, 
  TaskManager,
  TaskRegistry 
} from '@remote-claude/core'
import { ConfigManager } from '@remote-claude/config'
```

3. **Create API Server**
```typescript
// apps/api/src/server.ts
import express from 'express'
import { ProviderFactory } from '@remote-claude/core'
import { createWebSocketServer } from './websocket'
import { createTaskRoutes } from './routes/tasks'
import { createProviderRoutes } from './routes/providers'

const app = express()
const port = process.env.PORT || 3001

// Initialize providers
await ProviderFactory.initialize()

// Routes
app.use('/api/tasks', createTaskRoutes())
app.use('/api/providers', createProviderRoutes())

// WebSocket
const server = app.listen(port)
createWebSocketServer(server)
```

4. **Update Web App Imports**
```typescript
// apps/web/lib/api.ts
import { Task, Provider } from '@remote-claude/sdk'

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks')
  return response.json()
}
```

#### Phase 4: Update Build Configuration

1. **Root package.json**
```json
{
  "name": "remote-claude",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "cli": "pnpm --filter @remote-claude/cli",
    "api": "pnpm --filter @remote-claude/api",
    "web": "pnpm --filter @remote-claude/web"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.0.0"
  }
}
```

2. **Update TypeScript Configs**
```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@remote-claude/*": ["packages/*/src"]
    }
  },
  "references": [
    { "path": "./apps/cli" },
    { "path": "./apps/api" },
    { "path": "./apps/web" },
    { "path": "./packages/core" },
    { "path": "./packages/config" },
    { "path": "./packages/sdk" },
    { "path": "./packages/ui" }
  ]
}
```

## Benefits of This Structure

### 1. **Clear Separation of Concerns**
- Apps: Deployable units
- Packages: Shared code
- Services: Microservices
- Infrastructure: IaC

### 2. **Independent Development**
- Each package has its own version
- Teams can work independently
- Clear dependency graph

### 3. **Better Build Performance**
- Turborepo caches builds
- Only rebuilds changed packages
- Parallel builds

### 4. **Easier Testing**
- Unit tests per package
- Integration tests in apps
- E2E tests at root level

### 5. **Flexible Deployment**
- Deploy apps independently
- Share packages via npm
- Microservices architecture ready

## Development Workflow

### Local Development
```bash
# Start everything
pnpm dev

# Start specific app
pnpm dev --filter @remote-claude/web

# Run CLI locally
pnpm --filter @remote-claude/cli dev

# Add dependency to a package
pnpm add express --filter @remote-claude/api
```

### Building
```bash
# Build everything
pnpm build

# Build specific package and dependencies
pnpm build --filter @remote-claude/core...

# Build for production
pnpm build && pnpm prune --prod
```

### Testing
```bash
# Test everything
pnpm test

# Test specific package
pnpm test --filter @remote-claude/core

# Watch mode
pnpm test:watch
```

## CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm lint
```

## Publishing Strategy

### Internal Packages
```json
// packages/core/package.json
{
  "name": "@remote-claude/core",
  "version": "1.0.0",
  "private": true // Keep private initially
}
```

### Public SDK
```json
// packages/sdk/package.json
{
  "name": "@remote-claude/sdk",
  "version": "1.0.0",
  "publishConfig": {
    "access": "public"
  }
}
```

## Conclusion

This monorepo structure provides:
- Clear boundaries between components
- Shared code reuse
- Independent deployment
- Better developer experience
- Scalable architecture

The migration can be done incrementally, starting with extracting the core package and gradually moving other components.