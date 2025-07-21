'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaPlay, FaPause, FaStop, FaRedo, FaSearch, FaFilter } from 'react-icons/fa'
import { format } from 'date-fns'

export interface Task {
  id: string
  name: string
  description: string
  repository: string
  branch?: string
  status: 'running' | 'queued' | 'paused' | 'completed' | 'failed' | 'restarting'
  progress: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  duration?: number
  resources?: {
    cpu: number
    memory: number
  }
}

interface TaskListProps {
  tasks: Task[]
  selectedTaskId?: string
  onSelectTask: (taskId: string) => void
  onTaskAction: (taskId: string, action: 'start' | 'pause' | 'stop' | 'restart') => void
}

const statusConfig = {
  running: { icon: '🟢', color: 'text-green-500', bgColor: 'bg-green-500/10', pulse: true },
  queued: { icon: '🟡', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', pulse: false },
  paused: { icon: '⏸️', color: 'text-gray-500', bgColor: 'bg-gray-500/10', pulse: false },
  completed: { icon: '✅', color: 'text-green-500', bgColor: 'bg-green-500/10', pulse: false },
  failed: { icon: '❌', color: 'text-red-500', bgColor: 'bg-red-500/10', pulse: false },
  restarting: { icon: '🔄', color: 'text-blue-500', bgColor: 'bg-blue-500/10', pulse: true },
}

export function TaskList({ tasks, selectedTaskId, onSelectTask, onTaskAction }: TaskListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'none' | 'repository' | 'status'>('repository')

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.repository.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const groupedTasks = groupTasks(filteredTasks, groupBy)

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Tasks</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 text-xs">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 px-2 py-1 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="flex-1 px-2 py-1 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:border-primary-500"
          >
            <option value="none">No Grouping</option>
            <option value="repository">By Repository</option>
            <option value="status">By Status</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {Object.entries(groupedTasks).map(([group, tasks]) => (
            <div key={group}>
              {groupBy !== 'none' && (
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-800/50">
                  {group}
                </div>
              )}
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => onSelectTask(task.id)}
                  onAction={(action) => onTaskAction(task.id, action)}
                />
              ))}
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{tasks.filter(t => t.status === 'running').length} running</span>
          <span>{tasks.filter(t => t.status === 'queued').length} queued</span>
          <span>{tasks.length} total</span>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, isSelected, onSelect, onAction }: {
  task: Task
  isSelected: boolean
  onSelect: () => void
  onAction: (action: 'start' | 'pause' | 'stop' | 'restart') => void
}) {
  const status = statusConfig[task.status]
  const repoName = task.repository.split('/').pop()?.replace('.git', '') || task.repository

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`p-4 border-b border-gray-800 cursor-pointer transition-colors ${
        isSelected ? 'bg-primary-500/10 border-l-2 border-l-primary-500' : 'hover:bg-gray-800/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={`flex-shrink-0 ${status.pulse ? 'animate-pulse' : ''}`}>
          <span className="text-lg">{status.icon}</span>
        </div>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{task.name}</h3>
          <p className="text-xs text-gray-500 truncate">
            {repoName} {task.branch && `• ${task.branch}`} • {formatRelativeTime(task.createdAt)}
          </p>
          
          {/* Progress Bar */}
          {task.status === 'running' && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{task.progress}%</span>
                {task.duration && <span>{formatDuration(task.duration)}</span>}
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Resource Usage */}
          {task.status === 'running' && task.resources && (
            <div className="mt-2 flex gap-3 text-xs text-gray-500">
              <span>CPU: {task.resources.cpu}%</span>
              <span>Memory: {task.resources.memory}%</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {task.status === 'queued' && (
            <button
              onClick={() => onAction('start')}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="Start"
            >
              <FaPlay className="w-3 h-3" />
            </button>
          )}
          {task.status === 'running' && (
            <>
              <button
                onClick={() => onAction('pause')}
                className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                title="Pause"
              >
                <FaPause className="w-3 h-3" />
              </button>
              <button
                onClick={() => onAction('stop')}
                className="p-1.5 hover:bg-gray-700 rounded transition-colors text-red-500"
                title="Stop"
              >
                <FaStop className="w-3 h-3" />
              </button>
            </>
          )}
          {(task.status === 'completed' || task.status === 'failed') && (
            <button
              onClick={() => onAction('restart')}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="Restart"
            >
              <FaRedo className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function groupTasks(tasks: Task[], groupBy: 'none' | 'repository' | 'status'): Record<string, Task[]> {
  if (groupBy === 'none') {
    return { '': tasks }
  }

  return tasks.reduce((groups, task) => {
    const key = groupBy === 'repository' 
      ? task.repository.split('/').pop()?.replace('.git', '') || 'Unknown'
      : task.status.charAt(0).toUpperCase() + task.status.slice(1)
    
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(task)
    return groups
  }, {} as Record<string, Task[]>)
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return format(date, 'MMM d')
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}