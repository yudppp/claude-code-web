import {
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CpuIcon,
  PersonIcon,
} from '@primer/octicons-react'
import { Box, Button, Heading, Label, Spinner, Text, Timeline } from '@primer/react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ConversationHistory, ConversationMessage } from '../types'

interface ConversationHistoryProps {
  sessionId: string | null
}

export function ConversationHistory({ sessionId }: ConversationHistoryProps) {
  const [history, setHistory] = useState<ConversationHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(true)

  useEffect(() => {
    if (!sessionId) {
      setHistory(null)
      return
    }

    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/sessions/${sessionId}/history`)
        if (!response.ok) {
          throw new Error('Failed to fetch conversation history')
        }
        const data = await response.json()
        setHistory(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [sessionId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (history && scrollContainerRef.current && shouldScrollRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [history])

  // Check if user has scrolled up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10

    shouldScrollRef.current = isAtBottom
  }

  const getMessageIcon = (role: ConversationMessage['role']) => {
    switch (role) {
      case 'user':
        return <PersonIcon />
      case 'assistant':
        return <CpuIcon />
      case 'system':
        return <AlertIcon />
      default:
        return null
    }
  }

  const getMessageLabel = (role: ConversationMessage['role']) => {
    switch (role) {
      case 'user':
        return 'User'
      case 'assistant':
        return 'Claude'
      case 'system':
        return 'System'
      default:
        return role
    }
  }

  const getMessageVariant = (role: ConversationMessage['role']) => {
    switch (role) {
      case 'user':
        return 'primary'
      case 'assistant':
        return 'success'
      case 'system':
        return 'attention'
      default:
        return 'secondary'
    }
  }

  if (!sessionId) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, p: 3 }}>
        <Text sx={{ fontSize: 1, color: 'fg.muted', textAlign: 'center' }}>
          Please select a session
        </Text>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Spinner size="small" />
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Loading conversation history...</Text>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, p: 3 }}>
        <Text sx={{ fontSize: 1, color: 'danger.fg' }}>Error: {error}</Text>
      </Box>
    )
  }

  if (!history || history.messages.length === 0) {
    return (
      <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, p: 3 }}>
        <Text sx={{ fontSize: 1, color: 'fg.muted', textAlign: 'center' }}>
          No conversation history
        </Text>
      </Box>
    )
  }

  const displayMessages = showAll ? history.messages : history.messages.slice(-5)
  const hiddenCount = history.messages.length - 5

  return (
    <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2 }}>
      <Box p={[2, 3]}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ width: '4px', height: '24px', bg: 'accent.emphasis', borderRadius: 1 }} />
            <Heading sx={{ fontSize: 3, color: 'fg.default' }}>Conversation History</Heading>
            <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
              ({history.messages.length} messages)
            </Text>
          </Box>

          {hiddenCount > 0 && (
            <Button
              size="small"
              onClick={() => setShowAll(!showAll)}
              leadingVisual={showAll ? ChevronUpIcon : ChevronDownIcon}
            >
              {showAll ? 'Show latest 5 only' : `Show ${hiddenCount} more`}
            </Button>
          )}
        </Box>

        <Box
          ref={scrollContainerRef}
          onScroll={handleScroll}
          sx={{
            maxHeight: ['400px', '600px'],
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              bg: 'canvas.subtle',
            },
            '&::-webkit-scrollbar-thumb': {
              bg: 'neutral.muted',
              borderRadius: '4px',
              '&:hover': {
                bg: 'neutral.emphasis',
              },
            },
          }}
        >
          <Timeline>
            {displayMessages.map((message, index) => (
              <Timeline.Item key={index} condensed>
                <Timeline.Badge>{getMessageIcon(message.role)}</Timeline.Badge>
                <Timeline.Body>
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Label variant={getMessageVariant(message.role) as any} size="small">
                        {getMessageLabel(message.role)}
                      </Label>
                      <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                        {new Date(message.timestamp).toLocaleTimeString('en-US')}
                      </Text>
                    </Box>

                    <Box
                      sx={{
                        p: 3,
                        bg: message.role === 'user' ? 'canvas.subtle' : 'canvas.default',
                        border: '1px solid',
                        borderColor: 'border.default',
                        borderRadius: 2,
                        '& pre': {
                          p: 2,
                          bg: 'canvas.inset',
                          borderRadius: 1,
                          overflowX: 'auto',
                          fontSize: 0,
                          fontFamily: 'mono',
                        },
                        '& code': {
                          px: 1,
                          py: '2px',
                          bg: 'neutral.muted',
                          borderRadius: 1,
                          fontSize: 0,
                          fontFamily: 'mono',
                        },
                        '& p': {
                          mb: 2,
                          '&:last-child': {
                            mb: 0,
                          },
                        },
                      }}
                    >
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </Box>
                  </Box>
                </Timeline.Body>
              </Timeline.Item>
            ))}
          </Timeline>
        </Box>
      </Box>
    </Box>
  )
}
