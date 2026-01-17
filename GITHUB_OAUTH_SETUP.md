# GitHub OAuth Setup - Complete

## Configuration Status: ✅ Ready

The GitHub OAuth authentication has been successfully configured for the Edinburgh project.

## What's Configured

### 1. Supabase Configuration
**File**: `supabase/config.toml`

GitHub OAuth provider is enabled with:
- **Client ID**: `Ov23liWYwyU2Mw5SM4Lh`
- **Client Secret**: `83baeec8abb4a47c5da9d9638791821b683f9924`
- **Redirect URI**: `http://localhost:54321/auth/v1/callback`
- **Site URL**: `http://localhost:10050`

### 2. Environment Variables
**File**: `website/.env.local`

```bash
# Supabase public env vars (for Next.js client-side)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# GitHub OAuth
NEXT_PUBLIC_GITHUB_CLIENT_ID=Ov23liWYwyU2Mw5SM4Lh
GITHUB_CLIENT_SECRET=83baeec8abb4a47c5da9d9638791821b683f9924
```

### 3. Database Setup
All migrations applied:
- ✅ `001_initial_schema.sql` - Base schema with workspaces and tasks tables
- ✅ `002_disable_rls_for_local_dev.sql` - Disabled RLS for local testing
- ✅ `003_make_user_id_nullable.sql` - Made user_id nullable for local dev

### 4. PostgreSQL Version
- Updated to PostgreSQL 17 (from 15) to match Docker volume initialization

## Current Development Mode

The application currently runs in **Quick Start Mode**:
- Authentication checks are commented out in workspace pages
- Allows testing the Claude Code chat interface without OAuth
- Workspaces can be created with a default `local-dev-user` ID

## To Enable Full GitHub OAuth

When you're ready to test the full GitHub authentication flow:

1. **Uncomment authentication checks** in these files:
   - `website/app/workspaces/page.tsx` (lines 23-26)
   - `website/app/workspaces/[id]/page.tsx` (lines 47-50)

2. **Update the workspace creation form** in `website/app/workspaces/new/page.tsx`:
   - Replace manual form with GitHub repository selector
   - Use GitHub API to fetch user's repositories
   - Include GitHub token in workspace creation

3. **Test the OAuth flow**:
   - Visit `http://localhost:10050`
   - Click "Continue with GitHub"
   - Should redirect to GitHub for authorization
   - After approval, redirects back to `http://localhost:10050`
   - Check Supabase Studio at `http://localhost:54323` to see authenticated user

## Services Running

- **Next.js Frontend**: `http://localhost:10050`
- **Agent Server**: `ws://localhost:8080`
- **Supabase API**: `http://localhost:54321`
- **Supabase Studio**: `http://localhost:54323`
- **Supabase Database**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## GitHub OAuth App Settings

Your GitHub OAuth App should have these settings:

**Homepage URL**: `http://localhost:10050`
**Authorization callback URL**: `http://localhost:54321/auth/v1/callback`

Note: The callback URL points to Supabase (port 54321), not directly to your Next.js app (port 10050). Supabase handles the OAuth flow and then redirects to your site_url.

## Next Steps

1. Test workspace creation in Quick Start Mode (no auth required)
2. Test Claude Code chat interface
3. When ready, enable GitHub OAuth and test the full authentication flow
4. Test creating workspaces with real GitHub repositories
5. Verify repository cloning works with authenticated GitHub tokens

## Troubleshooting

If authentication doesn't work:
1. Check Supabase logs: `docker logs supabase_auth_edinburgh`
2. Verify redirect URIs match in GitHub OAuth App settings
3. Check browser console for errors
4. Verify environment variables are loaded (restart dev server if needed)
