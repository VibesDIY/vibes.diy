# Claude Development Notes

## Vibes App Development Guide

**NOTE**: For creating individual Vibes (React components), see `notes/vibes-app-jsx.md`. The instructions in that file are for building apps WITH this platform, NOT for working on this repository itself.

## Agent Documentation

For detailed documentation on working with this codebase, see [agents.md](agents.md):

- [Code Quality Standards](agents/code-quality.md) - Linting, TypeScript, React patterns
- [Testing](agents/testing.md) - Running tests
- [Release Process](agents/release-process.md) - Tag-based releases, npm publishing
- [Dependency Management](agents/dependency-management.md) - PNPM workspaces
- [CI/CD Architecture](agents/cicd-architecture.md) - GitHub Actions
- [Use-Vibes Architecture](agents/use-vibes-architecture.md) - Module structure

## Critical Reminders

- **Always run `pnpm check`** before submitting changes
- **Never push to main**
- **Never write releases to code until shipped** - we can't dereference URLs until they're on npm, otherwise esm.sh gets bad cache
- **Never manually update version numbers** in package.json files
- **Only create `use-vibes@*` tags** - never create `call-ai@*` tags
- **Prefer rebase over squash**
