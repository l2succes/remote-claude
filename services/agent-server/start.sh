#!/bin/bash
# Ensure node is in PATH for Claude Agent SDK
export PATH="$HOME/bin:/Users/luc/.nvm/versions/node/v20.19.6/bin:$PATH"
export NODE_PATH="/Users/luc/.nvm/versions/node/v20.19.6/bin"

# Source environment from root
if [ -f "../../.env.local" ]; then
  export $(cat ../../.env.local | grep -v '^#' | xargs)
fi

# Start the agent server
exec bun run start:dev
