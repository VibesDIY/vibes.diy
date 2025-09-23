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

## Call-AI Release Process

**IMPORTANT**: Never manually update version numbers in `call-ai/pkg/package.json`. The CI/CD system handles all versioning automatically based on git tags.

### Production Release

To release a new call-ai version:

1. **Create Git Tag**: `git tag call-ai@v0.12.1 -m "Release message"` (use semantic version)
2. **Push Tag**: `git push origin call-ai@v0.12.1`
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
const { database, useLiveQuery } = useFireproof('mydb');

// Enhanced use-vibes behavior (drop-in replacement):
const { database, useLiveQuery, enableSync, disableSync, syncEnabled } = useFireproof('mydb');
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
const { database, useLiveQuery, enableSync, syncEnabled } = useFireproof('db-name');
```

**Key Enhancement:**
- No need to manually pass `{ attach: toCloud() }` parameter
- Automatic `vibes-login-link` button detection and wiring
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
