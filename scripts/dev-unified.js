#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')

console.log('🔨 Building React app...')

// First, build the React app
const build = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
})

build.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Build failed')
    process.exit(1)
  }

  console.log('✅ Build complete')
  console.log('🚀 Starting server on port 9608...')
  console.log('📱 Open http://localhost:9608 in your browser\n')

  // Then start the server
  const server = spawn('npm', ['run', 'server:dev'], {
    stdio: 'inherit',
    shell: true,
  })

  server.on('close', (code) => {
    process.exit(code)
  })
})
