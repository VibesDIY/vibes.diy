# CLI Architecture

## Design decisions

**Thin dispatcher**: `dispatcher.ts` routes argv tokens to `CommandExecutable` implementations. No framework — just a switch on the first arg.

**Node runtime**: `bin.ts` is the entry point. Published via npm with `#!/usr/bin/env node` shebang.

**No `fs.*Sync`**: `fs/promises` everywhere for filesystem work.

**cement Result pattern**: All commands return `Result<void>` from `@adviser/cement`. Errors propagate as values, not exceptions.

**Injectable `CliOutput`**: Commands accept a `CliOutput` parameter (`stdout`/`stderr` functions), so tests can capture output without process forking.

**`.js` import specifiers**: Local imports use `.js` extensions for Node/browser compatibility.

---

## Entry points

```
bin.ts        ← Node CLI entrypoint (#!/usr/bin/env node shebang)
  └─ creates CliRuntime, calls dispatch(argv, commands, runtime)

dispatcher.ts ← routes argv[0] to CommandExecutable.run()
```

npm users run `npx use-vibes`.

---

## File structure

```
use-vibes/pkg/
├── bin.ts                    # Node entrypoint
├── dispatcher.ts             # thin command router
├── cli/
│   ├── executable.ts         # CommandExecutable + CliRuntime interfaces
│   └── exec/
│       ├── info.ts           # info command executable
│       ├── skills.ts         # skills command executable
│       ├── system.ts         # system command executable
│       ├── whoami.ts         # whoami command executable (stub)
│       └── result-to-exit-code.ts  # Result → exit code helper
├── commands/
│   ├── cli-output-node.ts    # CliOutput interface + Node implementation
│   ├── config.ts             # vibes.json loader (find-up discovery)
│   ├── resolve-target.ts     # Target resolution (bare → owner/app/group)
│   ├── info.ts               # Dry-run target resolution for debugging
│   ├── skills.ts             # Skill catalog listing
│   ├── system.ts             # System prompt assembly
│   └── whoami.ts             # Identity stub (returns Err)
└── index.ts                  # library exports
```

---

## Testing

CLI tests use vitest, run via `pnpm --filter use-vibes-test run test:cli`:

- **Unit tests**: direct import of command functions with `captureOutput()` helper
- **Integration tests**: call `dispatch()` in-process with captured output, assert exit codes + stdout/stderr
- No subprocess forking — all in-process via injectable `CliOutput`

Run with:

```bash
pnpm --filter use-vibes run check:cli    # eslint on dispatcher + cli/ + commands/ + tests/
pnpm --filter use-vibes-test run test:cli # vitest with cli config
```

---

## Key dependencies

- `find-up` — config file discovery (vibes.json)
- `@adviser/cement` — `Result`, `exception2Result`, `pathOps`
- `@vibes.diy/prompts` — skill catalog and system prompt assembly
