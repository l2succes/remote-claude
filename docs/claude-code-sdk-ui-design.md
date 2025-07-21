# Claude Code SDK UI Integration Design

## Overview

This document outlines how to integrate the Claude Code SDK into a web-based UI for Remote Claude, enabling users to interact with their remote tasks through an AI-powered interface.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Remote Claude Web UI                  │
│         (Next.js + React + Tailwind)            │
├─────────────────────────────────────────────────┤
│          Claude Code SDK Layer                  │
│    (@anthropic-ai/claude-code TypeScript)       │
├─────────────────────────────────────────────────┤
│           Remote Claude API                     │
│    (Task Management + Session Control)          │
├─────────────────────────────────────────────────┤
│         EC2 Instance Pool + WebSocket           │
│      (Shared instances with containers)         │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. Claude Assistant Component

```typescript
// components/ClaudeAssistant.tsx
import { useState, useEffect } from 'react'
import { query } from '@anthropic-ai/claude-code'

interface ClaudeAssistantProps {
  taskId: string
  workspacePath: string
  onFileChange?: (path: string) => void
}

export function ClaudeAssistant({ taskId, workspacePath, onFileChange }: ClaudeAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [input, setInput] = useState('')

  async function sendMessage(prompt: string) {
    setIsStreaming(true)
    const newMessages: Message[] = []

    try {
      for await (const message of query({
        prompt,
        options: {
          workingDirectory: workspacePath,
          maxTurns: 5,
          env: {
            TASK_ID: taskId,
            REMOTE_CLAUDE: 'true'
          }
        }
      })) {
        if (message.type === 'text') {
          newMessages.push({
            role: 'assistant',
            content: message.text,
            timestamp: new Date()
          })
        } else if (message.type === 'tool_use') {
          // Handle tool usage (file edits, commands, etc.)
          handleToolUse(message)
        }
      }
    } catch (error) {
      console.error('Claude query error:', error)
    } finally {
      setIsStreaming(false)
      setMessages(prev => [...prev, ...newMessages])
    }
  }

  function handleToolUse(toolMessage: any) {
    // Track file changes, command executions, etc.
    if (toolMessage.tool === 'edit_file' && onFileChange) {
      onFileChange(toolMessage.path)
    }
  }

  return (
    <div className="claude-assistant flex flex-col h-full">
      <div className="messages flex-1 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator />}
      </div>
      <div className="input-area p-4 border-t">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(input)
              setInput('')
            }
          }}
          placeholder="Ask Claude to help with your task..."
          className="w-full p-2 rounded border"
        />
      </div>
    </div>
  )
}
```

### 2. Task Dashboard with Claude Integration

```typescript
// pages/tasks/[taskId].tsx
import { useState, useEffect } from 'react'
import { ClaudeAssistant } from '@/components/ClaudeAssistant'
import { FileExplorer } from '@/components/FileExplorer'
import { Terminal } from '@/components/Terminal'
import { useWebSocket } from '@/hooks/useWebSocket'

export default function TaskView({ params }: { params: { taskId: string } }) {
  const [task, setTask] = useState<Task | null>(null)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const { connected, sendMessage, subscribe } = useWebSocket(
    `/api/tasks/${params.taskId}/ws`
  )

  useEffect(() => {
    // Load task details
    fetchTask(params.taskId).then(setTask)
    
    // Subscribe to file changes from Claude
    const unsubscribe = subscribe('file:changed', (data) => {
      // Refresh file explorer or editor
      refreshFile(data.path)
    })

    return () => unsubscribe()
  }, [params.taskId])

  return (
    <div className="task-view h-screen flex">
      {/* Left Panel - File Explorer */}
      <div className="w-64 border-r bg-gray-50">
        <FileExplorer 
          taskId={params.taskId}
          onFileSelect={setActiveFile}
        />
      </div>

      {/* Center Panel - Editor/Terminal */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          {activeFile ? (
            <CodeEditor 
              file={activeFile} 
              taskId={params.taskId}
            />
          ) : (
            <WelcomeScreen task={task} />
          )}
        </div>
        <div className="h-64 border-t">
          <Terminal taskId={params.taskId} />
        </div>
      </div>

      {/* Right Panel - Claude Assistant */}
      <div className="w-96 border-l">
        <ClaudeAssistant 
          taskId={params.taskId}
          workspacePath={task?.workspacePath || ''}
          onFileChange={(path) => {
            // Refresh file in editor if it's open
            if (path === activeFile) {
              refreshFile(path)
            }
          }}
        />
      </div>
    </div>
  )
}
```

### 3. Task Management Interface

