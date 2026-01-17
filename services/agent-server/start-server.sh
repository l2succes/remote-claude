#!/bin/bash

# Load NVM if available (for development environments)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Preserve existing PATH which should include node
export PATH="$PATH"

# Set working directory for Claude Code
export WORKING_DIR="/Users/luc/conductor/workspaces/remote-claude-monorepo/belo/workspace"

# Load environment variables
if [ -f "../../.env" ]; then
  export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Start the server
exec node -r ts-node/register src/index.ts