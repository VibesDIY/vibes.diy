# Contributing to vibes.diy

Thank you for your interest in contributing to vibes.diy! We're excited to have you as part of our community.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to **help@vibes.diy**.

## How Can I Contribute?

### Reporting Bugs

- Use [GitHub Issues](https://github.com/VibesDIY/vibes.diy/issues) to report bugs
- Check existing issues to avoid duplicates
- Provide detailed reproduction steps
- Include environment information (OS, Node version, browser, etc.)

### Suggesting Enhancements

- Use [GitHub Issues](https://github.com/VibesDIY/vibes.diy/issues) to suggest features
- Explain the problem you're trying to solve
- Describe your proposed solution
- Consider how it fits with the project's goals

### Pull Requests

We actively welcome your pull requests:

1. **Fork the repo** and create your branch from `main`
2. **Install dependencies**: `pnpm install`
3. **Make your changes**
4. **Run quality checks**: `pnpm check` (format + build + test + lint)
5. **Commit your changes** with a clear commit message
6. **Push to your fork** and submit a pull request

#### Pull Request Guidelines

- Keep PRs focused on a single concern
- Update documentation for API changes
- Follow existing code style and conventions
- Ensure all tests pass (`pnpm check`)
- Write meaningful commit messages

## Development Workflow

### Getting Started

```bash
# Clone the repository
git clone https://github.com/VibesDIY/vibes.diy.git
cd vibes.diy

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Project Structure

This is a PNPM monorepo containing:

- **vibes.diy/** - Main web application
- **use-vibes/** - React hooks and components library
- **call-ai/** - AI API integration library
- **prompts/** - Core prompts and configuration
- **hosting/** - Cloudflare Workers hosting infrastructure
- **utils/** - Shared utilities

### Quality Standards

**CRITICAL**: Always run `pnpm check` before submitting a PR. This command runs:

- `pnpm build` - Builds all packages
- `pnpm lint` - Lints code with ESLint
- `pnpm test` - Runs test suites
- `pnpm format` - Formats code with Prettier

### Code Style

- **TypeScript**: No `any` types - use `unknown`, specific interfaces, or unions
- **Unused variables**: Remove entirely or prefix with `_` for required API parameters
- **Imports**: Use `import type` for type-only imports
- **Console logs**: Remove before committing (use proper logging in production code)
- **File organization**: Keep related code together, avoid creating unnecessary files

### Testing

Run tests for specific packages:

```bash
# Main app tests
cd vibes.diy && pnpm test

# Component library tests
cd use-vibes && pnpm test

# API client tests
cd call-ai && pnpm test

# Run specific test files
pnpm test asset-provider  # uses vitest --run with filename filter
```

### Commit Messages

Follow the existing commit style:

- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes
- `wip:` - Work in progress (avoid in final commits)

**Examples from recent commits:**
- `feat: add image decode pipeline with block.image events`
- `fix: groups infinite loop`
- `chore: bump @adviser/cement`

## Branch Strategy

- **main** - Production-ready code
- **Feature branches** - Named like `username/feature-name`
- **Work in progress** - Prefix with `wip/` if needed
- **Never force-push to main** - This can cause data loss

## Release Process

**Note**: Releases are managed by project maintainers through git tags and CI/CD workflows.

### For Maintainers

Releasing packages (use-vibes, call-ai, etc.):

1. **Keep package.json versions at "0.0.0"** - CI updates them during release
2. Run `pnpm check` to ensure quality
3. Commit and push all changes
4. Create git tag: `git tag use-vibes@v0.X.Y-tagname -m "Release message"`
5. Push tag: `git push origin use-vibes@v0.X.Y-tagname`
6. GitHub Actions handles npm publishing automatically
7. **After npm publication completes**: Update import-map.ts with new version
8. **NEVER update import-map.ts before npm publish** - risks caching 404 on esm.sh

## Getting Help

- Check existing [GitHub issues](https://github.com/VibesDIY/vibes.diy/issues)
- Review the [README](README.md) for basic setup
- See [CLAUDE.md](CLAUDE.md) for detailed development guidelines
- Ask questions in pull request discussions
- Review the [Code of Conduct](CODE_OF_CONDUCT.md) for community standards

## License

By contributing to vibes.diy, you agree that your contributions will be licensed under the same [Permissive License Stack](LICENSE.md) (Apache-2.0 OR MIT) as the project.

Your contributions are made on a voluntary basis and you retain copyright to your contributions, but you grant the project the right to use, modify, and distribute your contributions under the project's license terms.
