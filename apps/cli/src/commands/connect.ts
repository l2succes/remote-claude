/**
 * Connect Command - Connect to an agent server via WebSocket
 *
 * Provides interactive and one-shot query modes for communicating
 * with a remote Claude Agent SDK server.
 */

import { Command } from 'commander';
import { chalk, createSpinner, Spinner } from '@remote-claude/ui';
import { createInterface } from 'readline';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type {
  ServerMessage,
  QueryMessage,
  ResponseMessage,
  ProgressMessage,
  ErrorMessage,
  CompleteMessage,
} from '@remote-claude/shared';

export interface ConnectOptions {
  apiKey?: string;
  systemPrompt?: string;
  permissionMode?: string;
  timeout?: string;
}

/**
 * Interactive connection to an agent server
 */
async function connectCommand(endpoint: string = 'ws://localhost:8080', options: ConnectOptions): Promise<void> {
  const spin = createSpinner('Connecting to agent server...');
  spin.start();

  try {
    const ws = new WebSocket(endpoint);

    await new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(connectTimeout);
        spin.succeed(`Connected to ${endpoint}`);
        resolve();
      });
      ws.on('error', (err) => {
        clearTimeout(connectTimeout);
        spin.fail(`Connection failed: ${err.message}`);
        reject(err);
      });
    });

    // Configure if API key provided
    if (options.apiKey) {
      ws.send(JSON.stringify({
        id: uuidv4(),
        type: 'configure',
        timestamp: new Date().toISOString(),
        payload: {
          anthropicApiKey: options.apiKey,
        },
      }));
    }

    // Set up message handling
    ws.on('message', (data) => {
      const message: ServerMessage = JSON.parse(data.toString());
      handleServerMessage(message);
    });

    ws.on('close', () => {
      console.log(chalk.yellow('\nDisconnected from server'));
      process.exit(0);
    });

    // Interactive prompt
    console.log(chalk.cyan('\nEnter your prompts (Ctrl+C to exit):\n'));

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green('> '),
    });

    rl.prompt();

    rl.on('line', (line) => {
      const prompt = line.trim();
      if (!prompt) {
        rl.prompt();
        return;
      }

      // Send query
      const query: QueryMessage = {
        id: uuidv4(),
        type: 'query',
        timestamp: new Date().toISOString(),
        payload: {
          prompt,
          options: {
            systemPrompt: options.systemPrompt,
            permissionMode: (options.permissionMode as any) || 'acceptEdits',
          },
        },
      };

      ws.send(JSON.stringify(query));
    });

    rl.on('close', () => {
      ws.close();
      process.exit(0);
    });

  } catch (err) {
    spin.fail(`Failed to connect: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Handle messages from the agent server
 */
function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'response': {
      const response = message as ResponseMessage;
      for (const block of response.payload.content) {
        if (block.type === 'text' && block.text) {
          console.log(block.text);
        } else if (block.type === 'tool_use') {
          console.log(chalk.blue(`\n🔧 Using tool: ${block.toolName}`));
          if (block.toolInput) {
            console.log(chalk.gray(JSON.stringify(block.toolInput, null, 2)));
          }
        } else if (block.type === 'tool_result') {
          if (block.isError) {
            console.log(chalk.red(`❌ Tool error: ${JSON.stringify(block.toolOutput)}`));
          } else {
            console.log(chalk.green(`✓ Tool result received`));
          }
        }
      }
      break;
    }

    case 'progress': {
      const progress = message as ProgressMessage;
      console.log(chalk.gray(`[${progress.payload.stage}] ${progress.payload.message}`));
      break;
    }

    case 'error': {
      const error = message as ErrorMessage;
      console.log(chalk.red(`\n❌ Error [${error.payload.code}]: ${error.payload.message}`));
      break;
    }

    case 'complete': {
      const complete = message as CompleteMessage;
      console.log(chalk.cyan(`\n✓ Complete (${complete.payload.status})`));
      console.log(chalk.gray(`  Turns: ${complete.payload.totalTurns}`));
      console.log(chalk.gray(`  Tokens: ${complete.payload.tokensUsed}`));
      console.log(chalk.gray(`  Duration: ${(complete.payload.duration / 1000).toFixed(1)}s`));
      console.log(); // Add newline before next prompt
      break;
    }

    case 'tool_use': {
      const tool = (message as any).payload;
      console.log(chalk.blue(`\n🔧 ${tool.toolName}`));
      break;
    }

    case 'tool_result': {
      const result = (message as any).payload;
      if (result.isError) {
        console.log(chalk.red(`   ❌ Failed`));
      } else {
        console.log(chalk.green(`   ✓ Done (${result.duration}ms)`));
      }
      break;
    }

    case 'pong':
      // Ignore pongs
      break;

    default:
      // Unknown message type
      break;
  }
}

/**
 * Create the connect command
 */
export function createConnectCommand(): Command {
  const command = new Command('connect');

  return command
    .description('Connect to an agent server for interactive session')
    .argument('[endpoint]', 'WebSocket endpoint (default: ws://localhost:8080)', 'ws://localhost:8080')
    .option('-k, --api-key <key>', 'Anthropic API key')
    .option('-s, --system-prompt <prompt>', 'System prompt for the session')
    .option('-m, --permission-mode <mode>', 'Permission mode (default, acceptEdits, bypassPermissions)', 'acceptEdits')
    .option('-t, --timeout <seconds>', 'Query timeout in seconds', '300')
    .action(connectCommand);
}

/**
 * One-shot query command
 */
export async function queryCommand(prompt: string, options: ConnectOptions & { endpoint?: string }): Promise<void> {
  const endpoint = options.endpoint || 'ws://localhost:8080';
  const spin = createSpinner('Connecting...');
  spin.start();

  try {
    const ws = new WebSocket(endpoint);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        spin.text('Connected, sending query...');
        resolve();
      });
      ws.on('error', reject);
    });

    // Send query
    const query: QueryMessage = {
      id: uuidv4(),
      type: 'query',
      timestamp: new Date().toISOString(),
      payload: {
        prompt,
        options: {
          systemPrompt: options.systemPrompt,
          permissionMode: (options.permissionMode as any) || 'acceptEdits',
        },
      },
    };

    ws.send(JSON.stringify(query));
    spin.text('Processing...');

    // Wait for completion
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Query timeout'));
      }, parseInt(options.timeout || '300') * 1000);

      ws.on('message', (data) => {
        const message: ServerMessage = JSON.parse(data.toString());

        if (message.type === 'progress') {
          const progress = message as ProgressMessage;
          spin.text(progress.payload.message);
        } else if (message.type === 'response') {
          spin.stop();
          handleServerMessage(message);
        } else if (message.type === 'complete') {
          clearTimeout(timeout);
          handleServerMessage(message);
          ws.close();
          resolve();
        } else if (message.type === 'error') {
          clearTimeout(timeout);
          handleServerMessage(message);
          ws.close();
          reject(new Error((message as ErrorMessage).payload.message));
        } else {
          handleServerMessage(message);
        }
      });
    });

  } catch (err) {
    spin.fail(`Query failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Create the query command
 */
export function createQueryCommand(): Command {
  const command = new Command('query');

  return command
    .description('Send a single query to the agent server')
    .argument('<prompt>', 'The prompt to send')
    .option('-e, --endpoint <url>', 'Agent server endpoint', 'ws://localhost:8080')
    .option('-k, --api-key <key>', 'Anthropic API key')
    .option('-s, --system-prompt <prompt>', 'System prompt')
    .option('-m, --permission-mode <mode>', 'Permission mode', 'acceptEdits')
    .option('-t, --timeout <seconds>', 'Timeout in seconds', '300')
    .action(queryCommand);
}