```typescript
// components/TaskManager.tsx
import { useState } from 'react'
import { createTask, listTasks } from '@/lib/api'
import { ClaudeCodeModal } from '@/components/ClaudeCodeModal'

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showClaudeModal, setShowClaudeModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  async function handleCreateTask(description: string) {
    // Use Claude to help create the task
    setShowClaudeModal(true)
    
    // Claude can help:
    // 1. Understand the task requirements
    // 2. Suggest repository and branch
    // 3. Estimate resource requirements
    // 4. Create initial task plan
  }

  return (
    <div className="task-manager">
      <div className="header flex justify-between items-center p-4">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <button
          onClick={() => setShowClaudeModal(true)}
          className="btn btn-primary"
        >
          New Task with Claude
        </button>
      </div>

      <div className="task-grid grid grid-cols-3 gap-4 p-4">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onSelect={() => setSelectedTask(task)}
            onAskClaude={() => {
              setSelectedTask(task)
              setShowClaudeModal(true)
            }}
          />
        ))}
      </div>

      {showClaudeModal && (
        <ClaudeCodeModal
          task={selectedTask}
          onClose={() => setShowClaudeModal(false)}
          onTaskCreated={(task) => {
            setTasks([...tasks, task])
            setShowClaudeModal(false)
          }}
        />
      )}
    </div>
  )
}
```

### 4. Claude-Powered Task Creation

```typescript
// components/ClaudeCodeModal.tsx
import { useState } from 'react'
import { query } from '@anthropic-ai/claude-code'

export function ClaudeCodeModal({ task, onClose, onTaskCreated }) {
  const [stage, setStage] = useState<'describe' | 'planning' | 'confirming'>('describe')
  const [description, setDescription] = useState('')
  const [plan, setPlan] = useState<TaskPlan | null>(null)

  async function analyzeTask() {
    setStage('planning')
    
    const analysisPrompt = `
      Analyze this development task and provide a structured plan:
      "${description}"
      
      Please provide:
      1. Suggested repository structure
      2. Required technologies/frameworks
      3. Estimated complexity (simple/medium/complex)
      4. Key implementation steps
      5. Potential challenges
      
      Format as JSON.
    `

    try {
      const messages = []
      for await (const message of query({ prompt: analysisPrompt })) {
        messages.push(message)
      }
      
      // Parse Claude's response
      const planData = parseClaudeResponse(messages)
      setPlan(planData)
      setStage('confirming')
    } catch (error) {
      console.error('Failed to analyze task:', error)
    }
  }

  async function createTaskWithPlan() {
    const task = await createTask({
      description,
      plan,
      provider: 'ec2-shared',
      estimatedComplexity: plan.complexity,
      suggestedResources: plan.resources
    })
    
    onTaskCreated(task)
  }

  return (
    <div className="modal">
      <div className="modal-content">
        {stage === 'describe' && (
          <div>
            <h2>Describe Your Task</h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., 'Add user authentication to my Next.js app'"
              className="w-full h-32"
            />
            <button onClick={analyzeTask}>
              Analyze with Claude
            </button>
          </div>
        )}

        {stage === 'planning' && (
          <div>
            <h2>Claude is analyzing your task...</h2>
            <div className="loading-spinner" />
          </div>
        )}

        {stage === 'confirming' && plan && (
          <div>
            <h2>Task Plan</h2>
            <TaskPlanView plan={plan} />
            <div className="actions">
              <button onClick={createTaskWithPlan}>
                Create Task
              </button>
              <button onClick={() => setStage('describe')}>
                Modify
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

## Advanced Features

### 1. Collaborative Claude Sessions

```typescript
// Allow multiple users to interact with Claude in the same task
interface CollaborativeSession {
  sessionId: string
  participants: User[]
  sharedContext: boolean
  messageHistory: Message[]
}

