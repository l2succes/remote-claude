# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install required system dependencies
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    python3 \
    make \
    g++ \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create workspace directory
RUN mkdir -p /workspace

# Set environment variables
ENV NODE_ENV=production \
    AGENT_PORT=8080 \
    LOG_LEVEL=info \
    WORKSPACE_ROOT=/workspace

# Expose WebSocket port
EXPOSE 8080

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /workspace

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the agent
CMD ["node", "dist/index.js"]