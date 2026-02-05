# Vibes.diy Agent Documentation

This directory contains detailed documentation for Claude agents working on the vibes.diy codebase.

## Documentation Index

- [Code Quality Standards](agents/code-quality.md) - Linting, TypeScript best practices, React patterns
- [Testing](agents/testing.md) - Running tests
- [Release Process](agents/release-process.md) - Tag-based releases, npm publishing workflow
- [Dependency Management](agents/dependency-management.md) - PNPM workspaces, package structure
- [CI/CD Architecture](agents/cicd-architecture.md) - GitHub Actions, tag-based publishing
- [Use-Vibes Architecture](agents/use-vibes-architecture.md) - Enhanced useFireproof hook, module structure

## Quick Reference

### Before Committing
```bash
pnpm check  # runs format, build, test, lint
```

### Release Tags
- **ONLY** create `use-vibes@*` tags (e.g., `use-vibes@v0.14.6`)
- **NEVER** create `call-ai@*` tags - those are managed manually

### Critical Rules
- Never push to main
- Never write releases to code until they are shipped on npm
- Never manually update version numbers in package.json
