'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

export interface WebSocketMessage {
  id: string
  type: string
  timestamp: string
  payload?: any
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  toolName?: string
  toolId?: string
  toolInput?: Record<string, unknown>
  toolOutput?: unknown
  isError?: boolean
}

export interface QueryOptions {
  systemPrompt?: string
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  maxTurns?: number
  allowedTools?: string[]
  disallowedTools?: string[]
}

export interface UseWebSocketOptions {
  url: string
  autoConnect?: boolean
  reconnect?: boolean
  reconnectDelay?: number
  maxReconnectAttempts?: number
  maxReconnectDelay?: number
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Error) => void
  onOpen?: () => void
  onClose?: () => void
}

export function useWebSocket({
  url,
  autoConnect = true,
  reconnect = true,
  reconnectDelay = 1000,
  maxReconnectAttempts = 5,
  maxReconnectDelay = 30000,
  onMessage,
  onError,
  onOpen,
  onClose,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string>(uuidv4())
  const currentReconnectDelay = useRef(reconnectDelay)
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Reset reconnection state when manually connecting
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      reconnectAttemptsRef.current = 0
      setReconnectAttempts(0)
      currentReconnectDelay.current = reconnectDelay
    }

    setIsConnecting(true)
    setError(null)

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setIsConnecting(false)
        reconnectAttemptsRef.current = 0 // Reset attempts on successful connection
        setReconnectAttempts(0)
        currentReconnectDelay.current = reconnectDelay // Reset delay
        onOpen?.()
      }

      ws.onclose = () => {
        setIsConnected(false)
        setIsConnecting(false)
        wsRef.current = null
        onClose?.()

        // Only attempt reconnection if enabled and not exceeded max attempts
        if (reconnect && !reconnectTimeoutRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(currentReconnectDelay.current, maxReconnectDelay)

          console.log(`WebSocket disconnected. Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            reconnectAttemptsRef.current += 1
            setReconnectAttempts(reconnectAttemptsRef.current)
            // Exponential backoff: double the delay for next attempt
            currentReconnectDelay.current = Math.min(currentReconnectDelay.current * 2, maxReconnectDelay)
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error(`WebSocket reconnection failed after ${maxReconnectAttempts} attempts`)
          setError(new Error(`Failed to connect after ${maxReconnectAttempts} attempts`))
        }
      }

      ws.onerror = (event) => {
        const err = new Error('WebSocket error')
        setError(err)
        onError?.(err)
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setMessages((prev) => [...prev, message])
          onMessage?.(message)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }
    } catch (err) {
      setIsConnecting(false)
      setError(err as Error)
      onError?.(err as Error)
    }
  }, [url, reconnect, reconnectDelay, maxReconnectAttempts, maxReconnectDelay, onMessage, onError, onOpen, onClose])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  const sendMessage = useCallback((message: Partial<WebSocketMessage>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    const fullMessage: WebSocketMessage = {
      id: message.id || uuidv4(),
      type: message.type || 'unknown',
      timestamp: message.timestamp || new Date().toISOString(),
      payload: message.payload,
    }

    wsRef.current.send(JSON.stringify(fullMessage))
  }, [])

  const sendQuery = useCallback((prompt: string, options?: QueryOptions) => {
    const message = {
      id: uuidv4(),
      type: 'query',
      timestamp: new Date().toISOString(),
      payload: {
        prompt,
        sessionId: sessionIdRef.current,
        options,
      },
    }

    sendMessage(message)
    return message.id
  }, [sendMessage])

  const cancelQuery = useCallback((sessionId?: string) => {
    sendMessage({
      type: 'cancel',
      payload: {
        sessionId: sessionId || sessionIdRef.current,
      },
    })
  }, [sendMessage])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Manual retry function that resets the reconnection state
  const retry = useCallback(() => {
    // Clear any pending reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Reset reconnection state
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
    currentReconnectDelay.current = reconnectDelay
    setError(null)

    // Disconnect if currently connected and reconnect
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Start fresh connection
    connect()
  }, [reconnectDelay]) // Don't depend on connect to avoid circular dependency

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect]) // Only depend on autoConnect, not the functions

  return {
    isConnected,
    isConnecting,
    messages,
    error,
    connect,
    disconnect,
    sendMessage,
    sendQuery,
    cancelQuery,
    clearMessages,
    retry,
    reconnectAttempts,
    maxReconnectAttempts,
    sessionId: sessionIdRef.current,
  }
}