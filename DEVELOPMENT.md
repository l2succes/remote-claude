# Local Development Guide

## Port Configuration

The development environment uses these default ports:

| Service | Default Port | Environment Variable |
|---------|-------------|---------------------|
| Frontend (Next.js) | 10050 | `FRONTEND_PORT` |
| Agent Server | 8080 | `AGENT_PORT` |
| Supabase API | 54321 | `SUPABASE_API_PORT` |
| Supabase DB | 54322 | `SUPABASE_DB_PORT` |
| Supabase Studio | 54323 | `SUPABASE_STUDIO_PORT` |

### Changing Ports

If you have port conflicts, edit `.env.local` before running services:

```bash
# .env.local
AGENT_PORT=8081       # Change from 8080
FRONTEND_PORT=10051   # Change from 10050
# Note: Supabase ports (54321-54323) are fixed by the CLI and cannot be changed
```

## Quick Start

### Option 1: One Command (Recommended)

```bash
# First time setup
./scripts/dev-setup.sh

# Start all services
./scripts/dev-start.sh
```

Press `Ctrl+C` to stop all services.

### Option 2: Manual (Separate Terminals)

```bash
# Terminal 1: Run setup once
./scripts/dev-setup.sh

# Terminal 2: Agent Server
cd services/agent-server
PORT=8080 bun run start:dev

# Terminal 3: Frontend
cd website
npm run dev -- -p 10050

# Supabase runs automatically (started by dev-setup.sh)
```

## First Time Setup

1. **Run the setup script:**
   ```bash
   ./scripts/dev-setup.sh
   ```

   This will:
   - Install Supabase CLI if needed
   - Initialize Supabase project
   - Start local Supabase services
   - Create `.env.local` with ports and credentials
   - Check for port conflicts

2. **Add your Anthropic API key:**
   ```bash
   # Edit .env.local
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Apply database migrations:**
   ```bash
   supabase db push
   ```

4. **Start the services:**
   ```bash
   ./scripts/dev-start.sh
   ```

5. **Open your browser:**
   - Frontend: http://localhost:10050 (or your custom port)
   - Supabase Studio: http://localhost:54323

## Useful Commands

```bash
# Check Supabase status
supabase status

# Stop Supabase
supabase stop

# Restart Supabase
supabase stop && supabase start

# View Supabase logs
supabase logs

# Reset database (WARNING: deletes all data)
supabase db reset

# Apply migrations
supabase db push

# Generate TypeScript types from database
supabase gen types typescript --local > website/lib/database.types.ts
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

1. Check what's using the port:
   ```bash
   lsof -i :10050  # or whatever port
   ```

2. Either:
   - Stop the conflicting service
   - OR change the port in `.env.local`

### Supabase Won't Start

```bash
# Stop and remove all containers
supabase stop --no-backup

# Start fresh
supabase start
```

### Agent Server Connection Fails

1. Check agent server is running:
   ```bash
   curl http://localhost:8080/health
   ```

2. Check WebSocket URL in `.env.local`:
   ```bash
   NEXT_PUBLIC_AGENT_SERVER_URL=ws://localhost:8080
   ```

### Environment Variables Not Loading

Make sure `.env.local` exists in both:
- Root directory (for agent server)
- `website/` directory (for Next.js)

The setup script copies it automatically.

## Development Workflow

1. Make code changes
2. Services auto-reload (agent server with ts-node, Next.js with turbopack)
3. Test in browser
4. Check logs in terminal
5. Inspect database in Supabase Studio

## Database Changes

1. Edit migration file: `supabase/migrations/001_initial_schema.sql`
2. Apply changes: `supabase db push`
3. Verify in Studio: http://localhost:54323

## Testing GitHub OAuth Locally

Local GitHub OAuth requires tunneling (ngrok/localhost.run) for callbacks:

1. **Option 1: Use ngrok**
   ```bash
   ngrok http 10050
   ```
   Update GitHub OAuth callback URL to `https://your-ngrok-url.ngrok.io/api/auth/callback`

2. **Option 2: Skip OAuth in development**
   - Use Supabase magic links instead
   - Or test OAuth only in production

## Recent Setup Changes (Jan 2026)

### Fixed Issues

1. **Next.js Build Error** - Split Supabase utilities:
   - Created `website/lib/supabase/client.ts` (client-side)
   - Created `website/lib/supabase/server.ts` (server-side)
   - Fixed `next/headers` import conflicts

2. **GitHub OAuth Configuration**:
   - Configured in `supabase/config.toml`
   - Client ID: `Ov23liWYwyU2Mw5SM4Lh`
   - Redirect URI: `http://localhost:54321/auth/v1/callback`
   - Added sign-in UI to homepage

3. **Component Import Fixes**:
   - Changed TopBar, TaskList, ClaudeCodeView, TaskProgress to named exports
   - Updated imports in workspace pages

4. **AWS Bedrock Configuration**:
   - Added bearer token to `.env.local`
   - Configured Haiku 4.5 models
   - Set `CLAUDE_CODE_USE_BEDROCK=1`

5. **Node.js Spawn Issue** (FIXED):
   - Error was "spawn node ENOENT"
   - Root cause: Default `WORKING_DIR=/workspace` didn't exist
   - Fix: Set `WORKING_DIR` to project directory in `.env.local`
   - Also set `executable` option in SDK to `process.execPath`
   - Created `services/agent-server/start.sh` wrapper script (for env setup)

6. **PostgreSQL Version**:
   - Upgraded to PostgreSQL 17 in `supabase/config.toml`
   - Fixed database version mismatch

7. **Database Permissions**:
   - Disabled RLS for local development
   - Made user_id nullable for testing without auth

### Files Created

- `services/agent-server/start.sh` - Start script with proper PATH
- `GITHUB_OAUTH_SETUP.md` - OAuth setup documentation
- `~/bin/node` - Symlink to make node accessible
- `supabase/migrations/002_disable_rls_for_local_dev.sql`
- `supabase/migrations/003_make_user_id_nullable.sql`

### Starting Services

**Recommended approach:**
```bash
# Terminal 1 - Agent Server
cd services/agent-server && ./start.sh

# Terminal 2 - Frontend
cd website && bun run dev -- -p 10050
```

The `start.sh` script ensures:
- Node is in PATH for Claude Agent SDK
- AWS Bedrock credentials are loaded
- Environment variables are sourced from root `.env.local`

## Next Steps

- Run `./scripts/dev-setup.sh` to initialize
- Run `./scripts/dev-start.sh` to start coding (or use manual approach above)
- Open http://localhost:10050 and build!
