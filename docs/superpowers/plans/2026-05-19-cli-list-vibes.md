# CLI `vibes list` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `vibes list` top-level CLI command that paginates through all of the authenticated user's vibes and prints them in text or NDJSON format.

**Architecture:** A new `list-cmd.ts` file defines `ReqVibesList` / `ResVibesList` types, a `listEvento` handler (paginates `api.listRecentVibes` until no `nextCursor`), and a `listCmd` cmd-ts command. The evento is registered in `cmd-evento.ts` and the command + output handler are wired into `main.ts`, following the identical pattern used by `skills-cmd.ts`, `themes-cmd.ts`, and `user-settings-cmd.ts`.

**Tech Stack:** TypeScript, arktype (runtime type validation), cmd-ts (CLI arg parsing), @adviser/cement (evento/result), @vibes.diy/api-types (`ResRecentVibesItem`), vitest.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `vibes-diy/cli/cmds/list-cmd.ts` | Create | Request/response types, evento handler, cmd-ts command |
| `vibes-diy/cli/cmds/list-cmd.test.ts` | Create | Unit tests for command wiring |
| `vibes-diy/cli/cmd-evento.ts` | Modify | Register `listEvento` in the evento registry |
| `vibes-diy/cli/main.ts` | Modify | Add `list` to cmds map; add `isResVibesList` output handler |

---

## Task 1: Write `list-cmd.ts` with tests

**Files:**
- Create: `vibes-diy/cli/cmds/list-cmd.ts`
- Create: `vibes-diy/cli/cmds/list-cmd.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `vibes-diy/cli/cmds/list-cmd.test.ts`:

```ts
import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqVibesList, listCmd, isReqVibesList } from "./list-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

describe("listCmd", () => {
  it("enqueues a request that passes isReqVibesList", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(listCmd(ctx), ["--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqVibesList }).result;
    expect(isReqVibesList(request)).toBe(true);
    expect(request.apiUrl).toBe("https://example.com/api");
  });

  it("defaults to the vibes.diy api url when --api-url is omitted", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(listCmd(ctx), []);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqVibesList }).result;
    expect(isReqVibesList(request)).toBe(true);
    expect(request.apiUrl).toContain("vibes.diy");
  });
});
```

- [ ] **Step 1.2: Run tests — expect them to fail (import not found)**

```bash
cd vibes-diy && pnpm vitest run cli/cmds/list-cmd.test.ts 2>&1 | tail -20
```

Expected: error like `Cannot find module './list-cmd.js'`

- [ ] **Step 1.3: Implement `list-cmd.ts`**

Create `vibes-diy/cli/cmds/list-cmd.ts`:

```ts
import { command } from "cmd-ts";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
} from "@adviser/cement";
import { type } from "arktype";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ReqVibesList = type({
  type: "'vibes-diy.cli.list'",
  apiUrl: "string",
});
export type ReqVibesList = typeof ReqVibesList.infer;

export function isReqVibesList(obj: unknown): obj is ReqVibesList {
  return !(ReqVibesList(obj) instanceof type.errors);
}

export const ResVibesList = type({
  type: "'vibes-diy.cli.res-list'",
  items: type({
    userSlug: "string",
    appSlug: "string",
    updated: "string",
    "title?": "string",
    "icon?": type({ cid: "string", mime: "string" }),
    "pinnedAt?": "string",
  }).array(),
});
export type ResVibesList = typeof ResVibesList.infer;

export function isResVibesList(obj: unknown): obj is ResVibesList {
  return !(ResVibesList(obj) instanceof type.errors);
}

export const listEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqVibesList, ResVibesList> = {
  hash: "vibes-diy.cli.list",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqVibesList, ResVibesList>) => {
    if (isReqVibesList(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqVibesList, ResVibesList>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (!ectx.vibesDiyApiFactory) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const items: ResRecentVibesItem[] = [];
    let cursor: string | undefined;
    do {
      const rPage = await api.listRecentVibes({ limit: 100, ...(cursor ? { cursor } : {}) });
      if (rPage.isErr()) {
        return Result.Err(rPage.Err());
      }
      const page = rPage.Ok();
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return sendMsg(ctx, { type: "vibes-diy.cli.res-list", items } satisfies ResVibesList);
  },
};

export function listCmd(ctx: CliCtx) {
  return command({
    name: "list",
    description: "List your vibes (userSlug/appSlug). Use --json for NDJSON output.",
    args: {
      ...cmdTsDefaultArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "vibes-diy.cli.list", ...args } satisfies ReqVibesList;
    }),
  });
}
```

- [ ] **Step 1.4: Run tests — expect them to pass**

```bash
cd vibes-diy && pnpm vitest run cli/cmds/list-cmd.test.ts 2>&1 | tail -20
```

Expected: `2 passed`

- [ ] **Step 1.5: Commit**

```bash
git add vibes-diy/cli/cmds/list-cmd.ts vibes-diy/cli/cmds/list-cmd.test.ts
git commit -m "feat(cli): add list-cmd types, evento handler, and cmd-ts command (#1830)"
```

---

## Task 2: Wire `listEvento` into the evento registry

**Files:**
- Modify: `vibes-diy/cli/cmd-evento.ts`

- [ ] **Step 2.1: Add import and registration**

In `vibes-diy/cli/cmd-evento.ts`, add the import at line 10 (after the `editEvento` import):

```ts
import { listEvento } from "./cmds/list-cmd.js";
```

Then add `listEvento` to the `evento.push([...])` array. The full updated array should be:

```ts
  evento.push([
    userSettingsEvento,
    skillsEvento,
    themesEvento,
    systemEvento,
    pushEvento,
    putAssetEvento,
    generateEvento,
    editEvento,
    listEvento,
    deviceIdRegisterEvento,
    dbListEvento,
    dbGetEvento,
    dbPutEvento,
    dbDelEvento,
    dbQueryEvento,
    dbSubscribeEvento,
  ]);
