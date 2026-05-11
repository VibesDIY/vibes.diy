# `vibes-diy db` CLI subcommands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `vibes-diy db` subcommand group to read/write Fireproof docs from the terminal. Builds on the [`FireflyApiAdapter`](../../../vibes.diy/api/impl/firefly-api-adapter.ts) landed in #1438 (PR #1664).

**Architecture:** Each subcommand is a thin wrapper that constructs a `VibesDiyApi` via the existing CLI `vibesDiyApiFactory` (device-id token), wraps it in `FireflyApiAdapter`, and either calls the adapter directly (list/get/put/del/subscribe) or composes a `FireflyDatabase` for query-filter parity (key/range/prefix).

**Tech Stack:** cmd-ts (CLI parsing), evento (request/response), `@vibes.diy/api-impl`, `@vibes.diy/vibe-runtime`, `@adviser/cement` (Result/Lazy).

**Issue:** [#1666](https://github.com/VibesDIY/vibes.diy/issues/1666)

---

## Surface

```bash
vibes-diy db list                          # listDbNames
vibes-diy db get <docId> [--db NAME]       # get one doc
vibes-diy db put '<json>' [--db NAME]      # put doc; JSON on argv or '-' for stdin
vibes-diy db del <docId> [--db NAME]       # delete by id
vibes-diy db query <field> [opts]          # field-name map fn with --key/--prefix/--range/--limit
vibes-diy db subscribe [--db NAME]         # tail evt-doc-changed events
```

Common flags (existing `cmdTsDefaultArgs`):

- `--api-url <url>` / env `VIBES_API_URL`
- `--json` / `--text` (default text)

New flags per subcommand:

- `--app-slug <slug>` — defaults to `basename(cwd)` or env `VIBES_APP_SLUG`
- `--user-slug <slug>` — defaults to lookup via `ensureUserSettings().defaultUserSlug`
- `--db <name>` — defaults to `"default"`

## File structure

```
vibes-diy/cli/cmds/db/
  index.ts        # exports dbSubcommands(ctx) — wires the nested subcommands
  shared.ts       # common: resolveAppSlug, resolveUserSlug, common args
  list-cmd.ts     # vibes-diy db list
  get-cmd.ts      # vibes-diy db get <docId>
  put-cmd.ts      # vibes-diy db put '<json>'
  del-cmd.ts      # vibes-diy db del <docId>
  query-cmd.ts    # vibes-diy db query <field>
  subscribe-cmd.ts # vibes-diy db subscribe
```

Each `*-cmd.ts` exports:

- `req<Name>` arktype schema
- `is<ReqName>` type guard
- `<name>Evento` EventoHandler
- `<name>Cmd(ctx)` cmd-ts command

Wiring:

- `vibes-diy/cli/main.ts` — add `db: dbSubcommands(ctx)` to the subcommands map; add result-type rendering cases in the output switch.
- `vibes-diy/cli/cmd-evento.ts` — add the new eventos to the `evento.push([...])` list.

---

## Pre-flight

- [ ] **Step 1: Confirm clean tree on the new branch**

Run: `git status && git branch --show-current`
Expected: branch `jchris/1666-cli-db-commands`, clean.

- [ ] **Step 2: Baseline `pnpm fast-check`**

Run: `pnpm fast-check 2>&1 | tail -5`
Expected: green.

---

## Task 1: Shared helpers + `db list`

**Why:** Establishes the CLI patterns for the rest of the subcommands; `list` is the simplest because `VibesDiyApi.listDbNames` already exists and there's no doc-shape translation.

**Files:**

- Create: `vibes-diy/cli/cmds/db/shared.ts`
- Create: `vibes-diy/cli/cmds/db/list-cmd.ts`
- Create: `vibes-diy/cli/cmds/db/index.ts`
- Modify: `vibes-diy/cli/main.ts` (add `db` subcommand + render case)
- Modify: `vibes-diy/cli/cmd-evento.ts` (push `dbListEvento`)

### Step 1: `db/shared.ts`

```ts
import { option, string } from "cmd-ts";
import { basename } from "node:path";
import type { CliCtx } from "../../cli-ctx.js";
import type { VibesDiyApi } from "@vibes.diy/api-impl";
import { Result } from "@adviser/cement";
import { isUserSettingDefaultUserSlug } from "@vibes.diy/api-types";

export function dbCommonArgs(ctx: CliCtx) {
  return {
    appSlug: option({
      long: "app-slug",
      description: "App slug; defaults to env VIBES_APP_SLUG or basename(cwd)",
      type: string,
      defaultValue: () => ctx.sthis.env.get("VIBES_APP_SLUG") ?? basename(process.cwd()),
      defaultValueIsSerializable: true,
    }),
    userSlug: option({
      long: "user-slug",
      description: "User slug; defaults to defaultUserSlug from user settings",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    dbName: option({
      long: "db",
      description: "Database name",
      type: string,
      defaultValue: () => "default",
      defaultValueIsSerializable: true,
    }),
  };
}

// Resolve userSlug: explicit override -> defaultUserSlug from user settings.
export async function resolveUserSlug(api: VibesDiyApi, explicit: string): Promise<Result<string>> {
  if (explicit !== "") return Result.Ok(explicit);
  const r = await api.ensureUserSettings({ settings: [] });
  if (r.isErr()) return Result.Err(r.Err());
  const def = r.Ok().settings.find(isUserSettingDefaultUserSlug);
  if (def === undefined) {
    return Result.Err("No defaultUserSlug — pass --user-slug or run 'vibes-diy login' first");
  }
  return Result.Ok(def.userSlug);
}
```

### Step 2: `db/list-cmd.ts`

```ts
import { command } from "cmd-ts";
import { type } from "arktype";
import { Result, EventoResult } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler, Option } from "@adviser/cement";
import { CliCtx, cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbList = type({
  type: "'vibes-diy.cli.db.list'",
  apiUrl: "string",
  appSlug: "string",
  userSlug: "string",
});
export type ReqDbList = typeof ReqDbList.infer;
export function isReqDbList(obj: unknown): obj is ReqDbList {
  return !(ReqDbList(obj) instanceof type.errors);
}

export const ResDbList = type({
  type: "'vibes-diy.cli.db.list-res'",
  dbNames: type("string").array(),
});
export type ResDbList = typeof ResDbList.infer;
export function isResDbList(obj: unknown): obj is ResDbList {
  return !(ResDbList(obj) instanceof type.errors);
}

export const dbListEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbList, ResDbList> = {
  hash: "vibes-diy.cli.db.list",
  validate: (ctx) => {
    if (isReqDbList(ctx.enRequest)) {
      return Promise.resolve(Result.Ok({ isSome: () => true, value: ctx.enRequest } as never)); /* Option.Some */
    }
    return Promise.resolve(Result.Ok({ isSome: () => false } as never)); /* Option.None */
  },
  handle: async (ctx) => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.userSlug);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const r = await api.listDbNames({ appSlug: ctx.validated.appSlug, userSlug: rUser.Ok() });
    if (r.isErr()) return Result.Err(r.Err());
    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.list-res",
      dbNames: r.Ok().dbNames,
    } satisfies ResDbList);
  },
};

export function dbListCmd(ctx: CliCtx) {
  return command({
    name: "list",
    description: "List database names for an app",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => ({
      type: "vibes-diy.cli.db.list",
      apiUrl: args.apiUrl,
      appSlug: args.appSlug,
      userSlug: args.userSlug,
    })),
  });
}
```

(Note: the `Option.Some`/`None` cast is a placeholder — copy the exact pattern from `user-settings-cmd.ts:22-25` which uses `Option` from `@adviser/cement` properly. The implementer should mirror that file exactly.)

### Step 3: `db/index.ts`

```ts
import { subcommands } from "cmd-ts";
import type { CliCtx } from "../../cli-ctx.js";
import { dbListCmd } from "./list-cmd.js";

export { dbListEvento, isResDbList, type ResDbList } from "./list-cmd.js";

export function dbSubcommands(ctx: CliCtx) {
  return subcommands({
    name: "db",
    description: "Read and write Fireproof documents",
    cmds: {
      list: dbListCmd(ctx),
    },
  });
}
```

### Step 4: Wire into `main.ts`

In the `subcommands({ ... cmds: { ... } })` block of `main.ts`, add:

```ts
db: dbSubcommands(ctx),
```

(Import: `import { dbSubcommands, isResDbList } from "./cmds/db/index.js";`)

In the output switch (the long `switch (true)` after `cmd-evento.ts trigger`), add a case:

```ts
case isResDbList(msg): {
  const names = (msg as ResDbList).dbNames;
  console.log(names.join("\n"));
  break;
}
```

(Or JSON output if `--json` was set. Check how other commands handle the json flag — `user-settings-cmd` doesn't appear to, so just text for now and add JSON later if needed.)

### Step 5: Wire into `cmd-evento.ts`

Add `dbListEvento` to the `evento.push([...])` list at the bottom.

### Step 6: Verify

Run from repo root:

```bash
pnpm fast-check 2>&1 | tail -5
```

Smoke test (requires `vibes-diy login` to have been run):

```bash
cd vibes-diy && node cli/run.js db list --app-slug=my-test-app
```

Should print db names one per line.

### Step 7: Format and commit

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write vibes-diy/cli/cmds/db/ vibes-diy/cli/main.ts vibes-diy/cli/cmd-evento.ts
git add vibes-diy/cli/cmds/db/ vibes-diy/cli/main.ts vibes-diy/cli/cmd-evento.ts
git commit -m "feat(cli): vibes-diy db list — list db names for an app"
```

---

## Task 2: `db get <docId>`

**Why:** Quickest read path. Uses `FireflyApiAdapter.getDoc(docId, dbName)`.

**Files:**

- Create: `vibes-diy/cli/cmds/db/get-cmd.ts`
- Modify: `vibes-diy/cli/cmds/db/index.ts` (export + add to subcommands)
- Modify: `vibes-diy/cli/main.ts` (render case)
- Modify: `vibes-diy/cli/cmd-evento.ts` (push evento)

### Step 1: `db/get-cmd.ts`

```ts
import { command, positional, string } from "cmd-ts";
import { type } from "arktype";
import { Result, Option, EventoResult } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { CliCtx, cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbGet = type({
  type: "'vibes-diy.cli.db.get'",
  apiUrl: "string",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  docId: "string",
});
export type ReqDbGet = typeof ReqDbGet.infer;
export function isReqDbGet(obj: unknown): obj is ReqDbGet {
  return !(ReqDbGet(obj) instanceof type.errors);
}

export const ResDbGet = type({
  type: "'vibes-diy.cli.db.get-res'",
  doc: type({ "[string]": "unknown" }),
});
export type ResDbGet = typeof ResDbGet.infer;
export function isResDbGet(obj: unknown): obj is ResDbGet {
  return !(ResDbGet(obj) instanceof type.errors);
}

export const dbGetEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbGet, ResDbGet> = {
  hash: "vibes-diy.cli.db.get",
  validate: (ctx) => {
    if (isReqDbGet(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx) => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.userSlug);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { userSlug: rUser.Ok() });
    const r = await adapter.getDoc(ctx.validated.docId, ctx.validated.dbName);
    if (r.isErr()) return Result.Err(r.Err());
    const res = r.Ok();
    if (res.type === "vibes.diy.res-get-doc-not-found") {
      return Result.Err(`Document not found: ${ctx.validated.docId}`);
    }
    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.get-res",
      doc: { ...res.doc, _id: res.id },
    } satisfies ResDbGet);
  },
};

