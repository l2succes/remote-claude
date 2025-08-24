import { Sandbox } from '@e2b/sdk';
import { Logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface VibeKitConfig {
  apiKey?: string;
  timeout?: number;
  persistent?: boolean;
}

export interface Session {
  id: string;
  sandboxId: string;
  repository: string;
  status: 'active' | 'paused' | 'terminated';
  startedAt: Date;
  lastActiveAt: Date;
}

export class VibeKitClient extends EventEmitter {
  private sandbox: Sandbox | null = null;
  private logger = new Logger('VibeKitClient');
  private config: VibeKitConfig;

  constructor(config: VibeKitConfig = {}) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.E2B_API_KEY,
      timeout: config.timeout || 60000,
      persistent: config.persistent ?? true,
    };
  }

  async createSession(repository: string): Promise<Session> {
    try {
      this.logger.info(`Creating sandbox for repository: ${repository}`);

      // Create E2B sandbox
      this.sandbox = await Sandbox.create({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout,
      });

      // Clone repository into sandbox
      const cloneResult = await this.sandbox.process.start({
        cmd: 'git',
        args: ['clone', repository, '/workspace'],
        cwd: '/',
      });

      await cloneResult.wait();

      if (cloneResult.exitCode !== 0) {
        throw new Error(`Failed to clone repository: ${cloneResult.stderr}`);
      }

      this.logger.success(`Repository cloned successfully`);

      // Install dependencies if package.json exists
      const checkPackage = await this.sandbox.process.start({
        cmd: 'test',
        args: ['-f', '/workspace/package.json'],
      });

      await checkPackage.wait();

      if (checkPackage.exitCode === 0) {
        this.logger.info('Installing npm dependencies...');
        const npmInstall = await this.sandbox.process.start({
          cmd: 'npm',
          args: ['install'],
          cwd: '/workspace',
        });
        await npmInstall.wait();
        this.logger.success('Dependencies installed');
      }

      const session: Session = {
        id: `session-${Date.now()}`,
        sandboxId: this.sandbox.id,
        repository,
        status: 'active',
        startedAt: new Date(),
        lastActiveAt: new Date(),
      };

      this.emit('session:created', session);
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw error;
    }
  }

  async executeCommand(command: string, args: string[] = []): Promise<string> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    try {
      const process = await this.sandbox.process.start({
        cmd: command,
        args,
        cwd: '/workspace',
      });

      const result = await process.wait();
      
      this.emit('command:executed', { command, args, exitCode: result.exitCode });
      
      if (result.exitCode !== 0) {
        throw new Error(`Command failed: ${result.stderr}`);
      }

      return result.stdout;
    } catch (error) {
      this.logger.error(`Failed to execute command: ${command}`, error);
      throw error;
    }
  }

  async readFile(path: string): Promise<string> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    try {
      const fullPath = path.startsWith('/') ? path : `/workspace/${path}`;
      const content = await this.sandbox.filesystem.read(fullPath);
      this.emit('file:read', { path: fullPath });
      return content;
    } catch (error) {
      this.logger.error(`Failed to read file: ${path}`, error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    try {
      const fullPath = path.startsWith('/') ? path : `/workspace/${path}`;
      await this.sandbox.filesystem.write(fullPath, content);
      this.emit('file:written', { path: fullPath });
      this.logger.success(`File written: ${fullPath}`);
    } catch (error) {
      this.logger.error(`Failed to write file: ${path}`, error);
      throw error;
    }
  }

  async listFiles(directory: string = '.'): Promise<string[]> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    try {
      const fullPath = directory.startsWith('/') ? directory : `/workspace/${directory}`;
      const files = await this.sandbox.filesystem.list(fullPath);
      return files;
    } catch (error) {
      this.logger.error(`Failed to list files in: ${directory}`, error);
      throw error;
    }
  }

  async getTerminal(): Promise<any> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    // Return terminal interface for interactive use
    return this.sandbox.process;
  }

  async pauseSession(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    // E2B sandboxes can be kept alive
    this.emit('session:paused');
    this.logger.info('Session paused');
  }

  async resumeSession(sandboxId: string): Promise<void> {
    try {
      // Reconnect to existing sandbox
      this.sandbox = await Sandbox.connect(sandboxId, {
        apiKey: this.config.apiKey,
      });
      
      this.emit('session:resumed', { sandboxId });
      this.logger.success('Session resumed');
    } catch (error) {
      this.logger.error('Failed to resume session', error);
      throw error;
    }
  }

  async terminateSession(): Promise<void> {
    if (!this.sandbox) {
      return;
    }

    try {
      await this.sandbox.close();
      this.sandbox = null;
      this.emit('session:terminated');
      this.logger.info('Session terminated');
    } catch (error) {
      this.logger.error('Failed to terminate session', error);
      throw error;
    }
  }

  async keepAlive(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('No active sandbox session');
    }

    try {
      await this.sandbox.keepAlive(300); // Keep alive for 5 more minutes
      this.emit('session:extended');
    } catch (error) {
      this.logger.error('Failed to extend session', error);
      throw error;
    }
  }

  getSandboxId(): string | null {
    return this.sandbox?.id || null;
  }

  isActive(): boolean {
    return this.sandbox !== null;
  }
}