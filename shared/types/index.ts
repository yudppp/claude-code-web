// Common type definitions
export * from './socket'

import type { ToolCall } from './socket'

// Session related types
export interface Session {
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

// Conversation history related types
export interface ConversationMessage {
  timestamp: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
}

export interface ConversationHistory {
  sessionId: string
  messages: ConversationMessage[]
  projectPath: string
  startTime: string
  lastUpdateTime: string
}

// Message related types
export interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'result'
  content?: string | Record<string, unknown>
  timestamp: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  cost?: {
    inputCost?: number
    outputCost?: number
    totalCost?: number
  }
  sessionInfo?: {
    sessionId: string
    cwd: string
  }
}

// Execution options
export interface ExecuteOptions {
  cwd?: string
  model?: string
  maxTurns?: number
  continue?: boolean
  resume?: string
}
