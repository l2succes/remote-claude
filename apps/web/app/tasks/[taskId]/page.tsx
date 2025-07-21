'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TopBar } from '@/components/TopBar'
import { TaskList } from '@/components/TaskList'
import { ClaudeCodeView } from '@/components/ClaudeCodeView'
import { TaskProgress } from '@/components/TaskProgress'
import { motion } from 'framer-motion'

// Mock data - in a real app, this would come from an API
const mockTasks = [
  {
    id: '1',
    name: 'Fix Authentication Bug',
    description: 'Fix the login timeout issue in auth.js',
    repository: 'https://github.com/mycompany/webapp.git',
    branch: 'main',
    status: 'running' as const,
    progress: 65,
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    startedAt: new Date(Date.now() - 1000 * 60 * 10),
    duration: 600,
    resources: { cpu: 45, memory: 62 }
  },
  {
    id: '2',
    name: 'Add Dark Mode',
    description: 'Implement dark mode toggle for the application',
    repository: 'https://github.com/mycompany/webapp.git',
    branch: 'feature/dark-mode',
    status: 'queued' as const,
    progress: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '3',
    name: 'Update Documentation',
    description: 'Update API documentation with new endpoints',
    repository: 'https://github.com/mycompany/docs.git',
    branch: 'main',
    status: 'completed' as const,
    progress: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    startedAt: new Date(Date.now() - 1000 * 60 * 50),
    completedAt: new Date(Date.now() - 1000 * 60 * 20),
    duration: 1800,
  },
]

const mockMessages = [
  {
    id: '1',
    role: 'user' as const,
    content: 'Fix the login timeout bug in the authentication system',
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: `I'll help you fix the login timeout bug. Let me first examine the authentication system to understand the current implementation.

Let me check the auth.js file:`,
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    toolUse: {
      tool: 'read_file',
      params: { path: 'src/auth.js' },
    }
  },
  {
    id: '3',
    role: 'assistant' as const,
    content: `I found the issue. The current timeout is set to 30 seconds, which is too short for some operations. I'll update it to 5 minutes (300 seconds).

\`\`\`javascript
// Current timeout setting
const SESSION_TIMEOUT = 30; // 30 seconds

// Updated timeout setting
const SESSION_TIMEOUT = 300; // 5 minutes
\`\`\`

Let me make this change:`,
    timestamp: new Date(Date.now() - 1000 * 60 * 8),
  },
]

const mockTodos = [
  { id: '1', text: 'Analyze authentication flow', status: 'completed' as const, createdAt: new Date() },
  { id: '2', text: 'Identify timeout issue in auth.js', status: 'completed' as const, createdAt: new Date() },
  { id: '3', text: 'Update SESSION_TIMEOUT to 5 minutes', status: 'in_progress' as const, createdAt: new Date() },
  { id: '4', text: 'Run authentication tests', status: 'pending' as const, createdAt: new Date() },
  { id: '5', text: 'Update documentation', status: 'pending' as const, createdAt: new Date() },
]

const mockFileChanges = [
  { path: 'src/auth.js', type: 'modified' as const, lines: { added: 1, removed: 1 } },
  { path: 'src/config.js', type: 'modified' as const, lines: { added: 3, removed: 0 } },
  { path: 'tests/auth.test.js', type: 'created' as const, lines: { added: 45, removed: 0 } },
]

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.taskId as string
  
  const [selectedTaskId, setSelectedTaskId] = useState(taskId)
  const [isStreaming, setIsStreaming] = useState(false)
  const [messages, setMessages] = useState(mockMessages)
  const [showTaskList, setShowTaskList] = useState(false)

  const currentTask = mockTasks.find(t => t.id === selectedTaskId) || mockTasks[0]

  const handleSendMessage = (message: string) => {
    const newMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: message,
      timestamp: new Date(),
    }
    setMessages([...messages, newMessage])
    
    // Simulate Claude response
    setIsStreaming(true)
    setTimeout(() => {
      const response = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: "I'll help you with that. Let me analyze the code and provide a solution...",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, response])
      setIsStreaming(false)
    }, 2000)
  }

  const handleTaskAction = (taskId: string, action: string) => {
    console.log('Task action:', taskId, action)
    // In a real app, this would trigger API calls
  }

  const handleTopBarAction = (action: string) => {
    console.log('Top bar action:', action)
    // Handle pause, resume, stop, restart
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Bar */}
      <TopBar
        taskName={currentTask.name}
        taskStatus={currentTask.status}
        onTaskAction={handleTopBarAction}
        onSettingsClick={() => console.log('Settings clicked')}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task List Panel - Collapsible on mobile */}
        <motion.div
          initial={{ width: 300 }}
          animate={{ width: showTaskList ? 300 : 0 }}
          className={`${showTaskList ? 'block' : 'hidden lg:block'} lg:w-[300px] flex-shrink-0`}
        >
          <TaskList
            tasks={mockTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onTaskAction={handleTaskAction}
          />
        </motion.div>

        {/* Mobile Toggle Button */}
        <button
          onClick={() => setShowTaskList(!showTaskList)}
          className="lg:hidden fixed bottom-4 left-4 z-40 p-3 bg-primary-500 rounded-full shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Claude Code View */}
        <div className="flex-1 min-w-0">
          <ClaudeCodeView
            taskId={currentTask.id}
            taskName={currentTask.name}
            repository={currentTask.repository}
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
          />
        </div>

        {/* Task Progress Panel */}
        <div className="w-[350px] flex-shrink-0 hidden xl:block">
          <TaskProgress
            taskId={currentTask.id}
            todos={mockTodos}
            fileChanges={mockFileChanges}
            resources={{
              cpu: currentTask.resources?.cpu || 0,
              memory: currentTask.resources?.memory || 0,
              duration: currentTask.duration || 0,
            }}
            activity={{
              commandsRun: 12,
              filesEdited: 3,
              testsPassed: 8,
              testsFailed: 0,
            }}
          />
        </div>
      </div>
    </div>
  )
}