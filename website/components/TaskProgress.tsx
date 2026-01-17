'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FaCheckCircle, FaSpinner, FaClock, FaFile,
  FaMemory, FaMicrochip, FaTerminal, FaEdit,
  FaChartLine, FaExclamationTriangle
} from 'react-icons/fa'
import type { Task, Workspace } from '@/lib/supabase/client'
import { WorkspaceManager } from '@/lib/workspace-manager'

interface TodoItem {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
  createdAt: Date
  completedAt?: Date
}

interface FileChange {
  path: string
  type: 'created' | 'modified' | 'deleted'
  lines?: { added: number; removed: number }
}

interface TaskProgressProps {
  task: Task | null
  workspace: Workspace
}

export function TaskProgress({
  task,
  workspace
}: TaskProgressProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [isLoadingTodos, setIsLoadingTodos] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('todos')

  // Load todos when task changes
  useEffect(() => {
    if (!task) {
      setTodos([])
      return
    }

    const loadTodos = async () => {
      try {
        setIsLoadingTodos(true)
        const taskTodos = await WorkspaceManager.getTaskTodos(task.id)
        setTodos(taskTodos.map(t => ({
          id: t.id,
          text: t.text,
          status: t.status,
          createdAt: new Date(t.created_at),
          completedAt: t.completed_at ? new Date(t.completed_at) : undefined
        })))
      } catch (err) {
        console.error('Error loading todos:', err)
      } finally {
        setIsLoadingTodos(false)
      }
    }

    loadTodos()

    // Subscribe to todo updates
    const todosChannel = WorkspaceManager.subscribeToTodos(
      task.id,
      ({ type, todo }) => {
        if (type === 'INSERT') {
          setTodos(prev => [...prev, {
            id: todo.id,
            text: todo.text,
            status: todo.status,
            createdAt: new Date(todo.created_at),
            completedAt: todo.completed_at ? new Date(todo.completed_at) : undefined
          }])
        } else if (type === 'UPDATE') {
          setTodos(prev => prev.map(t =>
            t.id === todo.id
              ? {
                  ...t,
                  status: todo.status,
                  completedAt: todo.completed_at ? new Date(todo.completed_at) : undefined
                }
              : t
          ))
        } else if (type === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== todo.id))
        }
      }
    )

    return () => {
      todosChannel.unsubscribe()
    }
  }, [task?.id])

  // Auto-expand todos section when todos exist
  useEffect(() => {
    if (todos.length > 0 && expandedSection !== 'todos') {
      setExpandedSection('todos')
    }
  }, [todos.length])

  // Mock data for other sections - will be populated later
  const fileChanges: FileChange[] = []
  const resources = {
    cpu: 0,
    memory: 0,
    duration: task?.started_at
      ? Math.floor((Date.now() - new Date(task.started_at).getTime()) / 1000)
      : 0
  }
  const activity = {
    commandsRun: 0,
    filesEdited: 0,
    testsPassed: 0,
    testsFailed: 0,
  }

  const todoStats = {
    total: todos.length,
    completed: todos.filter(t => t.status === 'completed').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    pending: todos.filter(t => t.status === 'pending').length,
  }

  const progress = todoStats.total > 0 
    ? Math.round((todoStats.completed / todoStats.total) * 100)
    : 0

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold mb-2">Task Progress</h2>
        
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{todoStats.completed} completed</span>
            <span>{todoStats.inProgress} in progress</span>
            <span>{todoStats.pending} pending</span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* TODO List Section */}
        <Section
          title="Current TODO"
          icon={<FaCheckCircle />}
          count={todos.length}
          isExpanded={expandedSection === 'todos'}
          onToggle={() => setExpandedSection(expandedSection === 'todos' ? null : 'todos')}
        >
          <div className="space-y-2">
            <AnimatePresence>
              {todos.map((todo) => (
                <TodoItemComponent key={todo.id} todo={todo} />
              ))}
            </AnimatePresence>
          </div>
        </Section>

        {/* File Changes Section */}
        <Section
          title="Files Changed"
          icon={<FaFile />}
          count={fileChanges.length}
          isExpanded={expandedSection === 'files'}
          onToggle={() => setExpandedSection(expandedSection === 'files' ? null : 'files')}
        >
          <div className="space-y-1">
            {fileChanges.map((file, index) => (
              <FileChangeItem key={index} file={file} />
            ))}
          </div>
        </Section>

        {/* Resources Section */}
        <Section
          title="Resources"
          icon={<FaMicrochip />}
          isExpanded={expandedSection === 'resources'}
          onToggle={() => setExpandedSection(expandedSection === 'resources' ? null : 'resources')}
        >
          <div className="space-y-3">
            <ResourceMeter
              icon={<FaClock />}
              label="Duration"
              value={formatDuration(resources.duration)}
              color="text-blue-500"
            />
            <ResourceMeter
              icon={<FaMicrochip />}
              label="CPU Usage"
              value={`${resources.cpu}%`}
              progress={resources.cpu}
              color="text-green-500"
              showWarning={resources.cpu > 80}
            />
            <ResourceMeter
              icon={<FaMemory />}
              label="Memory Usage"
              value={`${resources.memory}%`}
              progress={resources.memory}
              color="text-purple-500"
              showWarning={resources.memory > 80}
            />
          </div>
        </Section>

        {/* Activity Section */}
        <Section
          title="Activity"
          icon={<FaChartLine />}
          isExpanded={expandedSection === 'activity'}
          onToggle={() => setExpandedSection(expandedSection === 'activity' ? null : 'activity')}
        >
          <div className="grid grid-cols-2 gap-3">
            <ActivityStat
              icon={<FaTerminal />}
              label="Commands"
              value={activity.commandsRun}
              color="text-cyan-500"
            />
            <ActivityStat
              icon={<FaEdit />}
              label="Files Edited"
              value={activity.filesEdited}
              color="text-yellow-500"
            />
            <ActivityStat
              icon={<FaCheckCircle />}
              label="Tests Passed"
              value={activity.testsPassed}
              color="text-green-500"
            />
            <ActivityStat
              icon={<FaExclamationTriangle />}
              label="Tests Failed"
              value={activity.testsFailed}
              color="text-red-500"
            />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ 
  title, 
  icon, 
  count, 
  isExpanded, 
  onToggle, 
  children 
}: {
  title: string
  icon: React.ReactNode
  count?: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-gray-800">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{icon}</span>
          <span className="font-medium">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TodoItemComponent({ todo }: { todo: TodoItem }) {
  const statusIcons = {
    pending: <FaClock className="text-gray-500" />,
    in_progress: <FaSpinner className="text-blue-500 animate-spin" />,
    completed: <FaCheckCircle className="text-green-500" />,
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`flex items-start gap-2 p-2 rounded ${
        todo.status === 'completed' ? 'opacity-60' : ''
      }`}
    >
      <span className="mt-0.5">{statusIcons[todo.status]}</span>
      <span className={`text-sm flex-1 ${
        todo.status === 'completed' ? 'line-through text-gray-500' : ''
      }`}>
        {todo.text}
      </span>
    </motion.div>
  )
}

