# CLI `--vibe` Flag & Positional Parsing — Issue #2256

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every CLI command that takes an app identifier supports three ways to specify it: `--vibe jchris/hat-smeller` (new, handle/app-slug combined), `--handle jchris --app-slug hat-smeller` (existing, separate), or as a positional `jchris/hat-smeller` on commands that already accept a positional app arg. `vibes-diy pull jchris/hat-smeller` works instead of doubling the handle.

**Architecture:** Add a shared `parseVibe(raw: string)` utility that splits `handle/app-slug` on the first `/`. Add a shared `resolveVibeArgs()` that merges `--vibe`, `--handle`, `--app-slug`, and deprecated `--user-slug` with clear precedence. Wire into all 12 commands. The db commands also get a `--handle` alias (matching the rest of the CLI) with `--user-slug` deprecated.

**Tech Stack:** TypeScript, cmd-ts, vitest

**Precedence:** `--vibe` > `--handle`/`--app-slug` > handle parsed from positional > resolved from user settings. Error if `--vibe` and `--handle` are both explicitly passed (conflicting intent).

---

### Task 1: Add `parseVibe` utility and `resolveVibeArgs` helper

**Files:**
- Create: `vibes-diy/cli/parse-vibe.ts`
- Create: `vibes-diy/cli/parse-vibe.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// vibes-diy/cli/parse-vibe.test.ts
import { describe, expect, it } from "vitest";
import { parseVibe, resolveVibeArgs } from "./parse-vibe.js";

describe("parseVibe", () => {
  it("splits handle/app-slug into both parts", () => {
    expect(parseVibe("jchris/hat-smeller")).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller",
    });
  });

  it("returns bare app-slug with no handle when there is no slash", () => {
    expect(parseVibe("hat-smeller")).toEqual({
      handle: undefined,
      appSlug: "hat-smeller",
    });
  });

  it("handles empty string as bare app-slug", () => {
    expect(parseVibe("")).toEqual({
      handle: undefined,
      appSlug: "",
    });
  });

  it("only splits on the first slash", () => {
    expect(parseVibe("jchris/hat-smeller/extra")).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller/extra",
    });
  });
});

describe("resolveVibeArgs", () => {
  it("--vibe wins: extracts both handle and appSlug", () => {
    expect(resolveVibeArgs({ vibe: "jchris/hat-smeller", handle: "", appSlug: "", positionalAppSlug: "" }))
      .toEqual({ handle: "jchris", appSlug: "hat-smeller" });
  });

  it("--vibe bare slug: sets appSlug only", () => {
    expect(resolveVibeArgs({ vibe: "hat-smeller", handle: "", appSlug: "", positionalAppSlug: "" }))
      .toEqual({ handle: "", appSlug: "hat-smeller" });
  });

  it("--handle + --app-slug: uses both directly", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "jchris", appSlug: "hat-smeller", positionalAppSlug: "" }))
      .toEqual({ handle: "jchris", appSlug: "hat-smeller" });
  });

  it("positional handle/app-slug: splits when no explicit flags", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "", positionalAppSlug: "jchris/hat-smeller" }))
      .toEqual({ handle: "jchris", appSlug: "hat-smeller" });
  });

  it("positional bare app-slug: handle stays empty", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "", positionalAppSlug: "hat-smeller" }))
      .toEqual({ handle: "", appSlug: "hat-smeller" });
  });

  it("explicit --handle overrides handle parsed from positional", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "other-user", appSlug: "", positionalAppSlug: "jchris/hat-smeller" }))
      .toEqual({ handle: "other-user", appSlug: "hat-smeller" });
  });

  it("--app-slug overrides appSlug parsed from positional", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "override-slug", positionalAppSlug: "jchris/hat-smeller" }))
      .toEqual({ handle: "jchris", appSlug: "override-slug" });
  });

  it("--vibe overrides positional entirely", () => {
    expect(resolveVibeArgs({ vibe: "alice/cool-app", handle: "", appSlug: "", positionalAppSlug: "jchris/hat-smeller" }))
      .toEqual({ handle: "alice", appSlug: "cool-app" });
  });

  it("all empty: returns empty strings", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "", positionalAppSlug: "" }))
      .toEqual({ handle: "", appSlug: "" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/parse-vibe.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// vibes-diy/cli/parse-vibe.ts
export function parseVibe(raw: string): { handle: string | undefined; appSlug: string } {
  const slashIdx = raw.indexOf("/");
  if (slashIdx === -1) return { handle: undefined, appSlug: raw };
  return { handle: raw.slice(0, slashIdx), appSlug: raw.slice(slashIdx + 1) };
}

export function resolveVibeArgs(args: {
  vibe: string;
  handle: string;
  appSlug: string;
  positionalAppSlug: string;
}): { handle: string; appSlug: string } {
  // --vibe wins over everything
  if (args.vibe) {
    const parsed = parseVibe(args.vibe);
    return { handle: parsed.handle ?? "", appSlug: parsed.appSlug };
  }

  // Parse positional (may contain handle/app-slug)
  const positional = args.positionalAppSlug ? parseVibe(args.positionalAppSlug) : undefined;

  // Explicit flags override parts parsed from positional
  const handle = args.handle || positional?.handle || "";
  const appSlug = args.appSlug || positional?.appSlug || "";

  return { handle, appSlug };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/parse-vibe.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add vibes-diy/cli/parse-vibe.ts vibes-diy/cli/parse-vibe.test.ts
git commit -m "feat(cli): add parseVibe and resolveVibeArgs utilities"
```

