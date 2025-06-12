import { EventEmitter } from 'events';
import { Task, TaskStatus, TaskPriority, TaskResult, TaskFilter, TaskUpdate } from './types';
import { TaskQueue } from './queue';
import { TaskStorage } from './storage';
import { CodespaceManager } from '../codespace/manager';
import { WebhookServer } from '../webhook/server';
import { NotificationManager } from '../notifications/manager';
import { NotificationConfig, NotificationPayload } from '../notifications/types';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

export interface TaskManagerOptions {
  token: string;
  webhookPort?: number | undefined;
  webhookHost?: string | undefined;
  maxConcurrentTasks?: number | undefined;
  dataDir?: string | undefined;
  autoStart?: boolean | undefined;
  notifications?: NotificationConfig | undefined;
}

export interface CreateTaskOptions {
  name: string;
  command: string;
  repository: string;
  branch?: string | undefined;
  priority?: TaskPriority | undefined;
  timeout?: number | undefined;
  autoCommit?: boolean | undefined;
  pullRequest?: boolean | undefined;
  outputFiles?: string[] | undefined;
  notifications?: {
    channels?: string[] | undefined;
    onStart?: boolean | undefined;
    onComplete?: boolean | undefined;
    onFail?: boolean | undefined;
  } | undefined;
}

export class TaskManager extends EventEmitter {
  private queue: TaskQueue;
  private storage: TaskStorage;
  private codespaceManager: CodespaceManager;
  private webhookServer: WebhookServer;
  private notificationManager?: NotificationManager;
  private isRunning: boolean = false;
  private options: TaskManagerOptions;

  constructor(options: TaskManagerOptions) {
    super();
    this.options = options;

    // Initialize components
    this.queue = new TaskQueue({
      maxConcurrent: options.maxConcurrentTasks || 3,
    });

    this.storage = new TaskStorage({
      dataDir: options.dataDir,
    });

    this.webhookServer = new WebhookServer({
      port: options.webhookPort || 3000,
      host: options.webhookHost || 'localhost',
    });

    this.codespaceManager = new CodespaceManager({
      token: options.token,
      webhookUrl: this.webhookServer.getUrl(),
    });

    // Initialize notification manager if config provided
    if (options.notifications && options.notifications.enabled) {
      this.notificationManager = new NotificationManager({
        config: options.notifications,
      });
    }

    this.setupEventHandlers();

    if (options.autoStart !== false) {
      this.start();
    }
  }

  /**
   * Set up event handlers between components
   */
  private setupEventHandlers(): void {
    // Queue events
    this.queue.on('task:started', this.handleTaskStarted.bind(this));
    this.queue.on('task:completed', this.handleTaskCompleted.bind(this));
    this.queue.on('task:failed', this.handleTaskFailed.bind(this));
    this.queue.on('task:cancelled', this.handleTaskCancelled.bind(this));
    this.queue.on('task:timeout', this.handleTaskTimeout.bind(this));

    // Webhook events
    this.webhookServer.on('webhook:received', this.handleWebhookUpdate.bind(this));

    // Codespace events
    this.codespaceManager.on('codespace:created', this.handleCodespaceCreated.bind(this));
    this.codespaceManager.on('task:completed', this.handleCodespaceTaskCompleted.bind(this));
    this.codespaceManager.on('task:failed', this.handleCodespaceTaskFailed.bind(this));
  }

