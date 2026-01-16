'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FaCopy, FaTerminal, FaCode, FaExpand, FaCompress,
  FaPlay, FaFile, FaFolder, FaEdit
} from 'react-icons/fa'

import type { Workspace, Task } from '@/lib/supabase/client'

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

interface ClaudeCodeViewProps {
  workspace: Workspace
  task: Task | null
  messages: Message[]
  isStreaming: boolean
  onStartTask: (prompt: string) => void
}

export function ClaudeCodeView({
  workspace,
  task,
  messages,
  isStreaming,
  onStartTask
}: ClaudeCodeViewProps) {
  const [input, setInput] = useState('')
  const [viewMode, setViewMode] = useState<'chat' | 'split-terminal' | 'split-editor'>('chat')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = () => {
    if (input.trim() && !isStreaming) {
      onStartTask(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-gray-400">Claude is working on:</h3>
          <div className="flex items-center gap-2">
            <FaFolder className="text-gray-500" />
            <span className="font-mono text-sm">{workspace.repo_name}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'chat' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setViewMode('split-terminal')}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                viewMode === 'split-terminal' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FaTerminal className="w-3 h-3" />
              Terminal
            </button>
            <button
              onClick={() => setViewMode('split-editor')}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                viewMode === 'split-editor' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FaCode className="w-3 h-3" />
              Editor
            </button>
          </div>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
          >
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className={`flex flex-col ${viewMode === 'chat' ? 'w-full' : 'w-1/2 border-r border-gray-800'}`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            
            {isStreaming && (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Claude is thinking...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-800">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claude to help with your task..."
                className="w-full p-3 pr-12 bg-gray-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                disabled={isStreaming}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isStreaming}
                className={`absolute bottom-3 right-3 p-2 rounded transition-colors ${
                  input.trim() && !isStreaming
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <FaPlay className="w-3 h-3" />
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>

        {/* Split View Content */}
        {viewMode !== 'chat' && (
          <div className="w-1/2 bg-gray-950">
            {viewMode === 'split-terminal' ? (
              <MockTerminal />
            ) : (
              <MockEditor />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[80%] ${isUser ? 'order-2' : ''}`}>
        {/* Role Label */}
        <div className={`text-xs text-gray-500 mb-1 ${isUser ? 'text-right' : ''}`}>
          {isUser ? 'You' : 'Claude'}
        </div>

        {/* Message Content */}
        <div
          className={`rounded-lg p-4 ${
            isUser
              ? 'bg-primary-500/20 border border-primary-500/30'
              : 'bg-gray-800 border border-gray-700'
          }`}
        >
          {/* Tool Use Indicator */}
          {message.toolUse && (
            <ToolUseIndicator toolUse={message.toolUse} />
          )}

          {/* Message Text */}
          <div className="prose prose-invert prose-sm max-w-none">
            <MessageContent content={message.content} />
          </div>

          {/* Code Blocks */}
          {extractCodeBlocks(message.content).map((block, index) => (
            <div key={index} className="mt-3">
              <div className="flex items-center justify-between bg-gray-950 px-3 py-1 rounded-t-lg">
                <span className="text-xs text-gray-400">{block.language || 'code'}</span>
                <button
                  onClick={() => copyToClipboard(block.code)}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {copied ? 'Copied!' : <FaCopy />}
                </button>
              </div>
              <pre className="bg-gray-950 p-3 rounded-b-lg overflow-x-auto">
                <code className="text-xs">{block.code}</code>
              </pre>
            </div>
          ))}
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-gray-600 mt-1 ${isUser ? 'text-right' : ''}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  )
}

function ToolUseIndicator({ toolUse }: { toolUse: any }) {
  const toolIcons: Record<string, any> = {
    'edit_file': FaEdit,
    'create_file': FaFile,
    'run_command': FaTerminal,
    'read_file': FaFile,
  }

  const Icon = toolIcons[toolUse.tool] || FaCode

  return (
    <div className="flex items-center gap-2 mb-2 p-2 bg-gray-900 rounded text-xs text-gray-400">
      <Icon className="w-3 h-3" />
      <span className="font-mono">
        {toolUse.tool}: {toolUse.params.path || toolUse.params.command || 'Processing...'}
      </span>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  // Remove code blocks for inline rendering
  const textContent = content.replace(/```[\s\S]*?```/g, '')
  
  return <>{textContent}</>
}

function extractCodeBlocks(content: string): Array<{ language?: string; code: string }> {
  const blocks: Array<{ language?: string; code: string }> = []
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1],
      code: match[2].trim()
    })
  }

  return blocks
}

function MockTerminal() {
  return (
    <div className="h-full p-4 font-mono text-sm">
      <div className="text-green-400 mb-2">$ npm run dev</div>
      <div className="text-gray-400">
        <div>&gt; website@0.1.0 dev</div>
        <div>&gt; next dev --turbopack</div>
        <div className="mt-2">
          <span className="text-cyan-400">▲ Next.js 15.4.1 (Turbopack)</span>
        </div>
        <div className="text-gray-500">
          - Local:        http://localhost:3000
        </div>
        <div className="text-green-400 mt-2">✓ Starting...</div>
        <div className="text-green-400">✓ Ready in 745ms</div>
      </div>
      <div className="mt-4 flex">
        <span className="text-green-400">$ </span>
        <span className="ml-1 w-2 h-4 bg-green-400 animate-pulse"></span>
      </div>
    </div>
  )
}

function MockEditor() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 bg-gray-800 text-xs">
        <FaFile className="text-gray-500" />
        <span>src/auth.js</span>
      </div>
      <div className="flex-1 p-4 font-mono text-sm overflow-auto">
        <pre className="text-gray-300">{`export async function authenticate(username, password) {
  // Validate input
  if (!username || !password) {
    throw new Error('Username and password required')
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      throw new Error('Authentication failed')
    }

    const { token, user } = await response.json()
    
    // Store token
    localStorage.setItem('auth_token', token)
    
    return { success: true, user }
  } catch (error) {
    console.error('Auth error:', error)
    return { success: false, error: error.message }
  }
}`}</pre>
      </div>
    </div>
  )
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date)
}