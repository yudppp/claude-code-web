import { Box, Button, Heading, Text, Textarea } from '@primer/react'
import { type FormEvent, useState } from 'react'

interface CommentInputProps {
  onSendComment: (comment: string) => void
  isExecuting: boolean
}

export function CommentInput({ onSendComment, isExecuting }: CommentInputProps) {
  const [comment, setComment] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (comment.trim() && !isExecuting) {
      onSendComment(comment)
      setComment('')
    }
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2 }}>
      <Box p={[3, 4]}>
        <Heading sx={{ fontSize: 3, mb: 2, color: 'fg.default' }}>Send New Task</Heading>
        <Text sx={{ fontSize: 1, color: 'fg.muted', mb: 3 }}>
          Execute a new Claude task in the selected project
        </Text>
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Textarea
              placeholder="Example: Add tests for this feature and fix type errors..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isExecuting}
              sx={{ minHeight: '100px' }}
              block
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start' }}>
              <Button type="submit" disabled={isExecuting || !comment.trim()} variant="primary">
                {isExecuting ? 'Executing...' : 'Execute Task'}
              </Button>
            </Box>
          </Box>
        </form>
      </Box>
    </Box>
  )
}
