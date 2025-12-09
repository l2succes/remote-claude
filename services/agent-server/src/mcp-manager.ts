/**
 * MCP Manager - Manages Model Context Protocol server lifecycle
 */

import { spawn, ChildProcess } from 'child_process';
import type { MCPServerConfigMessage } from '@remote-claude/shared';
import { Logger } from './logger.js';

interface ManagedMCPServer {
  name: string;
  config: MCPServerConfigMessage;
  process?: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

export class MCPManager {
  private logger: Logger;
  private servers: Map<string, ManagedMCPServer> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Configure MCP servers
   */
  async configure(servers: Record<string, MCPServerConfigMessage>): Promise<void> {
    // Stop existing servers
    await this.stopAll();

    // Start new servers
    for (const [name, config] of Object.entries(servers)) {
      await this.startServer(name, config);
    }
  }

  /**
   * Start an MCP server
   */
  async startServer(name: string, config: MCPServerConfigMessage): Promise<void> {
    this.logger.info(`Starting MCP server: ${name}`, { command: config.command });

    const server: ManagedMCPServer = {
      name,
      config,
      status: 'starting',
    };

    try {
      const proc = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      server.process = proc;

      proc.on('spawn', () => {
        server.status = 'running';
        this.logger.info(`MCP server started: ${name}`, { pid: proc.pid });
      });

      proc.on('error', (err) => {
        server.status = 'error';
        this.logger.error(`MCP server error: ${name}`, err);
      });

      proc.on('exit', (code) => {
        server.status = 'stopped';
        this.logger.info(`MCP server exited: ${name}`, { code });
      });

      proc.stderr?.on('data', (data) => {
        this.logger.warn(`MCP server ${name} stderr: ${data.toString()}`);
      });

      this.servers.set(name, server);

      // Wait a bit for the server to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (server.status === 'error') {
        throw new Error(`MCP server ${name} failed to start`);
      }
    } catch (err) {
      server.status = 'error';
      this.servers.set(name, server);
      throw err;
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server || !server.process) {
      return;
    }

    this.logger.info(`Stopping MCP server: ${name}`);

    return new Promise((resolve) => {
      if (!server.process) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        server.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      server.process.on('exit', () => {
        clearTimeout(timeout);
        server.status = 'stopped';
        resolve();
      });

      server.process.kill('SIGTERM');
    });
  }

  /**
   * Stop all MCP servers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map((name) =>
      this.stopServer(name)
    );
    await Promise.all(stopPromises);
    this.servers.clear();
  }

  /**
   * Get active server names
   */
  getActiveServers(): string[] {
    return Array.from(this.servers.entries())
      .filter(([_, server]) => server.status === 'running')
      .map(([name]) => name);
  }

  /**
   * Get server status
   */
  getServerStatus(name: string): ManagedMCPServer['status'] | undefined {
    return this.servers.get(name)?.status;
  }

  /**
   * Get MCP configuration for Claude Agent SDK
   */
  getMCPConfig(): Record<string, MCPServerConfigMessage> {
    const config: Record<string, MCPServerConfigMessage> = {};
    for (const [name, server] of this.servers) {
      if (server.status === 'running') {
        config[name] = server.config;
      }
    }
    return config;
  }
}
