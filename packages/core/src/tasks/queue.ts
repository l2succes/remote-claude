import { EventEmitter } from 'events';
import { Task, TaskStatus, TaskPriority, QueueOptions, TaskFilter } from './types';
import chalk from 'chalk';

export class TaskQueue extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private runningTasks: Set<string> = new Set();
  private options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    super();
    this.options = {
      maxConcurrent: options.maxConcurrent || 3,
      priorityWeights: options.priorityWeights || {
        urgent: 4,
        high: 3,
        normal: 2,
        low: 1,
      },
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 5000,
      timeoutDefault: options.timeoutDefault || 7200,
    };
  }

  /**
   * Add a task to the queue
   */
  add(task: Task): void {
    // Set default values
    task.status = 'queued';
    task.createdAt = new Date();
    task.updatedAt = new Date();
    task.timeout = task.timeout || this.options.timeoutDefault;

    this.tasks.set(task.id, task);
    this.emit('task:added', task);
    
    console.log(chalk.blue('📝 Task added to queue:'), task.name, chalk.gray(`(${task.id})`));
    
    // Try to process the queue
    this.processQueue();
  }

  /**
   * Get a task by ID
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Update a task
   */
  update(taskId: string, updates: Partial<Task>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    Object.assign(task, updates, { updatedAt: new Date() });
    this.emit('task:updated', task);
    
    return true;
  }

  /**
   * Remove a task from the queue
   */
  remove(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    this.tasks.delete(taskId);
    this.runningTasks.delete(taskId);
    this.emit('task:removed', task);
    
    return true;
  }

  /**
   * Get all tasks matching filter criteria
   */
  list(filter: TaskFilter = {}): Task[] {
    let results = Array.from(this.tasks.values());

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
   * Get queue statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    running: number;
    queued: number;
  } {
    const tasks = Array.from(this.tasks.values());
    
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      timeout: 0,
    };

    const byPriority: Record<TaskPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
    };

    tasks.forEach(task => {
      byStatus[task.status]++;
      byPriority[task.priority]++;
    });

    return {
      total: tasks.length,
      byStatus,
      byPriority,
      running: this.runningTasks.size,
      queued: byStatus.queued,
    };
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'running') {
      this.emit('task:cancel:requested', task);
    }

    task.status = 'cancelled';
    task.updatedAt = new Date();
    task.completedAt = new Date();
    
    this.runningTasks.delete(taskId);
    this.emit('task:cancelled', task);
    
    console.log(chalk.yellow('🛑 Task cancelled:'), task.name, chalk.gray(`(${task.id})`));
    
    // Process queue to start next tasks
    this.processQueue();
    
    return true;
  }

  /**
   * Clear completed or failed tasks
   */
  cleanup(olderThan?: Date): number {
    const tasks = Array.from(this.tasks.values());
    const cutoff = olderThan || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    let removed = 0;
    tasks.forEach(task => {
      if (
        ['completed', 'failed', 'cancelled'].includes(task.status) &&
        task.updatedAt < cutoff
      ) {
        this.tasks.delete(task.id);
        removed++;
      }
    });

    if (removed > 0) {
      console.log(chalk.gray(`🧹 Cleaned up ${removed} old tasks`));
      this.emit('queue:cleaned', { removed, cutoff });
    }

    return removed;
  }

  /**
   * Process the queue and start new tasks
   */
  private processQueue(): void {
    // Don't start new tasks if we're at max capacity
    if (this.runningTasks.size >= (this.options.maxConcurrent || 3)) {
      return;
    }

    // Get queued tasks sorted by priority
    const queuedTasks = this.list({ status: 'queued' })
      .sort((a, b) => {
        // Sort by priority weight (higher first), then by creation time (older first)
        const priorityDiff = (this.options.priorityWeights?.[b.priority] || 0) - (this.options.priorityWeights?.[a.priority] || 0);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    // Start as many tasks as we can
    const tasksToStart = Math.min(
      queuedTasks.length,
      (this.options.maxConcurrent || 3) - this.runningTasks.size
    );

    for (let i = 0; i < tasksToStart; i++) {
      const task = queuedTasks[i];
      if (task) {
        this.startTask(task);
      }
    }
  }

  /**
   * Start executing a task
   */
  private startTask(task: Task): void {
    task.status = 'running';
    task.startedAt = new Date();
    task.updatedAt = new Date();
    
    this.runningTasks.add(task.id);
    this.emit('task:started', task);
    
    console.log(chalk.green('▶️  Starting task:'), task.name, chalk.gray(`(${task.id})`));

    // Set up timeout if configured
    if (task.timeout && task.timeout > 0) {
      setTimeout(() => {
        if (this.runningTasks.has(task.id)) {
          this.timeoutTask(task.id);
        }
      }, task.timeout * 1000);
    }
  }

  /**
   * Mark a task as completed
   */
  complete(taskId: string, success: boolean = true): boolean {
    const task = this.tasks.get(taskId);
    if (!task || !this.runningTasks.has(taskId)) {
      return false;
    }

    task.status = success ? 'completed' : 'failed';
    task.completedAt = new Date();
    task.updatedAt = new Date();
    
    // Calculate actual duration
    if (task.startedAt && task.metadata) {
      task.metadata.actualDuration = Math.round(
        (task.completedAt.getTime() - task.startedAt.getTime()) / 1000
      );
    }

    this.runningTasks.delete(taskId);
    this.emit(success ? 'task:completed' : 'task:failed', task);
    
    const emoji = success ? '✅' : '❌';
    const status = success ? 'completed' : 'failed';
    console.log(chalk.green(`${emoji} Task ${status}:`), task.name, chalk.gray(`(${task.id})`));
    
    // Process queue to start next tasks
    this.processQueue();
    
    return true;
  }

  /**
   * Mark a task as timed out
   */
  private timeoutTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !this.runningTasks.has(taskId)) {
      return;
    }

    task.status = 'timeout';
    task.completedAt = new Date();
    task.updatedAt = new Date();
    
    this.runningTasks.delete(taskId);
    this.emit('task:timeout', task);
    
    console.log(chalk.red('⏰ Task timed out:'), task.name, chalk.gray(`(${task.id})`));
    
    // Process queue to start next tasks
    this.processQueue();
  }

  /**
   * Get the next task that would be executed
   */
  getNextTask(): Task | undefined {
    const queuedTasks = this.list({ status: 'queued' })
      .sort((a, b) => {
        const priorityDiff = (this.options.priorityWeights?.[b.priority] || 0) - (this.options.priorityWeights?.[a.priority] || 0);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    return queuedTasks[0];
  }

  /**
   * Check if the queue can accept more tasks
   */
  canAcceptTasks(): boolean {
    return this.runningTasks.size < (this.options.maxConcurrent || 3);
  }

  /**
   * Get current queue options
   */
  getOptions(): Required<QueueOptions> {
    return { ...this.options };
  }

  /**
   * Update queue options
   */
  updateOptions(options: Partial<QueueOptions>): void {
    Object.assign(this.options, options);
    this.emit('queue:options:updated', this.options);
    
    // Process queue in case maxConcurrent was increased
    this.processQueue();
  }
}