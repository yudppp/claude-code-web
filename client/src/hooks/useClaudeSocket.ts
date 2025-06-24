import { useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  CommentErrorEvent,
  CommentEvent,
  ExecutionErrorEvent,
  ExecutionEvent,
  Message,
  MessageEvent,
  ResultMessageEvent,
  ServerToClientEvents,
  SessionData,
  ToolApprovalEvent,
} from '../types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface UseClaudeSocketOptions {
  onSessionsUpdate?: (data: { sessions: SessionData[] }) => void
  onMessage?: (message: Message) => void
  onExecutionStart?: () => void
  onExecutionComplete?: () => void
  onExecutionError?: (error: string) => void
  onToolApproval?: (data: ToolApprovalEvent) => void
  onCommentSent?: (data: CommentEvent) => void
  onCommentComplete?: (data: CommentEvent) => void
  onCommentError?: (data: CommentErrorEvent) => void
  onViewersUpdate?: (data: { sessionId: string; count: number }) => void
  onNotification?: (notification: any) => void
}

export function useClaudeSocket(socket: TypedSocket | null, options: UseClaudeSocketOptions) {
  const {
    onSessionsUpdate,
    onMessage,
    onExecutionStart,
    onExecutionComplete,
    onExecutionError,
    onToolApproval,
    onCommentSent,
    onCommentComplete,
    onCommentError,
    onViewersUpdate,
    onNotification,
  } = options

  useEffect(() => {
    if (!socket) return

    // Session events
    const handleSessionsUpdate = (data: { sessions: SessionData[] }) => {
      onSessionsUpdate?.(data)
    }

    // Message events
    const handleUserMessage = (data: MessageEvent) => {
      onMessage?.({
        id: Date.now().toString(),
        type: 'user',
        content: data.content,
        timestamp: data.timestamp,
      })
    }

    const handleAssistantMessage = (data: MessageEvent) => {
      onMessage?.({
        id: Date.now().toString(),
        type: 'assistant',
        content: data.content,
        timestamp: data.timestamp,
      })
    }

    const handleSystemMessage = (data: MessageEvent & { sessionInfo?: any }) => {
      onMessage?.({
        id: Date.now().toString(),
        type: 'system',
        content: data.content,
        timestamp: data.timestamp,
        sessionInfo: data.sessionInfo,
      })
    }

    const handleResultMessage = (data: ResultMessageEvent) => {
      onMessage?.({
        id: Date.now().toString(),
        type: 'result',
        timestamp: data.timestamp,
        usage: data.usage,
        cost: data.totalCost,
      })
    }

    // Execution events
    const handleExecutionStart = (data: ExecutionEvent) => {
      onExecutionStart?.()
    }

    const handleExecutionComplete = (data: ExecutionEvent) => {
      onExecutionComplete?.()
    }

    const handleExecutionError = (data: ExecutionErrorEvent) => {
      onExecutionError?.(data.error)
    }

    const handleToolApproval = (data: ToolApprovalEvent) => {
      console.log('[DEBUG] Received tool:approval event:', data)
      onToolApproval?.(data)
    }

    // Comment events
    const handleCommentSent = (data: CommentEvent) => {
      console.log('[DEBUG] Comment sent:', data)
      onCommentSent?.(data)
    }

    const handleCommentComplete = (data: CommentEvent) => {
      console.log('[DEBUG] Comment complete:', data)
      onCommentComplete?.(data)
    }

    const handleCommentError = (data: CommentErrorEvent) => {
      console.log('[DEBUG] Comment error:', data)
      onCommentError?.(data)
    }

    // Viewers update
    const handleViewersUpdate = (data: { sessionId: string; count: number }) => {
      onViewersUpdate?.(data)
    }

    // Notifications
    const handleNotification = (data: any) => {
      onNotification?.(data)
    }

    // Register event listeners
    socket.on('sessions:update', handleSessionsUpdate)
    socket.on('message:user', handleUserMessage)
    socket.on('message:assistant', handleAssistantMessage)
    socket.on('message:system', handleSystemMessage)
    socket.on('message:result', handleResultMessage)
    socket.on('execution:start', handleExecutionStart)
    socket.on('execution:complete', handleExecutionComplete)
    socket.on('execution:error', handleExecutionError)
    socket.on('tool:approval', handleToolApproval)
    socket.on('comment:sent', handleCommentSent)
    socket.on('comment:complete', handleCommentComplete)
    socket.on('comment:error', handleCommentError)
    socket.on('viewers:update', handleViewersUpdate)
    socket.on('notification:new', handleNotification)

    // Cleanup
    return () => {
      socket.off('sessions:update', handleSessionsUpdate)
      socket.off('message:user', handleUserMessage)
      socket.off('message:assistant', handleAssistantMessage)
      socket.off('message:system', handleSystemMessage)
      socket.off('message:result', handleResultMessage)
      socket.off('execution:start', handleExecutionStart)
      socket.off('execution:complete', handleExecutionComplete)
      socket.off('execution:error', handleExecutionError)
      socket.off('tool:approval', handleToolApproval)
      socket.off('comment:sent', handleCommentSent)
      socket.off('comment:complete', handleCommentComplete)
      socket.off('comment:error', handleCommentError)
      socket.off('viewers:update', handleViewersUpdate)
      socket.off('notification:new', handleNotification)
    }
  }, [
    socket,
    onSessionsUpdate,
    onMessage,
    onExecutionStart,
    onExecutionComplete,
    onExecutionError,
    onToolApproval,
    onCommentSent,
    onCommentComplete,
    onCommentError,
    onViewersUpdate,
    onNotification,
  ])
}
