# Notification System

## Overview

The notification system ensures you're immediately informed when remote Claude Code tasks complete, fail, or require attention. It supports multiple channels and can be configured for different types of events.

## Supported Notification Channels

### 1. Email (SMTP)

**Configuration**:
```bash
rcli config notify email \
  --smtp-host smtp.gmail.com \
  --smtp-port 587 \
  --smtp-user your-email@gmail.com \
  --smtp-password your-app-password \
  --from-email your-email@gmail.com \
  --to-email notifications@yourcompany.com
```

**Features**:
- Rich HTML email templates
- Task summary and links to results
- Attachment support for small result files
- Thread organization for related tasks

**Email Template Example**:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .task-summary { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .success { color: #28a745; }
    .failure { color: #dc3545; }
  </style>
</head>
<body>
  <div class="task-summary">
    <h2>Claude Code Task Completed</h2>
    <p><strong>Task:</strong> {{taskDescription}}</p>
    <p><strong>Status:</strong> <span class="{{statusClass}}">{{status}}</span></p>
    <p><strong>Duration:</strong> {{duration}}</p>
    <p><strong>Repository:</strong> {{repository}}</p>
    
    {{#if results}}
    <h3>Results</h3>
    <ul>
      {{#each results}}
      <li><a href="{{url}}">{{filename}}</a></li>
      {{/each}}
    </ul>
    {{/if}}
    
    <p><a href="{{codespaceUrl}}">View Codespace</a> | <a href="{{resultsUrl}}">Download Results</a></p>
  </div>
</body>
</html>
```

### 2. Slack Integration

**Configuration**:
```bash
rcli config notify slack \
  --webhook-url https://hooks.slack.com/services/... \
  --channel "#dev-team" \
  --username "Claude Bot"
```

**Features**:
- Rich message formatting with blocks
- Thread replies for task updates
- Interactive buttons for common actions
- Custom emoji and status indicators

**Slack Message Example**:
```json
{
  "text": "Claude Code Task Completed",
  "attachments": [
    {
      "color": "good",
      "fields": [
        {
          "title": "Task",
          "value": "Refactor payment module architecture",
          "short": false
        },
        {
          "title": "Repository",
          "value": "owner/repo",
          "short": true
        },
        {
          "title": "Duration",
          "value": "45 minutes",
          "short": true
        }
      ],
      "actions": [
        {
          "type": "button",
          "text": "View Results",
          "url": "https://github.com/owner/repo/compare/main...task-branch"
        },
        {
          "type": "button",
          "text": "Open Codespace",
          "url": "https://codespace-url"
        }
      ]
    }
  ]
}
```

### 3. Discord Webhook

**Configuration**:
```bash
rcli config notify discord \
  --webhook-url https://discord.com/api/webhooks/... \
  --username "Claude Assistant"
```

**Features**:
- Embedded rich messages
- Code syntax highlighting
- File attachments
- Mention support for urgent notifications

### 4. Push Notifications

**Supported Services**:
- **Pushover**: Cross-platform push notifications
- **Pushbullet**: Multi-device notifications
- **NTFY**: Self-hosted push service

**Pushover Configuration**:
```bash
rcli config notify pushover \
  --app-token your-app-token \
  --user-key your-user-key \
  --priority normal \
  --sound pushover
```

### 5. Custom Webhooks

**Configuration**:
```bash
rcli config notify webhook \
  --url https://your-api.com/webhooks/claude \
  --method POST \
  --headers "Authorization: Bearer token123" \
  --headers "Content-Type: application/json"
```

**Payload Format**:
```json
{
  "event": "task_completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "task": {
    "id": "task-uuid-123",
    "description": "Fix TypeScript errors in payment module",
    "status": "completed",
    "repository": "owner/repo",
    "branch": "fix/typescript-errors",
    "startTime": "2024-01-15T09:45:00Z",
    "endTime": "2024-01-15T10:30:00Z",
    "duration": 2700,
    "codespaceUrl": "https://github.com/codespaces/...",
    "resultsUrl": "https://api.github.com/repos/owner/repo/contents/..."
  },
  "results": {
    "filesChanged": 12,
    "errorsFixed": 34,
    "outputFiles": [
      "task-summary.md",
      "changes-log.txt"
    ]
  }
}
```

## Notification Events

### Task Lifecycle Events

1. **Task Started**
   ```json
   {
     "event": "task_started",
     "message": "Claude Code task has begun execution",
     "urgency": "low"
   }
   ```

2. **Task Progress** (Optional)
   ```json
   {
     "event": "task_progress",
     "message": "Task is 50% complete - fixed 17 of 34 errors",
     "urgency": "low"
   }
   ```

3. **Task Completed**
   ```json
   {
     "event": "task_completed",
     "message": "Task completed successfully",
     "urgency": "normal"
   }
   ```

4. **Task Failed**
   ```json
   {
     "event": "task_failed",
     "message": "Task failed: Unable to access repository",
     "urgency": "high"
   }
   ```

5. **Task Timeout**
   ```json
   {
     "event": "task_timeout",
     "message": "Task exceeded maximum runtime of 2 hours",
     "urgency": "high"
   }
   ```

### System Events

1. **Codespace Created**
2. **Codespace Destroyed**
3. **Resource Warnings** (high CPU, memory usage)
4. **Authentication Errors**
5. **Quota Limits Reached**

## Configuration Management

### Global Configuration
```bash
# Set default notification channels
rcli config notify default email,slack

# Set urgency thresholds
rcli config notify urgent-only --events task_failed,task_timeout

# Configure quiet hours
rcli config notify quiet-hours --start 22:00 --end 08:00 --timezone UTC
```

### Per-Task Configuration
```bash
# Task-specific notifications
rcli run "Long refactoring task" \
  --notify email,pushover \
  --notify-on started,completed,failed \
  --urgent-only false
```

### Template Customization

**Email Templates**: Store in `~/.rcli/templates/email/`
```
task-completed.html
task-failed.html
task-started.html
```

**Slack Templates**: Store in `~/.rcli/templates/slack/`
```
task-completed.json
task-failed.json
progress-update.json
```

## Advanced Features

### Conditional Notifications
```bash
# Only notify on failure
rcli run "Deploy to staging" --notify-condition "status !== 'completed'"

# Notify for long-running tasks only
rcli run "Full codebase analysis" --notify-condition "duration > 3600"
```

### Notification Aggregation
```bash
# Group related notifications
rcli run "Fix payment bugs" --notification-group "payment-fixes"

# Digest mode (hourly summary)
rcli config notify digest --interval 1h --channels email
```

### Rate Limiting
```bash
# Prevent notification spam
rcli config notify rate-limit \
  --max-per-minute 5 \
  --max-per-hour 20 \
  --backoff exponential
```

## Implementation Details

### Notification Queue

```typescript
interface NotificationQueue {
  id: string;
  event: NotificationEvent;
  channels: string[];
  retryCount: number;
  scheduledTime: Date;
  status: 'pending' | 'sent' | 'failed';
}

class NotificationService {
  private queue: NotificationQueue[] = [];
  
  async send(event: NotificationEvent, channels: string[]) {
    // Add to queue with retry logic
    // Process queue with rate limiting
    // Handle delivery failures
  }
}
```

### Error Handling

1. **Retry Logic**: Exponential backoff for failed deliveries
2. **Fallback Channels**: Try secondary channels on primary failure
3. **Dead Letter Queue**: Store permanently failed notifications
4. **Circuit Breaker**: Temporarily disable failing channels

### Security

1. **Credential Storage**: Secure storage in OS keychain
2. **Webhook Verification**: Signature validation for incoming webhooks
3. **Content Filtering**: Scrub sensitive information from notifications
4. **Rate Limiting**: Prevent abuse and spam

## Monitoring and Analytics

### Delivery Metrics
- Success/failure rates per channel
- Average delivery time
- Retry attempts and patterns

### Usage Analytics
- Most common notification types
- Channel preferences
- Peak notification times

### Health Checks
```bash
# Test all configured channels
rcli notify test --all

# Verify webhook endpoints
rcli notify verify --webhook-only

# Check delivery status
rcli notify status --last 24h
```