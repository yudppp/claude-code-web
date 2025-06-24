import path from 'node:path'
import { query } from '@anthropic-ai/claude-code'
import type { Server, Socket } from 'socket.io'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  SystemMessageEvent,
  ToolCall,
} from '../shared/types/socket'

// Type for Claude Code SDK query options
type QueryOptions = Parameters<typeof query>[0]

import { notificationQueue } from './services/notificationQueue'
import { sessionService } from './services/sessionService'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & { data: SocketData }
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>

export function setupClaudeHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    // Initialize socket data
    socket.data = {
      joinedSessions: new Set(),
    }
    // Join session
    socket.on('session:join', ({ sessionId }) => {
      socket.join(`session:${sessionId}`)
      socket.data.joinedSessions.add(sessionId)

      const room = io.sockets.adapter.rooms.get(`session:${sessionId}`)
      const viewerCount = room?.size || 0

      socket.emit('session:joined', { sessionId, viewers: viewerCount })
      io.to(`session:${sessionId}`).emit('viewers:update', { sessionId, count: viewerCount })
    })

    // Leave session
    socket.on('session:leave', ({ sessionId }) => {
      socket.leave(`session:${sessionId}`)
      socket.data.joinedSessions.delete(sessionId)

      const room = io.sockets.adapter.rooms.get(`session:${sessionId}`)
      const viewerCount = room?.size || 0

      socket.emit('session:left', { sessionId })
      io.to(`session:${sessionId}`).emit('viewers:update', { sessionId, count: viewerCount })
    })

    // Execute Claude command
    socket.on('execute', async (data) => {
      const { prompt, sessionId, options = {} } = data
      const abortController = new AbortController()

      // Store abort controller for this execution
      socket.data.currentAbort = abortController

      try {
        // Start execution
        socket.emit('execution:start', {
          sessionId: sessionId || '',
          timestamp: new Date().toISOString(),
        })

        // Query Claude Code SDK
        const queryOptions: QueryOptions = {
          prompt,
          abortController,
          options: {
            ...options,
            ...(sessionId ? { resume: sessionId } : {}),
          },
        }

        const generator = query(queryOptions)

        console.log('[DEBUG] Starting to stream messages from Claude Code SDK')

        // Stream messages to client
        for await (const message of generator) {
          console.log('[DEBUG] Received message from SDK:', {
            type: message.type,
            sessionId: message.session_id,
          })

          // Send different message types to client
          switch (message.type) {
            case 'user':
              socket.emit('message:user', {
                content:
                  typeof message.message.content === 'string'
                    ? message.message.content
                    : JSON.stringify(message.message.content),
                sessionId: message.session_id,
                timestamp: new Date().toISOString(),
              })
              // Update message count
              sessionService.updateSession(message.session_id, {
                messageCount: 1, // Increment will be handled by SessionService
              })
              break

            case 'assistant': {
              // Check if message contains tool calls that need approval
              let toolCalls: ToolCall[] = []

              // Check for JSON format tool calls
              if (Array.isArray(message.message.content)) {
                for (const contentItem of message.message.content) {
                  if (contentItem.type === 'tool_use') {
                    toolCalls.push({
                      name: contentItem.name,
                      parameters: contentItem.input || {},
                    })
                  }
                }
              } else {
                // Check for XML format tool calls
                const content =
                  typeof message.message.content === 'string'
                    ? message.message.content
                    : JSON.stringify(message.message.content)
                if (content.includes('<function_calls>')) {
                  toolCalls = parseToolCalls(content)
                }
              }

              console.log('[DEBUG] Assistant message:', {
                hasToolCalls: toolCalls.length > 0,
                toolCallsCount: toolCalls.length,
                toolCalls,
                contentType: typeof message.message.content,
                isArray: Array.isArray(message.message.content),
              })

              if (
                toolCalls.length > 0 &&
                queryOptions.options?.permissionMode !== 'bypassPermissions'
              ) {
                // Send tool approval request
                console.log('[DEBUG] Sending tool:approval event')
                socket.emit('tool:approval', {
                  tools: toolCalls,
                  sessionId: message.session_id,
                  timestamp: new Date().toISOString(),
                })

                // 通知キューに追加
                const session = await sessionService.getSessionById(message.session_id)
                if (session) {
                  const toolNames = toolCalls.map((t) => t.name).join(', ')
                  console.log('[DEBUG] Adding notification to queue for socket:', socket.id)
                  notificationQueue.addNotification(socket.id, {
                    sessionId: message.session_id,
                    type: 'tool-approval',
                    title: 'Tool Approval Required',
                    body: `${session.name}: Requires permission to execute ${toolNames}`,
                    data: { tools: toolCalls },
                  })

                  // 全ての接続中のクライアントにも通知を追加（ブロードキャスト）
                  const connectedSockets = await io.fetchSockets()
                  console.log(
                    '[DEBUG] Broadcasting to',
                    connectedSockets.length,
                    'connected clients'
                  )
                  for (const connectedSocket of connectedSockets) {
                    if (connectedSocket.id !== socket.id) {
                      notificationQueue.addNotification(connectedSocket.id, {
                        sessionId: message.session_id,
                        type: 'tool-approval',
                        title: 'Tool Approval Required',
                        body: `${session.name}: Requires permission to execute ${toolNames}`,
                        data: { tools: toolCalls },
                      })
                    }
                  }

                  notificationQueue.addPendingToolApproval(message.session_id, { tools: toolCalls })
                }

                // Wait for approval
                const approved = await waitForToolApproval(socket)

                console.log('[DEBUG] Tool approval result:', approved)

                if (!approved) {
                  // If not approved, cancel execution
                  abortController.abort()
                  socket.emit('execution:cancelled', { reason: 'Tool execution rejected by user' })
                  return
                }
              }

              console.log('[DEBUG] Emitting assistant message')
              // Get content as string for emitting
              const emitContent =
                typeof message.message.content === 'string'
                  ? message.message.content
                  : JSON.stringify(message.message.content)

              socket.emit('message:assistant', {
                content: emitContent,
                sessionId: message.session_id,
                timestamp: new Date().toISOString(),
              })

              // Update session with tool call count
              sessionService.updateSession(message.session_id, {
                messageCount: 1,
                toolCalls: toolCalls.length,
              })
              break
            }

            case 'system': {
              const systemEvent: SystemMessageEvent = {
                content: `Session initialized in ${message.cwd}`,
                sessionId: message.session_id,
                timestamp: new Date().toISOString(),
                sessionInfo: {
                  sessionId: message.session_id,
                  cwd: message.cwd,
                  model: message.model,
                  tools: message.tools,
                },
              }
              socket.emit('message:system', systemEvent)
              // Register or update session with SessionService
              const existingSession = await sessionService.getSessionById(message.session_id)
              if (existingSession) {
                // Update existing session to mark it as active
                // Note: We don't set PID here because this is the web server process,
                // not the actual Claude Code process. The PID will be detected by
                // the SessionService when it scans for active processes.
                sessionService.updateSession(message.session_id, {
                  isActive: true,
                  lastUpdateTime: new Date(),
                })
              } else {
                // Register new session
                const projectPath = message.cwd || 'Unknown'
                const name =
                  projectPath !== 'Unknown' ? path.basename(projectPath) : message.session_id
                sessionService.registerSession({
                  id: message.session_id,
                  name,
                  projectPath,
                  startTime: new Date(),
                  lastUpdateTime: new Date(),
                  isActive: true,
                  // Don't set PID here - it will be detected by SessionService
                  messageCount: 0,
                  toolCalls: 0,
                  currentBranch: undefined,
                })
              }
              break
            }

            case 'result': {
              const resultMessage = message
              socket.emit('message:result', {
                usage: resultMessage.usage
                  ? {
                      inputTokens:
                        resultMessage.usage.input_tokens ?? resultMessage.usage.inputTokens ?? 0,
                      outputTokens:
                        resultMessage.usage.output_tokens ?? resultMessage.usage.outputTokens ?? 0,
                    }
                  : undefined,
                totalCost: resultMessage.total_cost_usd,
                numTurns: resultMessage.num_turns,
                duration: resultMessage.duration_ms,
                timestamp: new Date().toISOString(),
              })
              break
            }
          }
        }

        socket.emit('execution:complete', {
          sessionId: sessionId || '',
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        console.error('Execution error:', error)
        socket.emit('execution:error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: sessionId || '',
          timestamp: new Date().toISOString(),
        })
      } finally {
        // Clean up abort controller
        delete socket.data.currentAbort
      }
    })

    // Get active sessions
    socket.on('sessions:list', async () => {
      try {
        const sessions = await sessionService.getAllSessions()
        // Transform sessions to match client format
        const transformedSessions = sessions.map((session) => ({
          id: session.id,
          name: session.name,
          projectPath: session.projectPath,
          startTime: session.startTime.toISOString(),
          lastUpdateTime: session.lastUpdateTime.toISOString(),
          isActive: session.isActive,
          pid: session.pid,
          messageCount: session.messageCount,
          toolCalls: session.toolCalls,
          currentBranch: session.currentBranch,
        }))
        socket.emit('sessions:update', { sessions: transformedSessions })
      } catch (error) {
        console.error('Error fetching sessions:', error)
        socket.emit('sessions:update', { sessions: [] })
      }
    })

    // Resume a session
    socket.on('session:resume', async (data) => {
      const { sessionId } = data
      try {
        socket.emit('session:resumed', { sessionId })
      } catch (error) {
        socket.emit('session:error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId,
        })
      }
    })

    // Cancel current execution
    socket.on('execution:cancel', () => {
      if (socket.data.currentAbort) {
        socket.data.currentAbort.abort()
        socket.emit('execution:cancelled', {})
      }
    })

    // Handle tool approval response
    socket.on('tool:approve', ({ approved }) => {
      if (socket.data.toolApprovalResolver) {
        socket.data.toolApprovalResolver(approved)
        socket.data.toolApprovalPending = false
      }
    })

    // Handle comment send
    socket.on('comment:send', async ({ comment, sessionId, allowedTools = [] }) => {
      console.log('[DEBUG] Received comment:send event:', { comment, sessionId, allowedTools })

      if (!comment || !sessionId) {
        console.error('[DEBUG] Missing comment or sessionId:', { comment, sessionId })
        socket.emit('comment:error', {
          error: 'Comment or session ID is missing',
          sessionId,
          comment: comment || '',
          timestamp: new Date().toISOString(),
        })
        return
      }

      try {
        // Get the active session
        const session = await sessionService.getSessionById(sessionId)

        console.log('[DEBUG] Session status:', {
          sessionId,
          found: !!session,
          isActive: session?.isActive,
          session,
        })

        if (!session) {
          console.error('[DEBUG] Session not found:', sessionId)
          socket.emit('comment:error', {
            error: 'Session not found',
            sessionId,
            comment,
            timestamp: new Date().toISOString(),
          })
          return
        }

        if (!session.isActive) {
          console.error('[DEBUG] Session is not active:', sessionId)
          console.error('[DEBUG] Session details:', {
            id: session.id,
            pid: session.pid,
            isActive: session.isActive,
            projectPath: session.projectPath,
            lastUpdateTime: session.lastUpdateTime,
          })

          // Try to refresh session status
          const refreshedSessions = await sessionService.getAllSessions()
          const refreshedSession = refreshedSessions.find((s) => s.id === sessionId)

          if (refreshedSession?.isActive) {
            console.log('[DEBUG] Session became active after refresh:', sessionId)
            session.isActive = true
          } else {
            console.error('[DEBUG] Session is not active and cannot be resumed')
            socket.emit('comment:error', {
              error: 'Session is not active. Please start a new session.',
              sessionId,
              comment,
              timestamp: new Date().toISOString(),
            })
            return
          }
        }

        // Execute the comment as a new prompt
        socket.emit('comment:sent', { sessionId, comment, timestamp: new Date().toISOString() })

        console.log('[DEBUG] Preparing to query Claude Code SDK with options:', {
          sessionId,
          comment: `${comment.substring(0, 100)}...`,
          projectPath: session.projectPath,
        })

        // Forward to execute handler with the comment as prompt
        const abortController = new AbortController()
        socket.data.currentAbort = abortController

        const queryOptions: QueryOptions = {
          prompt: comment,
          abortController,
          options: {
            // IMPORTANT: Use resume option to connect to existing session
            resume: sessionId,
            // Set working directory to session's project path or current directory
            cwd: session.projectPath || process.cwd(),
            // Add allowed tools if provided
            allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
            permissionMode: 'default', // Use default permission mode for tool approval
          },
        }

        console.log('[DEBUG] Query options:', JSON.stringify(queryOptions, null, 2))

        let messageReceived = false

        try {
          console.log(
            '[DEBUG] About to call query() with options:',
            JSON.stringify(queryOptions, null, 2)
          )
          const generator = query(queryOptions)

          console.log('[DEBUG] Query() called successfully, starting to stream messages...')

          // Stream messages to client (same as execute handler)
          for await (const message of generator) {
            messageReceived = true
            console.log('[DEBUG] Comment stream - Received message:', {
              type: message.type,
              sessionId: message.session_id,
              hasContent: 'message' in message && message.message && 'content' in message.message,
              messageKeys:
                'message' in message && message.message ? Object.keys(message.message) : [],
            })

            switch (message.type) {
              case 'user':
                socket.emit('message:user', {
                  content:
                    typeof message.message.content === 'string'
                      ? message.message.content
                      : JSON.stringify(message.message.content),
                  sessionId: message.session_id,
                  timestamp: new Date().toISOString(),
                })
                sessionService.updateSession(message.session_id, {
                  messageCount: 1,
                })
                break

              case 'assistant': {
                // Check if message contains tool calls that need approval
                let commentToolCalls: ToolCall[] = []

                // Check for JSON format tool calls
                if (Array.isArray(message.message.content)) {
                  for (const contentItem of message.message.content) {
                    if (contentItem.type === 'tool_use') {
                      commentToolCalls.push({
                        name: contentItem.name,
                        parameters: contentItem.input || {},
                      })
                    }
                  }
                } else {
                  // Check for XML format tool calls
                  const commentContent =
                    typeof message.message.content === 'string'
                      ? message.message.content
                      : JSON.stringify(message.message.content)
                  if (commentContent.includes('<function_calls>')) {
                    commentToolCalls = parseToolCalls(commentContent)
                  }
                }

                console.log('[DEBUG] Comment assistant message:', {
                  hasToolCalls: commentToolCalls.length > 0,
                  toolCallsCount: commentToolCalls.length,
                  toolCalls: commentToolCalls,
                  contentType: typeof message.message.content,
                  isArray: Array.isArray(message.message.content),
                })

                if (
                  commentToolCalls.length > 0 &&
                  queryOptions.options?.permissionMode !== 'bypassPermissions'
                ) {
                  console.log('[DEBUG] Sending tool:approval event for comment')
                  socket.emit('tool:approval', {
                    tools: commentToolCalls,
                    sessionId: message.session_id,
                    timestamp: new Date().toISOString(),
                  })

                  // 通知キューに追加
                  const commentSession = await sessionService.getSessionById(message.session_id)
                  if (commentSession) {
                    const toolNames = commentToolCalls.map((t) => t.name).join(', ')
                    console.log(
                      '[DEBUG] Adding comment tool notification to queue for socket:',
                      socket.id
                    )
                    notificationQueue.addNotification(socket.id, {
                      sessionId: message.session_id,
                      type: 'tool-approval',
                      title: 'Tool Approval Required',
                      body: `${commentSession.name}: Requires permission to execute ${toolNames}`,
                      data: { tools: commentToolCalls },
                    })

                    // 全ての接続中のクライアントにも通知を追加（ブロードキャスト）
                    const connectedSockets = await io.fetchSockets()
                    console.log(
                      '[DEBUG] Broadcasting comment tool notification to',
                      connectedSockets.length,
                      'connected clients'
                    )
                    for (const connectedSocket of connectedSockets) {
                      if (connectedSocket.id !== socket.id) {
                        notificationQueue.addNotification(connectedSocket.id, {
                          sessionId: message.session_id,
                          type: 'tool-approval',
                          title: 'Tool Approval Required',
                          body: `${commentSession.name}: Requires permission to execute ${toolNames}`,
                          data: { tools: commentToolCalls },
                        })
                      }
                    }
                  }

                  // Wait for approval
                  const approved = await waitForToolApproval(socket)

                  console.log('[DEBUG] Comment tool approval result:', approved)

                  if (!approved) {
                    // If not approved, cancel execution
                    abortController.abort()
                    socket.emit('execution:cancelled', {
                      reason: 'Tool execution rejected by user',
                    })
                    return
                  }
                }

                // Get content as string for emitting
                const emitContent =
                  typeof message.message.content === 'string'
                    ? message.message.content
                    : JSON.stringify(message.message.content)

                socket.emit('message:assistant', {
                  content: emitContent,
                  sessionId: message.session_id,
                  timestamp: new Date().toISOString(),
                })

                // Update session with tool call count
                sessionService.updateSession(message.session_id, {
                  messageCount: 1,
                  toolCalls: commentToolCalls.length,
                })
                break
              }

              case 'system': {
                const systemCommentEvent: SystemMessageEvent = {
                  content: `Comment added to session`,
                  sessionId: message.session_id,
                  timestamp: new Date().toISOString(),
                  sessionInfo: {
                    sessionId: message.session_id,
                  },
                }
                socket.emit('message:system', systemCommentEvent)
                break
              }

              case 'result': {
                const resultMessage = message
                socket.emit('message:result', {
                  usage: resultMessage.usage
                    ? {
                        inputTokens:
                          resultMessage.usage.input_tokens ?? resultMessage.usage.inputTokens ?? 0,
                        outputTokens:
                          resultMessage.usage.output_tokens ??
                          resultMessage.usage.outputTokens ??
                          0,
                      }
                    : undefined,
                  totalCost: resultMessage.total_cost_usd,
                  numTurns: resultMessage.num_turns,
                  duration: resultMessage.duration_ms,
                  timestamp: new Date().toISOString(),
                })
                break
              }
            }
          }

          if (!messageReceived) {
            console.error('[DEBUG] No messages received from Claude Code SDK')
            socket.emit('comment:error', {
              error: 'No response from Claude Code SDK',
              sessionId,
              comment,
              timestamp: new Date().toISOString(),
            })
          } else {
            console.log('[DEBUG] Comment streaming completed successfully')
            socket.emit('comment:complete', {
              sessionId,
              comment,
              timestamp: new Date().toISOString(),
            })
          }
        } catch (streamError) {
          console.error('[DEBUG] Stream error:', streamError)
          console.error(
            '[DEBUG] Stream error stack:',
            streamError instanceof Error ? streamError.stack : 'No stack'
          )
          throw streamError
        }
      } catch (error) {
        console.error('[DEBUG] Comment error:', error)

        let errorMessage = 'Unknown error'
        if (error instanceof Error) {
          errorMessage = error.message
          console.error('[DEBUG] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
          })

          // Check for specific error patterns
          if (error.message.includes('process exited with code 1')) {
            errorMessage =
              'Claude Code process exited unexpectedly. The session may have already ended. Please start a new session or select an active session.'
          } else if (error.message.includes('ENOENT')) {
            errorMessage =
              'Claude Code command not found. Please make sure Claude CLI is installed.'
          } else if (error.message.includes('EPIPE') || error.message.includes('ECONNRESET')) {
            errorMessage = 'Connection to Claude Code was lost. The session may have ended.'
          }
        }

        socket.emit('comment:error', {
          error: errorMessage,
          sessionId,
          comment,
          timestamp: new Date().toISOString(),
          details:
            error instanceof Error
              ? {
                  name: error.name,
                  originalMessage: error.message,
                }
              : undefined,
        })
      } finally {
        delete socket.data.currentAbort
        console.log('[DEBUG] Comment handler cleanup complete')
      }
    })

    // Clean up on disconnect
    socket.on('disconnect', () => {
      if (socket.data.currentAbort) {
        socket.data.currentAbort.abort()
      }
      if (socket.data.toolApprovalResolver) {
        socket.data.toolApprovalResolver(false)
        socket.data.toolApprovalPending = false
      }
    })
  })
}

