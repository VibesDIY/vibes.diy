# CLI Hello World — The Right Structure

This document describes the target CLI architecture and the concrete steps to get there. Based on Meno's feedback: **all side-effects should not be part of the application**.

## The shape

A CLI app is three layers:

```
parse(argv) → RequestObject
handle(ctx, req, { send }) → void
serialize(output, results) → void
```

1. **Parse** — runtime-specific. Turns raw argv into a typed request object. Different runtimes (Node, Deno, Cloudflare agent) may parse differently.
2. **Handle** — generic. Pure function. Takes a context (injected dependencies), a typed request, and a `{ send }` callback. Calls `send()` with typed result objects. Never touches stdout, stderr, fs, process, or any runtime API.
3. **Serialize** — runtime-specific. Takes typed result objects and writes them to output. Supports multiple formats (text, JSON). Handles exit codes.

## Why this matters

The handler is the application. Everything else is plumbing. When the handler has no side-effects:

- **Tests are trivial** — assert what `send` was called with, no output capture or temp dirs
- **Multi-runtime is free** — same handler works in Node, Deno, Cloudflare Workers, browser
- **JSON output is free** — just swap the serializer
- **Streaming is free** — `send` can emit results incrementally (evento pattern)
- **Composition is free** — one handler can call another handler's logic without going through stdout

## The types

```typescript
// Request types — one per command
interface CliReqSkills {
  readonly type: 'req.cli.skills'
}

interface CliReqSystem {
  readonly type: 'req.cli.system'
  readonly skills?: string[]
}

interface CliReqInfo {
  readonly type: 'req.cli.info'
  readonly target?: string
}

interface CliReqWhoami {
  readonly type: 'req.cli.whoami'
}

type CliRequest = CliReqSkills | CliReqSystem | CliReqInfo | CliReqWhoami

// Response types — one per output shape
interface CliResSkills {
  readonly type: 'res.cli.skills'
  readonly skills: readonly { name: string; description: string }[]
}

interface CliResSystem {
  readonly type: 'res.cli.system'
  readonly prompt: string
}

interface CliResInfo {
  readonly type: 'res.cli.info'
  readonly configPath: string
  readonly app: string
  readonly target?: string
}

interface CliResError {
  readonly type: 'res.cli.error'
  readonly message: string
}

type CliResponse = CliResSkills | CliResSystem | CliResInfo | CliResError
```

## The hello world test

Start here. This is the first test to write — before any refactor:

```typescript
import { describe, expect, it, vi } from 'vitest'

// The handler context — injected dependencies (no runtime APIs)
interface CliHandlerCtx {
  readonly getLlmCatalog: () => Promise<{ name: string; description: string }[]>
  readonly findVibesJson: (startDir: string) => Promise<Result<{ path: string; config: { app: string } }>>
}

describe('cli handler', () => {
  it('skills handler sends catalog', async () => {
    const ctx: CliHandlerCtx = {
      getLlmCatalog: async () => [
        { name: 'fireproof', description: 'Local-first database' },
        { name: 'callai', description: 'LLM API' },
      ],
      findVibesJson: async () => Result.Err('not needed'),
    }
    const send = vi.fn()
    await handleCliRequest(ctx, { type: 'req.cli.skills' }, { send })
    expect(send).toHaveBeenCalledWith({
      type: 'res.cli.skills',
      skills: [
        { name: 'fireproof', description: 'Local-first database' },
        { name: 'callai', description: 'LLM API' },
      ],
    })
  })

  it('skills handler sends error on failure', async () => {
    const ctx: CliHandlerCtx = {
      getLlmCatalog: async () => { throw new Error('boom') },
      findVibesJson: async () => Result.Err('not needed'),
    }
    const send = vi.fn()
    await handleCliRequest(ctx, { type: 'req.cli.skills' }, { send })
    expect(send).toHaveBeenCalledWith({
      type: 'res.cli.error',
      message: expect.stringContaining('boom'),
    })
  })
})

describe('cli parse', () => {
  it('parses skills command', () => {
    const req = parseCLIToReq(['skills'])
    expect(req).toEqual({ type: 'req.cli.skills' })
  })

  it('parses system with skills flag', () => {
    const req = parseCLIToReq(['system', '--skills', 'fireproof,d3'])
    expect(req).toEqual({ type: 'req.cli.system', skills: ['fireproof', 'd3'] })
  })

  it('unknown command returns error request', () => {
    const req = parseCLIToReq(['xyzzy'])
    expect(req).toEqual({ type: 'req.cli.unknown', command: 'xyzzy' })
  })
})

describe('cli output', () => {
  it('formats skills as text', () => {
    const out = vi.fn()
    const err = vi.fn()
    processLineOutput({ out, err }, [{
      type: 'res.cli.skills',
      skills: [{ name: 'fireproof', description: 'Local-first database' }],
    }])
    expect(out).toHaveBeenCalledWith('fireproof   Local-first database\n')
  })

  it('formats error to stderr', () => {
    const out = vi.fn()
    const err = vi.fn()
    const code = processLineOutput({ out, err }, [{
      type: 'res.cli.error',
      message: 'something broke',
    }])
    expect(err).toHaveBeenCalledWith('Error: something broke\n')
    expect(code).toBe(1)
  })
})
```

