'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkspaceManager } from '@/lib/workspace-manager'
import type { Workspace, Task } from '@/lib/supabase/client'
import { TopBar } from '@/components/TopBar'
import { TaskList } from '@/components/TaskList'
import { ClaudeCodeView } from '@/components/ClaudeCodeView'
import { TaskProgress } from '@/components/TaskProgress'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolUse?: {
    tool: string
    params: any
    result?: any
  }
}

export default function WorkspaceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const workspaceId = params.id as string
  const wsRef = useRef<WebSocket | null>(null)

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTask, setCurrentTask] = useState<Task | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [progress, setProgress] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)

  // Auto-dismiss error after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    const supabase = createClient()

    // Check authentication
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/')
        return
      }
      loadWorkspace()
    })

    // Subscribe to workspace updates (realtime)
    const workspaceChannel = WorkspaceManager.subscribeToWorkspace(
      workspaceId,
      (updatedWorkspace) => {
        setWorkspace(updatedWorkspace)
      }
    )

    // Subscribe to task updates (realtime)
    const tasksChannel = WorkspaceManager.subscribeToTasks(
      workspaceId,
      (task) => {
        setTasks((prev) => {
          const index = prev.findIndex((t) => t.id === task.id)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = task
            return updated
          }
          return [task, ...prev]
        })

        // Update current task if it's the one being updated
        if (currentTask?.id === task.id) {
          setCurrentTask(task)
        }
      }
    )

    return () => {
      workspaceChannel.unsubscribe()
      tasksChannel.unsubscribe()
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [workspaceId, router])

  // Load messages when current task changes
  useEffect(() => {
    if (!currentTask) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      try {
        const taskMessages = await WorkspaceManager.getTaskMessages(currentTask.id)
        setMessages(taskMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          toolUse: msg.tool_use
        })))
      } catch (err) {
        console.error('Error loading messages:', err)
      }
    }

    loadMessages()

    // Subscribe to new messages for this task
    const messagesChannel = WorkspaceManager.subscribeToMessages(
      currentTask.id,
      (message) => {
        setMessages(prev => [...prev, {
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: new Date(message.timestamp),
          toolUse: message.tool_use
        }])
      }
    )

    return () => {
      messagesChannel.unsubscribe()
    }
  }, [currentTask?.id])

  const loadWorkspace = async () => {
    try {
      setLoading(true)

      // Load workspace data
      const workspaceData = await WorkspaceManager.getWorkspace(workspaceId)
      if (!workspaceData) {
        setError('Workspace not found')
        return
      }
      setWorkspace(workspaceData)

      // Load tasks
      const tasksData = await WorkspaceManager.getWorkspaceTasks(workspaceId)
      setTasks(tasksData)

      // Set the most recent task as current
      if (tasksData.length > 0) {
        setCurrentTask(tasksData[0])
      }
    } catch (err) {
      console.error('Error loading workspace:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleStartTask = async (prompt: string) => {
    if (!workspace) return

    try {
      // Create task in database
      const task = await WorkspaceManager.createTask({
        workspaceId: workspace.id,
        name: prompt.slice(0, 100),
        description: prompt,
      })

      setCurrentTask(task)
      setTasks((prev) => [task, ...prev])

      // Save user message to database
      await WorkspaceManager.saveMessage({
        task_id: task.id,
        role: 'user',
        content: prompt
      })

      // Note: No need to manually add to UI - realtime subscription will handle it

      // Send to agent via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'query',
          payload: {
            prompt,
            sessionId: task.id,
            workspaceId: workspace.id,
            options: {
              workingDirectory: workspace.disk_path,
            },
          },
        }))
      } else {
        // Connect to WebSocket if not connected
        connectToAgentServer(task, prompt)
      }
    } catch (err) {
      console.error('Failed to start task:', err)
      setError(err instanceof Error ? err.message : 'Failed to start task')
    }
  }

  const handleEnterPlanMode = async (prompt: string) => {
    if (!workspace) return

    try {
      // Create task with plan mode flag
      const task = await WorkspaceManager.createTask({
        workspaceId: workspace.id,
        name: `[PLAN] ${prompt.slice(0, 90)}`,
        description: prompt,
      })

      setCurrentTask(task)
      setTasks((prev) => [task, ...prev])

      // Save user message
      await WorkspaceManager.saveMessage({
        task_id: task.id,
        role: 'user',
        content: prompt
      })

      // Send plan mode request to agent
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'query',
          payload: {
            prompt: `Enter plan mode. ${prompt}`,
            sessionId: task.id,
            workspaceId: workspace.id,
            options: {
              workingDirectory: workspace.disk_path,
              planMode: true
            },
          },
        }))
      } else {
        connectToAgentServer(task, `Enter plan mode. ${prompt}`)
      }
    } catch (err) {
      console.error('Failed to enter plan mode:', err)
      setError(err instanceof Error ? err.message : 'Failed to enter plan mode')
    }
  }

  const handleResponseMessage = async (message: any) => {
    const content = message.payload.content

    if (!currentTask) return

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        try {
          await WorkspaceManager.saveMessage({
            task_id: currentTask.id,
            role: 'assistant',
            content: block.text
          })
        } catch (err) {
          console.error('Error saving assistant message:', err)
        }
      }
    }
  }

  const handleToolUse = async (message: any) => {
    if (!currentTask) return

    try {
      await WorkspaceManager.saveMessage({
        task_id: currentTask.id,
        role: 'system',
        content: `Using tool: ${message.payload.toolName}`,
        tool_use: {
          tool: message.payload.toolName,
          params: message.payload.input
        }
      })
    } catch (err) {
      console.error('Error saving tool use message:', err)
    }
  }

  const handleToolResult = (message: any) => {
    console.log('Tool result:', message.payload)
    // Could add result to messages or update matching tool_use
  }

  const handleProgress = (message: any) => {
    setProgress(message.payload.message)
    setIsStreaming(true)

    // Update task status in database
    if (currentTask?.id) {
      const supabase = createClient()
      supabase
        .from('tasks')
        .update({
          status: message.payload.stage === 'processing' ? 'running' : 'queued',
          session_id: message.payload.sessionId,
          started_at: new Date().toISOString(),
        })
        .eq('id', currentTask.id)
        .then(() => console.log('Task status updated'))
    }
  }

  const handleComplete = (message: any) => {
    setProgress('')
    setIsStreaming(false)

    // Update task to completed
    if (currentTask?.id) {
      const supabase = createClient()
      supabase
        .from('tasks')
        .update({
          status: message.payload.status === 'success' ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentTask.id)
        .then(() => console.log('Task completed'))
    }
  }

  const connectToAgentServer = async (task: Task, prompt: string) => {
    try {
      // Get Supabase session token for authentication
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('No session found')
      }

      // Connect to agent server via WebSocket
      const agentServerUrl = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'ws://localhost:8080'
      const websocket = new WebSocket(agentServerUrl)

      websocket.onopen = () => {
        console.log('Connected to agent server')
        // Send query to agent
        websocket.send(
          JSON.stringify({
            type: 'query',
            payload: {
              prompt: task.description || prompt,
              sessionId: task.id,
              workspaceId: workspace?.id,
              options: {
                workingDirectory: workspace?.disk_path,
              },
            },
          })
        )
      }

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data)
        console.log('Agent message:', message)

        switch (message.type) {
          case 'response':
            handleResponseMessage(message)
            break
          case 'tool_use':
            handleToolUse(message)
            break
          case 'tool_result':
            handleToolResult(message)
            break
          case 'progress':
            handleProgress(message)
            break
          case 'error':
            setError(message.payload.message)
            setIsStreaming(false)
            break
          case 'complete':
            handleComplete(message)
            break
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('Connection to agent server failed')
      }

      websocket.onclose = () => {
        console.log('Disconnected from agent server')
      }

      wsRef.current = websocket
    } catch (err) {
      console.error('Error connecting to agent server:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to agent server')
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading workspace...</div>
      </div>
    )
  }

  // If no workspace found, redirect to workspaces page
  if (!workspace && !loading) {
    router.push('/workspaces')
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Top Bar */}
      <TopBar
        taskName={workspace?.name || 'Loading...'}
        status={workspace?.clone_status as 'pending' | 'cloning' | 'ready' | 'error'}
        onBack={() => router.push('/workspaces')}
      />

      {/* Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Task List */}
        <div className="w-80 border-r border-gray-800 flex-shrink-0 overflow-y-auto">
          <TaskList
            tasks={tasks}
            currentTaskId={currentTask?.id}
            onTaskSelect={setCurrentTask}
          />
        </div>

        {/* Center Panel: Claude Code View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ClaudeCodeView
            workspace={workspace!}
            task={currentTask}
            messages={messages}
            isStreaming={isStreaming}
            onStartTask={handleStartTask}
            onEnterPlanMode={handleEnterPlanMode}
          />
        </div>

        {/* Right Panel: Task Progress */}
        <div className="w-80 border-l border-gray-800 flex-shrink-0 overflow-y-auto">
          <TaskProgress task={currentTask} workspace={workspace!} />
        </div>
      </div>

      {/* Error Toast - Bottom Left */}
      {error && (
        <div className="fixed bottom-4 left-4 z-50 animate-slide-up">
          <div className="bg-red-900/90 border border-red-700 rounded-lg shadow-lg p-4 max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-200">Error</h3>
                <p className="mt-1 text-sm text-red-300">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="flex-shrink-0 text-red-400 hover:text-red-300"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
