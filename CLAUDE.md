# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Express + React web application that provides a mobile-friendly interface for Claude Code CLI. It uses the @anthropic-ai/claude-code SDK directly for real-time streaming communication via WebSocket, allowing users to execute Claude Code commands and monitor progress from any device.

## Development Commands

- **Install dependencies**: `npm install`
- **Unified development**: `npm run dev:unified` - Build and serve from single port (9608)
- **Dual-port development**: `npm run dev` - Vite (5173) + Express (9608) with hot reload
- **Build**: `npm run build` - Build React app for production
- **Production**: `npm start` - Serve everything from port 9608
- **Preview**: `npm run preview` - Build and start in production mode

## Project Structure

```
claude-code-web/
├── server/              # Express backend
│   ├── index.ts        # Express server with Socket.io
│   ├── claude-handler.ts # Claude Code SDK integration
│   └── services/       # Backend services
├── client/              # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── pages/      # Page components
│   │   ├── services/   # Frontend services
│   │   ├── types/      # TypeScript definitions
│   │   ├── App.tsx     # Main application
│   │   └── main.tsx    # Entry point
│   └── index.html      # HTML template
├── shared/              # Shared types and utilities
│   └── types/          # Socket.io event types
│       ├── index.ts    # Common types
│       └── socket.ts   # Socket event interfaces
├── vite.config.js      # Vite configuration
├── package.json        # Project dependencies
└── README.md          # Documentation
```

## Key Dependencies

- **@anthropic-ai/claude-code**: The official Claude Code CLI tool that this project depends on
- **@primer/react**: GitHub's design system for React components
- **socket.io**: Real-time bidirectional communication
- **TypeScript**: Type safety throughout the application

## Architecture Notes

1. **Backend**: Express.js with Socket.io for WebSocket communication
2. **Frontend**: React with Vite for fast development and optimized builds
3. **SDK Integration**: Direct use of @anthropic-ai/claude-code SDK's AsyncGenerator API
4. **Real-time Streaming**: WebSocket events for user, assistant, system, and result messages
5. **Type Safety**: Full TypeScript with type-safe Socket.io events via shared types
6. **Styling**: GitHub Primer (@primer/react) for professional UI design
7. **Notifications**: Web Push API with service worker for real-time notifications

## Implementation Guidance

When implementing features:
1. **Server**: Handle Claude Code SDK interactions in claude-handler.ts
2. **Client**: Keep components focused and use custom hooks for logic
3. **WebSocket Events**: Use typed events from shared/types/socket.ts for type safety
4. **Error Handling**: Use AbortController for cancellable operations
5. **Session Management**: Store active sessions in memory (consider Redis for production)
6. **Mobile UX**: Ensure touch-friendly UI with proper spacing and font sizes
7. **Security**: Never expose sensitive Claude Code operations to the client
8. **Type Safety**: All Socket.io events are fully typed - update shared types when adding new events