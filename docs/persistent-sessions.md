# Remote Claude Persistent Sessions Guide

This guide shows you how to run Claude Code in persistent sessions that survive host machine shutdowns using GitHub Codespaces.

## 🚀 Quick Start (Fully Automated)

```bash
# Start interactive session with auto-setup
rclaude run --interactive "Fix the API error handling" --repo your/repo

# That's it! The system will:
# ✅ Create a GitHub Codespace
# ✅ Install Claude Code
# ✅ Setup tmux with persistent sessions
# ✅ Create helper scripts
# ✅ Connect you to a persistent Claude Code session
```

## 📋 What Gets Auto-Created

When you use `--interactive`, the system automatically creates:

### Helper Scripts in Codespace
- `~/start-claude.sh` - Quick start/reconnect script
- `~/claude-status.sh` - Check session status
- `~/cleanup-claude.sh` - Clean up sessions
- `~/claude-code-persistent.sh` - Auto-restart wrapper
- `~/CLAUDE_README.md` - Complete guide

### Tmux Session Layout
- **Window 1**: `claude-code` - Main Claude Code workspace
- **Window 2**: `logs` - Log monitoring
- **Window 3**: `monitor` - System monitoring

### Configuration Files
- `~/.tmux.conf` - Optimized tmux configuration
- `/tmp/claude-setup.log` - Setup logs

## 🎛️ Command Options

```bash
# Interactive with full persistence (default)
rclaude run --interactive "task" --repo owner/repo

# Interactive without persistence setup
rclaude run --interactive --no-persistent "task" --repo owner/repo

# Force persistence setup
rclaude run --interactive --persistent "task" --repo owner/repo
```

## 🔄 Complete Workflow Examples

### Example 1: Start New Persistent Session
```bash
# In your project directory
cd ~/Projects/blaze/spark

# Start persistent interactive session
rclaude run --interactive "Add error handling to API endpoints" --repo l2succes/spark

# System creates codespace and you're connected to tmux session
# Work in Claude Code...

# Detach to keep running in background: Ctrl+B then D
# Close terminal - session keeps running on GitHub!
```

### Example 2: Reconnect to Existing Session
```bash
# List your codespace sessions
rclaude session --list

# Reconnect to specific session
rclaude session --connect <codespace-name>

# Or once connected to codespace:
tmux attach-session -t claude-work
```

### Example 3: Multiple Sessions
```bash
# Start session for frontend work
rclaude run --interactive "Fix React components" --repo user/frontend

# In another terminal, start backend session
rclaude run --interactive "Update API routes" --repo user/backend

# Manage both with session command
rclaude session --list
```

## 🔧 Manual Session Management

### Inside the Codespace
```bash
# Quick start (auto-created script)
~/start-claude.sh

# Check status
~/claude-status.sh

# Start Claude Code with auto-restart
~/claude-code-persistent.sh

# Manual tmux commands
tmux attach-session -t claude-work  # Reconnect
tmux list-sessions                  # List all
tmux kill-session -t claude-work    # Kill session
```

### From Your Local Machine
```bash
# List all sessions
rclaude session --list

# Connect to session
rclaude session --connect my-codespace-name

# Clean up old sessions
rclaude session --cleanup
```

## ⌨️ Essential Tmux Commands

| Command | Action |
|---------|--------|
| `Ctrl+B` then `D` | **Detach** (keeps running) |
| `Ctrl+B` then `1,2,3` | Switch windows |
| `Ctrl+B` then `C` | Create new window |
| `Ctrl+B` then `,` | Rename window |
| `Ctrl+B` then `?` | Help/all commands |

## 🔍 Monitoring & Debugging

### Check Session Status
```bash
# From codespace
~/claude-status.sh

# Manual check
tmux list-sessions
```

### View Logs
```bash
# Setup logs
tail -f /tmp/claude-setup.log

# System monitoring
htop
```

### Troubleshooting
```bash
# If session is stuck
tmux kill-session -t claude-work
~/start-claude.sh

# If Claude Code crashes
~/claude-code-persistent.sh  # Auto-restart version

# Check codespace status
rclaude session --list
```

## 💡 Pro Tips

### 1. Background Work Flows
```bash
# Start session
rclaude run --interactive "Long running task" --repo user/repo

# Once in Claude Code, start your work
# Press Ctrl+B then D to detach
# Close laptop - work continues in cloud!

# Later, reconnect from anywhere
rclaude session --connect <codespace-name>
tmux attach-session -t claude-work
```

### 2. Multiple Workspaces
```bash
# Create additional tmux windows for different tasks
Ctrl+B then C  # New window
Ctrl+B then ,  # Rename to "frontend"

# Switch between workspaces
Ctrl+B then 1  # Claude Code window
Ctrl+B then 2  # Logs window  
Ctrl+B then 3  # Monitor window
Ctrl+B then 4  # Your new window
```

### 3. Auto-commit Integration
```bash
# Start session with auto-commit
rclaude run --interactive --auto-commit "Fix bugs" --repo user/repo

# Changes will be automatically committed when you're done
```

## 🚨 Important Notes

1. **Codespace Costs**: GitHub Codespaces has usage limits and costs
2. **Session Timeout**: Codespaces auto-stop after inactivity (configurable)
3. **Resource Limits**: Choose appropriate machine size for your needs
4. **Data Persistence**: Files persist in codespace, but codespace can be deleted

## 🔗 Integration with Your Workflow

### Git Integration
```bash
# Start session on specific branch
rclaude run --interactive "Fix issue #123" --repo user/repo --branch feature/fix-123

# Auto-commit and create PR when done
rclaude run --interactive --auto-commit --pull-request "Feature work" --repo user/repo
```

### Notification Integration
```bash
# Get notified when long tasks complete
rclaude run --interactive --notify-on-complete --notify email "Long task" --repo user/repo
```

This setup gives you a fully persistent, cloud-based Claude Code environment that survives local machine shutdowns and provides seamless reconnection capabilities!