# Remote Claude v2: Migration to Agent SDK

This document describes the migration from Remote Claude v1 (SSH + subprocess) to v2 (Agent SDK + WebSocket).

## What Changed

### Architecture Overview

**v1 (Before):**
- SSH into VM/Codespace
- Spawn `claude` CLI as subprocess
- Parse stdout for responses

**v2 (After):**
- Container running Agent Server
- WebSocket connection for real-time streaming
- Claude Agent SDK runs in-process
- Native MCP server support

### Benefits

- **No subprocess management** - SDK runs in-process
- **Real-time streaming** - WebSocket provides instant feedback
- **Better error handling** - Structured error types
- **MCP support** - Configure tools programmatically
- **Multi-cloud** - Easier to add new backends (Azure ACI, GCP, etc.)
- **Cost efficiency** - Containers are cheaper than VMs for ephemeral tasks

## New Components

### 1. Agent Server (`services/agent-server/`)

The core server that wraps the Claude Agent SDK and exposes it via WebSocket.

```
services/agent-server/
├── src/
│   ├── index.ts      # WebSocket server, message routing
│   ├── executor.ts   # Claude Agent SDK wrapper
│   ├── mcp-manager.ts # MCP server lifecycle
│   └── logger.ts     # Structured logging
├── package.json
└── tsconfig.json
```

### 2. Shared Package (`packages/shared/`)

Shared types and utilities for both CLI and Agent Server.

```
packages/shared/
├── src/
│   ├── protocol.ts   # WebSocket message types
│   ├── types.ts      # Core type definitions
│   ├── ws-client.ts  # WebSocket client helper
│   └── index.ts      # Barrel exports
├── package.json
└── tsconfig.json
```

### 3. Container Configuration (`container/`)

Docker configuration for running the Agent Server.

```
container/
├── Dockerfile        # Production container
├── Dockerfile.dev    # Development container
└── mcps/
    └── default.json  # Default MCP server configs
```

### 4. Azure ACI Provider (`packages/core/src/providers/compute/azure-aci-provider.ts`)

New backend provider for Azure Container Instances.

## Migration Steps

### Step 1: Install Dependencies

```bash
cd belo
bun install
```

### Step 2: Build Packages

```bash
bun run build
```

### Step 3: Local Development

Start the agent server locally:

```bash
# Using docker-compose
docker-compose up -d

# Or run directly (requires dependencies)
bun run agent-server:dev
```

### Step 4: Connect to Agent Server

```bash
# Interactive session
rclaude connect ws://localhost:8080

# Single query
rclaude query "Write a hello world program" --endpoint ws://localhost:8080
```

### Step 5: Update Existing Workflows

The existing CLI commands (`run`, `tasks`, `session`) continue to work with Codespaces and EC2. The new WebSocket-based approach is available via:

- `rclaude connect <endpoint>` - Interactive WebSocket session
- `rclaude query <prompt>` - One-shot WebSocket query

For Azure ACI, the workflow is:

```bash
# Configure Azure
rclaude config backend azure-aci
rclaude config set azure.subscriptionId <your-subscription-id>
rclaude config set azure.resourceGroup <your-resource-group>

# Run task on Azure ACI
rclaude run my-task --provider azure-aci
```

## WebSocket Protocol

### Client → Server Messages

| Type | Description |
|------|-------------|
| `query` | Execute a prompt |
| `cancel` | Cancel a running query |
| `configure` | Configure API key, MCP servers |
| `ping` | Keep-alive |

### Server → Client Messages

| Type | Description |
|------|-------------|
| `response` | Response content (text, tool_use, tool_result) |
| `progress` | Progress updates |
| `tool_use` | Tool being used |
| `tool_result` | Tool execution result |
| `error` | Error occurred |
| `complete` | Query completed |
| `pong` | Keep-alive response |
| `configured` | Configuration applied |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `PORT` | Agent server port | 8080 |
| `HOST` | Agent server host | 0.0.0.0 |
| `WORKING_DIR` | Working directory in container | /workspace |
| `LOG_LEVEL` | Log level | info |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | - |
| `AZURE_RESOURCE_GROUP` | Azure resource group | remote-claude-rg |
| `AZURE_LOCATION` | Azure location | eastus |

## Common Issues

### 1. SDK Not Installed

If the Claude Agent SDK is not installed, the executor falls back to mock mode. Install it with:

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### 2. WebSocket Connection Refused

Ensure the agent server is running and the port is accessible:

```bash
curl http://localhost:8080/health
```

### 3. Azure Authentication

For Azure ACI, ensure you're authenticated:

```bash
az login
```

Or set credentials via environment variables:
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

## Rollback

To use the v1 approach, continue using the existing `run` command with `--provider codespace` or `--provider ec2`. The SSH-based execution path is still available.
