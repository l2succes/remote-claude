# Authentication System Design for Hosted Remote Claude

## Overview
The hosted version needs a robust authentication system supporting OAuth2 providers and API key authentication for the CLI.

## Authentication Flow

### Web Dashboard Flow (OAuth2)
```mermaid
sequenceDiagram
    User->>Dashboard: Click "Sign in with GitHub/Google"
    Dashboard->>OAuth Provider: Redirect to authorize
    OAuth Provider->>User: Show consent screen
    User->>OAuth Provider: Approve
    OAuth Provider->>Dashboard: Redirect with code
    Dashboard->>Auth Service: Exchange code for user info
    Auth Service->>OAuth Provider: Verify code
    OAuth Provider->>Auth Service: Return user data
    Auth Service->>Database: Create/update user
    Auth Service->>Dashboard: Return JWT + Refresh token
    Dashboard->>User: Logged in!
```

### CLI Authentication Flow
```mermaid
sequenceDiagram
    User->>CLI: rclaude login
    CLI->>User: Open browser to auth page
    User->>Auth Page: Login with OAuth
    Auth Page->>Auth Service: Generate CLI token
    Auth Service->>Auth Page: Return token
    Auth Page->>CLI: Send token via callback
    CLI->>Local Storage: Save encrypted token
    CLI->>API: Use token for requests
```

## Technical Implementation

### Auth Service Components

```typescript
// src/services/auth/types.ts
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  provider: 'github' | 'google'
  providerId: string
  apiKeys: ApiKey[]
  subscription: Subscription
  createdAt: Date
  updatedAt: Date
}

export interface ApiKey {
  id: string
  userId: string
  name: string
  key: string // hashed
  prefix: string // visible prefix (e.g., "rck_")
  lastUsed?: Date
  createdAt: Date
  expiresAt?: Date
  scopes: string[]
}

export interface Session {
  id: string
  userId: string
  token: string
  refreshToken: string
  expiresAt: Date
  createdAt: Date
}
```

### Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  scopes TEXT[],
  is_active BOOLEAN DEFAULT true
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking table
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,
  compute_provider VARCHAR(50),
  duration_seconds INTEGER,
  cpu_seconds INTEGER,
  memory_mb_seconds BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

```yaml
# Authentication endpoints
POST   /api/auth/oauth/github/callback  # GitHub OAuth callback
POST   /api/auth/oauth/google/callback  # Google OAuth callback
POST   /api/auth/refresh                # Refresh JWT token
POST   /api/auth/logout                 # Logout (revoke tokens)
GET    /api/auth/cli/authorize          # Start CLI auth flow
POST   /api/auth/cli/token              # Exchange code for CLI token

# User management
GET    /api/user/profile                # Get current user
PATCH  /api/user/profile                # Update profile
GET    /api/user/api-keys               # List API keys
POST   /api/user/api-keys               # Create API key
DELETE /api/user/api-keys/:id           # Revoke API key
GET    /api/user/usage                  # Get usage stats
```

### Security Measures

1. **Token Security**
   - JWT tokens expire in 15 minutes
   - Refresh tokens expire in 30 days
   - API keys use secure random generation
   - All tokens are hashed before storage

2. **Rate Limiting**
   - Auth endpoints: 5 requests per minute
   - API endpoints: Based on subscription tier
   - CLI polling: 60 requests per minute

3. **Encryption**
   - TLS 1.3 for all connections
   - Encrypted token storage in CLI
   - Secure session cookies (HttpOnly, Secure, SameSite)

### CLI Integration Changes

```typescript
// src/cli/utils/auth-v2.ts
export class HostedAuthManager {
  private apiUrl = process.env.RCLAUDE_API_URL || 'https://api.remoteclaude.com'
  
  async login(): Promise<void> {
    // 1. Start OAuth flow
    const { authUrl, state } = await this.startAuthFlow()
    
    // 2. Open browser
    console.log('Opening browser for authentication...')
    await open(authUrl)
    
    // 3. Poll for completion
    const token = await this.pollForToken(state)
    
    // 4. Save token securely
    await this.saveToken(token)
  }
  
  async getToken(): Promise<string> {
    const token = await this.loadToken()
    
    if (this.isExpired(token)) {
      return await this.refreshToken(token)
    }
    
    return token.access_token
  }
}
```

### Environment Variables

```bash
# OAuth Providers
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# JWT Secrets
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx

# Database
DATABASE_URL=postgresql://user:pass@host:5432/rclaude

# API URLs
FRONTEND_URL=https://app.remoteclaude.com
API_URL=https://api.remoteclaude.com
```

## Migration Path

1. **Phase 1**: Keep existing GitHub token auth for self-hosted
2. **Phase 2**: Add new auth system for hosted version
3. **Phase 3**: Update CLI to detect and use appropriate auth
4. **Phase 4**: Migrate existing users (if any)

## Next Steps
1. Set up OAuth apps on GitHub and Google
2. Implement auth service with Express/Passport
3. Create secure token generation and storage
4. Build CLI authentication flow
5. Add auth middleware to API routes