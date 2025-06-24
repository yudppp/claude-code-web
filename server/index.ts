import fs from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../shared/types/socket'
import { setupClaudeHandlers } from './claude-handler'
import { notificationQueue } from './services/notificationQueue'
import { sessionService } from './services/sessionService'

const app = express()
const httpServer = createServer(app)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:9608'],
    methods: ['GET', 'POST'],
  },
})

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files (in production or when dist folder exists)
const distPath = path.join(__dirname, '../dist')
if (process.env.NODE_ENV === 'production' || fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  console.log('Serving static files from:', distPath)
}

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Session API Routes
app.get('/api/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await sessionService.getAllSessions()
    console.log('Found sessions:', sessions.length)
    sessions.forEach((s) => {
      console.log(`Session ${s.id}: active=${s.isActive}, pid=${s.pid}, path=${s.projectPath}`)
    })
    res.json(sessions)
  } catch (error) {
    console.error('Error getting sessions:', error)
    res.status(500).json({ error: 'Failed to get sessions' })
  }
})

app.get('/api/sessions/active', async (_req: Request, res: Response) => {
  try {
    const activeSession = await sessionService.getActiveSession()
    res.json(activeSession)
  } catch (error) {
    console.error('Error getting active session:', error)
    res.status(500).json({ error: 'Failed to get active session' })
  }
})

app.get('/api/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await sessionService.getSessionById(req.params.sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    res.json(session)
  } catch (error) {
    console.error('Error getting session:', error)
    res.status(500).json({ error: 'Failed to get session' })
  }
})

app.get('/api/sessions/:sessionId/history', async (req: Request, res: Response) => {
  try {
    console.log('Getting history for session:', req.params.sessionId)
    const history = await sessionService.getConversationHistory(req.params.sessionId)
    if (!history) {
      console.log('No history found for session:', req.params.sessionId)
      return res.status(404).json({ error: 'Session history not found' })
    }
    console.log(`Found ${history.messages.length} messages for session ${req.params.sessionId}`)
    res.json(history)
  } catch (error) {
    console.error('Error getting session history:', error)
    res.status(500).json({ error: 'Failed to get session history' })
  }
})

// Setup WebSocket handlers
setupClaudeHandlers(io)

// Notification polling API
app.get('/api/notifications/poll/:clientId', async (req: Request, res: Response) => {
  const { clientId } = req.params
  const unreadNotifications = notificationQueue.getUnreadNotifications(clientId)

  res.json({
    notifications: unreadNotifications,
    timestamp: new Date().toISOString(),
  })
})

app.post('/api/notifications/mark-read/:clientId', async (req: Request, res: Response) => {
  const { clientId } = req.params
  const { notificationIds } = req.body

  notificationQueue.markAsRead(clientId, notificationIds)
  res.json({ success: true })
})

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Register client in notification queue
  notificationQueue.registerClient(socket.id)

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    // Remove client from notification queue
    notificationQueue.unregisterClient(socket.id)

    // Leave joined sessions
    const socketData = socket.data as SocketData
    if (socketData?.joinedSessions) {
      socketData.joinedSessions.forEach((sessionId) => {
        socket.leave(`session:${sessionId}`)
        const room = io.sockets.adapter.rooms.get(`session:${sessionId}`)
        const viewerCount = room?.size || 0
        io.to(`session:${sessionId}`).emit('viewers:update', { sessionId, count: viewerCount })
      })
    }
  })
})

// Catch all handler for SPA
if (process.env.NODE_ENV === 'production' || fs.existsSync(distPath)) {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

const PORT = process.env.PORT || 9608
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
