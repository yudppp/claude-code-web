import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface SessionInfo {
  id: string
  name: string
  projectPath: string
  startTime: Date
  lastUpdateTime: Date
  isActive: boolean
  pid?: number
  messageCount: number
  toolCalls: number
  currentBranch?: string
}

export interface ConversationMessage {
  timestamp: Date
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: number[]
}

export interface ConversationHistory {
  sessionId: string
  messages: ConversationMessage[]
  projectPath: string
  startTime: Date
  lastUpdateTime: Date
}

export interface SessionMetadata {
  sessionId: string
  projectPath: string
  startTime: string
  pid?: number
}

export class SessionService {
  private readonly claudeProjectsPath: string
  private inMemorySessions: Map<string, SessionInfo> = new Map()

  constructor() {
    this.claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects')
  }

  /**
   * Get all sessions including file-based and in-memory sessions
   */
  async getAllSessions(): Promise<SessionInfo[]> {
    const fileSessions = await this.getFileBasedSessions()
    const memorySessions = Array.from(this.inMemorySessions.values())

    // Find active Claude processes
    console.debug(`[SessionService] Getting all sessions...`)
    const activeProcesses = await this.findActiveClaudeSessions()
    console.debug(`[SessionService] Active processes found:`, Array.from(activeProcesses.entries()))

    // Merge sessions, preferring in-memory session data if available
    const mergedSessions = new Map<string, SessionInfo>()

    // Add file-based sessions first
    fileSessions.forEach((session) => {
      // Check if this session has an active process
      const activePid = activeProcesses.get(session.id)
      if (activePid) {
        console.debug(
          `[SessionService] Marking file session ${session.id} as active with PID ${activePid}`
        )
        session.pid = activePid
        session.isActive = true
      } else {
        console.debug(`[SessionService] File session ${session.id} has no active process`)
      }
      mergedSessions.set(session.id, session)
    })

    // Override with in-memory sessions
    memorySessions.forEach((session) => {
      // Check if this session has an active process
      const activePid = activeProcesses.get(session.id)
      if (activePid) {
        console.debug(
          `[SessionService] Marking memory session ${session.id} as active with PID ${activePid}`
        )
        session.pid = activePid
        session.isActive = true
      } else {
        console.debug(`[SessionService] Memory session ${session.id} has no active process`)
      }
      mergedSessions.set(session.id, session)
    })

    return Array.from(mergedSessions.values())
  }

  /**
   * Get sessions from ~/.claude/projects/ directory
   */
  private async getFileBasedSessions(): Promise<SessionInfo[]> {
    try {
      // Check if the directory exists
      await fs.access(this.claudeProjectsPath)
    } catch {
      // Directory doesn't exist, return empty array
      return []
    }

    const entries = await fs.readdir(this.claudeProjectsPath, { withFileTypes: true })
    const sessions: SessionInfo[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sessionPath = path.join(this.claudeProjectsPath, entry.name)
        const sessionInfo = await this.parseSessionDirectory(sessionPath, entry.name)
        if (sessionInfo) {
          sessions.push(sessionInfo)
        }
      }
    }

