/**
 * SSH client wrapper for Remote Claude
 */

import { spawn } from 'child_process';

export interface SSHClientOptions {
  host: string;
  user?: string;
  port?: number;
  keyPath?: string;
  timeout?: number;
}

export interface SSHExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SSHClient {
  private options: SSHClientOptions;

  constructor(options: SSHClientOptions) {
    this.options = {
      user: 'ec2-user',
      port: 22,
      timeout: 30000,
      ...options
    };
  }

  async execute(command: string): Promise<SSHExecResult> {
    return new Promise((resolve) => {
      const args = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', `ConnectTimeout=${Math.floor(this.options.timeout! / 1000)}`,
      ];

      if (this.options.keyPath) {
        args.push('-i', this.options.keyPath);
      }

      if (this.options.port !== 22) {
        args.push('-p', this.options.port!.toString());
      }

      args.push(
        `${this.options.user}@${this.options.host}`,
        command
      );

      const proc = spawn('ssh', args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          exitCode: -1
        });
      });

      // Timeout handling
      setTimeout(() => {
        proc.kill('SIGTERM');
      }, this.options.timeout!);
    });
  }

  async copyFile(localPath: string, remotePath: string): Promise<SSHExecResult> {
    return new Promise((resolve) => {
      const args = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
      ];

      if (this.options.keyPath) {
        args.push('-i', this.options.keyPath);
      }

      if (this.options.port !== 22) {
        args.push('-P', this.options.port!.toString());
      }

      args.push(
        localPath,
        `${this.options.user}@${this.options.host}:${remotePath}`
      );

      const proc = spawn('scp', args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          stdout,
          stderr: err.message,
          exitCode: -1
        });
      });
    });
  }
}