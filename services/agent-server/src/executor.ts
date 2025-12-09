/**
 * Agent Executor - Wraps Claude Agent SDK
 *
 * Provides a streaming interface for executing Claude queries
 * with full tool support and MCP integration.
 */

import type {
  ProgressStage,
  ContentBlockMessage,
  MCPServerConfigMessage,
} from '@remote-claude/shared';

// Note: These types match the Claude Agent SDK
// In production, you'd import from @anthropic-ai/claude-agent-sdk
interface ClaudeAgentOptions {
  systemPrompt?: string;
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  mcpServers?: Record<string, MCPServerConfig>;
  cwd?: string;
}

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  is_error?: boolean;
  tool_use_id?: string;
}

// ============================================================================
// Types
// ============================================================================

export interface ExecutorConfig {
  apiKey: string;
  workingDirectory: string;
  systemPrompt?: string;
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  mcpServers?: Record<string, MCPServerConfigMessage>;

  // Callbacks
  onProgress?: (stage: ProgressStage, message: string) => void;
  onToolUse?: (toolId: string, toolName: string, input: Record<string, unknown>) => void;
  onToolResult?: (
    toolId: string,
    toolName: string,
    output: unknown,
    isError: boolean,
    duration?: number
  ) => void;
}

export interface ExecutorResponse {
  content: ContentBlockMessage[];
  done: boolean;
  tokensUsed?: number;
}

// ============================================================================
// Agent Executor
// ============================================================================

export class AgentExecutor {
  private config: ExecutorConfig;
  private cancelled = false;
  private client: any; // ClaudeSDKClient

  constructor(config: ExecutorConfig) {
    this.config = config;
  }

  /**
   * Execute a query and yield responses as they come in
   */
  async *execute(prompt: string): AsyncGenerator<ExecutorResponse> {
    this.cancelled = false;

    // Dynamically import the SDK to handle cases where it might not be installed
    let sdk: any;

    try {
      // Dynamic import to handle SDK not being installed
      sdk = await import('@anthropic-ai/claude-agent-sdk') as Record<string, unknown>;

      console.log('SDK imported, available methods:', Object.keys(sdk || {}));

      // Check if we have the query function
      if (!sdk || typeof sdk.query !== 'function') {
        console.error('SDK structure:', sdk);
        throw new Error(`Could not find query function in SDK. Available: ${Object.keys(sdk || {})}`);
      }

      console.log('Claude Agent SDK loaded successfully');
    } catch (err) {
      // Fallback for development/testing without the SDK installed
      console.warn('Claude Agent SDK import error:', err);
      console.warn('Using mock implementation');
      yield* this.mockExecute(prompt);
      return;
    }

    // Build SDK options
    const options: ClaudeAgentOptions = {
      systemPrompt: this.config.systemPrompt,
      maxTurns: this.config.maxTurns || 50,
      allowedTools: this.config.allowedTools || [
        'Read',
        'Write',
        'Bash',
        'WebSearch',
        'WebFetch',
      ],
      disallowedTools: this.config.disallowedTools,
      permissionMode: this.config.permissionMode || 'acceptEdits',
      cwd: this.config.workingDirectory,
    };

    // Add MCP servers if configured
    if (this.config.mcpServers) {
      options.mcpServers = {};
      for (const [name, server] of Object.entries(this.config.mcpServers)) {
        options.mcpServers[name] = {
          command: server.command,
          args: server.args,
          env: server.env,
        };
      }
    }

    // Set API key in environment
    process.env.ANTHROPIC_API_KEY = this.config.apiKey;

    this.config.onProgress?.('initializing', 'Calling Claude SDK...');

    try {
      this.config.onProgress?.('processing', 'Sending query to Claude...');

      // Use the functional API - query expects an object with prompt and options
      const response = await sdk.query({
        prompt: prompt,
        options: options
      });

      // Check if response is iterable or a single response
      if (response && typeof response[Symbol.asyncIterator] === 'function') {
        // Process streaming responses
        for await (const message of response) {
          if (this.cancelled) {
            break;
          }

          const processedResponse = this.processMessage(message);
          if (processedResponse) {
            yield processedResponse;
          }
        }
      } else if (response) {
        // Process single response
        const processedResponse = this.processMessage(response);
        if (processedResponse) {
          yield processedResponse;
        }
      }
    } finally {
      // Cleanup if needed
      console.log('Query completed');
    }
  }

  /**
   * Process a message from the SDK into our protocol format
   */
  private processMessage(message: any): ExecutorResponse | null {
    // Handle different message types from the SDK
    if (message.type === 'assistant' || message.content) {
      const content: ContentBlockMessage[] = [];
      const rawContent = message.content || [];

      for (const block of rawContent) {
        if (block.type === 'text') {
          content.push({
            type: 'text',
            text: block.text,
          });
        } else if (block.type === 'tool_use') {
          const toolId = block.id || `tool_${Date.now()}`;
          const toolName = block.name || 'unknown';
          const input = block.input || {};

          content.push({
            type: 'tool_use',
            toolId,
            toolName,
            toolInput: input,
          });

          this.config.onToolUse?.(toolId, toolName, input);
        } else if (block.type === 'tool_result') {
          const toolId = block.tool_use_id || `tool_${Date.now()}`;
          const output = block.content;
          const isError = block.is_error || false;

          content.push({
            type: 'tool_result',
            toolId,
            toolOutput: output,
            isError,
          });

          this.config.onToolResult?.(toolId, 'tool', output, isError);
        }
      }

      return {
        content,
        done: message.stop_reason === 'end_turn' || message.done === true,
        tokensUsed: message.usage?.output_tokens,
      };
    }

    // Handle result messages
    if (message.type === 'result') {
      return {
        content: [
          {
            type: 'text',
            text: message.result || message.text || '',
          },
        ],
        done: true,
        tokensUsed: message.total_tokens,
      };
    }

    return null;
  }

  /**
   * Cancel the current execution
   */
  async cancel(): Promise<void> {
    this.cancelled = true;

    if (this.client && typeof this.client.abort === 'function') {
      await this.client.abort();
    }
  }

  /**
   * Mock execution for development/testing
   */
  private async *mockExecute(prompt: string): AsyncGenerator<ExecutorResponse> {
    this.config.onProgress?.('processing', 'Mock execution starting...');

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    yield {
      content: [
        {
          type: 'text',
          text: `[Mock Response]\n\nReceived prompt: "${prompt.substring(0, 100)}..."\n\nThis is a mock response because the Claude Agent SDK is not installed. Install it with:\n\nnpm install @anthropic-ai/claude-agent-sdk`,
        },
      ],
      done: false,
      tokensUsed: 50,
    };

    await new Promise((resolve) => setTimeout(resolve, 300));

    yield {
      content: [
        {
          type: 'text',
          text: '\n\nIn production, this would execute your query using the full Claude Agent SDK with tool support, MCP integration, and streaming responses.',
        },
      ],
      done: true,
      tokensUsed: 30,
    };
  }
}
