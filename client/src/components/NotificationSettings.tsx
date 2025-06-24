import { BellIcon, BellSlashIcon } from '@primer/octicons-react'
import { Box, Button, Flash, Text } from '@primer/react'
import { useEffect, useState } from 'react'
import { notificationService } from '../services/notificationService'

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Initialize notification service
    notificationService.init().then(() => {
      setPermission(notificationService.getPermissionStatus())
    })
  }, [])

  const handleEnableNotifications = async () => {
    setIsLoading(true)
    try {
      const granted = await notificationService.requestPermission()
      setPermission(granted ? 'granted' : 'denied')

      if (granted) {
        // Send test notification
        await notificationService.showNotification('Notifications enabled', {
          body: 'You will now receive notifications from Claude Code Web',
        })
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (permission === 'granted') {
    return (
      <Flash variant="success">
        <BellIcon size={16} />
        <Text sx={{ ml: 2, fontSize: [0, 1] }}>Notifications are enabled</Text>
      </Flash>
    )
  }

  if (permission === 'denied') {
    return (
      <Flash variant="warning">
        <BellSlashIcon size={16} />
        <Text sx={{ ml: 2, fontSize: [0, 1] }}>
          Notifications are blocked. Please allow them in your browser settings.
        </Text>
      </Flash>
    )
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Button
        onClick={handleEnableNotifications}
        disabled={isLoading}
        leadingIcon={BellIcon}
        variant="primary"
        size="small"
      >
        {isLoading ? 'Setting up...' : 'Enable notifications'}
      </Button>
      <Text
        sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block', wordBreak: 'break-word' }}
      >
        Receive notifications for tool approvals and long-running task completions
      </Text>
    </Box>
  )
}
