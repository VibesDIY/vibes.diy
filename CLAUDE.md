# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

Run `pnpm check` to format, typecheck, and test, before asking for feedback on work. Never delete a test to pass without asking.

### Development

- `pnpm dev` - Start development server with Netlify functions (primary dev command)
- `pnpm check` - Format, typecheck, and test (use this for general development)
- `pnpm test -- filename.test.tsx` - Run a specific test file
- `pnpm typecheck` - Run TypeScript type checking only

**Important**: Always run `pnpm check` unless you are targeting a single specific test file.

## Architecture Overview

This is a React Router v7 SPA application for building AI-powered mini apps. Key architectural components:

### Core Technologies

- **React Router v7** (SPA mode) for routing and SSR framework
- **Fireproof** database for local-first data storage with sync capabilities
- **Vite** for build tooling with custom plugins
- **Tailwind CSS v4** for styling
- **TypeScript** for type safety
- **Vitest** for testing with jsdom environment

### Database Architecture

- **Fireproof** provides local-first storage with real-time sync
- Session-based chat architecture with individual message documents
- Document types: `ChatMessageDocument`, `SessionDocument`, `ScreenshotDocument`, `VibeDocument`
- Database name: Uses `SETTINGS_DBNAME` environment variable

### Key Patterns

#### State Management

- **useSimpleChat** hook centralizes chat functionality and state
- **useSession** manages session lifecycle and document queries
- **useApiKey** handles API key management for both anonymous and authenticated users
- **useAuth** manages authentication state via AuthContext

#### Message Architecture

- Messages are stored as individual documents with session_id references
- Real-time updates via Fireproof's reactive queries
- Supports streaming responses with throttled updates
- Three message types: `user`, `ai`, `system` (for errors)

#### View System

- Multiple views per chat: `app`, `code`, `data`
- **ViewState** utility manages view navigation and state
- **ResultPreview** component handles iframe rendering for app view

### File Structure

- `app/components/` - React components organized by feature
- `app/hooks/` - Custom hooks for business logic
- `app/types/` - TypeScript type definitions
- `app/routes/` - React Router route components
- `app/contexts/` - React contexts for global state
- `app/utils/` - Utility functions and helpers
- `tests/` - Test files with comprehensive coverage

### Environment Configuration

- Uses `app/config/env.ts` for environment variable management
- API keys managed through secure key rotation system
- Development uses Netlify Dev for local serverless functions

### Testing Strategy

- Vitest with jsdom for component testing
- Comprehensive mocking in `tests/__mocks__/`
- React Testing Library for component interactions
- Coverage reporting with detailed metrics

## Development Notes

### API Integration

- Uses OpenRouter API with model routing (`anthropic/claude-sonnet-4` for coding, `meta-llama/llama-3.1-8b-instruct` for titles)
- Credit system for usage tracking
- Anonymous users get limited credits via session-based API keys

### Error Handling

- **useRuntimeErrors** hook tracks immediate and advisory errors
- System messages display errors in chat interface
- Automatic error recovery with user guidance

### Code Generation

- AI generates React components with live preview
- Monaco Editor integration for code editing
- Component export transformation for proper rendering
- Real-time syntax highlighting with Shiki

### Build Configuration

- React Router build with SPA mode enabled
- Vite plugins: Tailwind, TypeScript paths, devtools JSON
- Test environment configured to disable React Router when needed
- Coverage tracking for critical components and utilities

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
NEVER put test mode checks in production code - instead mock upstream dependencies in tests if you need deterministic behavior.