    return sessions
  }

  /**
   * Parse a single session directory
   */
  private async parseSessionDirectory(
    sessionPath: string,
    _dirName: string
  ): Promise<SessionInfo | null> {
    try {
      // Look for session metadata file
      const metadataPath = path.join(sessionPath, 'session.json')
      let metadata: SessionMetadata | null = null

      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        metadata = JSON.parse(metadataContent)
      } catch {
        // Metadata file doesn't exist or is invalid
      }

      // Look for JSONL files to extract session data
      const files = await fs.readdir(sessionPath)
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

      if (jsonlFiles.length === 0) {
        return null
      }

      // Sort JSONL files by modification time to get the most recent
      const jsonlFilesWithStats = await Promise.all(
        jsonlFiles.map(async (file) => {
          const filePath = path.join(sessionPath, file)
          const stats = await fs.stat(filePath)
          return { file, mtime: stats.mtime }
        })
      )

      jsonlFilesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      const mainJsonlFile = jsonlFilesWithStats[0].file

      // Extract session ID from the JSONL filename (it's usually the filename without extension)
      const sessionId = path.basename(mainJsonlFile, '.jsonl')
      const jsonlPath = path.join(sessionPath, mainJsonlFile)

      const sessionInfo = await this.parseJsonlFile(jsonlPath, sessionId)

      // Add metadata if available
      if (metadata) {
        sessionInfo.projectPath = metadata.projectPath || sessionInfo.projectPath
        if (metadata.pid) {
          sessionInfo.pid = metadata.pid
        }
      }

      // Check if session is active
      if (sessionInfo.pid) {
        sessionInfo.isActive = await this.isSessionActive(sessionInfo.pid)
      } else {
        sessionInfo.isActive = false
      }

      return sessionInfo
    } catch (error) {
      console.error(`Error parsing session directory ${sessionPath}:`, error)
      return null
    }
  }

  /**
   * Parse JSONL file to extract session information
   */
  private async parseJsonlFile(jsonlPath: string, sessionId: string): Promise<SessionInfo> {
    const content = await fs.readFile(jsonlPath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())

    let startTime: Date | null = null
    let lastUpdateTime: Date | null = null
    let projectPath = ''
    let messageCount = 0
    let toolCalls = 0
    let currentBranch: string | undefined

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)

        // Track timestamps
        if (entry.timestamp) {
          const timestamp = new Date(entry.timestamp)
          if (!startTime || timestamp < startTime) {
            startTime = timestamp
          }
          if (!lastUpdateTime || timestamp > lastUpdateTime) {
            lastUpdateTime = timestamp
          }
        }

        // Extract project path from various entry types
        if (entry.cwd) {
          projectPath = entry.cwd
        } else if (entry.type === 'init' && entry.data?.cwd) {
          projectPath = entry.data.cwd
        } else if (entry.type === 'environment' && entry.data?.workingDirectory) {
          projectPath = entry.data.workingDirectory
        }

        // Count messages based on type field
        if (entry.type === 'user' || entry.message?.role === 'user') {
          messageCount++
        } else if (entry.type === 'assistant' || entry.message?.role === 'assistant') {
          messageCount++
          // Count tool calls in assistant messages
          if (entry.message?.content) {
            // Handle both array and string content
            const _contentStr = Array.isArray(entry.message.content)
              ? JSON.stringify(entry.message.content)
              : entry.message.content
            // Look for tool_use type in content array
            if (Array.isArray(entry.message.content)) {
              const toolUseCount = entry.message.content.filter(
                (c: { type: string }) => c.type === 'tool_use'
              ).length
              toolCalls += toolUseCount
            }
          }
        }

        // Extract git branch from environment or git status
        if (entry.type === 'environment' && entry.data?.gitStatus) {
          const branchMatch = entry.data.gitStatus.match(/Current branch: (.+)/)
          if (branchMatch) {
            currentBranch = branchMatch[1]
          }
        }
      } catch (_error) {}
    }

    // Generate name from project path
    const name = projectPath ? path.basename(projectPath) : sessionId

    return {
      id: sessionId,
      name,
      projectPath: projectPath || 'Unknown',
      startTime: startTime || new Date(),
      lastUpdateTime: lastUpdateTime || new Date(),
      isActive: false,
      messageCount,
      toolCalls,
      currentBranch,
    }
  }

  /**
   * Check if a session is still active by checking the process
   */
  private async isSessionActive(pid?: number): Promise<boolean> {
    if (!pid) {
      console.debug(`[SessionService] isSessionActive: No PID provided`)
      return false
    }

    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}"`)
        const isActive = stdout.includes(pid.toString())
        console.debug(`[SessionService] isSessionActive: PID ${pid} active on Windows: ${isActive}`)
        return isActive
      } else {
        // On Unix-like systems, check if process exists and is a Claude process
        try {
          // First check if process exists
          await execAsync(`kill -0 ${pid}`)

          // Then check if it's a Claude process by examining the command line
          const { stdout } = await execAsync(`ps -p ${pid} -o command=`)
          console.debug(
            `[SessionService] isSessionActive: Process ${pid} command: ${stdout.trim()}`
          )

          // Check for various Claude-related process names
          const isClaudeProcess =
            stdout.toLowerCase().includes('claude') ||
            stdout.includes('@anthropic-ai/claude-code') ||
            stdout.includes('claude-code') ||
            (stdout.includes('node') && stdout.includes('claude')) ||
            (stdout.includes('npm') && stdout.includes('claude'))

          console.debug(
            `[SessionService] isSessionActive: PID ${pid} is Claude process: ${isClaudeProcess}`
          )
          return isClaudeProcess
        } catch (_error) {
          console.debug(
            `[SessionService] isSessionActive: Process ${pid} not found or not accessible`
          )
          return false
        }
      }
    } catch (error) {
      console.error(`[SessionService] isSessionActive error for PID ${pid}:`, error)
      return false
    }
  }

  /**
   * Find active Claude sessions by scanning running processes
   */
  private async findActiveClaudeSessions(): Promise<Map<string, number>> {
    const activeSessions = new Map<string, number>()
    const sessionProcesses = new Map<
      string,
      Array<{ pid: number; command: string; priority: number }>
    >()
    console.debug(`[SessionService] Starting search for active Claude sessions...`)

    try {
      if (process.platform === 'win32') {
        // Windows: Use wmic to get process command lines
        const { stdout } = await execAsync(
          'wmic process where "name=\'node.exe\'" get processid,commandline /format:csv'
        )
        const lines = stdout.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          if (line.includes('claude') || line.includes('@anthropic-ai/claude-code')) {
            const match = line.match(/,(\d+)$/)
            if (match) {
              const pid = parseInt(match[1], 10)
              console.debug(`[SessionService] Found Claude process on Windows: PID ${pid}`)
              // We'll need to match the PID with the session later
              activeSessions.set(`active-${pid}`, pid)
            }
          }
        }
      } else {
        // Unix-like: Search for Claude-related processes
        try {
          // Get all processes at once with more details
          const { stdout } = await execAsync('ps aux')
          const lines = stdout.split('\n').filter((line) => line.trim())

          for (const line of lines) {
            // Check if line contains claude-related keywords
            if (
              line.includes('claude') ||
              line.includes('@anthropic-ai/claude-code') ||
              line.includes('claude-code') ||
              line.includes('dist/cli.js') ||
              (line.includes('node') && (line.includes('claude') || line.includes('anthropic'))) ||
              (line.includes('tsx') && line.includes('claude'))
            ) {
              // Skip grep processes
              if (line.includes('grep')) continue

              // Extract PID (second column)
              const parts = line.split(/\s+/)
              if (parts.length > 1) {
                const pid = parseInt(parts[1], 10)
                if (!Number.isNaN(pid)) {
                  console.debug(
                    `[SessionService] Examining process PID ${pid}: ${line.substring(0, 100)}...`
                  )

                  // Determine process priority based on command
                  let priority = 0
                  const command = line.toLowerCase()

                  // Higher priority for actual claude command
                  if (command.includes('claude') && !command.includes('node')) {
                    priority = 10 // Highest priority for direct claude command
                  } else if (command.includes('@anthropic-ai/claude-code')) {
                    priority = 8 // High priority for claude-code package
                  } else if (command.includes('claude-code')) {
                    priority = 7 // High priority for claude-code command
                  } else if (
                    command.includes('node') &&
                    (command.includes('claude') || command.includes('dist/cli.js'))
                  ) {
                    priority = 5 // Medium priority for node processes running claude
                  } else if (command.includes('tsx') && command.includes('claude')) {
                    priority = 3 // Lower priority for tsx processes
                  }

                  // Get the working directory of this process
                  try {
                    const { stdout: cwdOut } = await execAsync(
                      `lsof -p ${pid} | grep "cwd" | awk '{print $NF}'`
                    )
                    const cwd = cwdOut.trim()
                    console.debug(
                      `[SessionService] Process ${pid} working directory: ${cwd}, priority: ${priority}`
                    )

                    // Match the working directory to a session
                    if (cwd) {
                      // Find the session ID for this working directory
                      const sessionId = await this.findSessionIdForWorkingDirectory(cwd)
                      if (sessionId) {
                        // Store process info for later selection
                        if (!sessionProcesses.has(sessionId)) {
                          sessionProcesses.set(sessionId, [])
                        }
                        sessionProcesses.get(sessionId)!.push({
                          pid,
                          command: line,
                          priority,
                        })
                      } else {
                        console.debug(
                          `[SessionService] Could not find session for working directory: ${cwd}`
                        )
                        if (priority > 5) {
                          // Only track high-priority processes without sessions
                          activeSessions.set(`active-${pid}`, pid)
                        }
                      }
                    }
                  } catch (error) {
                    console.debug(
                      `[SessionService] Could not get working directory for PID ${pid}:`,
                      error
                    )
                    // If we can't get the cwd but it's a high-priority process, still track it
                    if (priority > 5) {
                      activeSessions.set(`active-${pid}`, pid)
                    }
                  }
                }
              }
            }
          }

          // Select the best PID for each session based on priority
          for (const [sessionId, processes] of sessionProcesses.entries()) {
            // Sort by priority (descending) and select the highest priority process
            processes.sort((a, b) => b.priority - a.priority)
            const bestProcess = processes[0]
            console.debug(
              `[SessionService] Selected PID ${bestProcess.pid} for session ${sessionId} (priority: ${bestProcess.priority})`
            )
            activeSessions.set(sessionId, bestProcess.pid)
          }
        } catch (error) {
          console.error('[SessionService] Error scanning processes:', error)
        }
      }
    } catch (error) {
      console.error('[SessionService] Error finding active Claude sessions:', error)
    }

    console.debug(
      `[SessionService] Found ${activeSessions.size} active Claude sessions:`,
      Array.from(activeSessions.entries())
    )
    return activeSessions
  }

  /**
   * Find session ID for a given working directory
   */
  private async findSessionIdForWorkingDirectory(cwd: string): Promise<string | null> {
    try {
      const sessions = await this.getFileBasedSessions()
      for (const session of sessions) {
        if (session.projectPath === cwd) {
          return session.id
        }
      }
    } catch (error) {
      console.error('Error finding session ID for working directory:', error)
    }
    return null
  }

  /**
   * Register an in-memory session
   */
  registerSession(sessionInfo: SessionInfo): void {
    this.inMemorySessions.set(sessionInfo.id, sessionInfo)
  }

  /**
   * Update an in-memory session
   */
  updateSession(sessionId: string, updates: Partial<SessionInfo>): void {
    const session = this.inMemorySessions.get(sessionId)
    if (session) {
      // Handle incremental updates for counts
      if (updates.messageCount !== undefined) {
        session.messageCount += updates.messageCount
        delete updates.messageCount
      }
      if (updates.toolCalls !== undefined) {
        session.toolCalls += updates.toolCalls
        delete updates.toolCalls
      }

      Object.assign(session, updates)
      session.lastUpdateTime = new Date()
    } else {
      // If session doesn't exist in memory, try to get it from file-based sessions
      this.getSessionById(sessionId).then((fileSession) => {
        if (fileSession) {
          // Add to in-memory sessions
          this.inMemorySessions.set(sessionId, fileSession)
          // Apply updates
          this.updateSession(sessionId, updates)
        }
      })
    }
  }

  /**
   * Remove an in-memory session
   */
  removeSession(sessionId: string): void {
    this.inMemorySessions.delete(sessionId)
  }

  /**
   * Get active session (most recently updated active session)
   */
  async getActiveSession(): Promise<SessionInfo | null> {
    const sessions = await this.getAllSessions()
    const activeSessions = sessions.filter((s) => s.isActive)

    if (activeSessions.length === 0) {
      return null
    }

    // Return the most recently updated active session
    return activeSessions.reduce((latest, current) =>
      current.lastUpdateTime > latest.lastUpdateTime ? current : latest
    )
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<SessionInfo | null> {
    // Check in-memory first
    const memorySession = this.inMemorySessions.get(sessionId)
    if (memorySession) {
      return memorySession
    }

    // Check file-based sessions
    const fileSessions = await this.getFileBasedSessions()
    return fileSessions.find((s) => s.id === sessionId) || null
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string): Promise<ConversationHistory | null> {
    try {
      // First, try to find the session directory
      let sessionPath: string | null = null

      // Check if sessionId is a direct directory name
      const directPath = path.join(this.claudeProjectsPath, sessionId)
      try {
        await fs.access(directPath)
        sessionPath = directPath
      } catch {
        // Not a direct match, search for the JSONL file
        const dirs = await fs.readdir(this.claudeProjectsPath, { withFileTypes: true })
        for (const dir of dirs) {
          if (dir.isDirectory()) {
            const dirPath = path.join(this.claudeProjectsPath, dir.name)
            const files = await fs.readdir(dirPath)
            if (files.some((f) => f === `${sessionId}.jsonl`)) {
              sessionPath = dirPath
              break
            }
          }
        }
      }

      if (!sessionPath) {
        return null
      }

      // Find JSONL files
      const files = await fs.readdir(sessionPath)
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

      if (jsonlFiles.length === 0) {
        return null
      }

      // Parse the main JSONL file
      const mainJsonlFile = jsonlFiles.find((f) => f.includes(sessionId)) || jsonlFiles[0]
      const jsonlPath = path.join(sessionPath, mainJsonlFile)

      const content = await fs.readFile(jsonlPath, 'utf-8')
      const lines = content.split('\n').filter((line) => line.trim())

      const messages: ConversationMessage[] = []
      let projectPath = ''
      let startTime: Date | null = null
      let lastUpdateTime: Date | null = null

      for (const line of lines) {
        try {
          const entry = JSON.parse(line)

          // Track timestamps
          if (entry.timestamp) {
            const timestamp = new Date(entry.timestamp)
            if (!startTime || timestamp < startTime) {
              startTime = timestamp
            }
            if (!lastUpdateTime || timestamp > lastUpdateTime) {
              lastUpdateTime = timestamp
            }
          }

          // Extract project path
          if (entry.type === 'init' && entry.data?.cwd) {
            projectPath = entry.data.cwd
          } else if (entry.type === 'environment' && entry.data?.workingDirectory) {
            projectPath = entry.data.workingDirectory
          }

          // Extract messages - handle both 'type' field and 'message' field
          if ((entry.type === 'user' || entry.type === 'assistant') && entry.message) {
            const { role, content } = entry.message
            if (role && content) {
              // Handle content array (e.g., tool_use)
              let contentStr = content
              if (Array.isArray(content)) {
                contentStr = content
                  .map((c: { type: string; text?: string; name?: string; input?: unknown }) => {
                    if (c.type === 'text') {
                      return c.text
                    } else if (c.type === 'tool_use') {
                      return `\n\`\`\`tool_use\nTool: ${c.name}\nInput: ${JSON.stringify(c.input, null, 2)}\n\`\`\`\n`
                    }
                    return JSON.stringify(c)
                  })
                  .join('')
              }

              messages.push({
                timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
                role,
                content: contentStr,
                toolCalls:
                  entry.message.tool_calls ||
                  (Array.isArray(content)
                    ? content.filter((c: { type: string } | undefined) => c?.type === 'tool_use')
                    : []),
              })
            }
          }
        } catch (_error) {}
      }

      return {
        sessionId,
        messages,
        projectPath: projectPath || 'Unknown',
        startTime: startTime || new Date(),
        lastUpdateTime: lastUpdateTime || new Date(),
      }
    } catch (error) {
      console.error(`Error getting conversation history for session ${sessionId}:`, error)
      return null
    }
  }
}

// Export singleton instance
export const sessionService = new SessionService()
