# Remote Claude Setup Guide

This comprehensive guide will walk you through setting up Remote Claude from scratch, including all authentication requirements and configuration options.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GitHub Personal Access Token](#github-personal-access-token)
3. [GitHub CLI Authentication](#github-cli-authentication)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Verifying Your Setup](#verifying-your-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before setting up Remote Claude, ensure you have:

- **Node.js 18.0.0 or higher** - [Download Node.js](https://nodejs.org/)
- **GitHub account** - [Sign up for GitHub](https://github.com/signup)
- **GitHub Codespaces access** - Available with GitHub Free for personal accounts
- **Git** - [Download Git](https://git-scm.com/downloads)

## GitHub Personal Access Token

Remote Claude requires a GitHub Personal Access Token with specific permissions to create and manage Codespaces.

### Required Scopes

Your token must have the following scopes:
- `repo` - Full control of private repositories
- `codespace` - Manage user codespaces

### Creating Your Token

1. **Navigate to GitHub Settings**
   - Click your profile picture in the top-right corner
   - Select **Settings** from the dropdown menu

2. **Access Developer Settings**
   - Scroll down to the bottom of the left sidebar
   - Click **Developer settings**

3. **Create Personal Access Token**
   - Click **Personal access tokens** → **Tokens (classic)**
   - Click **Generate new token** → **Generate new token (classic)**

4. **Configure Token Settings**
   - **Note**: Enter a descriptive name like "Remote Claude CLI"
   - **Expiration**: Choose an appropriate expiration (90 days recommended)
   - **Select scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `codespace` (Manage user codespaces)

5. **Generate and Save Token**
   - Click **Generate token** at the bottom
   - **⚠️ IMPORTANT**: Copy your token immediately - you won't see it again!
   - Store it securely (e.g., in a password manager)

### Alternative: Fine-grained Personal Access Token

For enhanced security, you can use a fine-grained token:

1. Go to **Personal access tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Configure:
   - **Repository access**: Select specific repositories or "All repositories"
   - **Permissions**:
     - Repository permissions:
       - Contents: Read
       - Metadata: Read
       - Pull requests: Write (if using PR features)
     - Account permissions:
       - Codespaces: Write
       - Codespaces lifecycle admin: Write
       - Codespaces metadata: Read
       - Codespaces secrets: Write
       - Codespaces user secrets: Write

## GitHub CLI Authentication

Remote Claude can use GitHub CLI's authentication if available. This is optional but recommended.

### Installing GitHub CLI

```bash
# macOS
brew install gh

# Windows (with Chocolatey)
choco install gh

# Linux (Debian/Ubuntu)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### Authenticating GitHub CLI

```bash
# Start interactive authentication
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Login with a web browser
```

After authenticating, verify your setup:

```bash
gh auth status
```

### Adding Codespace Scope to GitHub CLI

If you're using GitHub CLI authentication, ensure it has the codespace scope:

```bash
gh auth refresh -h github.com -s codespace
```

## Installation

### Installing from NPM (Recommended)

```bash
npm install -g remote-claude
```

### Installing from Source

```bash
# Clone the repository
git clone https://github.com/l2succes/remote-claude.git
cd remote-claude

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link
```

## Configuration

### Initial Setup

1. **Configure GitHub Authentication**

   Using your personal access token:
   ```bash
   rclaude config github --token YOUR_GITHUB_TOKEN
   ```

   Or use interactive setup:
   ```bash
   rclaude config github
   ```

2. **Set Default Repository (Optional)**

   ```bash
   rclaude config github --repository owner/repo-name
   ```

### Notification Setup (Optional)

1. **Email Notifications**

   ```bash
   # Basic email setup
   rclaude config notify --email your@email.com

   # Advanced SMTP configuration
   rclaude config notify
   # Follow the interactive prompts for SMTP settings
   ```

2. **Slack Notifications**

   ```bash
   # Add Slack webhook
   rclaude config notify --slack https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

### Configuration File

Remote Claude stores configuration in `~/.rclirc`. You can also edit this file directly:

```json
{
  "github": {
    "token": "ghp_...",
    "defaultRepository": "owner/repo",
    "defaultMachine": "basicLinux32gb",
    "defaultIdleTimeout": 30
  },
  "notifications": {
    "email": {
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your@email.com",
          "pass": "app-specific-password"
        }
      },
      "from": "your@email.com",
      "to": "notifications@email.com"
    }
  }
}
```

## Verifying Your Setup

### 1. Check CLI Installation

```bash
rclaude --version
```

### 2. Verify GitHub Authentication

```bash
# If using GitHub CLI
gh auth status

# Check Remote Claude config
rclaude config github
```

### 3. Test Codespace Access

```bash
# List your codespaces (requires proper authentication)
gh codespace list
```

### 4. Run a Test Task

```bash
# Simple test on a public repository
rclaude run "List all files in the repository" --repo octocat/Hello-World --timeout 300
```

## Troubleshooting

### Common Issues

#### "Command not found: rclaude"

The CLI isn't in your PATH. Try:
- Reinstalling with `npm install -g remote-claude`
- Using `npx remote-claude` instead
- Checking your npm global bin path: `npm bin -g`

#### "Failed to create codespace: Request failed with status code 404"

Possible causes:
- Repository doesn't exist or is private
- No access to the repository
- Incorrect repository format (use `owner/repo`)

#### "Must have admin rights to Repository"

Your token is missing the `codespace` scope:
1. Generate a new token with proper scopes
2. Update configuration: `rclaude config github --token NEW_TOKEN`

#### "Codespace stuck in 'Queued' status"

This is normal for first-time creation. Codespaces can take 2-5 minutes to provision.

#### Authentication Issues with GitHub CLI

If GitHub CLI token doesn't have codespace scope:
```bash
gh auth refresh -h github.com -s codespace
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Set environment variable
export DEBUG=remote-claude:*

# Run command with debug output
rclaude run "test task" --repo owner/repo
```

### Getting Help

- Check command help: `rclaude --help` or `rclaude [command] --help`
- View logs: `rclaude logs <task-id>`
- Report issues: [GitHub Issues](https://github.com/l2succes/remote-claude/issues)

## Next Steps

Once setup is complete:

1. Read the [Usage Guide](./usage-guide.md) for detailed examples
2. Configure [notifications](./notifications.md) for task updates
3. Learn about [advanced features](./advanced-features.md)
4. Set up [team collaboration](./team-setup.md)

## Security Best Practices

1. **Token Security**
   - Never commit tokens to version control
   - Use environment variables for CI/CD
   - Rotate tokens regularly
   - Use fine-grained tokens when possible

2. **Codespace Security**
   - Review codespace settings in GitHub
   - Enable 2FA on your GitHub account
   - Monitor active codespaces regularly
   - Use `--auto-cleanup` for automatic resource management

3. **Repository Access**
   - Only grant access to necessary repositories
   - Review permissions regularly
   - Use organization-level settings for team deployments