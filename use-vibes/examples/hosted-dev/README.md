# Hosted Dev Environment

This example app mimics the hosted environment on vibesdiy.net but uses workspace dependencies for live Hot Module Replacement (HMR) during development.

## Purpose

- **Live Development**: Edit use-vibes source files and see changes instantly without rebuilding
- **Production Replica**: Matches the exact initialization flow used on hosted apps
- **Authentication Testing**: Test the auth wall and vibes control overlay functionality
- **AI Integration**: Verify call-ai works with proper authentication headers

## Quick Start

```bash
# Start the dev server
pnpm dev

# In another terminal, run quality checks
pnpm check
```

The app will be available at http://localhost:5173

## Architecture

### Hosted Environment Simulation

This app replicates how hosted apps initialize on vibesdiy.net:

1. **Main React App**: Mounts to `#container` element (like hosted apps)
2. **Vibes Control Overlay**: Mounts to `#vibe-control` element using `mountVibesApp()`
3. **Environment Globals**: Sets up `window.CALLAI_API_KEY` and other hosted environment variables
4. **Authentication Flow**: Uses the same auth strategy as production hosted apps

### Live HMR with Workspace Dependencies

The Vite configuration enables live reload for workspace packages:

```typescript
// vite.config.ts
server: {
  fs: {
    allow: ['..', '../..', '../../..'], // Allow workspace files
  },
},
optimizeDeps: {
  exclude: ['use-vibes', '@vibes.diy/use-vibes-base', 'call-ai'], // Enable HMR
}
```

This means editing files in:

- `use-vibes/base/` - Vibes control panel components
- `use-vibes/pkg/` - Main use-vibes package
- `call-ai/pkg/` - AI integration library

...will trigger instant hot reloads in the dev server.

## Features Demonstrated

### Database Integration

- Fireproof database with live queries
- Message storage and retrieval
- Sync enable/disable functionality

### AI Integration

- call-ai integration with authentication headers
- OpenAI API calls with proper error handling
- Environment variable configuration

### Vibes Control Panel

- Login/logout functionality
- Authentication wall when sync is disabled
- Control buttons when authenticated

## Development Workflow

### Making Changes to use-vibes

1. Edit files in `use-vibes/base/components/` or `use-vibes/pkg/`
2. Changes appear instantly in the running dev server
3. Test authentication, sync, and AI integration flows
4. Use browser DevTools to inspect console logs and component mounting

### Debugging with Claude Browse Scripts

The `/claude-browse-vibes/` directory contains debug scripts for automated browser testing:

```bash
# Run browser automation tests
cd /Users/jchris/code/vibes.diy/claude-browse-vibes
node test-hosted-dev.js
```

These scripts help verify:

- Vibes control panel mounting
- DOM content changes after HMR
- Console log output during initialization
- Authentication flow testing

## CLI Tools

```bash
# Development
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm preview      # Preview built app

# Quality Assurance
pnpm check        # Format + typecheck + lint + build
pnpm lint         # ESLint only
pnpm typecheck    # TypeScript only
pnpm format       # Prettier auto-format
pnpm format:check # Check formatting

# Testing
pnpm test         # Run tests
pnpm test:watch   # Watch mode

# Production
pnpm serve        # Serve built dist files
```

## Environment Configuration

The app reads from URL parameters and environment variables:

- `?api_key=custom` - Override API key
- `?chat_url=custom` - Override chat endpoint
- `window.CALLAI_API_KEY` - Set in setup.js
- `window.CALLAI_CHAT_URL` - Set in setup.js

## TypeScript Configuration

Uses strict TypeScript settings matching the workspace:

- `exactOptionalPropertyTypes: true`
- Proper interface definitions for all document types
- Global window type extensions for hosted environment
- No `any` types allowed

## Testing Strategy

This app serves as a testing ground for:

- **HMR Verification**: Prove workspace dependencies reload correctly
- **Authentication Flow**: Test login/logout and sync enabling
- **AI Integration**: Verify call-ai works with proper headers
- **Component Mounting**: Ensure vibes control panel mounts correctly
- **Browser Automation**: Use Playwright scripts for automated verification
