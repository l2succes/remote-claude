#!/bin/bash

# Manual setup script for Claude Code in GitHub Codespaces
# Use this when Remote Claude's automated setup fails

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Manual Claude Code Setup for GitHub Codespaces"
echo "=================================================="
echo ""

# Step 1: Install tmux
log_info "Step 1: Installing tmux..."
if command -v tmux &> /dev/null; then
    log_success "tmux already installed ($(tmux -V))"
else
    log_info "Installing tmux..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y tmux
    elif command -v yum &> /dev/null; then
        sudo yum install -y tmux
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y tmux
    else
        log_error "Could not detect package manager. Please install tmux manually:"
        echo "  sudo apt-get install tmux    # Ubuntu/Debian"
        echo "  sudo yum install tmux        # CentOS/RHEL"
        echo "  sudo dnf install tmux        # Fedora"
        exit 1
    fi
    log_success "tmux installed"
fi

# Step 2: Install Claude Code
log_info "Step 2: Installing Claude Code..."
if command -v claude &> /dev/null; then
    log_success "Claude Code already installed"
else
    log_info "Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
    log_success "Claude Code installed"
fi

# Step 3: Create tmux configuration
log_info "Step 3: Setting up tmux configuration..."
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

# Step 4: Create helper scripts
log_info "Step 4: Creating helper scripts..."

# Start script
cat > ~/start-claude.sh << 'EOF'
#!/bin/bash
SESSION_NAME="claude-work"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "🔗 Attaching to existing session: $SESSION_NAME"
    tmux attach-session -t "$SESSION_NAME"
else
    echo "🚀 Creating new session: $SESSION_NAME"
    tmux new-session -d -s "$SESSION_NAME"
    tmux send-keys -t "$SESSION_NAME" 'echo "🤖 Claude Code Session Ready!"' Enter
    tmux send-keys -t "$SESSION_NAME" 'echo "💡 Press Ctrl+B then D to detach"' Enter
    tmux send-keys -t "$SESSION_NAME" 'echo "📝 Run: claude to start"' Enter
    tmux send-keys -t "$SESSION_NAME" 'echo ""' Enter
    tmux attach-session -t "$SESSION_NAME"
fi
EOF

# Status script
cat > ~/claude-status.sh << 'EOF'
#!/bin/bash
echo "🔍 Claude Code Session Status"
echo "=============================="
if tmux has-session -t "claude-work" 2>/dev/null; then
    echo "✅ Session 'claude-work' is running"
    echo "🔗 Reconnect with: tmux attach-session -t claude-work"
else
    echo "❌ No active session found"
    echo "🚀 Start with: ~/start-claude.sh"
fi
echo ""
echo "All sessions:"
tmux list-sessions 2>/dev/null || echo "No sessions running"
EOF

chmod +x ~/start-claude.sh ~/claude-status.sh
log_success "Helper scripts created"

# Step 5: Create startup session
log_info "Step 5: Creating startup session..."
SESSION_NAME="claude-work"

# Kill any existing session
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

# Create new session
tmux new-session -d -s "$SESSION_NAME"
tmux send-keys -t "$SESSION_NAME" 'clear' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "🤖 Remote Claude Session Ready!"' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "================================"' Enter
tmux send-keys -t "$SESSION_NAME" 'echo ""' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "💡 Quick Commands:"' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "  claude                # Start Claude Code"' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "  Ctrl+B then D         # Detach (keeps running)"' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "  ~/claude-status.sh    # Check session status"' Enter
tmux send-keys -t "$SESSION_NAME" 'echo ""' Enter
tmux send-keys -t "$SESSION_NAME" 'echo "🚀 Ready! Type: claude"' Enter

log_success "Session '$SESSION_NAME' created"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. tmux attach-session -t claude-work"
echo "  2. Run: claude"
echo "  3. Press Ctrl+B then D to detach anytime"
echo ""
echo "Helper commands:"
echo "  ~/start-claude.sh     # Quick start/reconnect"
echo "  ~/claude-status.sh    # Check status"
echo ""