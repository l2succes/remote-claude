#!/bin/bash

# Auto-setup script for persistent Claude Code sessions in GitHub Codespaces
# This script sets up tmux, creates a persistent session, and starts Claude Code

set -e

SCRIPT_NAME="Remote Claude Persistent Setup"
SESSION_NAME="claude-work"
LOG_FILE="/tmp/claude-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo -e "$1"
}

log_info() {
    log "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    log "${GREEN}✅ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    log "${RED}❌ $1${NC}"
}

# Check if running in a codespace
check_codespace() {
    if [[ -z "$CODESPACES" ]]; then
        log_warning "Not running in GitHub Codespaces. This script is optimized for codespaces."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_info "Running in GitHub Codespace: $CODESPACE_NAME"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Update package list
    sudo apt-get update -qq
    
    # Install tmux if not present
    if ! command -v tmux &> /dev/null; then
        log_info "Installing tmux..."
        sudo apt-get install -y tmux
        log_success "tmux installed"
    else
        log_success "tmux already installed"
    fi
    
    # Install other useful tools
    if ! command -v htop &> /dev/null; then
        log_info "Installing monitoring tools..."
        sudo apt-get install -y htop tree curl jq
    fi
}

# Create tmux configuration
setup_tmux_config() {
    log_info "Setting up tmux configuration..."
    
    cat > ~/.tmux.conf << 'EOF'
# Remote Claude tmux configuration
set -g default-terminal "screen-256color"
set -g history-limit 10000
set -g base-index 1
set -g pane-base-index 1

# Easy config reload
bind-key r source-file ~/.tmux.conf \; display-message "Config reloaded!"

# Better window splitting
bind | split-window -h
bind - split-window -v

# Pane navigation
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

# Session management
bind-key S choose-session

# Status bar
set -g status-bg colour235
set -g status-fg white
set -g status-left '#[fg=green]#S '
set -g status-right '#[fg=yellow]%Y-%m-%d %H:%M'

# Auto-rename windows
setw -g automatic-rename on
set -g set-titles on
EOF

    log_success "tmux configuration created"
}

# Create helper scripts
create_helper_scripts() {
    log_info "Creating helper scripts..."
    
    # Create start script
    cat > ~/start-claude.sh << 'EOF'
#!/bin/bash
# Quick script to start Claude Code in persistent session

SESSION_NAME="claude-work"

# Check if session exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "🔗 Attaching to existing session: $SESSION_NAME"
    tmux attach-session -t "$SESSION_NAME"
else
    echo "🚀 Creating new session: $SESSION_NAME"
    tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)"
    
    # Setup window for Claude Code
    tmux send-keys -t "$SESSION_NAME" 'echo "🤖 Starting Claude Code session..."' Enter
    tmux send-keys -t "$SESSION_NAME" 'echo "💡 Tip: Press Ctrl+B then D to detach and keep running"' Enter
    tmux send-keys -t "$SESSION_NAME" 'echo "📝 Use: tmux attach-session -t claude-work to reconnect"' Enter
    tmux send-keys -t "$SESSION_NAME" 'echo ""' Enter
    
    # Attach to the session
    tmux attach-session -t "$SESSION_NAME"
fi
EOF

    # Create status script
    cat > ~/claude-status.sh << 'EOF'
#!/bin/bash
# Check status of Claude Code sessions

echo "🔍 Claude Code Session Status"
echo "=============================="

if tmux has-session -t "claude-work" 2>/dev/null; then
    echo "✅ Session 'claude-work' is running"
    echo ""
    echo "Windows in session:"
    tmux list-windows -t "claude-work"
    echo ""
    echo "🔗 Reconnect with: tmux attach-session -t claude-work"
    echo "📱 Or use: ~/start-claude.sh"
else
    echo "❌ No active Claude Code session found"
    echo "🚀 Start new session with: ~/start-claude.sh"
fi

echo ""
echo "All tmux sessions:"
tmux list-sessions 2>/dev/null || echo "No tmux sessions running"
EOF

    # Create cleanup script
    cat > ~/cleanup-claude.sh << 'EOF'
#!/bin/bash
# Clean up Claude Code sessions

echo "🧹 Cleaning up Claude Code sessions..."

if tmux has-session -t "claude-work" 2>/dev/null; then
    echo "🛑 Stopping session 'claude-work'..."
    tmux kill-session -t "claude-work"
    echo "✅ Session stopped"
else
    echo "ℹ️  No active session to clean up"
fi

echo "🔍 Remaining sessions:"
tmux list-sessions 2>/dev/null || echo "No sessions running"
EOF

    # Make scripts executable
    chmod +x ~/start-claude.sh ~/claude-status.sh ~/cleanup-claude.sh
    
    log_success "Helper scripts created in home directory"
}

