# CLI Architecture: Meno's Criteria

Meno's wish: no cmd-ts, build-free (`npx tsx` or `npx deno run`), no `fs.*Sync`.

## Fireproof CLI Audit

Every CLI in `/fp/fireproof/cli/` uses cmd-ts. None match all three criteria. But the patterns are instructive.

### What fireproof does right

- **Build-free execution**: `run.js` bootstraps via `tsx main.ts` — no compile step needed
- **Async file I/O**: 10 of 13 commands use zero `fs.*Sync` calls
- **Shell via zx**: `$` syntax for subprocesses instead of manual spawn
- **Streaming**: `quick-silver/api/cli.ts` streams large results with `processStream()`

### What violates Meno's criteria

| Violation | Files |
|---|---|
| cmd-ts everywhere | All 13 commands in `cli/main.ts` |
| `fs.existsSync()` | `run.js` (bootstrapper) |
| `fs.readJSONSync()` | `build-cmd.ts` |
| `fs.writeJSONSync()` | `build-cmd.ts`, `set-scripts-cmd.ts` |

### fs.*Sync-free commands (good examples)

These commands are fully async — no sync file operations:

| Command | What it does | Pattern |
|---|---|---|
| `tsc-cmd.ts` | TypeScript compiler wrapper | zx shell, arg passthrough |
| `retry-cmd.ts` | Retry with timeout | zx shell, `@adviser/cement` Future |
| `well-known-cmd.ts` | JWKS endpoint fetcher | Pure fetch + jose, no file I/O |
| `cloud-token-key-cmd.ts` | Crypto key generation | Pure crypto, stdout only |
| `write-env-cmd.ts` | Env file generation | `fs/promises` only |
| `device-id-cmd.ts` | Device ID + certs | `fs/promises`, Hono server for callback |
| `update-deps-cmd.ts` | Dependency updater | `fs/promises` + zx glob |
| `pre-signed-url.ts` | S3 signed URLs | Pure computation, stdout |
| `dependabot-cmd.ts` | Dependabot PR automation | `gh` CLI, no file I/O |
| `test-container-cmd.ts` | Docker container management | Async `fs.writeFile()` |

---

## Proposed Architecture for `use-vibes` CLI

Meeting all three criteria: no cmd-ts, build-free, no `fs.*Sync`.

### Arg parsing: `process.argv` + a tiny router

cmd-ts is overkill for `use-vibes`. We have ~10 commands with simple args. A minimal router:

```ts
const [cmd, ...args] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => Promise<void>> = {
  login,
  whoami,
  dev,
  live,
  publish,
  edit,
  slices,
  system,
  invite,
  help,
};

const handler = commands[cmd] ?? help;
await handler(args);
```

No parsing library. Each command destructures its own args. `--slices fireproof,d3` is just `args.find(a => a.startsWith('--slices='))?.split('=')[1]` or a 10-line `parseFlags()` helper.

If we outgrow this, [citty](https://github.com/unjs/citty) is a modern alternative — tree-shakeable, async-first, no decorators.

### Invocation: `npx tsx`

The `use-vibes` bin entry points to a `.ts` file run via tsx:

```json
{
  "bin": {
    "use-vibes": "./cli.ts"
  }
}
```

With a shebang:
```ts
#!/usr/bin/env npx tsx
```

Or for Deno compatibility:
```ts
#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net
```

tsx is already in the monorepo. Zero build step — edit the `.ts` file, run it.

### File I/O: `fs/promises` only

```ts
import { readFile, writeFile, access } from "node:fs/promises";

// Instead of fs.existsSync():
async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

// Instead of fs.readJSONSync():
async function readJSON<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8"));
}
```

vibes.json reads, config loading, file watching — all async.

### File watching: native + debounce

```ts
import { watch } from "node:fs/promises";

async function watchFiles(dir: string, onChange: () => Promise<void>) {
  const watcher = watch(dir, { recursive: true });
  let timeout: Timer | undefined;
  for await (const event of watcher) {
    clearTimeout(timeout);
    timeout = setTimeout(() => onChange(), 100);
  }
}
```

No chokidar dependency. Node 20+ `fs/promises.watch` returns an async iterator.

### Command structure

```
use-vibes/pkg/
├── cli.ts              # shebang entry, argv router
├── commands/
│   ├── login.ts        # device-code auth
│   ├── whoami.ts       # print current user
│   ├── dev.ts          # live dev — extension point (calls into live)
│   ├── live.ts         # file watch → push
│   ├── publish.ts      # one-time push
│   ├── edit.ts         # AI-edit via call-ai
│   ├── slices.ts       # list RAG slice catalog
│   ├── system.ts       # emit assembled system prompt
│   ├── invite.ts       # generate join link
│   └── help.ts         # help text
├── lib/
│   ├── config.ts       # vibes.json + target resolution
│   ├── api-client.ts   # ensureAppSlug + other API calls
│   └── auth.ts         # credential storage
└── index.ts            # library exports (existing)
```

### Key patterns from fireproof to adopt

1. **zx for shell commands** — already in the monorepo, cleaner than `child_process`
2. **Streaming output** — `edit` command should stream diffs like quick-silver streams results
3. **`fs/promises` everywhere** — 10 of 13 fireproof commands prove this works fine
4. **Stdout as API** — `system` and `slices` commands write to stdout for piping, like `well-known-cmd.ts`

### What we skip

- **cmd-ts** — too heavy for simple subcommand routing
- **fs.*Sync** — async everywhere, including config loading
- **Build step** — tsx runs TypeScript directly
- **chokidar** — native `fs/promises.watch` with recursive support (Node 20+)