```

- [ ] **Step 2.2: Type-check**

```bash
cd vibes-diy && pnpm tsc --noEmit 2>&1 | grep -i "list-cmd\|cmd-evento" | head -20
```

Expected: no errors mentioning these files.

- [ ] **Step 2.3: Commit**

```bash
git add vibes-diy/cli/cmd-evento.ts
git commit -m "feat(cli): register listEvento in evento registry (#1830)"
```

---

## Task 3: Wire `listCmd` and output handler into `main.ts`

**Files:**
- Modify: `vibes-diy/cli/main.ts`

- [ ] **Step 3.1: Add import to `main.ts`**

In `vibes-diy/cli/main.ts`, add to the imports block (alongside the other cmd imports around line 32-34):

```ts
import { listCmd, isResVibesList, type ResVibesList } from "./cmds/list-cmd.js";
```

- [ ] **Step 3.2: Add `list` to the cmds map**

In the `cmds` object inside `runSafely(subcommands({...}))` (around line 129), add:

```ts
        list: listCmd(ctx),
```

The updated `cmds` object should be:

```ts
      cmds: {
        db: dbSubcommands(ctx),
        edit: editCmd(ctx),
        generate: generateCmd(ctx),
        list: listCmd(ctx),
        login: loginCmd(ctx),
        push: pushCmd(ctx),
        "put-asset": putAssetCmd(ctx),
        skills: skillsCmd(ctx),
        themes: themesCmd(ctx),
        system: systemCmd(ctx),
        "user-settings": userSettingsCmd(ctx),
      },
```

- [ ] **Step 3.3: Add output handler case**

In the `switch (true)` block inside `processStream(outputSelector.outputStream, ...)` (around line 193, after `isResEnsureUserSettings`), add a new case **before** the `default:` case:

```ts
          case isResVibesList(msg): {
            const { items } = msg as ResVibesList;
            if (wmsg.cmdTs.outputFormat === "json") {
              for (const item of items) {
                console.log(JSON.stringify(item));
              }
            } else {
              for (const item of items) {
                const label = item.title ? `  ${item.title}` : "";
                console.log(`${item.userSlug}/${item.appSlug}${label}`);
              }
            }
            break;
          }
```

- [ ] **Step 3.4: Type-check the full file**

```bash
cd vibes-diy && pnpm tsc --noEmit 2>&1 | grep "main.ts" | head -20
```

Expected: no errors.

- [ ] **Step 3.5: Run full check**

```bash
cd /Users/jchris/code/fp/vibes.diy && pnpm check 2>&1 | tee /tmp/vibes-list-check.txt | tail -30
```

Expected: all checks pass. If flaky test failures appear, check [agents/flaky-tests.md](../../vibes-diy/agents/flaky-tests.md) — rerun before treating as real.

- [ ] **Step 3.6: Commit**

```bash
git add vibes-diy/cli/main.ts
git commit -m "feat(cli): wire vibes list command and output handler into main.ts (#1830)"
```

---

## Task 4: Manual smoke test

> This task cannot be fully automated without a logged-in CLI session. Run manually if you have credentials set up.

- [ ] **Step 4.1: Build the CLI**

```bash
cd vibes-diy && pnpm build 2>&1 | tail -10
```

- [ ] **Step 4.2: Verify `vibes list` appears in help**

```bash
node vibes-diy/cli/run.js --help 2>&1 | grep list
```

Expected: `list` appears in the subcommands list.

- [ ] **Step 4.3: (If logged in) Run `vibes list`**

```bash
node vibes-diy/cli/run.js list
```

Expected: lines like `jchris/my-app  My App Title` or `jchris/my-app` (no title).

- [ ] **Step 4.4: (If logged in) Run `vibes list --json`**

```bash
node vibes-diy/cli/run.js list --json
```

Expected: NDJSON — one `{"userSlug":"...","appSlug":"...","updated":"..."}` object per line.
