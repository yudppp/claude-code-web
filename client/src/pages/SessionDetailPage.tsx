import { ArrowLeftIcon, HomeIcon } from '@primer/octicons-react'
import {
  BaseStyles,
  Box,
  Header,
  Heading,
  IconButton,
  Spinner,
  Text,
  ThemeProvider,
} from '@primer/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { CommentInput } from '../components/CommentInput'
import { ConversationHistory } from '../components/ConversationHistory'
import { NotificationSettings } from '../components/NotificationSettings'
import { ThinkingDisplay } from '../components/ThinkingDisplay'
import { ToolApprovalModal } from '../components/ToolApprovalModal'
import { useClaudeSocket } from '../hooks/useClaudeSocket'
import { notificationService } from '../services/notificationService'
import type { Message, Session } from '../types'

interface PendingTool {
  name: string
  parameters: Record<string, any>
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  if (!sessionId) {
    navigate('/')
    return null
  }
  const [socket, setSocket] = useState<Socket | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [pendingTools, setPendingTools] = useState<PendingTool[]>([])
  const [showToolApproval, setShowToolApproval] = useState(false)
  const [allowedTools, setAllowedTools] = useState<string[]>([])
  const taskStartTimeRef = useRef<number | null>(null)

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(process.env.NODE_ENV === 'production' ? '' : '')

    socketInstance.on('connect', () => {
      console.log('[DEBUG] Socket connected')
      // Request specific session info
      socketInstance.emit('sessions:list')
      // Start polling
      if (socketInstance.id) {
        notificationService.startPolling(socketInstance.id)
      }
    })

    socketInstance.on('sessions:update', (data: { sessions: Session[] }) => {
      const currentSession = data.sessions.find((s) => s.id === sessionId)
      if (currentSession) {
        setSession(currentSession)
      }
    })

    setSocket(socketInstance)

    // Request sessions periodically
    const interval = setInterval(() => {
      socketInstance.emit('sessions:list')
    }, 5000)

