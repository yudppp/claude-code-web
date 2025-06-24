#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    port: process.env.PORT || '9608',
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--port' || arg === '-p') {
      if (i + 1 < args.length) {
        options.port = args[i + 1]
        i++ // Skip next argument
      }
    } else if (arg.startsWith('--port=')) {
      options.port = arg.split('=')[1]
    }
  }

  return options
}

// Show help message
function showHelp() {
  console.log(`
Claude Code Web - Web interface for Claude Code CLI

Usage: 
  claude-code-web [options]
  npx @yudppp/claude-code-web [options]

Options:
  --port, -p <port>  Port to run the server on (default: 9608)
  --help, -h         Show this help message

Examples:
  claude-code-web                    # Run on default port 9608
  claude-code-web --port 3000        # Run on port 3000
  claude-code-web -p 3000           # Short form

Environment Variables:
  PORT               Default port if not specified via CLI
`)
}

// Main execution
const options = parseArgs()

if (options.help) {
  showHelp()
  process.exit(0)
}

// Get the directory where the package is installed
const packageDir = path.resolve(__dirname, '..')
const distDir = path.join(packageDir, 'dist')
const distServerDir = path.join(packageDir, 'dist-server')

// Check if the built files exist
if (!fs.existsSync(distDir) || !fs.existsSync(distServerDir)) {
  console.error('Error: Built files not found. Building the project...')

  // Run the build command
  const buildProcess = spawn('npm', ['run', 'build'], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: true,
  })

  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Build process exited with code ${code}`)
      process.exit(code)
    } else {
      // After successful build, start the server
      startServer(options)
    }
  })
} else {
  // Built files exist, start the server directly
  startServer(options)
}

function startServer(options) {
  const serverPath = path.join(distServerDir, 'index.js')

  // Set environment variables
  process.env.NODE_ENV = 'production'
  process.env.PORT = options.port

  console.log(`Starting Claude Code Web on port ${options.port}...`)
  console.log(`Open http://localhost:${options.port} in your browser`)

  // Start the server
  const serverProcess = spawn('node', [serverPath], {
    cwd: packageDir,
    stdio: 'inherit',
    env: process.env,
  })

  serverProcess.on('close', (code) => {
    process.exit(code)
  })

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    serverProcess.kill('SIGTERM')
  })

  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM')
  })
}
