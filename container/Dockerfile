# Remote Claude Agent Container
#
# This container runs the Claude Agent SDK server for remote execution.
# Build: docker build -t remote-claude-agent -f container/Dockerfile .
# Run:   docker run -p 8080:8080 -e ANTHROPIC_API_KEY=sk-... remote-claude-agent

FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration
COPY package.json bun.lock* turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/agent-server/package.json ./services/agent-server/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY services/agent-server/ ./services/agent-server/
COPY tsconfig.json ./

# Build packages
RUN npm run build --workspace=@remote-claude/shared && \
    npm run build --workspace=@remote-claude/agent-server

# Production stage
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash claude && \
    mkdir -p /workspace && \
    chown -R claude:claude /app /workspace

# Copy built application
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/agent-server/dist ./services/agent-server/dist
COPY --from=builder /app/services/agent-server/package.json ./services/agent-server/
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Copy MCP configurations
COPY container/mcps/ ./mcps/

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV WORKING_DIR=/workspace
ENV LOG_LEVEL=info

# Expose WebSocket port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Switch to non-root user
USER claude

# Start the agent server
CMD ["node", "services/agent-server/dist/index.js"]
