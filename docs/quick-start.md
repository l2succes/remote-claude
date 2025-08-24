# 🚀 Remote Claude Quick Start Guide

Get up and running with Remote Claude in under 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Git installed  
- GitHub account (for repository access)
- E2B API key (free tier at [e2b.dev](https://e2b.dev))
- Anthropic API key (for Claude)

## Installation

```bash
# Install globally via npm
npm install -g @remote-claude/cli

# Or use npx (no installation needed)
npx @remote-claude/cli

# Verify installation
rclaude --version
```

## Initial Setup

### 1. Configure API Keys

```bash
# Interactive setup (recommended)
rclaude init

# Or set keys individually
rclaude config set E2B_API_KEY your_e2b_key
rclaude config set ANTHROPIC_API_KEY your_anthropic_key
rclaude config set GITHUB_TOKEN your_github_token  # For private repos
```

### 2. Test Your Setup

```bash
# Verify connections
rclaude test

# This will check:
# ✓ E2B sandbox connection
# ✓ Anthropic API access
# ✓ GitHub authentication (if configured)
```

## Your First Session

### Quick Start

```bash
# Start a session with any GitHub repository
rclaude start https://github.com/user/repo

# Or use your current directory
rclaude start .

# Claude is now ready to help!
```

### Run Your First Task

```bash
# Ask Claude to help with your code
rclaude run "Add error handling to the login function"

# Claude will:
# 1. Analyze your codebase
# 2. Make the requested changes
# 3. Show you the results
# 4. Save the session for later
```

## Core Commands

### Session Management

```bash
# Start a new session
rclaude start <repository-url>

# List active sessions
rclaude list

# Resume a previous session
rclaude resume <session-id>

# Pause to save costs (preserves state)
rclaude pause

# Stop and clean up
rclaude stop
```

### Working with Claude

```bash
# Run a task
rclaude run "Fix the bug in auth.js"

# Interactive mode (chat with Claude)
rclaude chat

# Execute a specific command
rclaude exec "npm test"

# View files
rclaude ls src/
rclaude cat src/index.js
```

### Task Management

```bash
# Save a task for reuse
rclaude task save "test" "Run all tests and fix failures"

# Run a saved task
rclaude task run test

# List saved tasks
rclaude task list
```

## Common Use Cases

### 🐛 Fix a Bug
```bash
rclaude run "Fix the TypeError in utils/auth.js line 42"
```

### ✨ Add a Feature
```bash
rclaude run "Add pagination to the user list component with 10 items per page"
```

### ♻️ Refactor Code
```bash
rclaude run "Refactor the database module to use connection pooling"
```

### 🧪 Write Tests
```bash
rclaude run "Write comprehensive unit tests for the auth module"
```

### 📝 Generate Documentation
```bash
rclaude run "Add JSDoc comments to all public API methods"
```

## Project Configuration

Create `.remote-claude.json` in your project root:

```json
{
  "repository": "https://github.com/user/repo",
  "defaultBranch": "main",
  "environment": {
    "NODE_ENV": "development",
    "API_URL": "http://localhost:3000"
  },
  "tasks": {
    "test": "Run all tests and fix any failures",
    "lint": "Run ESLint and fix all issues",
    "deploy": "Build and deploy to production"
  },
  "persistence": {
    "enabled": true,
    "autoSave": true,
    "saveInterval": 300
  }
}
```

Now you can use shortcuts:
```bash
# Uses configuration from .remote-claude.json
rclaude start
rclaude task run test
```

## Web Dashboard (Optional)

For a visual interface:

### 1. Clone and Setup
```bash
git clone https://github.com/yourusername/remote-claude
cd remote-claude
npm install
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start the Dashboard
```bash
npm run dev
# Open http://localhost:3000
```

### Dashboard Features
- 📊 Visual session management
- 💬 Real-time Claude chat interface
- 📁 File browser with syntax highlighting
- 📈 Task history and progress tracking
- 💰 Usage and cost monitoring

## Cost Management

### Pricing Structure
- **Active Sessions**: $0.10/hour
- **Persistent Storage**: $5/month per repository
- **Paused Sessions**: No charge

### Cost-Saving Tips

```bash
# Pause when not actively working
rclaude pause  # State preserved, billing stopped

# Set auto-pause timeout
rclaude config set autoPause 300  # Pause after 5 min idle

# Use efficient commands
rclaude run "Fix all bugs" --timeout 1800  # 30 min limit

# Monitor usage
rclaude usage
# Shows: Hours used, Current cost, Projected monthly
```

## Advanced Features

### Persistent Sessions
```bash
# Work persists automatically
rclaude run "Build authentication system"
# ... power outage / connection lost ...
rclaude resume  # Picks up exactly where you left off
```

### Multiple Repositories
```bash
# Work with multiple repos in one session
rclaude repo add https://github.com/user/frontend
rclaude repo add https://github.com/user/backend
rclaude repo switch frontend
rclaude run "Update API endpoints"
```

### Environment Variables
```bash
# Set for current session
rclaude env set DATABASE_URL "postgres://..."
rclaude env set API_KEY "secret"

# List all variables
rclaude env list
```

### Git Integration
```bash
# Claude can commit changes
rclaude run "Fix bugs and commit with descriptive messages"

# Create pull requests
rclaude run "Implement feature X and create a PR"
```

## Troubleshooting

### Session Won't Start
```bash
# Check your setup
rclaude test --verbose

# Common fixes:
rclaude config set E2B_API_KEY <new-key>  # Update API key
rclaude cleanup                           # Clear corrupted state
```

### Claude Not Responding
```bash
# Check status
rclaude status

# Restart session
rclaude restart

# View logs
rclaude logs --tail 50
```

### Files Not Persisting
```bash
# Force save
rclaude save

# Check persistence status
rclaude info
```

### Connection Issues
```bash
# Use a different region
rclaude config set region us-west-2

# Test connectivity
rclaude test network
```

## Best Practices

### 1. Use Descriptive Task Descriptions
```bash
# ❌ Bad
rclaude run "fix it"

# ✅ Good
rclaude run "Fix the null pointer exception in UserService.getProfile() when user has no avatar"
```

### 2. Pause Sessions When Idle
```bash
# Configure auto-pause
rclaude config set autoPause 300  # 5 minutes

# Or manually pause
rclaude pause
```

### 3. Save Frequently Used Tasks
```bash
rclaude task save daily-standup "Review recent commits, run tests, and summarize changes"
rclaude task run daily-standup
```

### 4. Set Resource Limits
```bash
# Prevent runaway costs
rclaude config set maxSessionHours 8
rclaude config set maxMonthlyCost 50
```

## Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `rclaude start` | Start new session | `rclaude start github.com/user/repo` |
| `rclaude run` | Execute task | `rclaude run "Add tests"` |
| `rclaude pause` | Pause session | `rclaude pause` |
| `rclaude resume` | Resume session | `rclaude resume abc123` |
| `rclaude stop` | Stop session | `rclaude stop` |
| `rclaude list` | List sessions | `rclaude list --active` |
| `rclaude task` | Manage tasks | `rclaude task save test "Run tests"` |
| `rclaude config` | Configuration | `rclaude config set autoPause 300` |
| `rclaude usage` | View usage | `rclaude usage --this-month` |
| `rclaude help` | Get help | `rclaude help run` |

## Getting Help

- 📚 **Documentation**: [docs.remoteclaude.com](https://docs.remoteclaude.com)
- 💬 **Discord Community**: [discord.gg/remoteclaude](https://discord.gg/remoteclaude)
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/yourusername/remote-claude/issues)
- 📧 **Email Support**: support@remoteclaude.com

## Next Steps

1. **Explore the CLI**: Run `rclaude help` for all commands
2. **Set up the dashboard**: Get a visual interface for your sessions
3. **Configure your project**: Create `.remote-claude.json` for project defaults
4. **Join the community**: Share tips and get help on Discord

---

**Happy coding with Remote Claude! 🚀**

Built with ❤️ using [VibeKit](https://vibekit.io) for secure sandbox execution.