  /**
   * Start the task manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      await this.webhookServer.start();
      await this.loadPersistedTasks();
      this.isRunning = true;
      
      console.log(chalk.green('✅ Task Manager started'));
      this.emit('manager:started');
    } catch (error) {
      console.error(chalk.red('❌ Failed to start Task Manager:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Stop the task manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.webhookServer.stop();
      this.storage.stop();
      this.notificationManager?.stop();
      this.isRunning = false;
      
      console.log(chalk.yellow('⏹️  Task Manager stopped'));
      this.emit('manager:stopped');
    } catch (error) {
      console.error(chalk.red('❌ Failed to stop Task Manager:'), (error as Error).message);
    }
  }

  /**
   * Create and queue a new task
   */
  async createTask(options: CreateTaskOptions): Promise<string> {
    const taskId = uuidv4().split('-')[0] || uuidv4().substring(0, 8);
    
    const task: Task = {
      id: taskId,
      name: options.name,
      command: options.command,
      status: 'pending',
      priority: options.priority || 'normal',
      repository: options.repository,
      branch: options.branch,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeout: options.timeout,
      autoCommit: options.autoCommit,
      pullRequest: options.pullRequest,
      outputFiles: options.outputFiles,
      notifications: options.notifications,
      metadata: {
        webhookUrl: this.webhookServer.getWebhookUrl(taskId),
      },
    };

    // Save to storage
    await this.storage.saveTask(task);
    
    // Add to queue
    this.queue.add(task);
    
    console.log(chalk.blue('📝 Task created:'), task.name, chalk.gray(`(${taskId})`));
    this.emit('task:created', task);
    
    return taskId;
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    // Try queue first (for active tasks)
    const queueTask = this.queue.get(taskId);
    if (queueTask) {
      return queueTask;
    }

    // Fall back to storage
    return await this.storage.loadTask(taskId);
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(filter: TaskFilter = {}): Promise<Task[]> {
    // Get active tasks from queue
    const activeTasks = this.queue.list(filter);
    
    // Get historical tasks from storage
    const storedTasks = await this.storage.searchTasks(filter);
    
    // Merge and deduplicate
    const taskMap = new Map<string, Task>();
    
    // Add stored tasks first
    storedTasks.forEach(task => taskMap.set(task.id, task));
    
    // Override with active tasks (more up-to-date)
    activeTasks.forEach(task => taskMap.set(task.id, task));
    
    return Array.from(taskMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, update: TaskUpdate): Promise<boolean> {
    // Update in queue if active
    const updated = this.queue.update(taskId, update as Partial<Task>);
    
    // Get updated task and save to storage
    const task = await this.getTask(taskId);
    if (task) {
      await this.storage.saveTask(task);
      this.emit('task:updated', task);
      return true;
    }
    
    return updated;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'running') {
      // Request cancellation from codespace manager
      this.emit('task:cancel:requested', task);
    }

    const cancelled = this.queue.cancel(taskId);
    if (cancelled) {
      await this.storage.saveTask(task);
    }
    
    return cancelled;
  }

  /**
   * Get task result
   */
  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    return await this.storage.loadResult(taskId);
  }

