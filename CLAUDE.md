# Claude Development Notes

## Vibes App Development Guide

**NOTE**: For creating individual Vibes (React components), see `notes/vibes-app-jsx.md`. The instructions in that file are for building apps WITH this platform, NOT for working on this repository itself.

## Code Quality Standards

### Linting and TypeScript

- **Always run `pnpm check`** before submitting changes - this runs format, build, test, and lint
- **ESLint configuration**: Uses strict TypeScript rules with custom ignores in `eslint.config.mjs`
- **No `any` types**: Replace with proper types like `unknown`, specific interfaces, or union types
- **Unused variables**: Remove entirely or prefix with `_` only for function parameters that must exist for API compliance
- **Remove unused code**: Delete unused imports, interfaces, and parameters completely rather than prefixing

### TypeScript Best Practices

- **Document interface properties**: Use correct property names from type definitions (e.g., `_id` not `messageId` for Fireproof documents)
- **Function signatures**: Match actual implementation types exactly (e.g., navigate function should match React Router's signature)
- **Type imports**: Use `import type` for type-only imports to improve build performance

### Debug and Development Code

- **Console logs**: Remove all `console.log` statements from production code before committing
- **Debug files**: Place browser debugging scripts in `claude-browse-vibes/` directory which is ignored by ESLint
- **Temporary code**: Remove commented debug code and temporary logging before finalizing changes

### React Patterns

- **Interface naming**: Use descriptive names without generic prefixes (e.g., `SessionViewProps` not `Props`)
- **Unused props**: Remove from interface and function signature entirely rather than keeping with `_` prefix
- **Component parameters**: Only include props that are actually used by the component

## Tests

Run vibes.diy tests: `cd vibes.diy/tests && pnpm test`
Run vibes.diy tests (quiet): `cd vibes.diy/tests && pnpm test --reporter=dot`

## Release Process

**CRITICAL**: Always commit and push changes BEFORE creating release tags.

**CRITICAL**: Claude should ONLY create `use-vibes@*` tags. Do NOT create `call-ai@*` tags - those are managed separately.

### Proper Release Order

1. **Run Quality Checks**: `pnpm check` (or at minimum `pnpm lint`)
2. **Commit Changes**: `git add . && git commit -m "message"`
3. **Push Changes**: `git push`
4. **Create Git Tag**: `git tag use-vibes@v0.14.6 -m "Release message"` (ONLY use-vibes tags!)
5. **Push Tag**: `git push origin use-vibes@v0.14.6`
6. **Confirm GitHub Actions**: The CI will automatically extract the version from the tag and publish to npm

**CRITICAL MISTAKES TO AVOID**:

- Never create git tags before committing changes! The tag will point to the old commit without your changes.
- Never create `call-ai@*` tags - only create `use-vibes@*` tags

**IMPORTANT**: Never manually update version numbers in package.json files. The CI/CD system handles all versioning automatically based on git tags.

### Use-Vibes Release Process

To release use-vibes (this is the ONLY package Claude should release):

1. **Create Git Tag**: `git tag use-vibes@v0.14.6 -m "Release message"` (use semantic version)
2. **Push Tag**: `git push origin use-vibes@v0.14.6`
3. **Confirm GitHub Actions**: The CI will automatically extract the version from the tag and publish to npm

**Note**: use-vibes releases automatically publish all three packages:

- `call-ai` (browser-loaded AI API client)
- `@vibes.diy/use-vibes-base` (core components and hooks)
- `use-vibes` (main package)

### Call-AI Release Process (MANUAL ONLY - Not for Claude)

Call-AI releases are managed manually by humans, not by Claude:

1. **Create Git Tag**: `git tag call-ai@v0.14.5 -m "Release message"` (use semantic version)
2. **Push Tag**: `git push origin call-ai@v0.14.5`
3. **Confirm GitHub Actions**: The CI will automatically extract the version from the tag and publish to npm

### Dev Release Process

To test call-ai fixes by releasing a dev version:

1. **Create Git Tag**: `git tag call-ai@v0.0.0-dev-prompts && git push origin call-ai@v0.0.0-dev-prompts`
2. **Confirm GitHub Actions**: Approve the manual step in the triggered workflow
3. **Verify NPM Dev Channel**: Check `npm view call-ai versions --json` for the new dev version

The CI reads the version from the git tag (not from package.json) and publishes accordingly. The `call-ai/pkg/package.json` version stays at `0.0.0` as a placeholder.

## Dependency Management

### PNPM Workspace System

This repository uses PNPM workspaces to manage a monorepo structure with multiple packages:

#### Workspace Package Structure

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

#### Configuration Data Organization

When adding new configuration data (like style prompts), follow this pattern:

1. **JSON file**: Place in `prompts/pkg/` (e.g., `style-prompts.json`)
2. **TypeScript wrapper**: Create typed export module (e.g., `style-prompts.ts`)
3. **Export from index**: Add to `prompts/pkg/index.ts`
4. **Import in consumers**: `import { stylePrompts } from "@vibes.diy/prompts"`

This ensures all configuration data is properly typed and available across the monorepo.

- **Root package.json**: Contains monorepo-level dependencies and scripts that coordinate across packages
- **Individual package directories**: Each has its own `package.json` with specific dependencies
- **Dependency installation**: Run `pnpm install` from the root to install all workspace dependencies
- **Adding dependencies**:
  - Root-level: `pnpm add <package>` (affects the entire monorepo)
  - Specific workspace: `pnpm add <package> --filter <workspace-name>`
- **Script execution**: Scripts in root package.json often delegate to specific workspace packages
- **Shared dependencies**: Common dependencies are hoisted to the root `node_modules` when possible

## CI/CD Architecture and Tag-Based Publishing

### GitHub Actions Structure

The repository uses a complex CI/CD system with multiple workflows and composite actions:

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

### Multi-Package Publishing Process

**CRITICAL ISSUE**: The publishing action runs **three independent steps** that don't fail-fast:

1. **publish-call-ai** (working-directory: `call-ai/pkg`)
2. **publish-base** (working-directory: `use-vibes/base`)
3. **publish-use-vibes** (working-directory: `use-vibes/pkg`)

**Problem**: If step 2 fails with TypeScript errors, steps 1 and 3 still publish successfully, creating **partial releases** with broken packages on npm.

### Build Failure Analysis

When `use-vibes@v0.12.6-dev` was tagged:

- ✅ `call-ai@0.12.6-dev` published successfully
- ❌ `@vibes.diy/use-vibes-base@0.12.6-dev` failed with TS2742 error
- ✅ `use-vibes@0.12.6-dev` published anyway (depends on broken base package)

### Prevention Strategy

**Always run `pnpm check` before tagging** - this would catch the TypeScript error:

```bash
# This runs: format && build && test && lint
pnpm check

# Only create tag if check passes
git tag use-vibes@v0.12.6-dev2
git push origin use-vibes@v0.12.6-dev2
```

### Workflow Improvements (IMPLEMENTED)

✅ **Fixed CI/CD Issues** - The following improvements have been implemented:

1. **Added root validation step** - `pnpm check` now runs before any publishing attempts
2. **Added fail-fast behavior** - All bash scripts use `set -e` to exit on first error
3. **Atomic publishing** - If any step fails, the entire workflow stops

**New Workflow Order**:

1. Checkout code
2. Setup base environment
3. **Run `pnpm check`** (format + build + test + lint) - **STOPS HERE IF ANY PACKAGE HAS ISSUES**
4. Publish call-ai (only if validation passes)
5. Publish use-vibes/base (only if call-ai succeeds)
6. Publish use-vibes/pkg (only if base succeeds)

### Package Version Coordination

- All packages extract version from the same git tag (`use-vibes@v0.12.6-dev`)
- Package.json versions remain at `0.0.0` as placeholders
- CI dynamically sets version during build process
- Dependency relationships: `use-vibes` → `@vibes.diy/use-vibes-base` → `call-ai`

## Use-Vibes Module Architecture

### Enhanced useFireproof Hook Strategy

From commit `8509d99` (Sept 17, 2025), use-vibes provides an **enhanced version** of `useFireproof` that serves as a drop-in replacement with additional sync capabilities.

#### Original vs Enhanced Behavior

```typescript
// Original use-fireproof behavior:
const { database, useLiveQuery } = useFireproof("mydb");

// Enhanced use-vibes behavior (drop-in replacement):
const { database, useLiveQuery, enableSync, disableSync, syncEnabled } =
  useFireproof("mydb");
```

#### Key Enhancements Added

1. **Local-first behavior** - starts without sync by default
2. **ManualRedirectStrategy** - custom auth strategy with subtle UI overlay
3. **enableSync()** function - allows users to manually trigger sync
4. **disableSync()** function - allows users to disable sync
5. **syncEnabled** state - tracks current sync status
6. **Persistent preferences** - remembers sync choice in localStorage

### Module Integration Architecture

```
use-vibes/pkg/index.ts (public API)
├── Re-exports from @vibes.diy/use-vibes-base
└── Adds RuntimeError interface

@vibes.diy/use-vibes-base/index.ts (core implementation)
├── Enhanced useFireproof hook (wraps original)
├── toCloud helper (with ManualRedirectStrategy)
├── ManualRedirectStrategy class
├── ImgGen components and utilities
└── Re-exports from use-fireproof + call-ai
```

### Enhanced useFireproof Implementation Details

The use-vibes `useFireproof` is a **wrapper** around the original that adds:

1. **Automatic ManualRedirectStrategy injection** - uses custom auth flow instead of default redirect
2. **Conditional sync** - only attaches cloud sync when explicitly enabled by user
3. **State management** - tracks manual vs automatic sync states using React state
4. **UI automation** - programmatically triggers auth popups via DOM manipulation
5. **Persistence** - uses localStorage to remember user's sync preference across sessions
6. **Dual attachment modes** - supports both original flow (for returning users) and manual flow (for first-time)

### Drop-in Replacement Strategy

For users who change their import from `use-fireproof` to `use-vibes`, the enhanced version provides:

- **Same API surface** - all original useFireproof functionality preserved
- **Implicit cloud sync** - cloud sync is always enabled (no need for `{ attach: toCloud() }`)
- **Enhanced defaults** - better auth UX with ManualRedirectStrategy
- **Optional sync features** - `enableSync`/`disableSync` available but not required
- **Backward compatibility** - existing code continues to work without changes
- **Progressive enhancement** - users can opt-in to new sync features when ready

#### Enhanced Button Integration

```typescript
// Simple API - no manual sync config needed:
const { database, useLiveQuery, enableSync, syncEnabled } =
  useFireproof("db-name");
```

**Key Enhancement:**

- No need to manually pass `{ attach: toCloud() }` parameter
- Automatic `vibes-login-link` button detection and wiring
- **Automatic ledger naming**: Generates cloud ledger names like `https-myapp-com-kanban-board`
- **Environment isolation**: Different origins (localhost vs production) get separate ledgers
- ManualRedirectStrategy provides better auth UX
- **Respects user preferences**: Only enables sync when user clicks the button or has previously enabled it
- Sync state is managed through localStorage (`wasSyncEnabled` preference)

#### Automatic Button Integration

The enhanced `useFireproof` automatically detects and wires up a button with `id="vibes-login-link"`:

- **Button Detection**: Searches for `#vibes-login-link` on component mount
- **Event Handling**: Connects button clicks to the `enableSync()` function
- **Multiple Instances**: Each `useFireproof` hook adds its own event listener
- **Clean Cleanup**: Event listeners are properly removed on component unmount
- **Graceful Degradation**: Works without the button (no errors if not found)

This allows vibes runtime containers to provide a login button that automatically triggers sync for all active `useFireproof` instances.

### ManualRedirectStrategy Features

- **Subtle UI overlay** - bottom-right notification instead of full-screen redirect
- **Custom CSS animations** - slide-up animation with modern styling
- **Programmatic auth** - JavaScript-triggered popup instead of page redirect
- **Better UX** - non-blocking authentication flow
- **Configurable** - custom overlay HTML and CSS can be provided
- dont write releases to code until they are shipped. we cant derefernce that url until its on npm, otherwise esm.sh gets bad cache
- never push to main
- dont squash next time rebase