export function dbGetCmd(ctx: CliCtx) {
  return command({
    name: "get",
    description: "Get a document by ID",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
      docId: positional({
        type: string,
        displayName: "docId",
        description: "Document ID to fetch",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => ({
      type: "vibes-diy.cli.db.get",
      apiUrl: args.apiUrl,
      appSlug: args.appSlug,
      userSlug: args.userSlug,
      dbName: args.dbName,
      docId: args.docId,
    })),
  });
}
```

### Step 2-5

Add `dbGetCmd` to `dbSubcommands` and `dbGetEvento` to `cmd-evento.ts`. Add render case to `main.ts`:

```ts
case isResDbGet(msg): {
  console.log(JSON.stringify((msg as ResDbGet).doc, null, 2));
  break;
}
```

### Step 6: Commit

```bash
git commit -m "feat(cli): vibes-diy db get — fetch document by ID"
```

---

## Task 3-5: `db put`, `db del`, `db query`

These follow the same exact pattern. Each adds:

- `<name>-cmd.ts` with req/res types, type guards, evento, command.
- Subcommand entry in `db/index.ts`.
- Evento registration in `cmd-evento.ts`.
- Render case in `main.ts`.

**Specific notes:**

### `db put`

Accept JSON on argv or `-` for stdin:

```ts
const json = args.docJson === "-" ? readStdinSync() : args.docJson;
const doc = JSON.parse(json); // bare JSON.parse; the request schema validates downstream
```

`readStdinSync` reads `process.stdin` synchronously (use `fs.readFileSync(0, "utf8")`).

Optional `--id <docId>` flag to set the `_id`.

Response carries `{id: string, ok: true}`.

### `db del`

Single positional `<docId>`. Response carries `{id: string, ok: true}`.

### `db query`

This is the most complex. Compose a real `FireflyDatabase` to get filter parity with the JS API.

```ts
import { FireflyDatabase } from "@vibes.diy/vibe-runtime";
// ...
const adapter = new FireflyApiAdapter(api, appSlug, { userSlug });
const db = new FireflyDatabase(dbName, adapter);
const opts: Record<string, unknown> = {};
if (args.key !== "") opts.key = JSON.parse(args.key);
if (args.prefix !== "") opts.prefix = JSON.parse(args.prefix);
if (args.range !== "") opts.range = JSON.parse(args.range);
if (args.limit !== 0) opts.limit = args.limit;
const result = await db.query(args.field, opts);
```

Flags: `--key <json>`, `--prefix <json>`, `--range <json>` (e.g. `--range '[3,5]'`), `--limit <n>`, `--descending`.

Response carries `{rows: [{key, value}], docs: [...]}`.

Render: print `docs` as JSON array.

---

## Task 6: `db subscribe`

**Why:** Streams events as they arrive. Uses `FireflyApiAdapter.onMsg` (or `VibesDiyApi.onDocChanged` directly).

**Streaming pattern:** The existing `generate-cmd` already streams output through the cli stream. Mirror that pattern. Each `evt-doc-changed` event becomes one line of JSON output.

### Sketch

```ts
const adapter = new FireflyApiAdapter(api, appSlug, { userSlug });
// Trigger the server-side subscription
await adapter.subscribeDocs(dbName);
// Set up the listener
adapter.onMsg((event) => {
  // synthesized {data: {type: "vibes.diy.evt-doc-changed", ...}} per our adapter
  sendProgress(ctx, "info", JSON.stringify(event.data));
});
// Block forever (or until SIGINT)
await new Promise(() => {});
```

Render: `sendProgress` outputs land via existing console.log path in `main.ts`.

Commit:

```bash
git commit -m "feat(cli): vibes-diy db subscribe — tail real-time doc changes"
```

---

## Task 7: Open PR

- [ ] **Step 1: `pnpm check`**

```bash
pnpm fast-check 2>&1 | tail -5
```

Expected: green. (Full `pnpm check` may fail on pre-existing vitest-orchestration issue unrelated to this PR — that's the known issue from #1664.)

- [ ] **Step 2: Push and open**

```bash
git push -u origin jchris/1666-cli-db-commands
gh pr create --title "feat(cli): vibes-diy db subcommands (#1666)" --body "...closes #1666..."
```

---

## Self-review

- **Spec coverage:** All 6 subcommands implemented? ✓
- **Pattern consistency:** Every command follows the same req/res/evento/command shape from `user-settings-cmd.ts` and friends.
- **Auth:** Each command resolves `userSlug` via the shared helper; never assumes the token's user is the routing user.
- **No new deps:** All needed packages already in `vibes-diy/package.json` (`@vibes.diy/api-impl` and `@vibes.diy/vibe-runtime` are workspace packages; verify the runtime dep exists or add it).

## Out of scope

- File upload (`db put` with `_files`) — blocked on the same v2 work as `FireflyApiAdapter.putAsset`.
- Output streaming for `db query --tail` — separate from `db subscribe`.
- JSON-vs-text differentiation per the `--json`/`--text` flags — the existing CLI doesn't honor them for most commands; we'll match the existing default (text) and add `--json` polish later if needed.