  /**
   * Get task logs
   */
  async getTaskLogs(taskId: string): Promise<string[]> {
    return await this.storage.loadLogs(taskId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queue.getStats();
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return await this.storage.getStats();
  }

  /**
   * Cleanup old tasks and files
   */
  async cleanup(): Promise<void> {
    const queueCleanup = this.queue.cleanup();
    const storageCleanup = await this.storage.cleanup();
    
    console.log(chalk.gray(`🧹 Cleanup completed: ${queueCleanup} queue tasks, ${storageCleanup.tasksRemoved} stored tasks removed`));
  }

  /**
   * Load persisted tasks from storage into queue
   */
  private async loadPersistedTasks(): Promise<void> {
    try {
      const tasks = await this.storage.loadAllTasks();
      const activeTasks = tasks.filter(task => 
        ['pending', 'queued', 'running'].includes(task.status)
      );

      for (const task of activeTasks) {
        // Reset running tasks to queued (they were interrupted)
        if (task.status === 'running') {
          task.status = 'queued';
          task.updatedAt = new Date();
          await this.storage.saveTask(task);
        }
        
        this.queue.add(task);
      }

      if (activeTasks.length > 0) {
        console.log(chalk.blue(`📥 Loaded ${activeTasks.length} persisted tasks`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to load persisted tasks:'), (error as Error).message);
    }
  }

  /**
   * Handle task started event
   */
  private async handleTaskStarted(task: Task): Promise<void> {
    await this.storage.saveTask(task);
    
    // Send notification
    if (this.notificationManager && task.notifications?.onStart) {
      await this.sendNotification(task, 'task:started');
    }
    
    // Start actual task execution in codespace
    try {
      await this.codespaceManager.runTask(task.id, {
        task: task.command,
        repository: task.repository,
        branch: task.branch,
        timeout: task.timeout,
        autoCommit: task.autoCommit,
        pullRequest: task.pullRequest,
        outputFiles: task.outputFiles,
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to start codespace task:'), (error as Error).message);
      this.queue.complete(task.id, false);
    }
  }

  /**
   * Handle task completed event
   */
  private async handleTaskCompleted(task: Task): Promise<void> {
    await this.storage.saveTask(task);
    
    // Send notification
    if (this.notificationManager && task.notifications?.onComplete) {
      const result = await this.storage.loadResult(task.id);
      await this.sendNotification(task, 'task:completed', result || undefined);
    }
    
    this.emit('task:completed', task);
  }

  /**
   * Handle task failed event
   */
  private async handleTaskFailed(task: Task): Promise<void> {
    await this.storage.saveTask(task);
    
    // Send notification
    if (this.notificationManager && task.notifications?.onFail) {
      const result = await this.storage.loadResult(task.id);
      await this.sendNotification(task, 'task:failed', result || undefined);
    }
    
    this.emit('task:failed', task);
  }

  /**
   * Handle task cancelled event
   */
  private async handleTaskCancelled(task: Task): Promise<void> {
    await this.storage.saveTask(task);
    this.emit('task:cancelled', task);
  }

  /**
   * Handle task timeout event
   */
  private async handleTaskTimeout(task: Task): Promise<void> {
    await this.storage.saveTask(task);
    this.emit('task:timeout', task);
  }

  /**
   * Handle webhook updates
   */
  private async handleWebhookUpdate(payload: any): Promise<void> {
    const { taskId, status, data } = payload;
    
    const update: TaskUpdate = {
      status: status as TaskStatus,
      progress: data?.progress,
      message: data?.message,
      metadata: data?.metadata ? { ...data.metadata } : undefined,
    };

    await this.updateTask(taskId, update);
  }

  /**
   * Handle codespace created event
   */
  private async handleCodespaceCreated({ taskId, codespace }: any): Promise<void> {
    await this.updateTask(taskId, {
      metadata: {
        codespaceId: codespace.id.toString(),
        codespaceName: codespace.name,
      },
    });
  }

  /**
   * Handle codespace task completed event
   */
  private async handleCodespaceTaskCompleted({ taskId }: any): Promise<void> {
    this.queue.complete(taskId, true);
  }

  /**
   * Handle codespace task failed event
   */
  private async handleCodespaceTaskFailed({ taskId, error }: any): Promise<void> {
    await this.updateTask(taskId, {
      metadata: {
        errorDetails: {
          code: 'CODESPACE_ERROR',
          message: error.message,
          details: error,
          timestamp: new Date(),
          recoverable: false,
        },
      },
    });
    
    this.queue.complete(taskId, false);
  }

  /**
   * Send notification for a task event
   */
  private async sendNotification(
    task: Task, 
    event: 'task:started' | 'task:completed' | 'task:failed' | 'task:cancelled' | 'task:timeout',
    result?: TaskResult
  ): Promise<void> {
    if (!this.notificationManager) return;

    const payload: NotificationPayload = {
      id: uuidv4().substring(0, 8),
      event,
      priority: task.priority === 'urgent' ? 'urgent' : 
                task.priority === 'high' ? 'high' : 
                task.priority === 'low' ? 'low' : 'normal',
      timestamp: new Date(),
      task,
      result,
    };

    try {
      await this.notificationManager.notify(payload);
    } catch (error) {
      console.error(chalk.red('❌ Failed to send notification:'), (error as Error).message);
    }
  }

  /**
   * Get notification manager
   */
  getNotificationManager(): NotificationManager | undefined {
    return this.notificationManager;
  }
}