---

### Task 2: Wire `--vibe` and positional parsing into `pull` command

**Files:**
- Modify: `vibes-diy/cli/cmds/pull-cmd.ts:145-189`
- Modify: `vibes-diy/cli/cmds/pull-cmd.test.ts`

- [ ] **Step 1: Write failing tests for vibe parsing in pull**

Add these tests to the existing `pull-cmd.test.ts`. Import `ReqPull`, `isReqPull`, `pullCmd` from `./pull-cmd.js` (already imported). No need to import `parseVibe` — it's internal to the handler.

```typescript
it("splits handle/app-slug positional into separate fields", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(pullCmd(ctx), ["jchris/hat-smeller"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  const request = (first.value as { result: ReqPull }).result;
  expect(isReqPull(request)).toBe(true);
  expect(request.appSlug).toBe("hat-smeller");
  expect(request.ownerHandle).toBe("jchris");
});

it("bare app-slug still works (handle resolved later)", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(pullCmd(ctx), ["hat-smeller"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  const request = (first.value as { result: ReqPull }).result;
  expect(isReqPull(request)).toBe(true);
  expect(request.appSlug).toBe("hat-smeller");
  expect(request.ownerHandle).toBe("");
});

it("--vibe overrides positional", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(pullCmd(ctx), ["ignored-slug", "--vibe", "alice/cool-app"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  const request = (first.value as { result: ReqPull }).result;
  expect(request.appSlug).toBe("cool-app");
  expect(request.ownerHandle).toBe("alice");
});

it("explicit --handle overrides handle parsed from positional", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(pullCmd(ctx), ["jchris/hat-smeller", "--handle", "other-user"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  const request = (first.value as { result: ReqPull }).result;
  expect(request.appSlug).toBe("hat-smeller");
  expect(request.ownerHandle).toBe("other-user");
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/cmds/pull-cmd.test.ts`
Expected: new tests FAIL (ownerHandle is `""`, appSlug is `"jchris/hat-smeller"`)

- [ ] **Step 3: Update the pull command to add `--vibe` and use `resolveVibeArgs`**

In `vibes-diy/cli/cmds/pull-cmd.ts`, add the import:

```typescript
import { resolveVibeArgs } from "../parse-vibe.js";
```

Update the command definition (lines 145-189). Add `--vibe` option, update positional description, update handler:

