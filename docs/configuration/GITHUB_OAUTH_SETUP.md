# GitHub OAuth Setup Guide

## Step 1: Create GitHub OAuth App

1. Go to GitHub Settings: https://github.com/settings/applications/new

2. Fill in the following details:
   - **Application name**: Remote Claude Dev (or your preferred name)
   - **Homepage URL**: `http://localhost:3020`
   - **Authorization callback URL**: `http://localhost:3020/api/github/callback`
   - **Description**: (Optional) "Remote Claude development environment with GitHub integration"

3. Click "Register application"

4. On the next page, you'll see:
   - **Client ID**: Copy this value
   - Click "Generate a new client secret"
   - **Client Secret**: Copy this value immediately (you won't be able to see it again)

## Step 2: Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your GitHub OAuth credentials:
   ```env
   # GitHub OAuth App Configuration
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   GITHUB_REDIRECT_URI=http://localhost:3020/api/github/callback
   ```

## Step 3: Restart the Application

1. Stop the current development server (Ctrl+C)

2. Restart the Next.js development server:
   ```bash
   cd apps/web
   npm run dev
   ```

3. Restart the agent server:
   ```bash
   cd services/agent-server
   ./start-server.sh
   ```

## Step 4: Test the OAuth Flow

1. Navigate to http://localhost:3020/claude

2. Click the "GitHub" button in the header

3. Click "Login with GitHub"

4. You'll be redirected to GitHub to authorize the application

5. After authorization, you'll be redirected back to the app

6. You should now see your GitHub username in the button and be able to browse your repositories

## Troubleshooting

### Common Issues:

1. **"Redirect URI mismatch" error**:
   - Ensure the callback URL in your GitHub OAuth App settings exactly matches: `http://localhost:3020/api/github/callback`
   - Check that your `.env` file has the correct `GITHUB_REDIRECT_URI`

2. **"Client ID not found" error**:
   - Make sure you've copied the Client ID correctly to your `.env` file
   - Restart the Next.js development server after updating `.env`

3. **"Invalid client secret" error**:
   - Regenerate the client secret in GitHub if needed
   - Ensure there are no extra spaces or quotes in your `.env` file

4. **Cookies not being set**:
   - Check browser console for any cookie-related errors
   - Try clearing cookies for localhost:3020

## Security Notes

- **Never commit your `.env` file** - it's already in `.gitignore`
- The client secret should remain confidential
- For production, use HTTPS and secure cookie settings
- Consider implementing token refresh for long-lived sessions

## Testing Different Scenarios

### Test with Multiple Accounts
1. Log out from the app
2. Log out from GitHub in your browser
3. Try logging in with a different GitHub account

### Test Token Expiry
1. Manually delete the `github_token` cookie in browser DevTools
2. Try to fetch repositories - should redirect to login

### Test Error Handling
1. Try with an invalid token by modifying the cookie value
2. Should show appropriate error messages

## Next Steps

Once OAuth is working:
1. The token can be used with Octokit for advanced GitHub API operations
2. Implement repository cloning using the OAuth token instead of gh CLI
3. Add webhook support for real-time repository updates
4. Implement fine-grained permissions for specific repository access