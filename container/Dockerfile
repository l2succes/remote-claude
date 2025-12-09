# Remote Claude Agent Container
#
# This container runs the Claude Agent SDK server for remote execution.
# Build: docker build -t remote-claude-agent -f container/Dockerfile .
# Run:   docker run -p 8080:8080 -e ANTHROPIC_API_KEY=sk-... remote-claude-agent

FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies and bun
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Copy all workspace files for bun workspaces
COPY package.json bun.lock* ./
COPY packages/ ./packages/
COPY services/ ./services/
COPY apps/ ./apps/
COPY tsconfig.json ./

# Install dependencies with bun
RUN bun install --frozen-lockfile

# Build only what we need
RUN cd packages/shared && bun run build && \
    cd ../.. && \
    cd services/agent-server && bun run build

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