function FileChangeItem({ file }: { file: FileChange }) {
  const typeColors = {
    created: 'text-green-500',
    modified: 'text-yellow-500',
    deleted: 'text-red-500',
  }

  const typeIcons = {
    created: '+',
    modified: '~',
    deleted: '-',
  }

  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className={`font-bold ${typeColors[file.type]}`}>
        {typeIcons[file.type]}
      </span>
      <span className="font-mono text-xs truncate flex-1">{file.path}</span>
      {file.lines && (
        <span className="text-xs text-gray-500">
          <span className="text-green-500">+{file.lines.added}</span>
          {' '}
          <span className="text-red-500">-{file.lines.removed}</span>
        </span>
      )}
    </div>
  )
}

function ResourceMeter({ 
  icon, 
  label, 
  value, 
  progress, 
  color,
  showWarning 
}: {
  icon: React.ReactNode
  label: string
  value: string
  progress?: number
  color: string
  showWarning?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <span>{label}</span>
        </div>
        <span className={`font-medium ${showWarning ? 'text-yellow-500' : ''}`}>
          {value}
          {showWarning && <FaExclamationTriangle className="inline ml-1 text-xs" />}
        </span>
      </div>
      {progress !== undefined && (
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${showWarning ? 'bg-yellow-500' : 'bg-gray-600'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </div>
  )
}

function ActivityStat({ 
  icon, 
  label, 
  value, 
  color 
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
      <span className={`text-lg ${color}`}>{icon}</span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}