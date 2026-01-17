/**
 * Agent Server - Runs inside containers
 *
 * This is the core server that wraps the Claude Agent SDK
 * and exposes it via WebSocket for remote CLI connections.
 */

import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { AgentExecutor } from './executor';
import { MCPManager } from './mcp-manager';
import { Logger } from './logger';
import { GitService } from './git-service';
import type {
  ClientMessage,
  ServerMessage,
  QueryMessage,
  CancelMessage,
  ConfigureMessage,
  ProgressMessage,
  ErrorMessage,
} from '@remote-claude/shared';

// ============================================================================
// Types
// ============================================================================

interface ServerConfig {
  port: number;
  host: string;
  anthropicApiKey?: string;
  workingDirectory: string;
  healthCheckPath: string;
}

interface ActiveSession {
  id: string;
  executor: AgentExecutor;
  ws: WebSocket;
  startedAt: Date;
  turn: number;
}

// ============================================================================
// Agent Server
// ============================================================================

export class AgentServer {
  private app: express.Application;
  private wss: WebSocketServer;
  private server: ReturnType<typeof createServer>;
  private config: ServerConfig;
  private logger: Logger;
  private mcpManager: MCPManager;
  private sessions: Map<string, ActiveSession> = new Map();
  private supabaseUrl = process.env.SUPABASE_URL;
  private supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      port: parseInt(process.env.PORT || '8080'),
      host: process.env.HOST || '0.0.0.0',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      workingDirectory: process.env.WORKING_DIR || '/workspace',
      healthCheckPath: '/health',
      ...config,
    };

    this.logger = new Logger('AgentServer');
    this.mcpManager = new MCPManager(this.logger);
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupExpress();
    this.setupWebSocket();
  }

  // --------------------------------------------------------------------------
  // Express Setup (Health checks, etc.)
  // --------------------------------------------------------------------------

  private setupExpress(): void {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get(this.config.healthCheckPath, (_req, res) => {
      res.json({
        status: 'healthy',
        version: process.env.npm_package_version || '2.0.0',
        uptime: process.uptime(),
        activeSessions: this.sessions.size,
        timestamp: new Date().toISOString(),
      });
    });

    // Readiness check
    this.app.get('/ready', (_req, res) => {
      const ready = !!this.config.anthropicApiKey;
      res.status(ready ? 200 : 503).json({
        ready,
        reason: ready ? null : 'Missing ANTHROPIC_API_KEY',
      });
    });

    // List active sessions
    this.app.get('/sessions', (_req, res) => {
      const sessions = Array.from(this.sessions.entries()).map(([id, s]) => ({
        id,
        startedAt: s.startedAt,
        turn: s.turn,
      }));
      res.json({ sessions });
    });

    // Clone repository endpoint
    this.app.post('/clone', express.json(), async (req, res) => {
      const { workspaceId, repoUrl, diskPath, githubToken } = req.body;

      if (!workspaceId || !repoUrl || !diskPath || !githubToken) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      try {
        this.logger.info(`Starting clone for workspace ${workspaceId}`);

        // Clone in background and notify via callback
        this.cloneRepository(workspaceId, repoUrl, diskPath, githubToken)
          .catch(err => this.logger.error('Clone failed', err));

        res.json({ status: 'started', workspaceId });
      } catch (error) {
        this.logger.error('Clone request failed', error);
        res.status(500).json({ error: 'Failed to start clone' });
      }
    });
  }

  // --------------------------------------------------------------------------
  // WebSocket Setup
  // --------------------------------------------------------------------------

  private setupWebSocket(): void {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      this.logger.info(`Client connected: ${clientId} from ${req.socket.remoteAddress}`);

      ws.on('message', async (data) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, clientId, message);
        } catch (err) {
          this.logger.error('Failed to parse message', err);
          this.sendError(ws, 'INVALID_REQUEST', 'Invalid message format', true);
        }
      });

      ws.on('close', () => {
        this.logger.info(`Client disconnected: ${clientId}`);
        this.cleanupClientSessions(ws);
      });

      ws.on('error', (err) => {
        this.logger.error(`WebSocket error for ${clientId}`, err);
      });

      // Send initial pong to confirm connection
      this.send(ws, {
        id: uuidv4(),
        type: 'pong',
        timestamp: new Date().toISOString(),
      });
    });
  }

  // --------------------------------------------------------------------------
  // Message Handling
  // --------------------------------------------------------------------------

  private async handleMessage(
    ws: WebSocket,
    clientId: string,
    message: ClientMessage
  ): Promise<void> {
    this.logger.debug(`Received ${message.type} from ${clientId}`);

    switch (message.type) {
      case 'query':
        await this.handleQuery(ws, message as QueryMessage);
        break;

      case 'cancel':
        await this.handleCancel(ws, message as CancelMessage);
        break;

      case 'ping':
        this.send(ws, {
          id: uuidv4(),
          type: 'pong',
          timestamp: new Date().toISOString(),
        });
        break;

      case 'configure':
        await this.handleConfigure(ws, message as ConfigureMessage);
        break;

      default:
        this.sendError(
          ws,
          'INVALID_REQUEST',
          `Unknown message type: ${(message as any).type}`,
          true
        );
    }
  }

  // --------------------------------------------------------------------------
  // Query Handling
  // --------------------------------------------------------------------------

  private async handleQuery(ws: WebSocket, message: QueryMessage): Promise<void> {
    const sessionId = message.payload.sessionId || uuidv4();
    const startTime = Date.now();
    let totalTokens = 0;
    let turn = 0;

    // Send progress: initializing
    this.sendProgress(ws, sessionId, 'initializing', 'Setting up agent...');

    try {
      // Create executor with options
      const executor = new AgentExecutor({
        apiKey: this.config.anthropicApiKey!,
        workingDirectory: this.config.workingDirectory,
        systemPrompt: message.payload.options?.systemPrompt,
        maxTurns: message.payload.options?.maxTurns,
        allowedTools: message.payload.options?.allowedTools,
        disallowedTools: message.payload.options?.disallowedTools,
        permissionMode: message.payload.options?.permissionMode,
        mcpServers: message.payload.options?.mcpServers,
        onProgress: (stage, msg) => this.sendProgress(ws, sessionId, stage, msg, turn),
        onToolUse: (toolId, toolName, input) => {
          this.send(ws, {
            id: uuidv4(),
            type: 'tool_use',
            timestamp: new Date().toISOString(),
            payload: { sessionId, toolId, toolName, input },
          });
        },
        onToolResult: (toolId, toolName, output, isError, duration) => {
          this.send(ws, {
            id: uuidv4(),
            type: 'tool_result',
            timestamp: new Date().toISOString(),
            payload: { sessionId, toolId, toolName, output, isError, duration },
          });
        },
      });

      // Track session
      this.sessions.set(sessionId, {
        id: sessionId,
        executor,
        ws,
        startedAt: new Date(),
        turn: 0,
      });

      // Send progress: loading MCPs
      if (message.payload.options?.mcpServers) {
        this.sendProgress(ws, sessionId, 'loading_mcps', 'Loading MCP servers...');
      }

      // Execute query
      this.sendProgress(ws, sessionId, 'processing', 'Processing query...');

      for await (const response of executor.execute(message.payload.prompt)) {
        turn++;

        const session = this.sessions.get(sessionId);
        if (session) {
          session.turn = turn;
        }

        // Send response chunk
        this.send(ws, {
          id: uuidv4(),
          type: 'response',
          timestamp: new Date().toISOString(),
          payload: {
            sessionId,
            content: response.content,
            turn,
            done: response.done,
          },
        });

        if (response.tokensUsed) {
          totalTokens += response.tokensUsed;
        }
      }

      // Send completion
      const duration = Date.now() - startTime;
      this.send(ws, {
        id: uuidv4(),
        type: 'complete',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId,
          status: 'success',
          totalTurns: turn,
          tokensUsed: totalTokens,
          duration,
        },
      });
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Query failed for session ${sessionId}`, error);

      const errorCode = this.mapErrorCode(error);
      this.send(ws, {
        id: uuidv4(),
        type: 'error',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId,
          code: errorCode,
          message: error.message,
          recoverable: errorCode !== 'AUTHENTICATION_ERROR',
        },
      });

      // Send completion with error status
      this.send(ws, {
        id: uuidv4(),
        type: 'complete',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId,
          status: 'error',
          totalTurns: turn,
          tokensUsed: totalTokens,
          duration: Date.now() - startTime,
        },
      });
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  // --------------------------------------------------------------------------
  // Cancel Handling
  // --------------------------------------------------------------------------

  private async handleCancel(ws: WebSocket, message: CancelMessage): Promise<void> {
    const session = this.sessions.get(message.payload.sessionId);

    if (!session) {
      this.sendError(
        ws,
        'INVALID_REQUEST',
        'Session not found',
        true,
        message.payload.sessionId
      );
      return;
    }

    try {
      await session.executor.cancel();

      this.send(ws, {
        id: uuidv4(),
        type: 'complete',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: message.payload.sessionId,
          status: 'cancelled',
          totalTurns: session.turn,
          tokensUsed: 0,
          duration: Date.now() - session.startedAt.getTime(),
        },
      });
    } catch (err) {
      this.logger.error('Failed to cancel session', err);
    } finally {
      this.sessions.delete(message.payload.sessionId);
    }
  }

  // --------------------------------------------------------------------------
  // Configure Handling
  // --------------------------------------------------------------------------

  private async handleConfigure(ws: WebSocket, message: ConfigureMessage): Promise<void> {
    const { anthropicApiKey, mcpServers, workingDirectory } = message.payload;

    if (anthropicApiKey) {
      this.config.anthropicApiKey = anthropicApiKey;
    }

    if (workingDirectory) {
      this.config.workingDirectory = workingDirectory;
    }

    if (mcpServers) {
      await this.mcpManager.configure(mcpServers);
    }

    this.send(ws, {
      id: uuidv4(),
      type: 'configured',
      timestamp: new Date().toISOString(),
      payload: {
        success: true,
        activeMcpServers: this.mcpManager.getActiveServers(),
        workingDirectory: this.config.workingDirectory,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendProgress(
    ws: WebSocket,
    sessionId: string,
    stage: ProgressMessage['payload']['stage'],
    message: string,
    turn?: number
  ): void {
    this.send(ws, {
      id: uuidv4(),
      type: 'progress',
      timestamp: new Date().toISOString(),
      payload: { sessionId, stage, message, turn },
    });
  }

  private sendError(
    ws: WebSocket,
    code: ErrorMessage['payload']['code'],
    message: string,
    recoverable: boolean,
    sessionId?: string
  ): void {
    this.send(ws, {
      id: uuidv4(),
      type: 'error',
      timestamp: new Date().toISOString(),
      payload: { sessionId, code, message, recoverable },
    });
  }

  private mapErrorCode(error: Error): ErrorMessage['payload']['code'] {
    const message = error.message.toLowerCase();

    if (message.includes('authentication') || message.includes('api key')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (message.includes('rate limit')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (message.includes('context') || message.includes('token')) {
      return 'CONTEXT_OVERFLOW';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (message.includes('mcp')) {
      return 'MCP_ERROR';
    }
    if (message.includes('tool')) {
      return 'TOOL_ERROR';
    }
    return 'INTERNAL_ERROR';
  }

  private cleanupClientSessions(ws: WebSocket): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.ws === ws) {
        session.executor.cancel().catch(() => {});
        this.sessions.delete(sessionId);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Repository Cloning
  // --------------------------------------------------------------------------

  private async cloneRepository(
    workspaceId: string,
    repoUrl: string,
    diskPath: string,
    githubToken: string
  ): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    const gitService = new GitService();

    // Update to 'cloning'
    await supabase
      .from('workspaces')
      .update({ clone_status: 'cloning' })
      .eq('id', workspaceId);

    try {
      await gitService.cloneRepository(repoUrl, diskPath, githubToken);
      this.logger.info(`Clone completed for workspace ${workspaceId}`);

      // Update to 'ready'
      await supabase
        .from('workspaces')
        .update({ clone_status: 'ready' })
        .eq('id', workspaceId);
    } catch (error) {
      this.logger.error(`Clone failed for workspace ${workspaceId}`, error);

      // Update to 'error'
      await supabase
        .from('workspaces')
        .update({ clone_status: 'error' })
        .eq('id', workspaceId);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Server Lifecycle
  // --------------------------------------------------------------------------

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info(
          `Agent server listening on ${this.config.host}:${this.config.port}`
        );
        this.logger.info(
          `Health check: http://${this.config.host}:${this.config.port}${this.config.healthCheckPath}`
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Cancel all active sessions
    for (const session of this.sessions.values()) {
      await session.executor.cancel().catch(() => {});
    }
    this.sessions.clear();

    // Stop MCP servers
    await this.mcpManager.stopAll();

    // Close WebSocket server
    this.wss.close();

    // Close HTTP server
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info('Agent server stopped');
        resolve();
      });
    });
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const server = new AgentServer();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.start();
}

// Run if this is the main module
main().catch((err) => {
  console.error('Failed to start agent server:', err);
  process.exit(1);
});
