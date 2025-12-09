# Simplified Monorepo Setup with Bun

This monorepo has been simplified to use only Bun's built-in workspace features, removing the complexity of Turborepo.

## Structure

```
.
├── apps/           # Application packages
│   ├── api/       # API server
│   ├── cli/       # CLI tool
│   └── web/       # Web application
├── packages/       # Shared packages
│   ├── config/    # Shared configuration
│   ├── core/      # Core functionality
│   ├── sdk/       # SDK package
│   ├── shared/    # Shared utilities
│   └── ui/        # UI components
└── services/       # Service packages
    ├── agent-server/     # Agent server
    ├── notifications/    # Notification service
    └── websocket/       # WebSocket service
```

## Workspace Management

Bun automatically handles workspace dependencies through the `workspaces` field in the root `package.json`:

```json
"workspaces": [
  "apps/*",
  "packages/*",
  "services/*",
  "infrastructure/*"
]
```

## Available Commands

### Root-level commands

```bash
# Run development servers for all packages
bun run dev

# Build all packages
bun run build

# Run tests for all packages
bun run test

# Lint all packages
bun run lint

# Clean build artifacts from all packages
bun run clean
```

### Package-specific commands

```bash
# Run commands for specific packages using --filter
bun run --filter @remote-claude/cli dev
bun run --filter @remote-claude/web build
bun run --filter website dev

# Shorthand commands for common packages
bun run cli          # CLI package
bun run web          # Web package
bun run web:dev      # Website dev server
bun run agent-server # Agent server
```

### Docker commands

```bash
bun run docker:build  # Build Docker image
bun run docker:up     # Start containers
bun run docker:down   # Stop containers
bun run docker:logs   # View container logs
bun run docker:dev    # Start dev containers
```

## Dependency Management

### Installing dependencies

```bash
# Install all dependencies for all workspaces
bun install

# Add a dependency to the root
bun add -d typescript

# Add a dependency to a specific workspace
bun add --filter @remote-claude/cli commander

# Add a workspace dependency
bun add --filter @remote-claude/cli @remote-claude/core
```

### Workspace dependencies

Workspace packages can depend on each other using the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@remote-claude/core": "workspace:*",
    "@remote-claude/shared": "workspace:*"
  }
}
```

## Building

The build process is straightforward without Turborepo's caching:

1. Bun automatically resolves the dependency graph
2. Each package's `build` script is executed
3. TypeScript compilation happens per package

To build a specific package and its dependencies:

```bash
bun run --filter @remote-claude/cli build
```

## Benefits of the Simplified Setup

1. **Fewer dependencies**: No need for Turborepo means one less tool to maintain
2. **Native Bun features**: Leverages Bun's built-in workspace management
3. **Simpler configuration**: No `turbo.json` to configure and maintain
4. **Faster installs**: Bun's package manager is extremely fast
5. **Unified tooling**: Everything runs through Bun

## Migration Notes

If you're coming from the Turborepo setup:

- The `turbo run` commands have been replaced with `bun run --filter '*'`
- Package-specific filtering uses `--filter` instead of Turborepo's syntax
- Build caching is handled by TypeScript's incremental compilation
- Parallel execution is handled by Bun's internal scheduler

## Troubleshooting

### Common Issues

1. **Build errors in dist folders**: Clean the dist folders if you see TypeScript errors about overwriting files:
   ```bash
   bun run clean
   ```

2. **Dependency resolution**: Ensure all workspace dependencies use `workspace:*`:
   ```bash
   bun install
   ```

3. **Package not found**: Check that the package name in `package.json` matches the import

## Future Improvements

- Consider adding a build orchestration script if build order becomes important
- Add git hooks for pre-commit linting using Bun scripts
- Optimize TypeScript configuration for faster builds