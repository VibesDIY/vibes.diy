# Package Architecture

## PNPM Workspace System

This repository uses PNPM workspaces to manage a monorepo structure with multiple packages.

### Workspace Packages

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

### Dependency Management

- **Root package.json**: Contains monorepo-level dependencies and scripts that coordinate across packages
- **Individual package directories**: Each has its own `package.json` with specific dependencies
- **Dependency installation**: Run `pnpm install` from the root to install all workspace dependencies
- **Adding dependencies**:
  - Root-level: `pnpm add <package>` (affects the entire monorepo)
  - Specific workspace: `pnpm add <package> --filter <workspace-name>`
- **Script execution**: Scripts in root package.json often delegate to specific workspace packages
- **Shared dependencies**: Common dependencies are hoisted to the root `node_modules` when possible

## CI/CD Architecture

### GitHub Actions Structure

```
.github/workflows/
├── use-vibes-publish.yaml    # Main workflow triggered by use-vibes@* tags
└── [other workflows...]

actions/
├── base/                     # Base setup actions
├── core-publish/            # Generic publishing action
└── [other shared actions...]

use-vibes/actions/
└── publish/                 # use-vibes specific publishing action
    └── action.yaml
```

### Tag-Based Trigger System

**Tag Pattern**: `use-vibes@v0.12.6-dev` triggers the use-vibes publishing workflow

The workflow in `.github/workflows/use-vibes-publish.yaml`:

1. Triggers on pushes to `use-vibes@*` tags
2. Calls base setup action (`./actions/base`)
3. Calls use-vibes publish action (`./use-vibes/actions/publish`)

### Multi-Package Publishing

Publishing runs three steps sequentially with fail-fast:

1. **publish-call-ai** (working-directory: `call-ai/pkg`)
2. **publish-base** (working-directory: `use-vibes/base`)
3. **publish-use-vibes** (working-directory: `use-vibes/pkg`)

**Always run `pnpm check` before tagging** — the CI also runs it as a gate before any publishing.

### Package Version Coordination

- All packages extract version from the same git tag (`use-vibes@v0.12.6-dev`)
- Package.json versions remain at `0.0.0` as placeholders
- CI dynamically sets version during build process
- Dependency relationships: `use-vibes` → `@vibes.diy/use-vibes-base` → `call-ai`

## Use-Vibes Module Architecture

### Enhanced useFireproof Hook

use-vibes provides an enhanced version of `useFireproof` as a drop-in replacement with sync capabilities:

```typescript
// Original use-fireproof behavior:
const { database, useLiveQuery } = useFireproof("mydb");

// Enhanced use-vibes behavior (drop-in replacement):
const { database, useLiveQuery, enableSync, disableSync, syncEnabled } = useFireproof("mydb");
```

### Module Integration

```
use-vibes/pkg/index.ts (public API)
├── Re-exports from @vibes.diy/use-vibes-base
└── Adds RuntimeError interface

@vibes.diy/use-vibes-base/index.ts (core implementation)
├── Enhanced useFireproof hook (wraps original)
├── toCloud helper
├── ImgGen components and utilities
└── Re-exports from use-fireproof + call-ai
```

### Key behaviors

- **Local-first** — starts without sync by default
- **Automatic sync for returning users** — attaches cloud sync if previously enabled
- **Persistent preferences** — remembers sync choice in localStorage
- **Stub sync functions** — `enableSync()`/`disableSync()` exported but not yet implemented (TODO: will use Clerk token)
- **Backward compatible** — existing code continues to work without changes
