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
├── package.json               # Root package.json (with workspaces)
├── turbo.json                 # Turborepo config
├── tsconfig.json              # Root TypeScript config
└── README.md
```

## Migration Plan from Current Structure

### Current Structure Analysis

The repository currently follows a traditional single-package structure with a separate website:

```
remote-claude/
├── src/                       # All source code in single directory
│   ├── cli.ts                 # Main CLI entry point → apps/cli/src/index.ts
│   ├── cli/                   # CLI-specific code
│   │   ├── commands/          # → Move to apps/cli/src/commands
│   │   └── utils/             # → Move to apps/cli/src/utils
│   ├── codespace/             # → Move to packages/core/src/providers/codespace
│   ├── compute/               # → Move to packages/core/src/compute
│   ├── notifications/         # → Move to services/notifications/src
│   ├── services/              # Business logic
│   │   └── compute/           # → Move to packages/core/src/services
│   ├── tasks/                 # → Move to packages/core/src/tasks
│   ├── types/                 # → Move to packages/core/src/types
│   ├── utils/                 # → Split between packages based on usage
│   └── webhook/               # → Move to services/webhook/src
├── website/                   # Next.js documentation site → apps/web
├── docs/                      # Keep as docs/
├── scripts/                   # Keep as scripts/
├── package.json              # Single package configuration
└── yarn.lock                 # Using Yarn 1.x
```

**Key Facts:**
- Single npm package: `remote-claude` v0.1.0
- Using Yarn 1.x as package manager
- No workspace configuration
- Website is a separate Next.js app with its own package.json
- Mixed dependencies (CLI, web, API) in single package.json

### Current Dependencies Analysis

The main package.json contains mixed dependencies that should be split:

**CLI Dependencies:**
- `commander`, `inquirer`, `chalk`, `ora` - CLI interface
- `keytar` - Credential storage
- `cosmiconfig` - Configuration management

**Infrastructure/Provider Dependencies:**
- `@aws-sdk/client-ec2`, `@aws-sdk/client-ssm` - AWS providers
- `ssh2`, `node-forge` - SSH connectivity

**API/Backend Dependencies:**
- `express`, `ws` - API server and WebSocket
- `axios` - HTTP client
- `nodemailer` - Email notifications

**Web/Documentation Dependencies:**
- `@mdx-js/*`, `@next/mdx` - MDX processing
- `next-mdx-remote`, `gray-matter` - Content management
- `rehype-*`, `remark-*` - Markdown processing
- `highlight.js` - Syntax highlighting

**Shared Dependencies:**
- `uuid`, `handlebars` - Utilities
- TypeScript and testing tools

### Step-by-Step Migration

#### Phase 1: Set up Monorepo Tools
```bash
# Install bun (fast all-in-one toolkit)
curl -fsSL https://bun.sh/install | bash

# Initialize workspace with bun
bun init

# Update package.json with workspaces
# Bun uses package.json workspaces field instead of separate config

# Install Turborepo for build orchestration
bun add -D turbo

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

2. **Update CLI to use Core with Absolute Imports**
```typescript
// apps/cli/src/commands/run.ts
import { ProviderFactory, TaskManager, TaskRegistry } from '@remote-claude/core';
import { ConfigManager } from '@remote-claude/config';
import { parseArgs, validateOptions } from '@cli/utils';
import { displayProgress } from '@cli/ui/progress';
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
    "cli": "bun --filter @remote-claude/cli",
    "api": "bun --filter @remote-claude/api",
    "web": "bun --filter @remote-claude/web"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.0.0"
  }
}
```

2. **Update TypeScript Configs for Absolute Imports**

**Root tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@remote-claude/core": ["packages/core/src/index.ts"],
      "@remote-claude/core/*": ["packages/core/src/*"],
      "@remote-claude/config": ["packages/config/src/index.ts"],
      "@remote-claude/config/*": ["packages/config/src/*"],
      "@remote-claude/sdk": ["packages/sdk/src/index.ts"],
      "@remote-claude/sdk/*": ["packages/sdk/src/*"],
      "@remote-claude/ui": ["packages/ui/src/index.ts"],
      "@remote-claude/ui/*": ["packages/ui/src/*"],
      "@cli/*": ["apps/cli/src/*"],
      "@api/*": ["apps/api/src/*"],
      "@web/*": ["apps/web/*"]
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

**Package-specific tsconfig.json (e.g., apps/cli/tsconfig.json):**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@cli/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/core" },
    { "path": "../../packages/config" }
  ]
}
```

**Import Examples:**
```typescript
// In apps/cli/src/commands/run.ts
import { ProviderFactory } from '@remote-claude/core';
import { ConfigManager } from '@remote-claude/config';
import { validateInput } from '@cli/utils/validation';
import { logger } from '@cli/utils/logger';

// In packages/core/src/providers/ec2.ts
import { BaseProvider } from '@remote-claude/core/providers/base';
import { EC2Config } from '@remote-claude/core/types';
```

## Benefits of This Structure

### 1. **Clear Separation of Concerns**
- **Apps**: Deployable units (CLI, API server, Web UI)
- **Packages**: Shared code that multiple apps use
- **Services**: Standalone microservices (webhooks, notifications)
- **Infrastructure**: IaC for AWS, Fly.io deployments

### 2. **Independent Development**
- CLI team can work without affecting web UI
- Provider implementations can evolve independently
- Clear API boundaries between packages

### 3. **Better Build Performance**
- Turborepo caches builds intelligently
- Only affected packages rebuild on changes
- Parallel builds reduce CI/CD time

### 4. **Easier Testing**
- Unit tests isolated per package
- Integration tests in apps
- Provider mocking simplified
- E2E tests at root level

### 5. **Flexible Deployment**
- Deploy CLI independently from API
- Share `@remote-claude/sdk` as public npm package
- Scale services independently
- Different deployment strategies per app

### 6. **Developer Experience**
- Better IDE support with TypeScript project references
- Clean absolute imports: `@remote-claude/core` instead of `../../../core`
- Focused development: work on one package at a time
- Easier onboarding for new developers
- Fast builds with Bun's native TypeScript support
- Built-in test runner and bundler

## Development Workflow

### Local Development
```bash
# Start everything
bun dev

# Start specific app
bun dev --filter @remote-claude/web

# Run CLI locally
bun run --filter @remote-claude/cli dev

# Add dependency to a package
bun add express --filter @remote-claude/api
```

### Building
```bash
# Build everything
bun run build

# Build specific package and dependencies
bun run build --filter @remote-claude/core...

# Build for production
bun run build
```

### Testing
```bash
# Test everything
bun test

# Test specific package
bun test --filter @remote-claude/core

# Watch mode
bun test --watch
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
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - run: bun install
      - run: bun run build
      - run: bun test
      - run: bun run lint
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

## Migration Timeline

### Phase 1: Foundation (Week 1)
- Set up Bun workspaces and Turborepo
- Create basic package structure
- Move types to `@remote-claude/core`
- Set up TypeScript project references with absolute imports

### Phase 2: Core Extraction (Week 2)
- Extract provider interfaces and implementations
- Move task management to core
- Create shared utilities package
- Update imports across codebase

### Phase 3: App Separation (Week 3)
- Separate CLI into `apps/cli`
- Create API server in `apps/api`
- Move website to `apps/web`
- Set up development scripts

### Phase 4: Services & Polish (Week 4)
- Extract notification service
- Create webhook service
- Add comprehensive tests
- Update CI/CD pipelines

## Important Considerations

### 1. **Backward Compatibility**
- Keep `rclaude` CLI command working
- Maintain existing config file formats
- Preserve GitHub Codespaces integration

### 2. **Migration Risks**
- Import path changes may break existing code
- Dependency conflicts between packages
- Build complexity increases initially

### 3. **Mitigation Strategies**
- Use git branches for experimental changes
- Create migration scripts for import updates
- Maintain comprehensive test coverage
- Document all breaking changes

## Conclusion

This monorepo structure provides:
- Clear boundaries between components
- Shared code reuse without duplication
- Independent deployment capabilities
- Better developer experience
- Scalable architecture for future growth

The migration can be done incrementally, starting with extracting the core package and gradually moving other components. Each phase should be tested thoroughly before moving to the next.