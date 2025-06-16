# API Reference

Complete reference for all Remote Claude commands and options.

## Table of Contents

1. [Global Options](#global-options)
2. [Commands](#commands)
   - [run](#run)
   - [status](#status)
   - [results](#results)
   - [logs](#logs)
   - [cancel](#cancel)
   - [config](#config)
   - [session](#session)
3. [Configuration File](#configuration-file)
4. [Environment Variables](#environment-variables)

## Global Options

Options available for all commands:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--version` | `-V` | Output the version number | - |
| `--help` | `-h` | Display help for command | - |
| `--verbose` | `-v` | Enable verbose output | false |
| `--quiet` | `-q` | Suppress non-error output | false |
| `--json` | - | Output in JSON format | false |

## Commands

### run

Execute a Claude Code task remotely in a GitHub Codespace.

```bash
rclaude run [options] <task>
```

#### Arguments

- `task` (required): The task description for Claude Code to execute

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--repo <repository>` | `-r` | GitHub repository (owner/repo format) | From config |
| `--branch <branch>` | `-b` | Git branch to use | Default branch |
| `--timeout <seconds>` | `-t` | Task timeout in seconds | 7200 (2 hours) |
| `--priority <level>` | `-p` | Task priority (low, normal, high, urgent) | normal |
| `--interactive` | `-i` | Run in interactive mode | false |
| `--persistent` | - | Enable persistent session with tmux | true (interactive) |
| `--no-persistent` | - | Disable persistent session | - |
| `--idle-timeout <minutes>` | - | Codespace idle timeout in minutes (30-1440) | 30 |
| `--machine-type <type>` | - | Codespace machine type | basicLinux32gb |
| `--notify <channels>` | `-n` | Notification channels (comma-separated) | From config |
| `--notify-on-start` | - | Send notification when task starts | false |
| `--notify-on-complete` | - | Send notification when task completes | false |
| `--notify-on-fail` | - | Send notification when task fails | false |
| `--auto-commit` | - | Automatically commit changes | false |
| `--pull-request` | - | Create pull request for changes | false |
| `--output <files>` | `-o` | Expected output files (comma-separated) | - |
| `--name <name>` | - | Custom name for the task | - |
| `--machine-type <type>` | - | Codespace machine type | basicLinux32gb |
| `--keep-codespace` | - | Don't delete codespace after task | false |
| `--no-prebuild` | - | Don't use repository prebuild | false |

#### Examples

```bash
# Basic task
rclaude run "Fix the TypeScript errors in src/index.ts"

# With repository and branch
rclaude run "Add user authentication" --repo owner/repo --branch feature/auth

# High priority with notifications
rclaude run "Critical security patch" \
  --priority urgent \
  --notify email,slack \
  --notify-on-start \
  --notify-on-complete

# Long-running task with auto-commit
rclaude run "Refactor entire codebase" \
  --timeout 14400 \
  --auto-commit \
  --pull-request

# Overnight task with extended idle timeout
rclaude run "Comprehensive analysis" \
  --idle-timeout 480 \
  --machine-type standardLinux32gb \
  --notify-on-complete

# High-performance computing task
rclaude run "ML model training" \
  --machine-type premiumLinux \
  --idle-timeout 1440 \
  --interactive

# Interactive debugging session
rclaude run "Debug performance issue" \
  --interactive \
  --idle-timeout 120
```

### status

Show running and completed tasks.

```bash
rclaude status [options] [taskId]
```

#### Arguments

- `taskId` (optional): Specific task ID to check

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--watch` | `-w` | Watch for status updates | false |
| `--interval <seconds>` | - | Watch interval in seconds | 5 |
| `--filter <status>` | `-f` | Filter by status (queued, running, completed, failed, cancelled) | - |
| `--limit <number>` | `-l` | Limit number of tasks shown | 20 |
| `--all` | `-a` | Show all tasks (no limit) | false |

#### Examples

```bash
# Show all tasks
rclaude status

# Check specific task
rclaude status abc123

# Watch task progress
rclaude status abc123 --watch

# Show only running tasks
rclaude status --filter running

# Show last 50 tasks
rclaude status --limit 50
```

### results

Download results from a completed task.

```bash
rclaude results [options] <taskId>
```

#### Arguments

- `taskId` (required): Task ID to get results from

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--download <path>` | `-d` | Download results to specified directory | - |
| `--output <file>` | `-o` | Save results to specific file | - |
| `--format <type>` | `-f` | Output format (text, json, markdown) | text |
| `--include-logs` | - | Include execution logs in results | false |

#### Examples

```bash
# View results in terminal
rclaude results abc123

# Download to directory
rclaude results abc123 --download ./results/

# Save as markdown
rclaude results abc123 --output report.md --format markdown

# Include logs
rclaude results abc123 --include-logs
```

### logs

View task execution logs.

```bash
rclaude logs [options] <taskId>
```

#### Arguments

- `taskId` (required): Task ID to view logs for

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--tail <lines>` | `-t` | Show last N lines | 100 |
| `--follow` | `-f` | Follow log output (live) | false |
| `--since <time>` | - | Show logs since timestamp | - |
| `--until <time>` | - | Show logs until timestamp | - |
| `--grep <pattern>` | `-g` | Filter logs by pattern | - |

#### Examples

```bash
# View last 100 lines
rclaude logs abc123

# Follow live logs
rclaude logs abc123 --follow

# Show last 500 lines
rclaude logs abc123 --tail 500

# Filter for errors
rclaude logs abc123 --grep "error|Error|ERROR"
```

### cancel

Cancel a running task.

```bash
rclaude cancel [options] <taskId>
```

#### Arguments

- `taskId` (required): Task ID to cancel

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--force` | `-f` | Force cancel without confirmation | false |
| `--delete-codespace` | - | Also delete the associated codespace | true |

#### Examples

```bash
# Cancel with confirmation
rclaude cancel abc123

# Force cancel
rclaude cancel abc123 --force

# Cancel but keep codespace
rclaude cancel abc123 --no-delete-codespace
```

### config

Manage Remote Claude configuration.

```bash
rclaude config <subcommand> [options]
```

#### Subcommands

##### config github

Configure GitHub authentication and settings.

```bash
rclaude config github [options]
```

Options:

| Option | Short | Description |
|--------|-------|-------------|
| `--token <token>` | `-t` | GitHub personal access token |
| `--username <username>` | `-u` | GitHub username |
| `--repository <repo>` | `-r` | Default repository |
| `--machine-type <type>` | `-m` | Default codespace machine type |
| `--timeout <minutes>` | - | Default idle timeout |

##### config notify

Configure notification channels.

```bash
rclaude config notify [options]
```

Options:

| Option | Short | Description |
|--------|-------|-------------|
| `--email <address>` | `-e` | Email address for notifications |
| `--slack <webhook>` | `-s` | Slack webhook URL |
| `--webhook <url>` | `-w` | Custom webhook URL |
| `--smtp-host <host>` | - | SMTP server host |
| `--smtp-port <port>` | - | SMTP server port |
| `--smtp-user <user>` | - | SMTP username |
| `--smtp-pass <pass>` | - | SMTP password |

##### config tasks

Configure task defaults.

```bash
rclaude config tasks [options]
```

Options:

| Option | Short | Description |
|--------|-------|-------------|
| `--max-concurrent <number>` | `-m` | Maximum concurrent tasks |
| `--default-timeout <seconds>` | `-t` | Default task timeout |
| `--auto-cleanup <boolean>` | `-a` | Auto-cleanup completed tasks |

#### Examples

```bash
# Configure GitHub token
rclaude config github --token ghp_xxxxx

# Interactive GitHub setup
rclaude config github

# Configure email notifications
rclaude config notify --email notify@example.com

# Configure Slack
rclaude config notify --slack https://hooks.slack.com/...

# Set task defaults
rclaude config tasks --max-concurrent 5 --default-timeout 3600
```

### session

Manage interactive Claude Code sessions.

```bash
rclaude session [options] [command]
```

#### Subcommands

- `list`: List active sessions
- `connect <sessionId>`: Reconnect to existing session
- `delete <sessionId>`: Delete a session

#### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--create` | `-c` | Create new session | - |
| `--repo <repository>` | `-r` | Repository for new session | From config |

#### Examples

```bash
# List sessions
rclaude session list

# Create new session
rclaude session --create --repo owner/repo

# Reconnect to session
rclaude session connect session-123

# Delete session
rclaude session delete session-123
```

## Configuration File

Remote Claude uses cosmiconfig for configuration discovery. Configuration can be stored in any of these locations:

- `.rclirc` (JSON)
- `.rclirc.json`
- `.rclirc.yaml`
- `.rclirc.yml`
- `.rclirc.js`
- `rcli.config.js`
- `package.json` (in "rcli" field)

### Configuration Schema

```typescript
interface Config {
  github: {
    token?: string;
    username?: string;
    defaultRepository?: string;
    defaultMachine?: string;
    defaultIdleTimeout?: number;
  };
  notifications: {
    email?: {
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
      from: string;
      to: string | string[];
    };
    slack?: {
      webhook: string;
      channel?: string;
      username?: string;
      iconEmoji?: string;
    };
    webhooks?: Array<{
      url: string;
      headers?: Record<string, string>;
      events?: string[];
    }>;
  };
  tasks: {
    maxConcurrent?: number;
    defaultTimeout?: number;
    autoCleanup?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
  };
  codespace: {
    defaultMachineType?: string;
    idleTimeoutMinutes?: number;
    retentionPeriodDays?: number;
    displayName?: string;
  };
}
```

### Example Configuration

```json
{
  "github": {
    "token": "ghp_xxxxxxxxxxxx",
    "defaultRepository": "owner/repo",
    "defaultMachine": "basicLinux32gb"
  },
  "notifications": {
    "email": {
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "notifications@example.com",
          "pass": "app-specific-password"
        }
      },
      "from": "Remote Claude <notifications@example.com>",
      "to": ["dev@example.com", "alerts@example.com"]
    },
    "slack": {
      "webhook": "https://hooks.slack.com/services/xxx/yyy/zzz",
      "channel": "#dev-notifications",
      "username": "Remote Claude Bot",
      "iconEmoji": ":robot_face:"
    }
  },
  "tasks": {
    "maxConcurrent": 3,
    "defaultTimeout": 3600,
    "autoCleanup": true,
    "retryAttempts": 2,
    "retryDelay": 5000
  }
}
```

## Environment Variables

Remote Claude supports the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `RCLI_GITHUB_TOKEN` | GitHub personal access token | - |
| `RCLI_DEFAULT_REPO` | Default repository | - |
| `RCLI_CONFIG_PATH` | Custom config file path | - |
| `RCLI_WEBHOOK_PORT` | Webhook server port | 3000 |
| `DEBUG` | Debug output (e.g., `remote-claude:*`) | - |
| `NODE_ENV` | Environment (development, production) | production |
| `FORCE_COLOR` | Force colored output | Auto-detected |
| `NO_COLOR` | Disable colored output | - |

### Debug Namespaces

When using `DEBUG` environment variable:

- `remote-claude:*` - All debug output
- `remote-claude:cli` - CLI operations
- `remote-claude:task-manager` - Task management
- `remote-claude:codespace` - Codespace operations
- `remote-claude:webhook` - Webhook server
- `remote-claude:notifications` - Notification system
- `remote-claude:config` - Configuration loading

Example:
```bash
DEBUG=remote-claude:task-manager,remote-claude:codespace rclaude run "debug task"
```