export function CollaborativeClaudeSession({ session }: { session: CollaborativeSession }) {
  // Real-time sync of Claude interactions across users
  const { messages, sendMessage, participants } = useCollaborativeSession(session.sessionId)
  
  return (
    <div className="collaborative-session">
      <ParticipantList participants={participants} />
      <SharedMessageHistory messages={messages} />
      <ClaudeInput onSend={sendMessage} />
    </div>
  )
}
```

### 2. Claude Code Reviews

```typescript
// Automated code review on task completion
export async function requestClaudeReview(taskId: string) {
  const changes = await getTaskChanges(taskId)
  
  const reviewPrompt = `
    Review the following code changes:
    ${changes}
    
    Provide feedback on:
    1. Code quality
    2. Potential bugs
    3. Performance considerations
    4. Security issues
    5. Best practices
  `
  
  const review = await queryClaudeForReview(reviewPrompt)
  return formatReviewResults(review)
}
```

### 3. Smart Task Suggestions

```typescript
// Claude suggests next tasks based on current work
export function TaskSuggestions({ currentTask }: { currentTask: Task }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  
  useEffect(() => {
    async function getSuggestions() {
      const context = await getTaskContext(currentTask.id)
      const suggestions = await queryClaudeForSuggestions(context)
      setSuggestions(suggestions)
    }
    
    getSuggestions()
  }, [currentTask])
  
  return (
    <div className="task-suggestions">
      <h3>Claude suggests these next steps:</h3>
      {suggestions.map(suggestion => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={() => createTaskFromSuggestion(suggestion)}
        />
      ))}
    </div>
  )
}
```

## API Integration

### Backend API Endpoints

```typescript
// pages/api/claude/query.ts
export async function POST(req: Request) {
  const { taskId, prompt, options } = await req.json()
  
  // Verify user has access to task
  const hasAccess = await checkTaskAccess(req.user, taskId)
  if (!hasAccess) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // Get task workspace
  const workspace = await getTaskWorkspace(taskId)
  
  // Stream Claude response
  const stream = new ReadableStream({
    async start(controller) {
      for await (const message of query({
        prompt,
        options: {
          ...options,
          workingDirectory: workspace.path,
          env: {
            TASK_ID: taskId,
            USER_ID: req.user.id
          }
        }
      })) {
        controller.enqueue(JSON.stringify(message) + '\n')
      }
      controller.close()
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### WebSocket Integration

```typescript
// Real-time updates from Claude actions
wss.on('connection', (ws, req) => {
  const { taskId } = parseQuery(req.url)
  
  // Subscribe to Claude events for this task
  claudeEventEmitter.on(`task:${taskId}:file:changed`, (data) => {
    ws.send(JSON.stringify({
      type: 'file:changed',
      data
    }))
  })
  
  claudeEventEmitter.on(`task:${taskId}:command:executed`, (data) => {
    ws.send(JSON.stringify({
      type: 'command:executed',
      data
    }))
  })
})
```

## Security Considerations

### 1. API Key Management
```typescript
// Secure API key handling
export class ClaudeSDKManager {
  private apiKey: string
  
  constructor() {
    // Never expose API key to frontend
    this.apiKey = process.env.ANTHROPIC_API_KEY!
  }
  
  async query(prompt: string, userId: string, taskId: string) {
    // Audit log
    await logClaudeQuery({ userId, taskId, prompt })
    
    // Rate limiting
    await checkRateLimit(userId)
    
    // Execute query server-side only
    return query({ 
      prompt,
      apiKey: this.apiKey 
    })
  }
}
```

### 2. Permission Management
```typescript
interface ClaudePermissions {
  canEditFiles: boolean
  canExecuteCommands: boolean
  canAccessSensitiveData: boolean
  maxTokensPerQuery: number
  allowedTools: string[]
}

// Apply permissions per user/task
export function getClaudePermissions(user: User, task: Task): ClaudePermissions {
  if (user.role === 'admin' || task.ownerId === user.id) {
    return FULL_PERMISSIONS
  }
  
  if (task.collaborators.includes(user.id)) {
    return COLLABORATOR_PERMISSIONS
  }
  
  return VIEWER_PERMISSIONS
}
```

## UI/UX Best Practices

### 1. Streaming Responses
- Show typing indicators
- Progressive rendering of code blocks
- Smooth scrolling to new content

### 2. Error Handling
- Graceful fallbacks for Claude errors
- Retry mechanisms
- Clear error messages

### 3. Context Preservation
- Save Claude conversation history
- Allow resuming conversations
- Export chat logs

### 4. Performance
- Debounce Claude queries
- Cache frequent responses
- Lazy load conversation history

## Deployment Considerations

### 1. Environment Variables
```env
# .env.production
ANTHROPIC_API_KEY=your-api-key
CLAUDE_MODEL=claude-3-sonnet-20240229
MAX_TOKENS_PER_USER=100000
RATE_LIMIT_PER_HOUR=100
```

### 2. Monitoring
- Track Claude API usage
- Monitor response times
- Alert on errors
- Cost tracking per user/task

### 3. Scaling
- Queue management for Claude requests
- Load balancing across API keys
- Caching strategies
- CDN for static assets

## Next Steps

1. **Prototype Development**
   - Build basic Claude Assistant component
   - Integrate with existing task system
   - Test streaming responses

2. **Feature Development**
   - Implement collaborative sessions
   - Add code review capabilities
   - Build task suggestion system

3. **Production Preparation**
   - Security audit
   - Performance testing
   - Documentation
   - User training materials

## Conclusion

The Claude Code SDK provides powerful capabilities for building an AI-assisted development environment. By integrating it into Remote Claude's UI, we can offer users an intelligent interface that helps them:
- Create and plan tasks more effectively
- Get real-time coding assistance
- Review and improve their code
- Collaborate with team members

This integration transforms Remote Claude from a simple task runner into an AI-powered development platform.