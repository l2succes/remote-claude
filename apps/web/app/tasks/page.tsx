'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskList, Task } from '@/components/TaskList'
import { motion } from 'framer-motion'
import { FaPlus, FaRocket, FaClock, FaCheckCircle, FaTasks } from 'react-icons/fa'

// Mock data
const mockTasks: Task[] = [
  {
    id: '1',
    name: 'Fix Authentication Bug',
    description: 'Fix the login timeout issue in auth.js',
    repository: 'https://github.com/mycompany/webapp.git',
    branch: 'main',
    status: 'running',
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
    status: 'queued',
    progress: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '3',
    name: 'Update Documentation',
    description: 'Update API documentation with new endpoints',
    repository: 'https://github.com/mycompany/docs.git',
    branch: 'main',
    status: 'completed',
    progress: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
    startedAt: new Date(Date.now() - 1000 * 60 * 50),
    completedAt: new Date(Date.now() - 1000 * 60 * 20),
    duration: 1800,
  },
  {
    id: '4',
    name: 'Refactor Database Layer',
    description: 'Improve database query performance',
    repository: 'https://github.com/mycompany/backend.git',
    branch: 'refactor/db-layer',
    status: 'failed',
    progress: 35,
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    startedAt: new Date(Date.now() - 1000 * 60 * 110),
    duration: 600,
  },
]

export default function TasksPage() {
  const router = useRouter()
  const [tasks] = useState<Task[]>(mockTasks)

  const stats = {
    total: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    queued: tasks.filter(t => t.status === 'queued').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }

  const handleSelectTask = (taskId: string) => {
    router.push(`/tasks/${taskId}`)
  }

  const handleTaskAction = (taskId: string, action: string) => {
    console.log('Task action:', taskId, action)
    // In a real app, this would trigger API calls
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Tasks</h1>
              <p className="mt-2 text-gray-400">Manage and monitor your Claude Code tasks</p>
            </div>
            <button
              onClick={() => console.log('Create new task')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
            >
              <FaPlus />
              New Task
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<FaTasks />}
            label="Total Tasks"
            value={stats.total}
            color="text-blue-500"
          />
          <StatCard
            icon={<FaRocket />}
            label="Running"
            value={stats.running}
            color="text-green-500"
          />
          <StatCard
            icon={<FaClock />}
            label="Queued"
            value={stats.queued}
            color="text-yellow-500"
          />
          <StatCard
            icon={<FaCheckCircle />}
            label="Completed"
            value={stats.completed}
            color="text-purple-500"
          />
        </div>

        {/* Task List */}
        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
          <TaskList
            tasks={tasks}
            selectedTaskId={undefined}
            onSelectTask={handleSelectTask}
            onTaskAction={handleTaskAction}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`text-3xl ${color}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  )
}