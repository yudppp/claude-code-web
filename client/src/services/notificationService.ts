// Notification service
class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null
  private isSupported: boolean
  private permission: NotificationPermission = 'default'
  private pollingInterval: number | null = null
  private clientId: string | null = null

  constructor() {
    this.isSupported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  }

  // Register Service Worker
  async init(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('Push notifications are not supported in this browser')
      return false
    }

    try {
      // Register Service Worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered successfully')

      // Check existing permission status
      this.permission = Notification.permission

      return true
    } catch (error) {
      console.error('Service Worker registration failed:', error)
      return false
    }
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false

    try {
      this.permission = await Notification.requestPermission()
      return this.permission === 'granted'
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return false
    }
  }

  // Get notification permission status
  getPermissionStatus(): NotificationPermission {
    return this.permission
  }

  // Show local notification (simple version without Service Worker)
  async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    console.log('[NotificationService] showNotification called:', {
      title,
      permission: this.permission,
    })

    if (this.permission !== 'granted') {
      console.log('[NotificationService] Notification permission not granted')
      return
    }

    try {
      // Use Service Worker if registered
      if (this.swRegistration) {
        console.log('[NotificationService] Using Service Worker for notification')
        await this.swRegistration.showNotification(title, {
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'claude-code-notification',
          requireInteraction: false,
          ...options,
        } as any) // vibrate is supported but not in TypeScript types
        console.log('[NotificationService] Notification shown via Service Worker')
      } else if ('Notification' in window) {
        console.log('[NotificationService] Using Notification API directly')
        // Fallback: Regular Notification API
        new Notification(title, options)
        console.log('[NotificationService] Notification shown via Notification API')
      } else {
        console.error('[NotificationService] No notification method available')
      }
    } catch (error) {
      console.error('[NotificationService] Error showing notification:', error)
    }
  }

  // Notification when tool approval is needed
  async notifyToolApproval(sessionName: string, toolName: string): Promise<void> {
    await this.showNotification('Tool approval required', {
      body: `${sessionName}: Execution permission needed for ${toolName}`,
      requireInteraction: true,
      tag: 'tool-approval',
      data: {
        type: 'tool-approval',
        sessionName,
        toolName,
      },
    })
  }

  // Notification when long-running task completes
  async notifyTaskComplete(sessionName: string, duration: number): Promise<void> {
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)

    await this.showNotification('Task completed', {
      body: `${sessionName}: Completed in ${minutes}m ${seconds}s`,
      tag: 'task-complete',
      data: {
        type: 'task-complete',
        sessionName,
        duration,
      },
    })
  }

  // Error notification
  async notifyError(sessionName: string, error: string): Promise<void> {
    await this.showNotification('Error occurred', {
      body: `${sessionName}: ${error}`,
      tag: 'error',
      data: {
        type: 'error',
        sessionName,
        error,
      },
    })
  }

  // Start polling
  startPolling(clientId: string): void {
    this.clientId = clientId
    console.log('[NotificationService] Starting polling with clientId:', clientId)

    // Stop existing polling
    this.stopPolling()

    // Poll every 3 seconds (for quick tool approval notifications)
    this.pollingInterval = window.setInterval(() => {
      this.pollNotifications()
    }, 3000)

    // Execute once immediately
    this.pollNotifications()
  }

  // Stop polling
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // Poll notifications
  private async pollNotifications(): Promise<void> {
    if (!this.clientId || this.permission !== 'granted') {
      console.log(
        '[NotificationService] Skipping poll - clientId:',
        this.clientId,
        'permission:',
        this.permission
      )
      return
    }

    try {
      const response = await fetch(`/api/notifications/poll/${this.clientId}`)
      if (!response.ok) {
        console.error('[NotificationService] Poll request failed:', response.status)
        return
      }

      const data = await response.json()
      const notifications = data.notifications || []

      if (notifications.length > 0) {
        console.log('[NotificationService] Received notifications:', notifications)
      }

      // Display unread notifications
      for (const notification of notifications) {
        console.log('[NotificationService] Showing notification:', notification.title)
        await this.showNotification(notification.title, {
          body: notification.body,
          tag: notification.id,
          data: notification.data,
        })
      }

      // Mark displayed notifications as read
      if (notifications.length > 0) {
        const notificationIds = notifications.map((n: any) => n.id)
        await fetch(`/api/notifications/mark-read/${this.clientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds }),
        })
      }
    } catch (error) {
      console.error('[NotificationService] Failed to poll notifications:', error)
    }
  }
}

// Singleton instance
export const notificationService = new NotificationService()