    return () => {
      clearInterval(interval)
      notificationService.stopPolling()
      socketInstance.disconnect()
    }
  }, [sessionId])

  // Use custom hook for socket event handling
  useClaudeSocket(socket, {
    onMessage: (message) => setMessages((prev) => [...prev, message]),
    onExecutionStart: () => {
      setIsExecuting(true)
      taskStartTimeRef.current = Date.now()
    },
    onExecutionComplete: () => {
      setIsExecuting(false)
      // Notify for long-running tasks
      if (taskStartTimeRef.current && session) {
        const duration = Date.now() - taskStartTimeRef.current
        if (duration > 30000) {
          // More than 30 seconds
          notificationService.notifyTaskComplete(session.name, duration)
        }
        taskStartTimeRef.current = null
      }
    },
    onExecutionError: (error) => {
      setIsExecuting(false)
      console.error('Execution error:', error)
    },
    onToolApproval: (data) => {
      console.log('[DEBUG] Tool approval requested:', data)
      setPendingTools(data.tools)
      setShowToolApproval(true)
      // Notify when tool approval is needed
      if (session && data.tools.length > 0) {
        const toolNames = data.tools.map((t) => t.name).join(', ')
        notificationService.notifyToolApproval(session.name, toolNames)
      }
    },
    onCommentSent: (data) => {
      console.log('[DEBUG] Comment sent successfully:', data)
      setIsExecuting(true)
      taskStartTimeRef.current = Date.now()
    },
    onCommentComplete: (data) => {
      console.log('[DEBUG] Comment processing complete:', data)
      setIsExecuting(false)
      // Notify for long-running tasks
      if (taskStartTimeRef.current && session) {
        const duration = Date.now() - taskStartTimeRef.current
        if (duration > 30000) {
          // More than 30 seconds
          notificationService.notifyTaskComplete(session.name, duration)
        }
        taskStartTimeRef.current = null
      }
    },
    onCommentError: (data) => {
      console.error('[DEBUG] Comment error:', data)
      setIsExecuting(false)
      // Add error message to the message list
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'system',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
        },
      ])
    },
  })

  const handleSendComment = (comment: string) => {
    if (!socket || !session) return

    console.log('[DEBUG] Sending comment:', {
      comment,
      sessionId,
      session,
    })

    setMessages([]) // Clear previous messages to show new conversation
    socket.emit('comment:send', {
      comment,
      sessionId: session.id,
      allowedTools: allowedTools,
    })
  }

  const handleToolApprove = (tools: PendingTool[], permanent: boolean) => {
    console.log('[DEBUG] Tools approved:', { tools, permanent })

    if (permanent) {
      // Add tools to permanent allowed list
      const newAllowedTools = tools.map((tool) =>
        tool.name === 'Bash' && tool.parameters.command
          ? `Bash(command:${tool.parameters.command})`
          : tool.name
      )
      setAllowedTools((prev) => Array.from(new Set([...prev, ...newAllowedTools])))
    }

    // Send approval to server
    if (socket) {
      socket.emit('tool:approve', { approved: true })
    }

    setShowToolApproval(false)
    setPendingTools([])
  }

  const handleToolReject = () => {
    console.log('[DEBUG] Tools rejected')

    // Send rejection to server
    if (socket) {
      socket.emit('tool:approve', { approved: false })
    }

    setShowToolApproval(false)
    setPendingTools([])
  }

  if (!session) {
    return (
      <ThemeProvider colorMode="auto" dayScheme="light" nightScheme="dark">
        <BaseStyles>
          <div
            style={{
              minHeight: '100vh',
              backgroundColor: 'var(--bgColor-default)',
              color: 'var(--fgColor-default)',
            }}
          >
            <Header>
              <Header.Item>
                <IconButton
                  icon={ArrowLeftIcon}
                  variant="invisible"
                  aria-label="Back"
                  onClick={() => navigate('/')}
                />
              </Header.Item>
              <Header.Item>
                <Heading as="h1">Session Details</Heading>
              </Header.Item>
            </Header>
            <Box
              p={4}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <Spinner size="large" />
              <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Loading session...</Text>
            </Box>
          </div>
        </BaseStyles>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider colorMode="auto" dayScheme="light" nightScheme="dark">
      <BaseStyles>
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bgColor-default)',
            color: 'var(--fgColor-default)',
          }}
        >
          <Header>
            <Header.Item>
              <IconButton
                icon={ArrowLeftIcon}
                variant="invisible"
                aria-label="Back"
                onClick={() => navigate('/')}
              />
            </Header.Item>
            <Header.Item full>
              <Box style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Heading as="h1" sx={{ fontSize: [1, 2], wordBreak: 'break-word', mb: 1 }}>
                  {session.name}
                </Heading>
                <Text sx={{ fontSize: [0, 1], color: 'fg.muted' }}>
                  {session.isActive ? '🟢 Active' : '⚪ Inactive'}
                </Text>
              </Box>
            </Header.Item>
            <Header.Item>
              <IconButton
                icon={HomeIcon}
                variant="invisible"
                aria-label="Home"
                onClick={() => navigate('/')}
              />
            </Header.Item>
          </Header>

          <Box
            p={2}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Notification Settings */}
            <NotificationSettings />

            {/* Conversation History */}
            {sessionId && <ConversationHistory sessionId={sessionId} />}

            {/* Thinking */}
            <ThinkingDisplay messages={messages} />

            {/* Comment Input */}
            {session.isActive && (
              <CommentInput onSendComment={handleSendComment} isExecuting={isExecuting} />
            )}
          </Box>

          {/* Tool Approval Modal */}
          <ToolApprovalModal
            isOpen={showToolApproval}
            tools={pendingTools}
            onApprove={handleToolApprove}
            onReject={handleToolReject}
          />
        </div>
      </BaseStyles>
    </ThemeProvider>
  )
}
