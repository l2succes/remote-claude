'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaTerminal, FaSpinner, FaCheck, FaTimes, FaTools } from 'react-icons/fa'
import { ContentBlock } from '../lib/useWebSocket'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string | ContentBlock[]
  timestamp: Date
}

interface ClaudeTerminalProps {
  messages: Message[]
  isConnected: boolean
  isProcessing: boolean
  onSendPrompt: (prompt: string) => void
  onClear: () => void
  onCancel?: () => void
}

export default function ClaudeTerminal({
  messages,
  isConnected,
  isProcessing,
  onSendPrompt,
  onClear,
  onCancel,
}: ClaudeTerminalProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!input.trim() || !isConnected || isProcessing) return

    const prompt = input.trim()
    onSendPrompt(prompt)
    setHistory(prev => [...prev, prompt])
    setHistoryIndex(-1)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'ArrowUp' && input === '') {
      e.preventDefault()
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex])
      }
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex])
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      onClear()
    }
  }

  const renderContent = (content: string | ContentBlock[]) => {
    if (typeof content === 'string') {
      return <div className="whitespace-pre-wrap">{content}</div>
    }

    return (
      <div className="space-y-2">
        {content.map((block, index) => {
          if (block.type === 'text') {
            return (
              <div key={index} className="whitespace-pre-wrap">
                {block.text}
              </div>
            )
          } else if (block.type === 'tool_use') {
            return (
              <div key={index} className="flex items-start gap-2 text-blue-400">
                <FaTools className="mt-1 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Using tool: {block.toolName}</div>
                  {block.toolInput && (
                    <pre className="mt-1 text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(block.toolInput, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )
          } else if (block.type === 'tool_result') {
            return (
              <div key={index} className="flex items-start gap-2">
                {block.isError ? (
                  <FaTimes className="mt-1 text-red-400 flex-shrink-0" />
                ) : (
                  <FaCheck className="mt-1 text-green-400 flex-shrink-0" />
                )}
                <div className="text-sm text-gray-400">
                  Tool result {block.isError ? 'failed' : 'received'}
                </div>
              </div>
            )
          }
          return null
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FaTerminal className="text-primary-500" />
          <span className="text-sm font-semibold">Claude Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4"
            >
              {message.type === 'user' && (
                <div className="flex items-start gap-2">
                  <span className="text-green-500">$</span>
                  <div className="flex-1 text-white">{renderContent(message.content)}</div>
                </div>
              )}
              {message.type === 'assistant' && (
                <div className="pl-4 text-gray-300">
                  {renderContent(message.content)}
                </div>
              )}
              {message.type === 'system' && (
                <div className="text-blue-400 italic">
                  {renderContent(message.content)}
                </div>
              )}
              {message.type === 'error' && (
                <div className="text-red-400">
                  ❌ {renderContent(message.content)}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing Indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-blue-400"
          >
            <FaSpinner className="animate-spin" />
            <span>Processing...</span>
            {onCancel && (
              <button
                onClick={onCancel}
                className="ml-2 text-xs text-gray-400 hover:text-white transition-colors"
              >
                (Press Esc to cancel)
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Terminal Input */}
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="flex items-start gap-2">
          <span className="text-green-500 mt-1">$</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected || isProcessing}
            placeholder={
              !isConnected
                ? 'Waiting for connection...'
                : isProcessing
                ? 'Processing...'
                : 'Enter your prompt (Shift+Enter for new line)'
            }
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none resize-none"
            rows={Math.min(input.split('\n').length || 1, 10)}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Press Enter to send • Shift+Enter for new line • Ctrl+L to clear • ↑↓ for history
        </div>
      </div>
    </div>
  )
}