```typescript
export function pullCmd(ctx: CliCtx) {
  return command({
    name: "pull",
    description: "Download source files of a deployed vibe to disk.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug (e.g. jchris/hat-smeller)",
        type: string,
      }),
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      handle: option({
        long: "handle",
        description: "Handle (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      userSlug: option({
        long: "user-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      dir: option({
        long: "dir",
        description: "Directory to write files into (defaults to ./<appSlug>/)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      if (args.userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibeArgs({
        vibe: args.vibe,
        handle: args.handle || args.userSlug,
        appSlug: "",
        positionalAppSlug: args.appSlug,
      });
      return {
        type: "vibes-diy.cli.pull",
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        dir: args.dir,
        apiUrl: args.apiUrl,
      } satisfies ReqPull;
    }),
  });
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/cmds/pull-cmd.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add vibes-diy/cli/cmds/pull-cmd.ts vibes-diy/cli/cmds/pull-cmd.test.ts
git commit -m "feat(cli): pull accepts --vibe and handle/app-slug positional — fixes #2256"
```

---

### Task 3: Wire `--vibe` and positional parsing into `edit` command

**Files:**
- Modify: `vibes-diy/cli/cmds/edit-cmd.ts:385-463`
- Modify: `vibes-diy/cli/cmds/edit-cmd.test.ts`

- [ ] **Step 1: Write failing tests for vibe parsing in edit**

Add to `edit-cmd.test.ts` (follow the existing test pattern — import `run` from `cmd-ts`, use `makeCtx()`, read from `cliStream`). Import `ReqEdit`, `isReqEdit`, `editCmd` (should already be imported):

```typescript
it("splits handle/app-slug positional into separate fields", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(editCmd(ctx), ["jchris/hat-smeller", "make it blue"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  const request = (first.value as { result: ReqEdit }).result;
  expect(isReqEdit(request)).toBe(true);
  expect(request.appSlug).toBe("hat-smeller");
  expect(request.ownerHandle).toBe("jchris");
});

it("bare app-slug still works for edit", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(editCmd(ctx), ["hat-smeller", "make it blue"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  const request = (first.value as { result: ReqEdit }).result;
  expect(isReqEdit(request)).toBe(true);
  expect(request.appSlug).toBe("hat-smeller");
  expect(request.ownerHandle).toBe("");
});

it("--vibe overrides positional for edit", async () => {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(editCmd(ctx), ["ignored", "make it blue", "--vibe", "alice/cool-app"]);

  const first = await firstRead;
  await ctx.cliStream.close();
  const request = (first.value as { result: ReqEdit }).result;
  expect(request.appSlug).toBe("cool-app");
  expect(request.ownerHandle).toBe("alice");
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/cmds/edit-cmd.test.ts`
Expected: "splits handle/app-slug" test FAILS

- [ ] **Step 3: Update the edit command**

In `vibes-diy/cli/cmds/edit-cmd.ts`, add import:

```typescript
import { resolveVibeArgs } from "../parse-vibe.js";
```

Add `--vibe` option to args (after the existing `appSlug` positional, around line 395):

```typescript
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
```

Update the positional description:

```typescript
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug",
        type: string,
      }),
```

Update the handler (line 450). The current handler destructures `{ focus, model, handle, userSlug, ...rest }`. Add `vibe` to the destructured set:

```typescript
    handler: ctx.cliStream.enqueue(({ focus, model, handle, userSlug, vibe, ...rest }) => {
      if (userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibeArgs({
        vibe,
        handle: handle || userSlug,
        appSlug: "",
        positionalAppSlug: rest.appSlug,
      });
      const base = { type: "vibes-diy.cli.edit" as const, ...rest, appSlug: resolved.appSlug, ownerHandle: resolved.handle };
      const withFocus = focus === undefined ? base : { ...base, focusPath: focus };
      return model === undefined ? withFocus : { ...withFocus, model };
    }),
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/cmds/edit-cmd.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add vibes-diy/cli/cmds/edit-cmd.ts vibes-diy/cli/cmds/edit-cmd.test.ts
git commit -m "feat(cli): edit accepts --vibe and handle/app-slug positional"
```

