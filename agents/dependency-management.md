# Dependency Management

## PNPM Workspace System

This repository uses PNPM workspaces to manage a monorepo structure with multiple packages:

### Workspace Package Structure

- **@vibes.diy/prompts** (`prompts/pkg/`) - Core prompts, settings, and configuration data
  - Contains TypeScript interfaces and types (UserSettings, ChatMessage, etc.)
  - Configuration data exports (stylePrompts, LLM catalog, etc.)
  - System prompt generation logic
  - Imported as: `import { UserSettings, stylePrompts } from "@vibes.diy/prompts"`

- **call-ai** (`call-ai/pkg/`) - AI API integration library
  - OpenRouter API client with streaming support
  - Model routing and credit management
  - Error handling and retry logic

- **use-vibes** (`use-vibes/pkg/`) - React hooks and components
  - Enhanced useFireproof hook with sync capabilities
  - Image generation components and utilities
  - Manual redirect strategy for authentication

### Configuration Data Organization

When adding new configuration data (like style prompts), follow this pattern:

1. **JSON file**: Place in `prompts/pkg/` (e.g., `style-prompts.json`)
2. **TypeScript wrapper**: Create typed export module (e.g., `style-prompts.ts`)
3. **Export from index**: Add to `prompts/pkg/index.ts`
4. **Import in consumers**: `import { stylePrompts } from "@vibes.diy/prompts"`

This ensures all configuration data is properly typed and available across the monorepo.

### Workspace Commands

- **Root package.json**: Contains monorepo-level dependencies and scripts that coordinate across packages
- **Individual package directories**: Each has its own `package.json` with specific dependencies
- **Dependency installation**: Run `pnpm install` from the root to install all workspace dependencies
- **Adding dependencies**:
  - Root-level: `pnpm add <package>` (affects the entire monorepo)
  - Specific workspace: `pnpm add <package> --filter <workspace-name>`
- **Script execution**: Scripts in root package.json often delegate to specific workspace packages
- **Shared dependencies**: Common dependencies are hoisted to the root `node_modules` when possible
