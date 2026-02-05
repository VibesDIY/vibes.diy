# CI/CD Architecture and Tag-Based Publishing

## GitHub Actions Structure

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

## Tag-Based Trigger System

**Tag Pattern**: `use-vibes@v0.12.6-dev` triggers the use-vibes publishing workflow

The workflow in `.github/workflows/use-vibes-publish.yaml`:

1. Triggers on pushes to `use-vibes@*` tags
2. Calls base setup action (`./actions/base`)
3. Calls use-vibes publish action (`./use-vibes/actions/publish`)

## Multi-Package Publishing Process

**CRITICAL ISSUE**: The publishing action runs **three independent steps** that don't fail-fast:

1. **publish-call-ai** (working-directory: `call-ai/pkg`)
2. **publish-base** (working-directory: `use-vibes/base`)
3. **publish-use-vibes** (working-directory: `use-vibes/pkg`)

**Problem**: If step 2 fails with TypeScript errors, steps 1 and 3 still publish successfully, creating **partial releases** with broken packages on npm.

## Build Failure Analysis

When `use-vibes@v0.12.6-dev` was tagged:

- `call-ai@0.12.6-dev` published successfully
- `@vibes.diy/use-vibes-base@0.12.6-dev` failed with TS2742 error
- `use-vibes@0.12.6-dev` published anyway (depends on broken base package)

## Prevention Strategy

**Always run `pnpm check` before tagging** - this would catch the TypeScript error:

```bash
# This runs: format && build && test && lint
pnpm check

# Only create tag if check passes
git tag use-vibes@v0.12.6-dev2
git push origin use-vibes@v0.12.6-dev2
```

## Workflow Improvements (IMPLEMENTED)

**Fixed CI/CD Issues** - The following improvements have been implemented:

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

## Package Version Coordination

- All packages extract version from the same git tag (`use-vibes@v0.12.6-dev`)
- Package.json versions remain at `0.0.0` as placeholders
- CI dynamically sets version during build process
- Dependency relationships: `use-vibes` → `@vibes.diy/use-vibes-base` → `call-ai`
