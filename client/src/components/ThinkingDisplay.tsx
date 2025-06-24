import { ChevronDownIcon, ChevronRightIcon, GearIcon } from '@primer/octicons-react'
import { Box, IconButton, Text } from '@primer/react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Message } from '../types'

interface ThinkingDisplayProps {
  messages: Message[]
}

export function ThinkingDisplay({ messages }: ThinkingDisplayProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [userCollapsed, setUserCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLength = useRef(0)

  // Reset when messages are cleared (new task started)
  useEffect(() => {
    if (messages.length === 0 && prevMessagesLength.current > 0) {
      setIsCollapsed(true)
      setUserCollapsed(false)
    }
    prevMessagesLength.current = messages.length
  }, [messages.length])

  // Automatically expand when new messages arrive (only if user hasn't manually collapsed)
  useEffect(() => {
    if (messages.length > 0 && !userCollapsed) {
      setIsCollapsed(false)
    }
  }, [messages.length, userCollapsed])

  if (messages.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: [2, 3],
          bg: 'canvas.subtle',
          cursor: 'pointer',
          '&:hover': {
            bg: 'canvas.muted',
          },
        }}
        onClick={() => {
          const newCollapsed = !isCollapsed
          setIsCollapsed(newCollapsed)
          setUserCollapsed(newCollapsed)
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: [1, 2], flexWrap: 'wrap' }}>
          <IconButton
            icon={isCollapsed ? ChevronRightIcon : ChevronDownIcon}
            variant="invisible"
            size="small"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          />
          <GearIcon size={16} />
          <Text sx={{ fontWeight: 'bold' }}>Thinking...</Text>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>({messages.length} messages)</Text>
        </Box>
      </Box>

      {!isCollapsed && (
        <Box
          sx={{
            maxHeight: ['300px', '400px'],
            overflowY: 'auto',
            bg: 'canvas.default',
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                p: 3,
                borderBottom: '1px solid',
                borderColor: 'border.default',
                '&:last-child': {
                  borderBottom: 'none',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Text
                  sx={{
                    fontSize: 0,
                    fontWeight: 'bold',
                    color:
                      message.type === 'user'
                        ? 'accent.fg'
                        : message.type === 'assistant'
                          ? 'success.fg'
                          : message.type === 'system'
                            ? 'attention.fg'
                            : 'fg.muted',
                    textTransform: 'uppercase',
                  }}
                >
                  {message.type === 'user'
                    ? 'User'
                    : message.type === 'assistant'
                      ? 'Claude'
                      : message.type === 'system'
                        ? 'System'
                        : message.type === 'result'
                          ? 'Result'
                          : message.type}
                </Text>
                <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                  {new Date(message.timestamp).toLocaleTimeString('en-US')}
                </Text>
              </Box>

              {message.type === 'result' && message.usage ? (
                <Box sx={{ fontSize: 0, fontFamily: 'mono' }}>
                  <Text>
                    Token usage: Input {message.usage.inputTokens} / Output{' '}
                    {message.usage.outputTokens}
                  </Text>
                  {message.cost && <Text>Cost: ${message.cost?.totalCost ?? 0} USD</Text>}
                </Box>
              ) : (
                <Box
                  sx={{
                    fontSize: 1,
                    '& pre': {
                      p: 2,
                      bg: 'canvas.subtle',
                      borderRadius: 1,
                      overflowX: 'auto',
                      fontSize: 0,
                    },
                    '& code': {
                      fontFamily: 'mono',
                      fontSize: 0,
                      bg: 'canvas.subtle',
                      px: 1,
                      borderRadius: 1,
                    },
                    '& p': {
                      mb: 2,
                      '&:last-child': {
                        mb: 0,
                      },
                    },
                  }}
                >
                  {typeof message.content === 'string' ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {JSON.stringify(message.content, null, 2)}
                    </pre>
                  )}
                </Box>
              )}
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>
      )}
    </Box>
  )
}
