'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWebSocket, ContentBlock } from '../../lib/useWebSocket'
import ClaudeTerminal from '../../components/ClaudeTerminal'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { FaHome, FaWifi, FaTimes, FaCog } from 'react-icons/fa'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string | ContentBlock[]
  timestamp: Date
}

export default function ClaudePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [wsUrl, setWsUrl] = useState('ws://localhost:8080')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const {
    isConnected,
    isConnecting,
    error,
    sendQuery,
    cancelQuery,
    clearMessages,
    connect,
    disconnect,
    retry,
    reconnectAttempts,
    maxReconnectAttempts,
    sessionId,
    messages: wsMessages,
  } = useWebSocket({
    url: wsUrl,
    autoConnect: true,
    reconnect: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    maxReconnectDelay: 30000,
    onOpen: () => {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'system',
        content: '✅ Connected to Claude Agent Server',
        timestamp: new Date(),
      }])
    },
    onClose: () => {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'system',
        content: '❌ Disconnected from server',
        timestamp: new Date(),
      }])
    },
    onError: (err) => {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'error',
        content: `Connection error: ${err.message}`,
        timestamp: new Date(),
      }])
    },
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Process WebSocket messages
  useEffect(() => {
    const lastMessage = wsMessages[wsMessages.length - 1]
    if (!lastMessage) return

    switch (lastMessage.type) {
      case 'response':
        const content = lastMessage.payload?.content
        if (content && content.length > 0) {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1]
            // If the last message is from assistant and same session, append to it
            if (
              lastMsg?.type === 'assistant' &&
              typeof lastMsg.content !== 'string' &&
              Array.isArray(lastMsg.content)
            ) {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMsg,
                  content: [...lastMsg.content, ...content],
                },
              ]
            }
            // Otherwise create new assistant message
            return [...prev, {
              id: uuidv4(),
              type: 'assistant',
              content: content,
              timestamp: new Date(),
            }]
          })
        }
        break

      case 'progress':
        // Could show progress in UI if desired
        console.log('Progress:', lastMessage.payload?.message)
        break

      case 'error':
        setMessages(prev => [...prev, {
          id: uuidv4(),
          type: 'error',
          content: `Error [${lastMessage.payload?.code}]: ${lastMessage.payload?.message}`,
          timestamp: new Date(),
        }])
        setIsProcessing(false)
        break

      case 'complete':
        setIsProcessing(false)
        if (lastMessage.payload?.status === 'success') {
          setMessages(prev => [...prev, {
            id: uuidv4(),
            type: 'system',
            content: `✓ Complete (${lastMessage.payload?.totalTurns} turns, ${lastMessage.payload?.tokensUsed} tokens, ${(lastMessage.payload?.duration / 1000).toFixed(1)}s)`,
            timestamp: new Date(),
          }])
        }
        break

      case 'tool_use':
      case 'tool_result':
        // These are handled in the response content blocks
        break
    }
  }, [wsMessages])

  const handleSendPrompt = useCallback((prompt: string) => {
    setMessages(prev => [...prev, {
      id: uuidv4(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    }])

    setIsProcessing(true)
    const queryId = sendQuery(prompt, {
      systemPrompt: systemPrompt || undefined,
      permissionMode: 'acceptEdits',
    })
    setCurrentSessionId(sessionId)
  }, [sendQuery, sessionId, systemPrompt])

  const handleClear = useCallback(() => {
    setMessages([])
    clearMessages()
  }, [clearMessages])

  const handleCancel = useCallback(() => {
    if (currentSessionId) {
      cancelQuery(currentSessionId)
      setIsProcessing(false)
    }
  }, [cancelQuery, currentSessionId])

  const handleConnect = useCallback(() => {
    if (isConnected) {
      disconnect()
    } else {
      connect()
    }
  }, [isConnected, connect, disconnect])

  const handleSaveSettings = useCallback(() => {
    // In a real app, you'd configure the API key via the WebSocket
    // For now, we'll just close the settings
    setShowSettings(false)

    // Reconnect with new URL if changed
    if (wsUrl !== 'ws://localhost:8080') {
      disconnect()
      setTimeout(() => connect(), 100)
    }
  }, [wsUrl, disconnect, connect])

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <FaHome />
                <span>Home</span>
              </Link>
              <h1 className="text-xl font-bold text-white">Claude Web Terminal</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Connection status indicator */}
              {!isConnected && reconnectAttempts > 0 && reconnectAttempts < maxReconnectAttempts && (
                <div className="text-yellow-400 text-sm">
                  Reconnecting... ({reconnectAttempts}/{maxReconnectAttempts})
                </div>
              )}

              {/* Show retry button when max attempts reached */}
              {!isConnected && reconnectAttempts >= maxReconnectAttempts && (
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-sm">Connection failed</span>
                  <button
                    onClick={retry}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                  >
                    <FaWifi />
                    Retry Connection
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white transition-colors"
              >
                <FaCog />
                Settings
              </button>

              {/* Regular connect/disconnect button */}
              {(isConnected || (!isConnected && reconnectAttempts < maxReconnectAttempts)) && (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isConnecting
                      ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                      : isConnected
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <FaWifi className="animate-pulse" />
                      Connecting...
                    </>
                  ) : isConnected ? (
                    <>
                      <FaTimes />
                      Disconnect
                    </>
                  ) : (
                    <>
                      <FaWifi />
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-[calc(100vh-10rem)]">
          <ClaudeTerminal
            messages={messages}
            isConnected={isConnected}
            isProcessing={isProcessing}
            onSendPrompt={handleSendPrompt}
            onClear={handleClear}
            onCancel={handleCancel}
          />
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  WebSocket URL
                </label>
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                  placeholder="ws://localhost:8080"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                  placeholder="sk-..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  If not set, the server must have an API key configured
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  System Prompt (Optional)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                  rows={3}
                  placeholder="You are a helpful AI assistant..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}