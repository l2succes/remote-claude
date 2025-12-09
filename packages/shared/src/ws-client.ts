/**
 * WebSocket Client for Remote Claude
 *
 * Helper class for CLI to communicate with Agent Server
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type {
  ClientMessage,
  ServerMessage,
  QueryMessage,
  CancelMessage,
  ConfigureMessage,
  ResponseMessage,
  ProgressMessage,
  ErrorMessage,
  CompleteMessage,
  QueryOptions,
  MCPServerConfigMessage,
} from './protocol.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentClientOptions {
  endpoint: string;
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface QueryResult {
  sessionId: string;
  status: 'success' | 'error' | 'cancelled' | 'timeout';
  output: string;
  totalTurns: number;
  tokensUsed: number;
  duration: number;
}

// ============================================================================
// Agent Client
// ============================================================================

export class AgentClient {
  private ws: WebSocket | null = null;
  private options: AgentClientOptions;
  private reconnectAttempts = 0;
  private sessionCallbacks: Map<string, {
    onResponse?: (msg: ResponseMessage) => void;
    onProgress?: (msg: ProgressMessage) => void;
    onError?: (msg: ErrorMessage) => void;
    onComplete?: (msg: CompleteMessage) => void;
  }> = new Map();

  constructor(options: AgentClientOptions) {
    this.options = {
      reconnect: false,
      reconnectInterval: 5000,
      maxReconnectAttempts: 3,
      ...options,
    };
  }

  /**
   * Connect to the agent server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.endpoint);

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.options.onConnect?.();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message: ServerMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        this.options.onDisconnect?.();
        if (this.options.reconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 3)) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.options.reconnectInterval);
        }
      });

      this.ws.on('error', (err) => {
        this.options.onError?.(err);
        reject(err);
      });
    });
  }

  /**
   * Close the connection
   */
  close(): void {
    this.options.reconnect = false; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send a query to the agent server
   */
  query(prompt: string, options?: QueryOptions): string {
    const sessionId = uuidv4();

    const message: QueryMessage = {
      id: uuidv4(),
      type: 'query',
      timestamp: new Date().toISOString(),
      payload: {
        prompt,
        sessionId,
        options,
      },
    };

    this.send(message);
    return sessionId;
  }

  /**
   * Send a query and wait for completion
   */
  async queryAndWait(
    prompt: string,
    options?: QueryOptions & {
      onResponse?: (msg: ResponseMessage) => void;
      onProgress?: (msg: ProgressMessage) => void;
    }
  ): Promise<QueryResult> {
    const sessionId = this.query(prompt, options);

    return new Promise((resolve, reject) => {
      let output = '';
      let lastStatus: 'success' | 'error' | 'cancelled' | 'timeout' = 'success';

      this.sessionCallbacks.set(sessionId, {
        onResponse: (msg) => {
          for (const block of msg.payload.content) {
            if (block.type === 'text' && block.text) {
              output += block.text;
            }
          }
          options?.onResponse?.(msg);
        },
        onProgress: (msg) => {
          options?.onProgress?.(msg);
        },
        onError: (msg) => {
          lastStatus = 'error';
        },
        onComplete: (msg) => {
          this.sessionCallbacks.delete(sessionId);
          resolve({
            sessionId,
            status: msg.payload.status,
            output,
            totalTurns: msg.payload.totalTurns,
            tokensUsed: msg.payload.tokensUsed,
            duration: msg.payload.duration,
          });
        },
      });
    });
  }

  /**
   * Cancel an active session
   */
  cancel(sessionId: string, reason?: string): void {
    const message: CancelMessage = {
      id: uuidv4(),
      type: 'cancel',
      timestamp: new Date().toISOString(),
      payload: {
        sessionId,
        reason,
      },
    };

    this.send(message);
  }

  /**
   * Configure the agent server
   */
  configure(config: {
    anthropicApiKey?: string;
    mcpServers?: Record<string, MCPServerConfigMessage>;
    workingDirectory?: string;
  }): void {
    const message: ConfigureMessage = {
      id: uuidv4(),
      type: 'configure',
      timestamp: new Date().toISOString(),
      payload: config,
    };

    this.send(message);
  }

  /**
   * Send a ping to keep the connection alive
   */
  ping(): void {
    this.send({
      id: uuidv4(),
      type: 'ping',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: ServerMessage): void {
    // Notify global handler
    this.options.onMessage?.(message);

    // Handle session-specific callbacks
    if ('payload' in message && 'sessionId' in (message.payload || {})) {
      const sessionId = (message.payload as any).sessionId;
      const callbacks = this.sessionCallbacks.get(sessionId);

      if (callbacks) {
        switch (message.type) {
          case 'response':
            callbacks.onResponse?.(message as ResponseMessage);
            break;
          case 'progress':
            callbacks.onProgress?.(message as ProgressMessage);
            break;
          case 'error':
            callbacks.onError?.(message as ErrorMessage);
            break;
          case 'complete':
            callbacks.onComplete?.(message as CompleteMessage);
            break;
        }
      }
    }
  }

  /**
   * Send a message to the server
   */
  private send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to agent server');
    }
    this.ws.send(JSON.stringify(message));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Run a single query and return the result
 */
export async function runQuery(
  endpoint: string,
  prompt: string,
  options?: {
    queryOptions?: QueryOptions;
    onProgress?: (msg: ProgressMessage) => void;
    onOutput?: (text: string) => void;
    timeout?: number;
  }
): Promise<QueryResult> {
  const client = new AgentClient({
    endpoint,
    onMessage: (msg) => {
      if (msg.type === 'response') {
        const response = msg as ResponseMessage;
        for (const block of response.payload.content) {
          if (block.type === 'text' && block.text) {
            options?.onOutput?.(block.text);
          }
        }
      }
    },
  });

  await client.connect();

  try {
    const result = await Promise.race([
      client.queryAndWait(prompt, {
        ...options?.queryOptions,
        onProgress: options?.onProgress,
      }),
      new Promise<QueryResult>((_, reject) => {
        if (options?.timeout) {
          setTimeout(() => reject(new Error('Query timeout')), options.timeout);
        }
      }),
    ]);

    return result;
  } finally {
    client.close();
  }
}
