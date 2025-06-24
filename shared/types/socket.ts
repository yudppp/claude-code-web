// Socket.io event type definitions
import type { ExecuteOptions } from './index'

// Client to Server events
export interface ClientToServerEvents {
  // Session related
  'sessions:list': () => void
  'session:join': (data: { sessionId: string }) => void
  'session:leave': (data: { sessionId: string }) => void
  'session:resume': (data: { sessionId: string }) => void

  // Comment submission
  'comment:send': (data: { comment: string; sessionId: string; allowedTools?: string[] }) => void

  // Tool approval
  'tool:approve': (data: { approved: boolean }) => void

  // Execution control
  execute: (data: { prompt: string; sessionId?: string; options?: ExecuteOptions }) => void
  'execution:cancel': () => void

  // Typing state
  'comment:typing': (data: { sessionId: string; isTyping: boolean }) => void
}

// Server to Client events
export interface ServerToClientEvents {
  // Session related
  'sessions:update': (data: { sessions: SessionData[] }) => void

  'session:joined': (data: { sessionId: string; viewers: number }) => void

  'session:left': (data: { sessionId: string }) => void

  'session:resumed': (data: { sessionId: string }) => void

  'session:error': (data: { error: string; sessionId: string }) => void

  'viewers:update': (data: { sessionId: string; count: number }) => void

  // Message delivery
  'message:user': (data: MessageEvent) => void
  'message:assistant': (data: MessageEvent) => void
  'message:system': (data: MessageEvent | SystemMessageEvent) => void
  'message:result': (data: ResultMessageEvent) => void

  // Tool approval
  'tool:approval': (data: ToolApprovalEvent) => void

  // Execution state
  'execution:start': (data: ExecutionEvent) => void
  'execution:complete': (data: ExecutionEvent) => void
  'execution:error': (data: ExecutionErrorEvent) => void
  'execution:cancelled': (data: { reason?: string }) => void

  // Comment state
  'comment:sent': (data: CommentEvent) => void
  'comment:complete': (data: CommentEvent) => void
  'comment:error': (data: CommentErrorEvent) => void

  // Typing state
  'user:typing': (data: { userId: string; sessionId: string; isTyping: boolean }) => void

  // Notifications
  'notification:new': (data: NotificationEvent) => void
}

// Socket internal data
export interface SocketData {
  currentAbort?: AbortController
  toolApprovalPending?: boolean
  toolApprovalResolver?: (approved: boolean) => void
  joinedSessions: Set<string>
}

// Event data type definitions
export interface SessionData {
  id: string
  name: string
  projectPath: string
  startTime: string
  lastUpdateTime: string
  isActive: boolean
  pid?: number
  messageCount: number
  toolCalls: number
  currentBranch?: string
}

export interface MessageEvent {
  content: string
  sessionId: string
  timestamp: string
}

export interface ResultMessageEvent {
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
  totalCost?: number
  numTurns?: number
  duration?: number
  timestamp: string
}

export interface ToolApprovalEvent {
  tools: ToolCall[]
  sessionId: string
  timestamp: string
}

export interface ToolCall {
  name: string
  parameters: Record<string, unknown>
}

export interface ExecutionEvent {
  sessionId: string
  timestamp: string
}

export interface ExecutionErrorEvent extends ExecutionEvent {
  error: string
}

export interface CommentEvent {
  sessionId: string
  comment: string
  timestamp: string
}

export interface CommentErrorEvent extends CommentEvent {
  error: string
  details?: {
    name: string
    originalMessage: string
  }
}

export interface NotificationEvent {
  id: string
  type: 'tool-approval' | 'task-complete' | 'error' | 'status-change'
  sessionId: string
  title: string
  body: string
  timestamp: string
  data?: Record<string, unknown>
}

// System message event (with sessionInfo)
export interface SystemMessageEvent extends MessageEvent {
  sessionInfo?: {
    sessionId: string
    cwd?: string
    model?: string
    tools?: string[]
  }
}
