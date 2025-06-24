// Service Worker for Claude Code Web
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated')
  event.waitUntil(clients.claim())
})

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'claude-code-notification',
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Focus if window is already open
      for (let client of windowClients) {
        if (client.url.includes('localhost:9608') || client.url.includes('claude-code-web')) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      return clients.openWindow(urlToOpen)
    })
  )
})

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-sessions') {
    event.waitUntil(checkActiveSessions())
  }
})

async function checkActiveSessions() {
  // Check sessions in background (for future extensions)
  console.log('Checking active sessions in background...')
}
