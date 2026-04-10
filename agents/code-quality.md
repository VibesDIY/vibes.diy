# Code Quality Standards

## Linting and TypeScript

- **Always run `pnpm check`** before submitting changes - this runs format, build, test, and lint
- **ESLint configuration**: Uses strict TypeScript rules with custom ignores in `eslint.config.mjs`
- **No `any` types**: Replace with proper types like `unknown`, specific interfaces, or union types
- **Unused variables**: Remove entirely or prefix with `_` only for function parameters that must exist for API compliance
- **Remove unused code**: Delete unused imports, interfaces, and parameters completely rather than prefixing

## TypeScript Best Practices

- **Document interface properties**: Use correct property names from type definitions (e.g., `_id` not `messageId` for Fireproof documents)
- **Function signatures**: Match actual implementation types exactly (e.g., navigate function should match React Router's signature)
- **Type imports**: Use `import type` for type-only imports to improve build performance

## Debug and Development Code

- **Console logs**: Remove all `console.log` statements from production code before committing
- **Debug files**: Place browser debugging scripts in `claude-browse-vibes/` directory which is ignored by ESLint
- **Temporary code**: Remove commented debug code and temporary logging before finalizing changes

## React Patterns

- **Interface naming**: Use descriptive names without generic prefixes (e.g., `SessionViewProps` not `Props`)
- **Unused props**: Remove from interface and function signature entirely rather than keeping with `_` prefix
- **Component parameters**: Only include props that are actually used by the component

## Tests

Run vibes.diy tests: `cd vibes.diy/tests && pnpm test`
Run vibes.diy tests (quiet): `cd vibes.diy/tests && pnpm test --reporter=dot`
