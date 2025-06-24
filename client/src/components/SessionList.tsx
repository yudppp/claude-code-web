import { CodeIcon, CommentIcon, FileDirectoryIcon, GitBranchIcon } from '@primer/octicons-react'
import { Box, BranchName, Heading, Label, Text, Timeline } from '@primer/react'
import type { Session } from '../types'

interface SessionListProps {
  sessions: Session[]
  selectedSession: string | null
  onSelectSession: (sessionId: string | null) => void
}

export function SessionList({ sessions, selectedSession, onSelectSession }: SessionListProps) {
  const formatPath = (path: string) => {
    // Extract project name from path
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }

  const formatDuration = (startTime: string, lastUpdateTime: string) => {
    const start = new Date(startTime)
    const last = new Date(lastUpdateTime)
    const durationMs = last.getTime() - start.getTime()
    const minutes = Math.floor(durationMs / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2 }}>
      <Box p={[2, 3]}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: [1, 2], mb: [2, 3] }}>
          <Box sx={{ width: '4px', height: '24px', bg: 'accent.emphasis', borderRadius: 1 }} />
          <Heading sx={{ fontSize: [2, 3], color: 'fg.default' }}>Session List</Heading>
        </Box>

        {sessions.length === 0 ? (
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>No active sessions</Text>
        ) : (
          <Timeline>
            {sessions.map((session) => (
              <Timeline.Item key={session.id} condensed>
                <Timeline.Badge>
                  <FileDirectoryIcon />
                </Timeline.Badge>
                <Timeline.Body>
                  <Box
                    as="button"
                    onClick={() => onSelectSession(session.id)}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      p: 3,
                      cursor: 'pointer',
                      bg: selectedSession === session.id ? 'accent.subtle' : 'canvas.default',
                      border: '1px solid',
                      borderColor:
                        selectedSession === session.id ? 'accent.emphasis' : 'border.default',
                      borderRadius: 2,
                      '&:hover': {
                        bg: selectedSession === session.id ? 'accent.subtle' : 'canvas.subtle',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 2,
                        flexWrap: 'wrap',
                        gap: 2,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
                        >
                          <Text
                            sx={{
                              fontSize: 1,
                              fontWeight: 'semibold',
                              color: 'fg.default',
                              wordBreak: 'break-word',
                            }}
                          >
                            {formatPath(session.projectPath)}
                          </Text>
                          {session.isActive && (
                            <Label variant="primary" size="small">
                              Active (PID: {session.pid})
                            </Label>
                          )}
                        </Box>
                        <Text
                          sx={{
                            fontSize: 0,
                            color: 'fg.muted',
                            fontFamily: 'mono',
                            mt: 1,
                            display: 'block',
                          }}
                        >
                          {session.id}
                        </Text>
                      </Box>
                      <Label variant={session.isActive ? 'success' : 'secondary'} size="small">
                        {session.isActive ? 'Active' : 'Inactive'}
                      </Label>
                    </Box>

                    <Box sx={{ display: 'flex', gap: [2, 3], mb: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CommentIcon size={12} />
                        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                          {session.messageCount} messages
                        </Text>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CodeIcon size={12} />
                        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                          {session.toolCalls} tool calls
                        </Text>
                      </Box>
                    </Box>

                    {session.currentBranch && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <GitBranchIcon size={12} />
                        <BranchName>{session.currentBranch}</BranchName>
                      </Box>
                    )}

                    <Box
                      sx={{ borderTop: '1px solid', borderColor: 'border.default', pt: 2, mt: 2 }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                          Started: {new Date(session.startTime).toLocaleTimeString('en-US')}
                        </Text>
                        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                          Duration: {formatDuration(session.startTime, session.lastUpdateTime)}
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                </Timeline.Body>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Box>
    </Box>
  )
}