# Setup Claude Code with auto-restart
setup_claude_code() {
    log_info "Setting up Claude Code environment..."
    
    # Verify Claude Code is installed
    if ! command -v claude-code &> /dev/null; then
        log_error "Claude Code is not installed. Please install it first."
        return 1
    fi
    
    # Create a wrapper script for Claude Code with auto-restart
    cat > ~/claude-code-persistent.sh << 'EOF'
#!/bin/bash
# Persistent Claude Code wrapper with auto-restart

SESSION_NAME="claude-work"
RESTART_COUNT=0
MAX_RESTARTS=3

log_message() {
    echo "$(date '+%H:%M:%S') - $1"
}

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
    log_message "🤖 Starting Claude Code (attempt $((RESTART_COUNT + 1))/$MAX_RESTARTS)"
    
    # Run Claude Code
    claude-code
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        log_message "✅ Claude Code exited normally"
        break
    else
        log_message "⚠️  Claude Code exited with code $EXIT_CODE"
        RESTART_COUNT=$((RESTART_COUNT + 1))
        
        if [ $RESTART_COUNT -lt $MAX_RESTARTS ]; then
            log_message "🔄 Restarting in 5 seconds..."
            sleep 5
        else
            log_message "❌ Max restart attempts reached. Exiting."
        fi
    fi
done

log_message "📤 Session ended. Use 'tmux attach-session -t claude-work' to reconnect."
EOF

    chmod +x ~/claude-code-persistent.sh
    log_success "Claude Code wrapper created"
}

# Create startup session
create_startup_session() {
    log_info "Creating startup session..."
    
    # Kill any existing session
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    
    # Create new session
    tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)"
    
    # Setup main window
    tmux rename-window -t "$SESSION_NAME:1" "claude-code"
    
    # Create additional useful windows
    tmux new-window -t "$SESSION_NAME" -n "logs" -c "$(pwd)"
    tmux new-window -t "$SESSION_NAME" -n "monitor" -c "$(pwd)"
    
    # Setup logs window
    tmux send-keys -t "$SESSION_NAME:logs" 'echo "📋 Log monitoring window"' Enter
    tmux send-keys -t "$SESSION_NAME:logs" 'echo "Use: tail -f /tmp/claude-setup.log"' Enter
    
    # Setup monitor window  
    tmux send-keys -t "$SESSION_NAME:monitor" 'echo "📊 System monitoring window"' Enter
    tmux send-keys -t "$SESSION_NAME:monitor" 'echo "Use: htop, top, or ~/claude-status.sh"' Enter
    
    # Go back to main window
    tmux select-window -t "$SESSION_NAME:claude-code"
    
    # Setup main window with welcome message
    tmux send-keys -t "$SESSION_NAME:claude-code" 'clear' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "🤖 Remote Claude Persistent Session Ready!"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "========================================="' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo ""' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "💡 Tips:"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "  • Press Ctrl+B then D to detach (keeps running)"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "  • Use Ctrl+B then 1,2,3 to switch windows"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "  • Reconnect with: tmux attach-session -t claude-work"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo ""' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "🚀 Ready to start Claude Code!"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "   Run: claude-code"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo "   Or:  ~/claude-code-persistent.sh (with auto-restart)"' Enter
    tmux send-keys -t "$SESSION_NAME:claude-code" 'echo ""' Enter
    
    log_success "Startup session created: $SESSION_NAME"
}

# Create connection instructions
create_instructions() {
    log_info "Creating connection instructions..."
    
    cat > ~/CLAUDE_README.md << 'EOF'
# Remote Claude Persistent Session Guide

## Quick Start
```bash
# Start/reconnect to Claude Code session
~/start-claude.sh

# Check session status
~/claude-status.sh

# Clean up sessions
~/cleanup-claude.sh
```

## Manual Commands
```bash
# Attach to existing session
tmux attach-session -t claude-work

# Create new session if none exists
tmux new-session -d -s claude-work

# List all sessions
tmux list-sessions

# Kill a session
tmux kill-session -t claude-work
```

## Tmux Key Bindings
- `Ctrl+B then D` - Detach (keeps running)
- `Ctrl+B then 1,2,3` - Switch windows
- `Ctrl+B then C` - Create new window
- `Ctrl+B then ,` - Rename window
- `Ctrl+B then ?` - Help

## Session Layout
- **Window 1 (claude-code)**: Main Claude Code workspace
- **Window 2 (logs)**: Log monitoring
- **Window 3 (monitor)**: System monitoring

## Auto-restart Claude Code
Use `~/claude-code-persistent.sh` instead of `claude-code` for automatic restart on crashes.

## Files Created
- `~/.tmux.conf` - tmux configuration
- `~/start-claude.sh` - Quick start script
- `~/claude-status.sh` - Status checker
- `~/cleanup-claude.sh` - Session cleanup
- `~/claude-code-persistent.sh` - Auto-restart wrapper
- `~/CLAUDE_README.md` - This guide

## Troubleshooting
- Check logs: `tail -f /tmp/claude-setup.log`
- Monitor system: `htop`
- Test tmux: `tmux list-sessions`
EOF

    log_success "Instructions created: ~/CLAUDE_README.md"
}

# Main setup function
main() {
    log_info "Starting $SCRIPT_NAME"
    log_info "Log file: $LOG_FILE"
    
    check_codespace
    install_dependencies
    setup_tmux_config
    create_helper_scripts
    setup_claude_code
    create_startup_session
    create_instructions
    
    log_success "🎉 Setup complete!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🤖 Remote Claude Persistent Session Ready!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Quick commands:"
    echo "  🚀 Start session:    ~/start-claude.sh"
    echo "  📊 Check status:     ~/claude-status.sh"  
    echo "  🧹 Cleanup:          ~/cleanup-claude.sh"
    echo "  📖 Full guide:       cat ~/CLAUDE_README.md"
    echo ""
    echo "Current session: $SESSION_NAME"
    echo "Attach with: tmux attach-session -t $SESSION_NAME"
    echo ""
    log_info "Setup logged to: $LOG_FILE"
}

# Run main function
main "$@"