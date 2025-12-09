/**
 * WebSocket Protocol for Remote Claude
 *
 * Communication between CLI and Agent Server running in containers
 */

// ============================================================================
// Base Message Types
// ============================================================================

export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: string;
}

export type MessageType =
  // Client -> Server
  | 'query'
  | 'cancel'
  | 'ping'
  | 'configure'

  // Server -> Client
  | 'response'
  | 'tool_use'
  | 'tool_result'
  | 'progress'
  | 'error'
  | 'complete'
  | 'pong'
  | 'configured';

// ============================================================================
// Client -> Server Messages
// ============================================================================

export interface QueryMessage extends BaseMessage {
  type: 'query';
  payload: {
    prompt: string;
    sessionId?: string; // For continuing conversations
    options?: QueryOptions;
  };
}

export interface QueryOptions {
  systemPrompt?: string;
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  mcpServers?: Record<string, MCPServerConfigMessage>;
  workingDirectory?: string;
}

export interface MCPServerConfigMessage {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CancelMessage extends BaseMessage {
  type: 'cancel';
  payload: {
    sessionId: string;
    reason?: string;
  };
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface ConfigureMessage extends BaseMessage {
  type: 'configure';
  payload: {
    anthropicApiKey?: string;
    mcpServers?: Record<string, MCPServerConfigMessage>;
    workingDirectory?: string;
  };
}

// ============================================================================
// Server -> Client Messages
// ============================================================================

export interface ResponseMessage extends BaseMessage {
  type: 'response';
  payload: {
    sessionId: string;
    content: ContentBlockMessage[];
    turn: number;
    done: boolean;
  };
}

export interface ContentBlockMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  toolName?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  isError?: boolean;
}

export interface ToolUseMessage extends BaseMessage {
  type: 'tool_use';
  payload: {
    sessionId: string;
    toolId: string;
    toolName: string;
    input: Record<string, unknown>;
  };
}

export interface ToolResultMessage extends BaseMessage {
  type: 'tool_result';
  payload: {
    sessionId: string;
    toolId: string;
    toolName: string;
    output: unknown;
    isError: boolean;
    duration?: number;
  };
}

export interface ProgressMessage extends BaseMessage {
  type: 'progress';
  payload: {
    sessionId: string;
    stage: ProgressStage;
    message: string;
    turn?: number;
    maxTurns?: number;
    tokensUsed?: number;
  };
}

export type ProgressStage =
  | 'initializing'
  | 'loading_mcps'
  | 'processing'
  | 'tool_executing'
  | 'waiting_for_response'
  | 'compacting_context'
  | 'finalizing';

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  payload: {
    sessionId?: string;
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    recoverable: boolean;
  };
}

export type ErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CONTEXT_OVERFLOW'
  | 'TOOL_ERROR'
  | 'MCP_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INTERNAL_ERROR'
  | 'INVALID_REQUEST';

export interface CompleteMessage extends BaseMessage {
  type: 'complete';
  payload: {
    sessionId: string;
    status: 'success' | 'error' | 'cancelled' | 'timeout';
    summary?: string;
    totalTurns: number;
    tokensUsed: number;
    duration: number; // milliseconds
  };
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

export interface ConfiguredMessage extends BaseMessage {
  type: 'configured';
  payload: {
    success: boolean;
    activeMcpServers: string[];
    workingDirectory: string;
  };
}

// ============================================================================
// Union Types
// ============================================================================

export type ClientMessage =
  | QueryMessage
  | CancelMessage
  | PingMessage
  | ConfigureMessage;

export type ServerMessage =
  | ResponseMessage
  | ToolUseMessage
  | ToolResultMessage
  | ProgressMessage
  | ErrorMessage
  | CompleteMessage
  | PongMessage
  | ConfiguredMessage;

export type AnyMessage = ClientMessage | ServerMessage;

// ============================================================================
// Helper Functions
// ============================================================================

export function createMessage<T extends AnyMessage>(
  type: T['type'],
  payload?: T extends { payload: infer P } ? P : never
): T {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    ...(payload !== undefined ? { payload } : {}),
  } as T;
}

export function isClientMessage(msg: AnyMessage): msg is ClientMessage {
  return ['query', 'cancel', 'ping', 'configure'].includes(msg.type);
}

export function isServerMessage(msg: AnyMessage): msg is ServerMessage {
  return ['response', 'tool_use', 'tool_result', 'progress', 'error', 'complete', 'pong', 'configured'].includes(msg.type);
}
