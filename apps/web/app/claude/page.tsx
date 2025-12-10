'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWebSocket, ContentBlock } from '../../lib/useWebSocket'
import ClaudeTerminal from '../../components/ClaudeTerminal'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { FaHome, FaWifi, FaTimes, FaCog, FaGithub, FaFolder, FaDownload, FaSpinner, FaCheck, FaSearch, FaSignOutAlt } from 'react-icons/fa'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string | ContentBlock[]
  timestamp: Date
}

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  clone_url?: string
  ssh_url?: string
  description: string | null
  language: string | null
  updated_at: string
  stargazers_count: number
  default_branch: string
  owner?: {
    login: string
    avatar_url: string
  }
}

export default function ClaudePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [wsUrl, setWsUrl] = useState('ws://localhost:8080')
  const [showSettings, setShowSettings] = useState(false)
  const [showGitHub, setShowGitHub] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  // GitHub state
  const [githubAuth, setGithubAuth] = useState<{ username?: string; isAuthenticated: boolean }>({ isAuthenticated: false })
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [repoSearch, setRepoSearch] = useState('')
  const [cloning, setCloning] = useState(false)
  const [workingDir, setWorkingDir] = useState('/workspace')

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

  // Check GitHub auth status
  useEffect(() => {
    checkGitHubAuth()

    // Check for auth success/error in URL params
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'system',
        content: '✅ Successfully authenticated with GitHub',
        timestamp: new Date(),
      }])
      // Clean up URL
      window.history.replaceState({}, '', '/claude')
      // Fetch repos after successful auth
      setTimeout(() => fetchRepos(), 500)
    } else if (params.get('error')) {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'error',
        content: `GitHub authentication failed: ${params.get('error')}`,
        timestamp: new Date(),
      }])
      window.history.replaceState({}, '', '/claude')
    }
  }, [])

  const checkGitHubAuth = async () => {
    try {
      const response = await fetch('/api/github/auth')
      const data = await response.json()
      if (data.isAuthenticated && data.user) {
        setGithubAuth({ username: data.user.username, isAuthenticated: true })
      }
    } catch (err) {
      console.error('Failed to check GitHub auth:', err)
    }
  }

  const loginWithGitHub = () => {
    // Redirect to GitHub OAuth login
    window.location.href = '/api/github/login'
  }

  const logoutFromGitHub = async () => {
    try {
      await fetch('/api/github/logout', { method: 'POST' })
      setGithubAuth({ isAuthenticated: false })
      setRepos([])
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'system',
        content: '✅ Logged out from GitHub',
        timestamp: new Date(),
      }])
    } catch (err) {
      console.error('Failed to logout:', err)
    }
  }

  const fetchRepos = async () => {
    setLoadingRepos(true)
    try {
      const response = await fetch('/api/github/repos')
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setRepos(data.repos || [])
      setLoadingRepos(false)
    } catch (err) {
      console.error('Failed to fetch repos:', err)
      setLoadingRepos(false)
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'error',
        content: 'Failed to fetch repositories. Please try again.',
        timestamp: new Date(),
      }])
    }
  }

  const cloneRepo = async (repo: GitHubRepo) => {
    setCloning(true)
    setSelectedRepo(repo)

    const cloneMessage = {
      id: uuidv4(),
      type: 'system',
      content: `🔄 Cloning ${repo.full_name}...`,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, cloneMessage])

    // Send clone command using gh CLI (which will use the stored token)
    const cloneCommand = `Clone the repository ${repo.html_url} to ${workingDir}/${repo.name} using: gh repo clone ${repo.full_name} ${workingDir}/${repo.name}`
    sendQuery(cloneCommand)

    setTimeout(() => {
      setCloning(false)
      setShowGitHub(false)
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'system',
        content: `✅ Successfully cloned ${repo.full_name} to ${workingDir}/${repo.name}`,
        timestamp: new Date(),
      }])
    }, 3000)
  }

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
            return [...prev, {
              id: uuidv4(),
              type: 'assistant',
              content: content,
              timestamp: new Date(),
            }]
          })
        }
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

      case 'error':
        setMessages(prev => [...prev, {
          id: uuidv4(),
          type: 'error',
          content: `Error [${lastMessage.payload?.code}]: ${lastMessage.payload?.message}`,
          timestamp: new Date(),
        }])
        setIsProcessing(false)
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

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    repo.description?.toLowerCase().includes(repoSearch.toLowerCase())
  )

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
              <h1 className="text-xl font-bold text-white">Claude Terminal</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* GitHub Button */}
              <button
                onClick={() => setShowGitHub(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <FaGithub />
                {githubAuth.isAuthenticated ? `@${githubAuth.username}` : 'GitHub'}
              </button>

              {/* Connection status */}
              {!isConnected && reconnectAttempts >= maxReconnectAttempts && (
                <button
                  onClick={retry}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  <FaWifi />
                  Retry
                </button>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white transition-colors"
              >
                <FaCog />
                Settings
              </button>

              {isConnected && (
                <button
                  onClick={disconnect}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <FaTimes />
                  Disconnect
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

      {/* GitHub Modal */}
      <AnimatePresence>
        {showGitHub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowGitHub(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FaGithub />
                  GitHub Repositories
                </h2>
                <button
                  onClick={() => setShowGitHub(false)}
                  className="p-2 hover:bg-gray-700 rounded transition-colors"
                >
                  <FaTimes />
                </button>
              </div>

              {!githubAuth.isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FaGithub className="text-6xl text-gray-600 mb-4" />
                  <p className="text-gray-400 mb-6">Connect your GitHub account to clone repositories</p>
                  <button
                    onClick={loginWithGitHub}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <FaGithub />
                    Login with GitHub
                  </button>
                  <p className="text-xs text-gray-500 mt-4">
                    You'll be redirected to GitHub to authorize access
                  </p>
                </div>
              ) : (
                <>
                  {/* User info and logout */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <FaGithub />
                      <span>Logged in as <strong className="text-white">@{githubAuth.username}</strong></span>
                    </div>
                    <button
                      onClick={logoutFromGitHub}
                      className="flex items-center gap-2 px-3 py-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <FaSignOutAlt />
                      Logout
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Search repositories..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400"
                    />
                  </div>

                  {/* Working Directory */}
                  <div className="flex items-center gap-2 mb-4">
                    <FaFolder className="text-gray-500" />
                    <span className="text-sm text-gray-400">Clone to:</span>
                    <input
                      type="text"
                      value={workingDir}
                      onChange={(e) => setWorkingDir(e.target.value)}
                      className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm"
                    />
                  </div>

                  {/* Repo List */}
                  <div className="flex-1 overflow-y-auto">
                    {loadingRepos ? (
                      <div className="flex items-center justify-center py-12">
                        <FaSpinner className="text-4xl text-gray-600 animate-spin" />
                      </div>
                    ) : filteredRepos.length > 0 ? (
                      <div className="grid gap-2">
                        {filteredRepos.map((repo) => (
                          <div
                            key={repo.id}
                            className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors"
                            onClick={() => !cloning && cloneRepo(repo)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{repo.name}</h3>
                                  {repo.private && (
                                    <span className="text-xs px-2 py-1 bg-gray-600 rounded">Private</span>
                                  )}
                                  {repo.language && (
                                    <span className="text-xs text-gray-400">{repo.language}</span>
                                  )}
                                </div>
                                {repo.description && (
                                  <p className="text-sm text-gray-400 mt-1">{repo.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span>⭐ {repo.stargazers_count}</span>
                                  <span>🌿 {repo.default_branch}</span>
                                  <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              {selectedRepo?.id === repo.id && cloning ? (
                                <FaSpinner className="text-green-500 animate-spin" />
                              ) : (
                                <FaDownload className="text-gray-500 hover:text-white transition-colors" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        {repoSearch ? 'No repositories found' : 'No repositories available'}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <button
                      onClick={fetchRepos}
                      disabled={loadingRepos}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Refresh Repositories
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                onClick={() => setShowSettings(false)}
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