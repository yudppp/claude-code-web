// Notification queue service
interface Notification {
  id: string
  sessionId: string
  type: 'tool-approval' | 'task-complete' | 'error' | 'status-change'
  title: string
  body: string
  timestamp: Date
  read: boolean
  data?: any
}

class NotificationQueue {
  private notifications: Map<string, Notification[]> = new Map() // clientId -> notifications
  private pendingToolApprovals: Map<string, any> = new Map() // sessionId -> tool info

  // Add notification
  addNotification(
    clientId: string,
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ): void {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    }

    if (!this.notifications.has(clientId)) {
      this.notifications.set(clientId, [])
    }

    this.notifications.get(clientId)!.push(newNotification)

    // Remove old notifications (keep up to 100)
    const clientNotifications = this.notifications.get(clientId)!
    if (clientNotifications.length > 100) {
      this.notifications.set(clientId, clientNotifications.slice(-100))
    }
  }

  // Get unread notifications
  getUnreadNotifications(clientId: string): Notification[] {
    const clientNotifications = this.notifications.get(clientId) || []
    return clientNotifications.filter((n) => !n.read)
  }

  // Mark notifications as read
  markAsRead(clientId: string, notificationIds: string[]): void {
    const clientNotifications = this.notifications.get(clientId)
    if (!clientNotifications) return

    clientNotifications.forEach((notification) => {
      if (notificationIds.includes(notification.id)) {
        notification.read = true
      }
    })
  }

  // Add pending tool approval
  addPendingToolApproval(sessionId: string, toolInfo: any): void {
    this.pendingToolApprovals.set(sessionId, {
      ...toolInfo,
      timestamp: new Date(),
    })
  }

  // Remove pending tool approval
  removePendingToolApproval(sessionId: string): void {
    this.pendingToolApprovals.delete(sessionId)
  }

  // Add notification to all clients (broadcast)
  broadcastNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    // In a real implementation, we would need to manage connected client IDs
    // Here we simply add to all clients
    this.notifications.forEach((_, clientId) => {
      this.addNotification(clientId, notification)
    })
  }

  // Register client
  registerClient(clientId: string): void {
    if (!this.notifications.has(clientId)) {
      this.notifications.set(clientId, [])
    }
  }

  // Unregister client
  unregisterClient(clientId: string): void {
    this.notifications.delete(clientId)
  }

  // Monitor session status changes
  checkSessionStatus(sessionId: string, wasActive: boolean, isActive: boolean): void {
    if (wasActive && !isActive) {
      // Session became inactive
      this.broadcastNotification({
        sessionId,
        type: 'status-change',
        title: 'Session Ended',
        body: `Session ${sessionId} has ended`,
        data: { wasActive, isActive },
      })
    } else if (!wasActive && isActive) {
      // Session became active
      this.broadcastNotification({
        sessionId,
        type: 'status-change',
        title: 'Session Started',
        body: `Session ${sessionId} has started`,
        data: { wasActive, isActive },
      })
    }
  }
}

export const notificationQueue = new NotificationQueue()
