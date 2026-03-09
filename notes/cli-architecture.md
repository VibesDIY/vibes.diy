# CLI Architecture

## Design decisions

**cmd-ts** for subcommand routing, option parsing, and help generation.

**Deno-first runtime**: `main.deno.ts` is the primary entrypoint. Node gets an npm binary via dnt.

**Runtime-neutral orchestration**: `run-cli.ts` owns command wiring and dispatch. Host-specific entrypoints only provide stdout/stderr and exit-code hooks.

**No `fs.*Sync`**: `fs/promises` everywhere for filesystem work.

**cement Result pattern**: All commands return `Result<void>` from `@adviser/cement`. Errors propagate as values, not exceptions.

**Injectable `CliOutput`**: Commands accept a `CliOutput` parameter (`stdout`/`stderr` functions), so tests can capture output without process forking.

**`.js` import specifiers**: Local imports use `.js` extensions for Node/browser compatibility. Deno resolves these via `--unstable-sloppy-imports`.

---

## Entry points

```
main.deno.ts  ← Deno CLI entrypoint
  └─ calls runCli(Deno.args, runtime)

bin.ts        ← Node CLI entrypoint (compiled by dnt with #!/usr/bin/env node shebang)
  └─ calls runCli(process.argv.slice(2), runtime)

run-cli.ts    ← shared cmd-ts app and dispatch logic
```

npm users run `npx use-vibes`. dnt generates the bin entry with a proper shebang from `bin.ts`.

---

## File structure

```
use-vibes/pkg/
├── main.deno.ts              # Deno entrypoint
├── bin.ts                    # Node entrypoint (dnt adds shebang)
├── run-cli.ts                # shared runtime-neutral orchestrator
├── build-npm.ts              # dnt build script (Deno-only, excluded from tsgo/ESLint)
├── build-npm-imports.json    # npm specifiers for dnt dependency resolution
├── deno.json                 # Deno tasks + JSR config + local import mappings
├── commands/
│   ├── cli-output.ts         # CliOutput interface + Node default output
│   ├── cli-output-deno.ts    # Deno stdout/stderr implementation
│   ├── whoami.ts
│   ├── skills.ts
│   ├── system.ts
│   └── not-implemented.ts
├── scripts/
│   └── check-local-import-specifiers.ts  # enforces .js imports
└── index.ts                  # library exports
```

---

## Testing

CLI tests are `deno test` based:

- **Unit tests**: direct import of command functions with captured output
- **Smoke tests**: spawn `deno run main.deno.ts` and assert exit codes/stdout/stderr

Run with:

```bash
deno task --config use-vibes/pkg/deno.json check-cli   # lint + import specifier check
deno task --config use-vibes/pkg/deno.json test-cli     # unit + smoke tests
```

---

## npm packaging

`build-npm.ts` uses dnt (`@deno/dnt`) to compile TypeScript into an npm-compatible package:

- Generates `bin` entry with `#!/usr/bin/env node` shebang
- ESM-only output (`scriptModule: false` for top-level await)
- Dependencies resolved via `build-npm-imports.json` import map
- CI runs `PACKAGE_VERSION="$VERSION" deno run -A build-npm.ts` then publishes from `dist/npm/`

---

## Key dependencies

- `cmd-ts` — subcommand routing, option parsing, help generation
- `@adviser/cement` — `Result`, `exception2Result`
- `@vibes.diy/prompts` — skill catalog and system prompt assembly
- `@deno/dnt` — Deno-to-npm build tool
- `deno` — primary CLI runtime and test runner
