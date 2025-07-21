import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { Task, TaskResult, TaskFilter } from './types';
import chalk from 'chalk';

export interface StorageOptions {
  dataDir?: string | undefined;
  maxTaskHistory?: number | undefined;
  maxResultHistory?: number | undefined;
  autoCleanup?: boolean | undefined;
  cleanupInterval?: number | undefined;
}

export class TaskStorage {
  private dataDir: string;
  private options: Required<StorageOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: StorageOptions = {}) {
    this.options = {
      dataDir: options.dataDir || path.join(os.homedir(), '.rclaude', 'data'),
      maxTaskHistory: options.maxTaskHistory || 1000,
      maxResultHistory: options.maxResultHistory || 100,
      autoCleanup: options.autoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 60 * 60 * 1000, // 1 hour
    };
    
    this.dataDir = this.options.dataDir || path.join(os.homedir(), '.rclaude', 'data');
    this.initialize();
  }

  /**
   * Initialize storage directories
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'tasks'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'results'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'logs'), { recursive: true });
      
      if (this.options.autoCleanup) {
        this.startCleanupTimer();
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize storage:'), (error as Error).message);
    }
  }

  /**
   * Save a task to storage
   */
  async saveTask(task: Task): Promise<void> {
    try {
      const taskFile = path.join(this.dataDir, 'tasks', `${task.id}.json`);
      await fs.writeFile(taskFile, JSON.stringify(task, null, 2), 'utf8');
    } catch (error) {
      console.error(chalk.red('❌ Failed to save task:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Load a task from storage
   */
  async loadTask(taskId: string): Promise<Task | null> {
    try {
      const taskFile = path.join(this.dataDir, 'tasks', `${taskId}.json`);
      const content = await fs.readFile(taskFile, 'utf8');
      const task = JSON.parse(content);
      
      // Convert date strings back to Date objects
      task.createdAt = new Date(task.createdAt);
      task.updatedAt = new Date(task.updatedAt);
      if (task.startedAt) task.startedAt = new Date(task.startedAt);
      if (task.completedAt) task.completedAt = new Date(task.completedAt);
      
      return task;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      console.error(chalk.red('❌ Failed to load task:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Load all tasks from storage
   */
  async loadAllTasks(): Promise<Task[]> {
    try {
      const tasksDir = path.join(this.dataDir, 'tasks');
      const files = await fs.readdir(tasksDir);
      const tasks: Task[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const taskId = file.replace('.json', '');
          const task = await this.loadTask(taskId);
          if (task) {
            tasks.push(task);
          }
        }
      }

      return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error(chalk.red('❌ Failed to load tasks:'), (error as Error).message);
      return [];
    }
  }

  /**
   * Delete a task from storage
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const taskFile = path.join(this.dataDir, 'tasks', `${taskId}.json`);
      await fs.unlink(taskFile);
      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return false;
      }
      console.error(chalk.red('❌ Failed to delete task:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Save task result to storage
   */
  async saveResult(result: TaskResult): Promise<void> {
    try {
      const resultFile = path.join(this.dataDir, 'results', `${result.taskId}.json`);
      await fs.writeFile(resultFile, JSON.stringify(result, null, 2), 'utf8');
    } catch (error) {
      console.error(chalk.red('❌ Failed to save result:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Load task result from storage
   */
  async loadResult(taskId: string): Promise<TaskResult | null> {
    try {
      const resultFile = path.join(this.dataDir, 'results', `${taskId}.json`);
      const content = await fs.readFile(resultFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      console.error(chalk.red('❌ Failed to load result:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Save task logs to storage
   */
  async saveLogs(taskId: string, logs: string[]): Promise<void> {
    try {
      const logFile = path.join(this.dataDir, 'logs', `${taskId}.log`);
      await fs.writeFile(logFile, logs.join('\n'), 'utf8');
    } catch (error) {
      console.error(chalk.red('❌ Failed to save logs:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Load task logs from storage
   */
  async loadLogs(taskId: string): Promise<string[]> {
    try {
      const logFile = path.join(this.dataDir, 'logs', `${taskId}.log`);
      const content = await fs.readFile(logFile, 'utf8');
      return content.split('\n').filter(line => line.trim());
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      console.error(chalk.red('❌ Failed to load logs:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Search tasks by filter criteria
   */
  async searchTasks(filter: TaskFilter): Promise<Task[]> {
    const allTasks = await this.loadAllTasks();
    let results = allTasks;

    // Filter by status
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      results = results.filter(task => statuses.includes(task.status));
    }

    // Filter by priority
    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      results = results.filter(task => priorities.includes(task.priority));
    }

    // Filter by repository
    if (filter.repository) {
      results = results.filter(task => task.repository === filter.repository);
    }

    // Filter by branch
    if (filter.branch) {
      results = results.filter(task => task.branch === filter.branch);
    }

    // Filter by date range
    if (filter.createdAfter) {
      results = results.filter(task => task.createdAt >= filter.createdAfter!);
    }

    if (filter.createdBefore) {
      results = results.filter(task => task.createdAt <= filter.createdBefore!);
    }

    return results;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalTasks: number;
    totalResults: number;
    totalLogs: number;
    diskUsage: number;
  }> {
    try {
      const [tasksCount, resultsCount, logsCount] = await Promise.all([
        this.countFilesInDir(path.join(this.dataDir, 'tasks')),
        this.countFilesInDir(path.join(this.dataDir, 'results')),
        this.countFilesInDir(path.join(this.dataDir, 'logs')),
      ]);

      const diskUsage = await this.calculateDiskUsage(this.dataDir);

      return {
        totalTasks: tasksCount,
        totalResults: resultsCount,
        totalLogs: logsCount,
        diskUsage,
      };
    } catch (error) {
      console.error(chalk.red('❌ Failed to get storage stats:'), (error as Error).message);
      return {
        totalTasks: 0,
        totalResults: 0,
        totalLogs: 0,
        diskUsage: 0,
      };
    }
  }

  /**
   * Cleanup old files
   */
  async cleanup(): Promise<{ tasksRemoved: number; resultsRemoved: number; logsRemoved: number }> {
    const stats = { tasksRemoved: 0, resultsRemoved: 0, logsRemoved: 0 };
    
    try {
      // Cleanup old tasks (keep only the most recent)
      const tasks = await this.loadAllTasks();
      if (tasks.length > (this.options.maxTaskHistory || 1000)) {
        const tasksToRemove = tasks.slice(this.options.maxTaskHistory || 1000);
        for (const task of tasksToRemove) {
          await this.deleteTask(task.id);
          stats.tasksRemoved++;
        }
      }

      // Cleanup old results
      const resultsDir = path.join(this.dataDir, 'results');
      const resultFiles = await fs.readdir(resultsDir);
      if (resultFiles.length > (this.options.maxResultHistory || 100)) {
        const filesToRemove = resultFiles.slice(this.options.maxResultHistory || 100);
        for (const file of filesToRemove) {
          await fs.unlink(path.join(resultsDir, file));
          stats.resultsRemoved++;
        }
      }

      // Cleanup orphaned logs (logs without corresponding tasks)
      const logsDir = path.join(this.dataDir, 'logs');
      const logFiles = await fs.readdir(logsDir);
      const existingTaskIds = new Set(tasks.map(t => t.id));
      
      for (const logFile of logFiles) {
        const taskId = logFile.replace('.log', '');
        if (!existingTaskIds.has(taskId)) {
          await fs.unlink(path.join(logsDir, logFile));
          stats.logsRemoved++;
        }
      }

      if (stats.tasksRemoved > 0 || stats.resultsRemoved > 0 || stats.logsRemoved > 0) {
        console.log(chalk.gray(`🧹 Storage cleanup completed: ${stats.tasksRemoved} tasks, ${stats.resultsRemoved} results, ${stats.logsRemoved} logs removed`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Storage cleanup failed:'), (error as Error).message);
    }

    return stats;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined as any;
    }
  }

  /**
   * Count files in a directory
   */
  private async countFilesInDir(dir: string): Promise<number> {
    try {
      const files = await fs.readdir(dir);
      return files.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate disk usage of a directory
   */
  private async calculateDiskUsage(dir: string): Promise<number> {
    try {
      let totalSize = 0;
      const calculateSize = async (currentDir: string): Promise<void> => {
        const items = await fs.readdir(currentDir);
        for (const item of items) {
          const itemPath = path.join(currentDir, item);
          const stats = await fs.stat(itemPath);
          if (stats.isDirectory()) {
            await calculateSize(itemPath);
          } else {
            totalSize += stats.size;
          }
        }
      };
      
      await calculateSize(dir);
      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}