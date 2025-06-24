# Claude Code Web

A web interface for Claude Code CLI that allows you to monitor and control Claude sessions from your browser. Built with Express, React, and Socket.io for real-time communication.

## Features

- 📱 **Mobile-friendly interface** - Monitor Claude sessions from any device
- 🔄 **Real-time updates** - Live streaming of Claude's responses via WebSocket
- 📋 **Session management** - View active/inactive sessions and their history
- ✅ **Tool approval** - Approve or reject tool executions with permanent allow options
- 🔔 **Notifications** - Get notified about tool approvals and task completions
- 🎨 **GitHub Primer UI** - Professional design system from GitHub
- 🌐 **Single-port deployment** - Everything runs on a single port

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)

## Quick Start

Run directly with npx (no installation required):

```bash
npx @yudppp/claude-code-web
```

Or specify a custom port:

```bash
npx @yudppp/claude-code-web --port 3000
npx @yudppp/claude-code-web -p 3000
```

## Installation

### Global Installation

```bash
npm install -g @yudppp/claude-code-web
```

Then run:

```bash
claude-code-web                    # Default port 9608
claude-code-web --port 3000        # Custom port
claude-code-web -p 3000           # Short form
```

### Local Development

```bash
git clone https://github.com/yudppp/claude-code-web.git
cd claude-code-web
npm install
```

## Usage

### Running the Server

After installation, you can run the server in several ways:

1. **Using npx** (recommended for quick start):
```bash
npx @yudppp/claude-code-web
npx @yudppp/claude-code-web --port 3000
npx @yudppp/claude-code-web -p 3000
```

2. **Global command** (if installed globally):
```bash
claude-code-web
claude-code-web --port 3000
claude-code-web -p 3000
```

3. **Development mode**:
```bash
npm run dev:unified  # Single port with hot reload
npm run dev         # Dual-port mode (Vite + Express)
```

4. **Production mode**:
```bash
npm run build
npm start
```

### Command Line Options

```bash
# Show help
npx @yudppp/claude-code-web --help

# Specify port (multiple formats supported)
npx @yudppp/claude-code-web --port 3000
npx @yudppp/claude-code-web -p 3000
npx @yudppp/claude-code-web --port=3000

# Environment variable
PORT=3000 npx @yudppp/claude-code-web

# Default port is 9608
```

### Access the Interface

Open http://localhost:9608 in your browser (or your custom port if specified).

## Architecture

- **Backend**: Express.js server with Socket.io for WebSocket communication
- **Frontend**: React 19 with Vite for fast development
- **UI Library**: GitHub Primer (@primer/react) for consistent design
- **SDK Integration**: Direct use of @anthropic-ai/claude-code SDK
- **Session Detection**: Automatic discovery of active Claude processes
- **Type Safety**: Full TypeScript support throughout

## Development Commands

- `npm run dev` - Start development servers (dual-port)
- `npm run dev:unified` - Start unified development server
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Project Structure

```
claude-code-web/
├── server/              # Express backend
│   ├── index.ts        # Server entry point
│   ├── claude-handler.ts # Claude SDK integration
│   └── services/       # Business logic
├── client/              # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom hooks
│   │   ├── pages/      # Page components
│   │   └── services/   # Client services
│   └── index.html
├── shared/              # Shared types
├── bin/                # CLI executable
└── dist/               # Production build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details