# Contributing

Thanks for contributing to `vibes.diy`.

## Before You Start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing [issues](https://github.com/VibesDIY/vibes.diy/issues) and [pull requests](https://github.com/VibesDIY/vibes.diy/pulls).
- For questions, open a discussion in an issue or draft PR.

## Development Setup

```bash
git clone https://github.com/VibesDIY/vibes.diy.git
cd vibes.diy
pnpm install
pnpm dev
```

## Making Changes

1. Create a branch from `main`.
2. Keep changes focused on one topic.
3. Add or update tests when behavior changes.
4. Run checks locally:

```bash
pnpm check
```

This runs formatting, linting, build, and tests.

## Pull Requests

- Write a clear title and description.
- Link related issues (for example: `Closes #123`).
- Update docs when needed.
- Ensure CI is green before requesting review.

## Commit Messages

Use clear, imperative commit messages. Conventional prefixes are recommended:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance
- `refactor:` code cleanup without behavior change

## Reporting Bugs

Open an issue with:

- expected behavior
- actual behavior
- steps to reproduce
- environment details (OS, Node, browser, versions)

## License

By contributing, you agree your contributions are licensed under the project license in [LICENSE.md](LICENSE.md) (`Apache-2.0`).
