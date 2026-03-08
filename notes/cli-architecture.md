# CLI Architecture

## Design decisions

**cmd-ts** for subcommand routing. Initially planned to use a manual `process.argv` router, but Meno's PR review (see [cli-mvp-code-review.md](cli-mvp-code-review.md)) pushed toward cmd-ts.

**Deno-first runtime**: `main.deno.ts` is now the primary entrypoint in development and CI. Node keeps a compatibility wrapper for `npx use-vibes`.

**Runtime-neutral orchestration**: `run-cli.ts` owns command wiring and dispatch. Host-specific entrypoints only provide stdout/stderr and exit-code hooks.

**No `fs.*Sync`**: `fs/promises` everywhere for filesystem work.

**cement Result pattern**: All commands return `Result<void>` from `@adviser/cement`. Errors propagate as values, not exceptions.

**Injectable `CliOutput`**: Commands accept a `CliOutput` parameter (`stdout`/`stderr` functions), so tests can capture output without process forking.

**`loadAsset` for text files**: Help text lives in `help.txt`, loaded via cement `loadAsset` with `import.meta.url` as base path.

---

## Entry points

```
main.deno.ts  ← Deno-first CLI entrypoint
  └─ calls runCli(Deno.args, runtime)

cli.ts        ← Node compatibility entrypoint
  └─ calls runCli(process.argv.slice(2), runtime)

run-cli.ts    ← shared cmd-ts app and dispatch logic
```

`cli.js` remains the npm bin wrapper during transition. It exists only to execute TypeScript in Node environments that use `npx use-vibes`.

---

## Command structure

```
use-vibes/pkg/
├── main.deno.ts           # Deno entrypoint
├── cli.js                 # npm bin wrapper (transition)
├── cli.ts                 # Node entrypoint
├── run-cli.ts             # shared runtime-neutral orchestrator
├── deno.json              # Deno tasks + local import mappings
├── commands/
│   ├── cli-output.ts      # CliOutput interface + Node default output
│   ├── cli-output-deno.ts # Deno stdout/stderr implementation
│   ├── help.ts
│   ├── help.txt
│   ├── whoami.ts
│   ├── skills.ts
│   ├── system.ts
│   └── not-implemented.ts
└── index.ts               # library exports
```

---

## Testing

CLI tests are now `deno test` based:

- **Unit tests**: direct import of command functions with captured output
- **Smoke tests**: spawn `deno run main.deno.ts` and assert exit codes/stdout/stderr

Run with:

```bash
deno task --config use-vibes/pkg/deno.json check-cli
deno task --config use-vibes/pkg/deno.json test-cli
```

---

## Key dependencies

- `cmd-ts` — subcommand routing, option parsing, help generation
- `@adviser/cement` — `Result`, `exception2Result`, `loadAsset`
- `@vibes.diy/prompts` — skill catalog and system prompt assembly
- `deno` — primary CLI runtime and test runner
