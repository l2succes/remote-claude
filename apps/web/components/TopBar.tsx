'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FaCog, FaPause, FaPlay, FaStop, FaRedo, 
  FaShareAlt, FaDownload, FaBell, FaExpand,
  FaCompress, FaHome, FaChevronDown
} from 'react-icons/fa'
import Link from 'next/link'

interface TopBarProps {
  taskName: string
  taskStatus: 'running' | 'paused' | 'completed' | 'failed'
  onTaskAction: (action: 'pause' | 'resume' | 'stop' | 'restart') => void
  onSettingsClick: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function TopBar({
  taskName,
  taskStatus,
  onTaskAction,
  onSettingsClick,
  isFullscreen = false,
  onToggleFullscreen
}: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(taskName)

  const handleNameSubmit = () => {
    // In a real app, this would update the task name
    setIsEditingName(false)
  }

  const statusColors = {
    running: 'text-green-500',
    paused: 'text-yellow-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  }

  return (
    <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Logo/Home */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">RC</span>
          </div>
          <span className="font-semibold text-lg">Remote Claude</span>
        </Link>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-700" />

        {/* Task Name */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Task:</span>
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="bg-gray-800 px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="font-medium hover:text-primary-400 transition-colors"
            >
              {taskName}
            </button>
          )}
          <span className={`text-sm ${statusColors[taskStatus]}`}>
            ({taskStatus})
          </span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Task Actions */}
        <div className="flex items-center gap-1 mr-2">
          {taskStatus === 'running' && (
            <button
              onClick={() => onTaskAction('pause')}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title="Pause Task"
            >
              <FaPause className="w-4 h-4" />
            </button>
          )}
          {taskStatus === 'paused' && (
            <button
              onClick={() => onTaskAction('resume')}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title="Resume Task"
            >
              <FaPlay className="w-4 h-4" />
            </button>
          )}
          {(taskStatus === 'running' || taskStatus === 'paused') && (
            <button
              onClick={() => onTaskAction('stop')}
              className="p-2 hover:bg-gray-800 rounded transition-colors text-red-500"
              title="Stop Task"
            >
              <FaStop className="w-4 h-4" />
            </button>
          )}
          {(taskStatus === 'completed' || taskStatus === 'failed') && (
            <button
              onClick={() => onTaskAction('restart')}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title="Restart Task"
            >
              <FaRedo className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-700" />

        {/* Quick Actions */}
        <button
          className="p-2 hover:bg-gray-800 rounded transition-colors"
          title="Share Task"
        >
          <FaShareAlt className="w-4 h-4" />
        </button>
        
        <button
          className="p-2 hover:bg-gray-800 rounded transition-colors"
          title="Download Logs"
        >
          <FaDownload className="w-4 h-4" />
        </button>

        <button
          className="p-2 hover:bg-gray-800 rounded transition-colors relative"
          title="Notifications"
        >
          <FaBell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <FaCompress className="w-4 h-4" /> : <FaExpand className="w-4 h-4" />}
          </button>
        )}

        {/* Settings Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-800 rounded transition-colors flex items-center gap-1"
          >
            <FaCog className="w-4 h-4" />
            <FaChevronDown className="w-3 h-3" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                
                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50"
                >
                  <div className="p-1">
                    <MenuItem onClick={onSettingsClick}>
                      Task Settings
                    </MenuItem>
                    <MenuItem>Resource Limits</MenuItem>
                    <MenuItem>Notifications</MenuItem>
                    <div className="my-1 border-t border-gray-700" />
                    <MenuItem>Export Logs</MenuItem>
                    <MenuItem>Export Results</MenuItem>
                    <div className="my-1 border-t border-gray-700" />
                    <MenuItem>View Documentation</MenuItem>
                    <MenuItem>Keyboard Shortcuts</MenuItem>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function MenuItem({ 
  children, 
  onClick 
}: { 
  children: React.ReactNode
  onClick?: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 rounded transition-colors"
    >
      {children}
    </button>
  )
}