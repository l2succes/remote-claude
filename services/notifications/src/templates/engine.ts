import { promises as fs } from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { 
  NotificationPayload, 
  NotificationChannel, 
  TemplateVariables,
  NotificationTemplate 
} from '@remote-claude/core';
import { Task, TaskResult } from '@remote-claude/core';
import chalk from 'chalk';

export interface TemplateContent {
  subject?: string | undefined;
  title?: string | undefined;
  body: string;
  format: 'text' | 'html' | 'markdown';
}

export class TemplateEngine {
  private templateDir: string;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private defaultTemplates: Map<string, NotificationTemplate> = new Map();

  constructor(templateDir?: string) {
    this.templateDir = templateDir || path.join(__dirname, 'defaults');
    this.setupHelpers();
    this.loadDefaultTemplates();
  }

  /**
   * Set up Handlebars helpers
   */
  private setupHelpers(): void {
    // Format date helper
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleString();
    });

    // Format duration helper
    Handlebars.registerHelper('formatDuration', (seconds: number) => {
      if (seconds < 60) {
        return `${seconds}s`;
      } else if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
      }
    });

    // Status emoji helper
    Handlebars.registerHelper('statusEmoji', (status: string) => {
      const emojis: Record<string, string> = {
        pending: '⏳',
        queued: '📝',
        running: '▶️',
        completed: '✅',
        failed: '❌',
        cancelled: '🛑',
        timeout: '⏰',
      };
      return emojis[status] || '❓';
    });

    // Priority color helper
    Handlebars.registerHelper('priorityColor', (priority: string) => {
      const colors: Record<string, string> = {
        urgent: '#ff0000',
        high: '#ff8800',
        normal: '#00aa00',
        low: '#0088ff',
      };
      return colors[priority] || '#666666';
    });

    // Conditional helper
    Handlebars.registerHelper('ifEquals', function(this: any, arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // Repository link helper
    Handlebars.registerHelper('repoLink', (repository: string) => {
      return `https://github.com/${repository}`;
    });

    // Truncate helper
    Handlebars.registerHelper('truncate', (text: string, length: number) => {
      if (!text || text.length <= length) return text;
      return text.substring(0, length) + '...';
    });
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    // Task started templates
    this.defaultTemplates.set('email:task:started', {
      id: 'email:task:started',
      name: 'Email - Task Started',
      event: 'task:started',
      channel: 'email',
      subject: '🚀 Task Started: {{task.name}}',
      title: 'Task Started',
      body: `
<h2>{{statusEmoji task.status}} Task Started</h2>
<p><strong>{{task.name}}</strong> has been started.</p>

<h3>Task Details</h3>
<ul>
  <li><strong>ID:</strong> {{task.id}}</li>
  <li><strong>Command:</strong> <code>{{task.command}}</code></li>
  <li><strong>Repository:</strong> <a href="{{repoLink task.repository}}">{{task.repository}}</a></li>
  {{#if task.branch}}<li><strong>Branch:</strong> {{task.branch}}</li>{{/if}}
  <li><strong>Priority:</strong> <span style="color: {{priorityColor task.priority}}">{{task.priority}}</span></li>
  <li><strong>Started:</strong> {{formatDate task.startedAt}}</li>
</ul>

<p>You will receive another notification when the task completes.</p>
      `,
      format: 'html',
      variables: ['task'],
    });

    this.defaultTemplates.set('slack:task:started', {
      id: 'slack:task:started',
      name: 'Slack - Task Started',
      event: 'task:started',
      channel: 'slack',
      title: 'Task Started',
      body: `
{
  "text": "🚀 Task Started: {{task.name}}",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "{{statusEmoji task.status}} Task Started"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Task:*\\n{{task.name}}"
        },
        {
          "type": "mrkdwn",
          "text": "*ID:*\\n\`{{task.id}}\`"
        },
        {
          "type": "mrkdwn",
          "text": "*Repository:*\\n<{{repoLink task.repository}}|{{task.repository}}>"
        },
        {
          "type": "mrkdwn",
          "text": "*Priority:*\\n{{task.priority}}"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Command:* \`{{task.command}}\`"
      }
    }
  ]
}
      `,
      format: 'markdown',
      variables: ['task'],
    });

    // Task completed templates
    this.defaultTemplates.set('email:task:completed', {
      id: 'email:task:completed',
      name: 'Email - Task Completed',
      event: 'task:completed',
      channel: 'email',
      subject: '✅ Task Completed: {{task.name}}',
      title: 'Task Completed Successfully',
      body: `
<h2>{{statusEmoji task.status}} Task Completed Successfully</h2>
<p><strong>{{task.name}}</strong> has been completed successfully!</p>

<h3>Task Details</h3>
<ul>
  <li><strong>ID:</strong> {{task.id}}</li>
  <li><strong>Command:</strong> <code>{{task.command}}</code></li>
  <li><strong>Repository:</strong> <a href="{{repoLink task.repository}}">{{task.repository}}</a></li>
  {{#if task.branch}}<li><strong>Branch:</strong> {{task.branch}}</li>{{/if}}
  <li><strong>Priority:</strong> <span style="color: {{priorityColor task.priority}}">{{task.priority}}</span></li>
  <li><strong>Started:</strong> {{formatDate task.startedAt}}</li>
  <li><strong>Completed:</strong> {{formatDate task.completedAt}}</li>
  <li><strong>Duration:</strong> {{task.duration}}</li>
</ul>

{{#if result}}
<h3>Results</h3>
{{#if result.files}}
<p><strong>Generated Files:</strong></p>
<ul>
  {{#each result.files}}
  <li><a href="{{url}}">{{path}}</a> ({{size}} bytes)</li>
  {{/each}}
</ul>
{{/if}}

{{#if result.output}}
<p><strong>Output:</strong></p>
<pre>{{truncate result.output 500}}</pre>
{{/if}}
{{/if}}

<p>You can view full details and download results using: <code>rclaude results {{task.id}}</code></p>
      `,
      format: 'html',
      variables: ['task', 'result'],
    });

    // Task failed templates
    this.defaultTemplates.set('email:task:failed', {
      id: 'email:task:failed',
      name: 'Email - Task Failed',
      event: 'task:failed',
      channel: 'email',
      subject: '❌ Task Failed: {{task.name}}',
      title: 'Task Failed',
      body: `
<h2>{{statusEmoji task.status}} Task Failed</h2>
<p><strong>{{task.name}}</strong> has failed to complete.</p>

<h3>Task Details</h3>
<ul>
  <li><strong>ID:</strong> {{task.id}}</li>
  <li><strong>Command:</strong> <code>{{task.command}}</code></li>
  <li><strong>Repository:</strong> <a href="{{repoLink task.repository}}">{{task.repository}}</a></li>
  {{#if task.branch}}<li><strong>Branch:</strong> {{task.branch}}</li>{{/if}}
  <li><strong>Priority:</strong> <span style="color: {{priorityColor task.priority}}">{{task.priority}}</span></li>
  <li><strong>Started:</strong> {{formatDate task.startedAt}}</li>
  <li><strong>Failed:</strong> {{formatDate task.completedAt}}</li>
  {{#if task.duration}}<li><strong>Duration:</strong> {{task.duration}}</li>{{/if}}
</ul>

{{#if result.error}}
<h3>Error Details</h3>
<pre style="background: #f5f5f5; padding: 10px; border-left: 4px solid #ff0000;">{{result.error}}</pre>
{{/if}}

<p>You can view full logs using: <code>rclaude logs {{task.id}}</code></p>
      `,
      format: 'html',
      variables: ['task', 'result'],
    });

    console.log(chalk.green(`✅ Loaded ${this.defaultTemplates.size} default templates`));
  }

  /**
   * Render a notification template
   */
  async render(payload: NotificationPayload, channel: NotificationChannel): Promise<TemplateContent> {
    const templateKey = `${channel}:${payload.event}`;
    const template = this.defaultTemplates.get(templateKey);

    if (!template) {
      // Fall back to basic text template
      return this.renderBasicTemplate(payload);
    }

    try {
      const variables = this.buildTemplateVariables(payload);
      const compiledTemplate = this.getCompiledTemplate(template);
      
      const renderedBody = compiledTemplate(variables);
      const renderedSubject = template.subject ? Handlebars.compile(template.subject)(variables) : undefined;
      const renderedTitle = template.title ? Handlebars.compile(template.title)(variables) : undefined;

      return {
        subject: renderedSubject,
        title: renderedTitle,
        body: renderedBody,
        format: template.format,
      };
    } catch (error) {
      console.error(chalk.red('❌ Template rendering failed:'), (error as Error).message);
      return this.renderBasicTemplate(payload);
    }
  }

  /**
   * Get or compile a template
   */
  private getCompiledTemplate(template: NotificationTemplate): HandlebarsTemplateDelegate {
    let compiled = this.compiledTemplates.get(template.id);
    if (!compiled) {
      compiled = Handlebars.compile(template.body);
      this.compiledTemplates.set(template.id, compiled);
    }
    return compiled;
  }

  /**
   * Build template variables from notification payload
   */
  private buildTemplateVariables(payload: NotificationPayload): TemplateVariables {
    const task = payload.task;
    const result = payload.result;

    const variables: TemplateVariables = {
      task: {
        id: task.id,
        name: task.name,
        command: task.command,
        status: task.status,
        priority: task.priority,
        repository: task.repository,
        branch: task.branch,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        duration: this.calculateDuration(task),
        url: `https://github.com/${task.repository}`,
      },
      metadata: payload.metadata,
    };

    if (result) {
      variables.result = {
        success: result.success,
        output: result.output,
        error: result.error?.message,
        files: result.files?.map(file => ({
          path: file.path,
          size: file.size,
          url: file.url,
        })),
      };
    }

    return variables;
  }

  /**
   * Calculate task duration string
   */
  private calculateDuration(task: Task): string | undefined {
    if (!task.startedAt || !task.completedAt) {
      return undefined;
    }

    const duration = Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000);
    
    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    } else {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Render basic fallback template
   */
  private renderBasicTemplate(payload: NotificationPayload): TemplateContent {
    const task = payload.task;
    const emoji = this.getEventEmoji(payload.event);
    
    let subject = `${emoji} ${this.getEventTitle(payload.event)}: ${task.name}`;
    let body = `Task: ${task.name}\nID: ${task.id}\nRepository: ${task.repository}\nStatus: ${task.status}`;
    
    if (task.branch) {
      body += `\nBranch: ${task.branch}`;
    }
    
    if (payload.result?.error) {
      body += `\nError: ${payload.result.error.message}`;
    }

    return {
      subject,
      title: subject,
      body,
      format: 'text',
    };
  }

  /**
   * Get emoji for event type
   */
  private getEventEmoji(event: string): string {
    const emojis: Record<string, string> = {
      'task:started': '🚀',
      'task:completed': '✅',
      'task:failed': '❌',
      'task:cancelled': '🛑',
      'task:timeout': '⏰',
    };
    return emojis[event] || '📨';
  }

  /**
   * Get title for event type
   */
  private getEventTitle(event: string): string {
    const titles: Record<string, string> = {
      'task:started': 'Task Started',
      'task:completed': 'Task Completed',
      'task:failed': 'Task Failed',
      'task:cancelled': 'Task Cancelled',
      'task:timeout': 'Task Timed Out',
    };
    return titles[event] || 'Task Update';
  }

  /**
   * Load custom template from file
   */
  async loadTemplate(filePath: string): Promise<NotificationTemplate> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load template from ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Save template to file
   */
  async saveTemplate(template: NotificationTemplate, filePath: string): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save template to ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Register a custom template
   */
  registerTemplate(template: NotificationTemplate): void {
    this.defaultTemplates.set(template.id, template);
    // Clear compiled cache
    this.compiledTemplates.delete(template.id);
    console.log(chalk.green(`✅ Registered custom template: ${template.id}`));
  }

  /**
   * Get available templates
   */
  getTemplates(): NotificationTemplate[] {
    return Array.from(this.defaultTemplates.values());
  }
}