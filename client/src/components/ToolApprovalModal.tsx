import { CheckIcon, ShieldCheckIcon, ToolsIcon, XIcon } from '@primer/octicons-react'
import { Box, Button, Checkbox, Dialog, FormControl, Heading, Text } from '@primer/react'
import { useState } from 'react'

interface Tool {
  name: string
  parameters: Record<string, any>
}

interface ToolApprovalModalProps {
  isOpen: boolean
  tools: Tool[]
  onApprove: (tools: Tool[], permanent: boolean) => void
  onReject: () => void
}

export function ToolApprovalModal({ isOpen, tools, onApprove, onReject }: ToolApprovalModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  const handleApprove = () => {
    onApprove(tools, dontAskAgain)
    setDontAskAgain(false) // Reset for next time
  }

  const handleReject = () => {
    onReject()
    setDontAskAgain(false) // Reset for next time
  }

  if (!isOpen) return null

  return (
    <Dialog onClose={handleReject} aria-labelledby="tool-approval-title">
      <Dialog.Header id="tool-approval-title">
        <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheckIcon size={20} />
          <Heading as="h2" style={{ fontSize: '16px', margin: 0, wordBreak: 'break-word' }}>
            Tool Execution Approval
          </Heading>
        </Box>
      </Dialog.Header>

      <Box p={[3, 4]}>
        <Text
          as="p"
          style={{ marginBottom: '16px', color: 'var(--fgColor-muted)', fontSize: '14px' }}
        >
          Claude is trying to execute the following tools:
        </Text>

        <Box
          style={{
            border: '1px solid var(--borderColor-default)',
            borderRadius: '6px',
            marginBottom: '16px',
            overflow: 'hidden',
          }}
        >
          {tools.map((tool, index) => (
            <Box
              key={index}
              style={{
                padding: '12px',
                borderBottom:
                  index < tools.length - 1 ? '1px solid var(--borderColor-default)' : 'none',
                backgroundColor: 'var(--bgColor-subtle)',
              }}
            >
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <ToolsIcon size={16} />
                <Text
                  style={{ fontWeight: 'bold', fontFamily: 'monospace', wordBreak: 'break-word' }}
                >
                  {tool.name}
                </Text>
                <Text
                  style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: getToolCategoryColor(tool.name),
                    color: 'var(--fgColor-onEmphasis)',
                  }}
                >
                  {getToolCategory(tool.name)}
                </Text>
              </Box>

              {Object.keys(tool.parameters).length > 0 && (
                <Box
                  style={{
                    backgroundColor: 'var(--bgColor-default)',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}
                >
                  {formatParameters(tool.parameters)}
                </Box>
              )}
            </Box>
          ))}
        </Box>

        <FormControl>
          <Checkbox checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
          <FormControl.Label>Don't ask again for this tool</FormControl.Label>
        </FormControl>

        <Box style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <Button variant="primary" onClick={handleApprove} leadingVisual={CheckIcon}>
            Approve
          </Button>
          <Button variant="danger" onClick={handleReject} leadingVisual={XIcon}>
            Reject
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

function getToolCategory(toolName: string): string {
  const name = toolName.toLowerCase()
  if (name.includes('read') || name === 'ls' || name === 'grep' || name === 'glob') return 'Read'
  if (name.includes('write') || name.includes('edit')) return 'Edit'
  if (name === 'bash' || name.includes('execute')) return 'Command'
  if (name.includes('search') || name.includes('find')) return 'Search'
  if (name.includes('web')) return 'Web'
  return 'Other'
}

function getToolCategoryColor(toolName: string): string {
  const category = getToolCategory(toolName)
  switch (category) {
    case 'Read':
      return 'var(--bgColor-success-emphasis)'
    case 'Edit':
      return 'var(--bgColor-attention-emphasis)'
    case 'Command':
      return 'var(--bgColor-danger-emphasis)'
    case 'Search':
      return 'var(--bgColor-accent-emphasis)'
    case 'Web':
      return 'var(--bgColor-done-emphasis)'
    default:
      return 'var(--bgColor-neutral-emphasis)'
  }
}

function formatParameters(params: Record<string, any>): string {
  // Special formatting for common parameters
  if (params.command) {
    return `$ ${params.command}`
  }
  if (params.file_path) {
    return `File: ${params.file_path}`
  }
  if (params.path && params.pattern) {
    return `Path: ${params.path}\nPattern: ${params.pattern}`
  }
  if (params.url) {
    return `URL: ${params.url}`
  }

  // Default JSON formatting
  return JSON.stringify(params, null, 2)
}