---

### Task 4: Wire `--vibe` and positional parsing into `chats` command

**Files:**
- Modify: `vibes-diy/cli/cmds/chats-cmd.ts:114-143`

- [ ] **Step 1: Update the chats command**

In `vibes-diy/cli/cmds/chats-cmd.ts`, add import:

```typescript
import { resolveVibeArgs } from "../parse-vibe.js";
```

Add `--vibe` option to args (after the existing `appSlug` positional):

```typescript
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
```

Update the positional description:

```typescript
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug",
        type: string,
      }),
```

Update the handler (line 138):

```typescript
    handler: ctx.cliStream.enqueue(({ handle, chatId, vibe, ...rest }) => {
      const resolved = resolveVibeArgs({
        vibe,
        handle,
        appSlug: "",
        positionalAppSlug: rest.appSlug,
      });
      const base = { type: "vibes-diy.cli.chats" as const, ...rest, appSlug: resolved.appSlug, ownerHandle: resolved.handle };
      return chatId === undefined ? base : { ...base, chatId };
    }),
```

- [ ] **Step 2: Verify no regressions**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/`
Expected: all CLI tests PASS

- [ ] **Step 3: Commit**

```bash
git add vibes-diy/cli/cmds/chats-cmd.ts
git commit -m "feat(cli): chats accepts --vibe and handle/app-slug positional"
```

---

### Task 5: Wire `--vibe` into `dbCommonArgs` (covers all 6 db subcommands)

**Files:**
- Modify: `vibes-diy/cli/cmds/db/shared.ts`
- Modify: `vibes-diy/cli/cmds/db/list-cmd.ts`
- Modify: `vibes-diy/cli/cmds/db/get-cmd.ts`
- Modify: `vibes-diy/cli/cmds/db/put-cmd.ts`
- Modify: `vibes-diy/cli/cmds/db/del-cmd.ts`
- Modify: `vibes-diy/cli/cmds/db/query-cmd.ts`
- Modify: `vibes-diy/cli/cmds/db/subscribe-cmd.ts`

- [ ] **Step 1: Update `dbCommonArgs` to add `--vibe` and `--handle`, deprecate `--user-slug`**

In `vibes-diy/cli/cmds/db/shared.ts`, add import:

```typescript
import { resolveVibeArgs } from "../../parse-vibe.js";
```

Replace the `dbCommonArgs` function:

```typescript
export function dbCommonArgs(ctx: CliCtx) {
  return {
    vibe: option({
      long: "vibe",
      description: "Vibe identifier as handle/app-slug",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    appSlug: option({
      long: "app-slug",
      description: "App slug; defaults to env VIBES_APP_SLUG or basename(cwd)",
      type: string,
      defaultValue: () => ctx.sthis.env.get("VIBES_APP_SLUG") ?? basename(process.cwd()),
      defaultValueIsSerializable: true,
    }),
    ownerHandle: option({
      long: "handle",
      description: "Handle; defaults to defaultHandle from user settings",
      type: string,
      defaultValue: () => "",
      defaultValueIsSerializable: true,
    }),
    ownerHandleDeprecated: option({
      long: "user-slug",
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
```

Add a helper that all 6 db command handlers call:

```typescript
export function resolveDbVibeArgs(args: {
  vibe: string;
  appSlug: string;
  ownerHandle: string;
  ownerHandleDeprecated: string;
}): { appSlug: string; ownerHandle: string } {
  if (args.ownerHandleDeprecated) {
    process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
  }
  const resolved = resolveVibeArgs({
    vibe: args.vibe,
    handle: args.ownerHandle || args.ownerHandleDeprecated,
    appSlug: args.appSlug,
    positionalAppSlug: "",
  });
  return { appSlug: resolved.appSlug, ownerHandle: resolved.handle };
}
```

Update the error message in `resolveUserSlug`:

```typescript
export async function resolveUserSlug(api: VibesDiyApi, explicit: string): Promise<Result<string>> {
  if (explicit !== "") return Result.Ok(explicit);
  const r = await api.ensureUserSettings({ settings: [] });
  if (r.isErr()) return Result.Err(r.Err());
  const def = r.Ok().settings.find(isUserSettingDefaultHandle);
  if (def === undefined) {
    return Result.Err("No defaultHandle — pass --handle, --vibe, or run 'vibes-diy login' first");
  }
  return Result.Ok(def.ownerHandle);
}
```

- [ ] **Step 2: Update all 6 db command handlers to use `resolveDbVibeArgs`**

Each handler currently passes `args.appSlug` and `args.ownerHandle` directly into the request object. Update each to call `resolveDbVibeArgs(args)` first.

**Important:** Read each file's handler first to get the exact field names. The pattern for each is the same:

```typescript
import { dbCommonArgs, resolveUserSlug, resolveDbVibeArgs } from "./shared.js";
```

Then in the handler, replace direct `args.appSlug` / `args.ownerHandle` with:

```typescript
const resolved = resolveDbVibeArgs(args);
// use resolved.appSlug and resolved.ownerHandle in the return object
```

**`db/list-cmd.ts`** handler (line 63):
```typescript
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveDbVibeArgs(args);
      return {
        type: "vibes-diy.cli.db.list",
        apiUrl: args.apiUrl,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.ownerHandle,
      };
    }),
```

**`db/get-cmd.ts`**, **`db/put-cmd.ts`**, **`db/del-cmd.ts`**, **`db/query-cmd.ts`**, **`db/subscribe-cmd.ts`**: same pattern. Read each handler, add `const resolved = resolveDbVibeArgs(args);`, replace `args.appSlug` with `resolved.appSlug` and `args.ownerHandle` with `resolved.ownerHandle`. Keep all other fields unchanged.

- [ ] **Step 3: Run the full CLI test suite**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add vibes-diy/cli/cmds/db/shared.ts vibes-diy/cli/cmds/db/list-cmd.ts vibes-diy/cli/cmds/db/get-cmd.ts vibes-diy/cli/cmds/db/put-cmd.ts vibes-diy/cli/cmds/db/del-cmd.ts vibes-diy/cli/cmds/db/query-cmd.ts vibes-diy/cli/cmds/db/subscribe-cmd.ts
git commit -m "feat(cli): db commands accept --vibe, add --handle alias, deprecate --user-slug"
```

---

### Task 6: Wire `--vibe` into `push`, `generate`, `put-asset`

These commands take `--app-slug` as a named option (no positional app arg). Add `--vibe` and wire through `resolveVibeArgs`.

**Files:**
- Modify: `vibes-diy/cli/cmds/push-cmd.ts:63-123`
- Modify: `vibes-diy/cli/cmds/generate-cmd.ts:250-313`
- Modify: `vibes-diy/cli/cmds/put-asset-cmd.ts:197-256`

- [ ] **Step 1: Update `push` command**

In `vibes-diy/cli/cmds/push-cmd.ts`, add import:

```typescript
import { resolveVibeArgs } from "../parse-vibe.js";
```

Add `--vibe` option to args (after `appSlug`):

```typescript
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
```

Update the handler (line 117-121):

```typescript
    handler: ctx.cliStream.enqueue((args) => {
      const { handle, userSlug, vibe, ...rest } = args;
      if (userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibeArgs({
        vibe,
        handle: handle || userSlug,
        appSlug: rest.appSlug,
        positionalAppSlug: "",
      });
      return { type: "vibes-diy.cli.push", ...rest, appSlug: resolved.appSlug, ownerHandle: resolved.handle };
    }),
```

- [ ] **Step 2: Update `generate` command**

In `vibes-diy/cli/cmds/generate-cmd.ts`, add import:

```typescript
import { resolveVibeArgs } from "../parse-vibe.js";
```

Add `--vibe` option to args (after `appSlug`):

```typescript
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
```

Update the handler (line 303-311):

```typescript
    handler: ctx.cliStream.enqueue(({ focus, model, handle, userSlug, vibe, ...rest }) => {
      if (userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibeArgs({
        vibe,
        handle: handle || userSlug,
        appSlug: rest.appSlug,
        positionalAppSlug: "",
      });
      const base = { type: "vibes-diy.cli.generate" as const, ...rest, appSlug: resolved.appSlug, ownerHandle: resolved.handle };
      const withFocus = focus === undefined ? base : { ...base, focusPath: focus };
      return model === undefined ? withFocus : { ...withFocus, model };
    }),
```

- [ ] **Step 3: Update `put-asset` command**

In `vibes-diy/cli/cmds/put-asset-cmd.ts`, add import:

```typescript
import { resolveVibeArgs } from "../parse-vibe.js";
```

Add `--vibe` option to args (after `appSlug`):

```typescript
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
```

Update the handler (line 242-254):

```typescript
    handler: ctx.cliStream.enqueue((args) => {
      if (args.userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibeArgs({
        vibe: args.vibe,
        handle: args.handle || args.userSlug,
        appSlug: args.appSlug,
        positionalAppSlug: "",
      });
      const mimeType = args.mimeType === "" ? inferMimeType(args.file) : args.mimeType;
      return {
        type: "vibes-diy.cli.put-asset",
        file: args.file,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        apiUrl: args.apiUrl,
        verifyFetch: args.verifyFetch,
        mimeType,
      } satisfies ReqPutAsset;
    }),
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm vitest run vibes-diy/cli/`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add vibes-diy/cli/cmds/push-cmd.ts vibes-diy/cli/cmds/generate-cmd.ts vibes-diy/cli/cmds/put-asset-cmd.ts
git commit -m "feat(cli): push, generate, put-asset accept --vibe flag"
```

---

### Task 7: Run `pnpm fast-check` and verify

- [ ] **Step 1: Run fast-check**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm fast-check 2>&1 | tee /tmp/fast-check.log`
Expected: PASS

- [ ] **Step 2: If any failures, fix them**

Read the log: `grep -i "fail\|error" /tmp/fast-check.log`

Fix any type errors, lint issues, or test failures introduced by the changes.

- [ ] **Step 3: Manual smoke test**

Run the actual CLI to verify the fix works end-to-end (requires login):

```bash
# Positional handle/app-slug
npx vibes-diy pull jchris/hat-smeller --api-url https://vibes.diy/api?.stable-entry.=cli

# --vibe flag
npx vibes-diy pull ignored --vibe jchris/hat-smeller --api-url https://vibes.diy/api?.stable-entry.=cli

# db with --vibe
npx vibes-diy db list --vibe jchris/hat-smeller --api-url https://vibes.diy/api?.stable-entry.=cli
```

Expected: all three work without "App not found: jchris/jchris/hat-smeller" doubling

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(cli): address lint/type issues from --vibe refactor"
```

---

## Flag Summary

After this work, every command supports three ways to identify a vibe:

| Flag | Meaning | Example |
|------|---------|---------|
| `--vibe` | Combined handle/app-slug | `--vibe jchris/hat-smeller` |
| `--handle` | Owner handle only | `--handle jchris` |
| `--app-slug` | App slug only | `--app-slug hat-smeller` |

For commands with a positional arg (`pull`, `edit`, `chats`), the positional also accepts `handle/app-slug`.

**Precedence:** `--vibe` > `--handle`/`--app-slug` > handle parsed from positional > resolved from user settings.

**Deprecated:** `--user-slug` still works everywhere but prints a deprecation warning. It was the only handle flag on db commands before this change; now `--handle` is canonical everywhere.