// Helper function to parse tool calls from content
function parseToolCalls(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = []
  // Try both possible formats for tool calls
  const regexes = [
    /<invoke name="([^"]+)">([\s\S]*?)<\/antml:invoke>/g,
    /<invoke name="([^"]+)">([\s\S]*?)<\/invoke>/g,
  ]

  console.log('[DEBUG] Parsing tool calls from content')

  for (const regex of regexes) {
    let match: RegExpExecArray | null = regex.exec(content)
    while (match !== null) {
      const name = match[1]
      const paramsXml = match[2]
      const parameters: Record<string, unknown> = {}

      console.log('[DEBUG] Found tool call:', name)

      // Parse parameters - try both formats
      const paramRegexes = [
        /<parameter name="([^"]+)">([\s\S]*?)<\/antml:parameter>/g,
        /<parameter name="([^"]+)">([\s\S]*?)<\/parameter>/g,
      ]

      for (const paramRegex of paramRegexes) {
        let paramMatch: RegExpExecArray | null = paramRegex.exec(paramsXml)
        while (paramMatch !== null) {
          parameters[paramMatch[1]] = paramMatch[2].trim()
          paramMatch = paramRegex.exec(paramsXml)
        }
      }

      toolCalls.push({ name, parameters })
      match = regex.exec(content)
    }
  }

  console.log('[DEBUG] Total tool calls found:', toolCalls.length)
  return toolCalls
}

// Helper function to wait for tool approval
function waitForToolApproval(socket: TypedSocket): Promise<boolean> {
  return new Promise((resolve) => {
    socket.data.toolApprovalPending = true
    socket.data.toolApprovalResolver = resolve
  })
}
