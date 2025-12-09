#!/bin/bash

# Ensure node is in PATH for spawned processes
export PATH="/Users/luc/.nvm/versions/node/v20.19.6/bin:$PATH"

# Set working directory for Claude Code
export WORKING_DIR="/Users/luc/conductor/workspaces/remote-claude-monorepo/belo/workspace"

# Load environment variables
if [ -f "../../.env" ]; then
  export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Start the server
exec node -r ts-node/register src/index.ts