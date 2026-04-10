# Code Quality

The linter enforces no `any`, no unused vars, no unused imports, `import type` for type-only imports. Run `pnpm check` before submitting — it runs format, build, test, and lint.

## Tests

Run vibes.diy tests: `cd vibes.diy/tests && pnpm test`
Run vibes.diy tests (quiet): `cd vibes.diy/tests && pnpm test --reporter=dot`
