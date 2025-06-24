import { CommentIcon, PlayIcon, PlusIcon, StopIcon } from '@primer/octicons-react'
import {
  BaseStyles,
  Box,
  Button,
  Header,
  Heading,
  StateLabel,
  Text,
  ThemeProvider,
} from '@primer/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import type { Session } from '../types'

export function SessionListPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    const socketInstance = io(process.env.NODE_ENV === 'production' ? '' : '')

    socketInstance.on('connect', () => {
      console.log('[DEBUG] Socket connected')
      socketInstance.emit('sessions:list')
    })

    socketInstance.on('sessions:update', (data: { sessions: Session[] }) => {
      console.log('[DEBUG] Sessions updated:', data.sessions)
      setSessions(data.sessions)
    })

    setSocket(socketInstance)

    // Request sessions periodically
    const interval = setInterval(() => {
      socketInstance.emit('sessions:list')
    }, 5000)

    return () => {
      clearInterval(interval)
      socketInstance.disconnect()
    }
  }, [])

  const activeSessions = sessions.filter((s) => s.isActive)
  const inactiveSessions = sessions.filter((s) => !s.isActive)

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
              <Heading as="h1" sx={{ fontSize: [2, 3] }}>
                Claude Code Web
              </Heading>
            </Header.Item>
          </Header>

          <Box p={[2, 3, 4]} sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <Box mb={4}>
                <Heading as="h2" sx={{ fontSize: 2, mb: 3 }}>
                  Active Sessions
                </Heading>
                <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeSessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/session/${session.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Box
                        p={[2, 3]}
                        style={{
                          border: '1px solid var(--borderColor-default)',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bgColor-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        sx={{
                          '&:hover': {
                            backgroundColor: 'var(--bgColor-muted)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                          },
                        }}
                      >
                        <Box
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <StateLabel status="issueOpened" variant="small">
                              Active
                            </StateLabel>
                            <Text sx={{ fontSize: 0, color: 'fg.muted' }}>PID: {session.pid}</Text>
                          </Box>
                        </Box>

                        <Text
                          sx={{ fontSize: 1, fontWeight: 'bold', mb: 1, wordBreak: 'break-word' }}
                        >
                          {session.name}
                        </Text>

                        {session.projectPath && (
                          <Text
                            sx={{
                              fontSize: 0,
                              color: 'fg.muted',
                              fontFamily: 'mono',
                              wordBreak: 'break-all',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {session.projectPath}
                          </Text>
                        )}

                        <Box style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                            <CommentIcon size={12} /> {session.messageCount || 0} messages
                          </Text>
                          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                            Updated: {new Date(session.lastUpdateTime).toLocaleString('en-US')}
                          </Text>
                        </Box>
                      </Box>
                    </Link>
                  ))}
                </Box>
              </Box>
            )}

            {/* Inactive Sessions */}
            {inactiveSessions.length > 0 && (
              <Box>
                <Heading as="h2" sx={{ fontSize: 2, mb: 3 }}>
                  Past Sessions
                </Heading>
                <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {inactiveSessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/session/${session.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Box
                        p={[2, 3]}
                        style={{
                          border: '1px solid var(--borderColor-default)',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bgColor-subtle)',
                          cursor: 'pointer',
                          opacity: 0.8,
                        }}
                        sx={{
                          '&:hover': {
                            opacity: 1,
                            backgroundColor: 'var(--bgColor-muted)',
                          },
                        }}
                      >
                        <Box
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <StateLabel status="issueClosed" variant="small">
                            <StopIcon size={12} /> Inactive
                          </StateLabel>
                        </Box>

                        <Text
                          sx={{ fontSize: 1, fontWeight: 'bold', mb: 1, wordBreak: 'break-word' }}
                        >
                          {session.name}
                        </Text>

                        {session.projectPath && (
                          <Text
                            sx={{
                              fontSize: 0,
                              color: 'fg.muted',
                              fontFamily: 'mono',
                              wordBreak: 'break-all',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {session.projectPath}
                          </Text>
                        )}

                        <Box style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                            <CommentIcon size={12} /> {session.messageCount || 0} messages
                          </Text>
                          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                            Updated: {new Date(session.lastUpdateTime).toLocaleString('en-US')}
                          </Text>
                        </Box>
                      </Box>
                    </Link>
                  ))}
                </Box>
              </Box>
            )}

            {/* Empty State */}
            {sessions.length === 0 && (
              <Box
                style={{
                  textAlign: 'center',
                  padding: '48px',
                  border: '1px dashed var(--borderColor-default)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bgColor-subtle)',
                }}
              >
                <Text sx={{ fontSize: 2, color: 'fg.muted', mb: 3 }}>No sessions</Text>
                <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
                  Run the claude command in your terminal to start a session
                </Text>
              </Box>
            )}
          </Box>
        </div>
      </BaseStyles>
    </ThemeProvider>
  )
}