Notice:
- The handler test doesn't need `captureOutput()`, `makeTestRuntime()`, `withTempDir()`, or any runtime helpers
- Dependencies are injected via `ctx` — `getLlmCatalog` is a function, not an import
- The output test doesn't need the handler — it just formats typed objects
- Each layer is tested independently

## What changes in the codebase

### New files

```
use-vibes/pkg/
├── cli/
│   ├── types.ts              # CliRequest, CliResponse union types
│   ├── handler.ts            # handleCliRequest(ctx, req, { send })
│   ├── parse.ts              # parseCLIToReq(argv) → CliRequest
│   └── output.ts             # processLineOutput(output, results) → exitCode
```

### Modified files

```
bin.ts         → parse(argv) → handle(ctx, req, { send }) → serialize(output, results)
dispatcher.ts  → deleted or becomes just the parse layer
cli/exec/*     → deleted (absorbed into handler.ts)
commands/*     → handler logic extracted, output calls removed
```

### Deleted files

```
cli/exec/skills.ts      → handler.ts
cli/exec/system.ts      → handler.ts
cli/exec/info.ts        → handler.ts
cli/exec/whoami.ts      → handler.ts
cli/exec/result-to-exit-code.ts → output.ts
cli/executable.ts       → types.ts
```

## Migration order

1. **Write the types** (`cli/types.ts`) — request and response discriminated unions
2. **Write the tests** — hello world tests from above, targeting the new handler
3. **Write the handler** (`cli/handler.ts`) — extract logic from existing commands, remove output calls
4. **Write the parser** (`cli/parse.ts`) — extract from dispatcher + exec wrappers
5. **Write the serializer** (`cli/output.ts`) — extract text formatting from existing commands
6. **Wire bin.ts** — parse → handle → serialize
7. **Delete the old layers** — dispatcher.ts, cli/exec/*, commands/*.ts output calls
8. **Update tests** — migrate existing 36 tests to the new shape

## Runtime decision

TypeScript, because:
- Cloudflare Workers agent runtime path (future)
- Shares types with the API (`VibesDiyApiIface`)
- cement library already in use
- Team knows it

Constraints this creates:
- Requires a JS runtime (Node, Deno, Bun)
- Binary distribution is hard (but not needed — npm is the distribution channel)
- Handler logic MUST be runtime-independent (no `node:*` imports in handlers)

Alternatives considered:
- **Go**: single binary, easy distribution, but no Cloudflare agent path, weaker types
- **Rust**: checks all boxes but 3x development time, no cement, hard for team to maintain

## Context injection

The `CliHandlerCtx` is Meno's sthis pattern applied to CLI. All external dependencies are functions on the context object:

```typescript
interface CliHandlerCtx {
  // Data sources
  readonly getLlmCatalog: () => Promise<Skill[]>
  readonly getDefaultDependencies: () => Promise<string[]>
  readonly findVibesJson: (startDir: string) => Promise<Result<VibesConfig>>
  readonly makeBaseSystemPrompt: (mode: string, opts: PromptOpts) => Promise<Result<SystemPrompt>>

  // Future: API client
  readonly api?: VibesDiyApiIface
}
```

In production, these are wired to the real implementations. In tests, they're mocks. In Cloudflare Workers, they might be different implementations entirely. The handler doesn't care.
