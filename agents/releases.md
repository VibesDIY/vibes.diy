# Release Process

**CRITICAL**: Always commit and push changes BEFORE creating release tags.

**CRITICAL**: Claude should ONLY create `use-vibes@*` tags. Do NOT create `call-ai@*` tags - those are managed separately.

## Proper Release Order

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

## Use-Vibes Release Process

To release use-vibes (this is the ONLY package Claude should release):

1. **Create Git Tag**: `git tag use-vibes@v0.14.6 -m "Release message"` (use semantic version)
2. **Push Tag**: `git push origin use-vibes@v0.14.6`
3. **Confirm GitHub Actions**: The CI will automatically extract the version from the tag and publish to npm

**Note**: use-vibes releases automatically publish all three packages:

- `call-ai` (browser-loaded AI API client)
- `@vibes.diy/use-vibes-base` (core components and hooks)
- `use-vibes` (main package)

## Call-AI Release Process (MANUAL ONLY - Not for Claude)

Call-AI releases are managed manually by humans, not by Claude:

1. **Create Git Tag**: `git tag call-ai@v0.14.5 -m "Release message"` (use semantic version)
2. **Push Tag**: `git push origin call-ai@v0.14.5`
3. **Confirm GitHub Actions**: The CI will automatically extract the version from the tag and publish to npm

## Dev Release Process

To test call-ai fixes by releasing a dev version:

1. **Create Git Tag**: `git tag call-ai@v0.0.0-dev-prompts && git push origin call-ai@v0.0.0-dev-prompts`
2. **Confirm GitHub Actions**: Approve the manual step in the triggered workflow
3. **Verify NPM Dev Channel**: Check `npm view call-ai versions --json` for the new dev version

The CI reads the version from the git tag (not from package.json) and publishes accordingly. The `call-ai/pkg/package.json` version stays at `0.0.0` as a placeholder.
