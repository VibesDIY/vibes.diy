# CLI Architecture

## Target architecture (from Meno)

All side-effects should be outside the application logic. A CLI command decomposes into three layers:

```
runtimeSpecific:  parseCLIToReq(argv) → RequestObject
genericPart:      triggerHandler(ctx)(req, { send }) → void
runtimeSpecific:  processLineOutput(output, results)
```

- **Parse**: runtime-specific argv parsing into a typed request object
- **Handle**: pure logic that takes a request + `{ send }` callback, emits typed result objects. No stdout, no fs, no process — just data in, data out
- **Serialize**: runtime-specific output formatting (text, JSON, etc.) with proper exit codes

This structure lets the same handler run in Node, Deno, Cloudflare Workers (agent runtime), or tests — only the parse and serialize layers change.

### Test shape

```typescript
it('handler returns time', () => {
  const ctx = setupGenericPartCtx()
  const req = { type: 'req.cli.print.time' }
  const send = vi.fn()
  triggerHandler(ctx)(req, { send })
  expect(send).toHaveBeenCalledWith({ type: 'res.cli.print.time', time: expect.any(Date) })
})

it('parses argv to request', () => {
  const req = parseCLIToReq(['print', '--time'])
  expect(req).toEqual({ type: 'req.cli.print.time' })
})

it('serializes result to output', () => {
  const output = { out: vi.fn(), err: vi.fn() }
  processLineOutput(output, [{ type: 'res.cli.print.time', time: new Date('2024') }])
  expect(output.out).toHaveBeenCalledWith('2024\n')
})
```

The handler test has zero runtime dependencies — no output capture, no temp dirs, no process mocking. This is the goal.

---

## Current implementation (what exists today)

The current code does NOT follow the target architecture. Commands mix logic and output:

```
dispatch(argv, runtime) → void
  └─ exec.run(argv, runtime) → exitCode
       └─ runSkills(runtime) → Result<void>   // calls runtime.output.stdout() directly
```

**What's missing:**
- No typed request/response objects — commands receive raw argv + runtime
- No handler/output separation — `runSkills()` calls `output.stdout()` inside the logic
- No output serializer — text formatting is hardcoded in each command
- No JSON output mode
- Tests assert captured stdout strings instead of structured data

### Entry points

```
bin.ts        ← Node CLI entrypoint (#!/usr/bin/env node shebang)
  └─ creates CliRuntime, calls dispatch(argv, runtime)

dispatcher.ts ← routes argv[0] to CommandExecutable.run()
```

### File structure

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
│       └── result-to-exit-code.ts
├── commands/
│   ├── cli-output-node.ts    # CliOutput interface + Node implementation
│   ├── config.ts             # vibes.json loader (find-up discovery)
│   ├── resolve-target.ts     # Target resolution (bare → owner/app/group)
│   ├── info.ts               # calls runtime.output directly (needs refactor)
│   ├── skills.ts             # calls runtime.output directly (needs refactor)
│   ├── system.ts             # calls runtime.output directly (needs refactor)
│   └── whoami.ts             # stub
└── index.ts                  # library exports
```

### Testing

CLI tests use vitest, run via `pnpm --filter use-vibes-test run test:cli`:

- **Unit tests**: direct import of command functions with `makeTestRuntime()` helper
- **Integration tests**: call `dispatch()` in-process with captured output, assert exit codes + stdout/stderr
- No subprocess forking — all in-process via injectable `CliRuntime`

```bash
pnpm --filter use-vibes run check:cli    # eslint on dispatcher + cli/ + commands/ + tests/
pnpm --filter use-vibes-test run test:cli # vitest with cli config
```

### Key dependencies

- `find-up` — config file discovery (vibes.json)
- `@adviser/cement` — `Result`, `exception2Result`, `pathOps`
- `@vibes.diy/prompts` — skill catalog and system prompt assembly

---

## Migration path

See [cli-hello-world.md](cli-hello-world.md) for the plan to refactor from the current implementation to the target architecture.
