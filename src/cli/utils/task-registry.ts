import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  repository: string;
  branch?: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  runCount: number;
  tags?: string[];
  metadata?: Record<string, any>;
  // Default options for this task
  defaultOptions?: {
    branch?: string;
    timeout?: number;
    priority?: string;
    machineType?: string;
    provider?: string;
    ec2InstanceType?: string;
    ec2Region?: string;
    idleTimeout?: number;
    autoCommit?: boolean;
    pullRequest?: boolean;
    outputFiles?: string[];
    notifyOnComplete?: boolean;
    notifyOnFail?: boolean;
  };
}

export class TaskRegistry {
  private registryPath: string;
  private tasks: Map<string, TaskDefinition> = new Map();

  constructor(customPath?: string) {
    this.registryPath = customPath || path.join(os.homedir(), '.rclaude', 'tasks.json');
    this.loadTasks();
  }

  /**
   * Load tasks from the registry file
   */
  private loadTasks(): void {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = fs.readFileSync(this.registryPath, 'utf-8');
        const tasksArray = JSON.parse(data, (key, value) => {
          // Parse dates
          if (key === 'createdAt' || key === 'updatedAt' || key === 'lastRunAt') {
            return value ? new Date(value) : undefined;
          }
          return value;
        });
        
        tasksArray.forEach((task: TaskDefinition) => {
          this.tasks.set(task.id, task);
        });
      }
    } catch (error) {
      console.error(chalk.yellow('⚠️  Warning: Could not load task registry:'), (error as Error).message);
    }
  }

  /**
   * Save tasks to the registry file
   */
  private saveTasks(): void {
    try {
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tasksArray = Array.from(this.tasks.values());
      fs.writeFileSync(this.registryPath, JSON.stringify(tasksArray, null, 2));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save task registry:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Create a new task definition
   */
  createTask(params: {
    id: string;
    name: string;
    description: string;
    repository: string;
    branch?: string;
    tags?: string[];
    defaultOptions?: TaskDefinition['defaultOptions'];
    metadata?: Record<string, any>;
  }): TaskDefinition {
    const task: TaskDefinition = {
      id: params.id,
      name: params.name,
      description: params.description,
      repository: params.repository,
      ...(params.branch && { branch: params.branch }),
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0,
      ...(params.tags && { tags: params.tags }),
      ...(params.defaultOptions && { defaultOptions: params.defaultOptions }),
      ...(params.metadata && { metadata: params.metadata }),
    };

    this.tasks.set(task.id, task);
    this.saveTasks();
    
    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): TaskDefinition | null {
    return this.tasks.get(id) || null;
  }

  /**
   * Update a task definition
   */
  updateTask(id: string, updates: Partial<Omit<TaskDefinition, 'id' | 'createdAt'>>): TaskDefinition | null {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updatedTask);
    this.saveTasks();
    
    return updatedTask;
  }

  /**
   * Record a task run
   */
  recordRun(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.lastRunAt = new Date();
      task.runCount = (task.runCount || 0) + 1;
      task.updatedAt = new Date();
      this.tasks.set(id, task);
      this.saveTasks();
    }
  }

  /**
   * Delete a task definition
   */
  deleteTask(id: string): boolean {
    const deleted = this.tasks.delete(id);
    if (deleted) {
      this.saveTasks();
    }
    return deleted;
  }

  /**
   * List all tasks with optional filtering
   */
  listTasks(filter?: {
    repository?: string;
    tags?: string[];
    search?: string;
  }): TaskDefinition[] {
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.repository) {
        tasks = tasks.filter(t => t.repository === filter.repository);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        tasks = tasks.filter(t => 
          t.tags && filter.tags!.some(tag => t.tags!.includes(tag))
        );
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        tasks = tasks.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.id.toLowerCase().includes(searchLower) ||
          (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchLower)))
        );
      }
    }

    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Check if a task ID exists
   */
  hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Get recently used tasks
   */
  getRecentTasks(limit: number = 10): TaskDefinition[] {
    return Array.from(this.tasks.values())
      .filter(t => t.lastRunAt)
      .sort((a, b) => (b.lastRunAt?.getTime() || 0) - (a.lastRunAt?.getTime() || 0))
      .slice(0, limit);
  }

  /**
   * Get most frequently used tasks
   */
  getFrequentTasks(limit: number = 10): TaskDefinition[] {
    return Array.from(this.tasks.values())
      .filter(t => t.runCount > 0)
      .sort((a, b) => b.runCount - a.runCount)
      .slice(0, limit);
  }

  /**
   * Export tasks to a JSON file
   */
  async exportTasks(filePath: string, taskIds?: string[]): Promise<number> {
    try {
      let tasksToExport = Array.from(this.tasks.values());
      
      if (taskIds && taskIds.length > 0) {
        tasksToExport = tasksToExport.filter(t => taskIds.includes(t.id));
      }
      
      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(tasksToExport, null, 2));
      return tasksToExport.length;
    } catch (error) {
      throw new Error(`Failed to export tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Import tasks from a JSON file
   */
  async importTasks(filePath: string): Promise<number> {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(filePath, 'utf-8');
      const importedTasks = JSON.parse(data);
      
      let count = 0;
      for (const task of importedTasks) {
        // Generate new ID to avoid conflicts
        const newTask = {
          ...task,
          id: uuidv4().split('-')[0],
          createdAt: new Date(task.createdAt || Date.now()),
          updatedAt: new Date(),
        };
        
        this.tasks.set(newTask.id, newTask);
        count++;
      }
      
      this.saveTasks();
      return count;
    } catch (error) {
      throw new Error(`Failed to import tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Get statistics about the task registry
   */
  getStats(): {
    totalTasks: number;
    tasksByRepository: Record<string, number>;
    tasksByTag: Record<string, number>;
    mostUsedTask?: TaskDefinition;
    leastUsedTask?: TaskDefinition;
  } {
    const tasks = Array.from(this.tasks.values());
    const tasksByRepository: Record<string, number> = {};
    const tasksByTag: Record<string, number> = {};
    
    tasks.forEach(task => {
      // Count by repository
      tasksByRepository[task.repository] = (tasksByRepository[task.repository] || 0) + 1;
      
      // Count by tags
      if (task.tags) {
        task.tags.forEach(tag => {
          tasksByTag[tag] = (tasksByTag[tag] || 0) + 1;
        });
      }
    });
    
    const sortedByUsage = tasks.sort((a, b) => (b.runCount || 0) - (a.runCount || 0));
    
    const result: {
      totalTasks: number;
      tasksByRepository: Record<string, number>;
      tasksByTag: Record<string, number>;
      mostUsedTask?: TaskDefinition;
      leastUsedTask?: TaskDefinition;
    } = {
      totalTasks: tasks.length,
      tasksByRepository,
      tasksByTag,
    };
    
    if (sortedByUsage.length > 0) {
      const first = sortedByUsage[0];
      const last = sortedByUsage[sortedByUsage.length - 1];
      if (first) result.mostUsedTask = first;
      if (last) result.leastUsedTask = last;
    }
    
    return result;
  }
}