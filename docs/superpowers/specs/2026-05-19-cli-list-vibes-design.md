# Design: `vibes list` CLI command

**Date:** 2026-05-19  
**Issue:** [#1830](https://github.com/VibesDIY/vibes.diy/issues/1830)

## Goal

Add a `vibes list` top-level CLI command that fetches all of the authenticated user's vibes via the same `listRecentVibes` API the sidebar uses, and prints them to stdout.

## Architecture

The command follows the existing evento pattern used by every other CLI command:

```
cmd-ts command → enqueue → WrapCmdTSMsg → evento handler → sendMsg → output handler in main.ts
```

### New file: `vibes-diy/cli/cmds/list-cmd.ts`

**Request type:**

```ts
ReqVibesList = { type: "vibes-diy.cli.list", apiUrl: string };
```

No extra args needed; `--json`/`--text` and `--api-url` come from `cmdTsDefaultArgs` and are carried in `WrapCmdTSMsg.cmdTs`.

**Response type:**

```ts
ResVibesList = { type: 'vibes-diy.cli.res-list', items: ResRecentVibesItem[] }
```

All items after full pagination. Callers never see cursor details.

**Handler (`listEvento`):**

1. Error if `vibesDiyApiFactory` is absent (not logged in).
2. Loop: call `api.listRecentVibes({ limit: 100, cursor? })` until `nextCursor` is absent.
3. Accumulate all `items`.
4. `sendMsg` with `ResVibesList`.

**Command (`listCmd`):** Standard `command({...})` using `cmdTsDefaultArgs`.

### Wiring

- **`cmd-evento.ts`:** import and push `listEvento` into the evento registry.
- **`main.ts`:**
  - Import `listCmd`, `isResVibesList`, `ResVibesList`.
  - Add `list: listCmd(ctx)` to the `cmds` map.
  - Add `case isResVibesList(msg):` output handler:
    - `wmsg.cmdTs.outputFormat === "json"` → NDJSON (one `JSON.stringify(item)` per line)
    - otherwise → `userHandle/appSlug  title` per line (title omitted if absent)

## Output formats

**Text (default):**

```
jchris/todo-app    My Todo App
jchris/weather     (no title)
```

**JSON (`--json`):**

```json
{"userHandle":"jchris","appSlug":"todo-app","updated":"...","title":"My Todo App"}
{"userHandle":"jchris","appSlug":"weather","updated":"..."}
```

## Testing

`vibes-diy/cli/cmds/list-cmd.test.ts` — unit tests following `generate-cmd.test.ts` pattern:

- Verify `listCmd` enqueues a request that passes `isReqVibesList`.
- Verify `apiUrl` defaults correctly.

## Files changed

| File                                  | Change                              |
| ------------------------------------- | ----------------------------------- |
| `vibes-diy/cli/cmds/list-cmd.ts`      | New                                 |
| `vibes-diy/cli/cmds/list-cmd.test.ts` | New                                 |
| `vibes-diy/cli/cmd-evento.ts`         | Add `listEvento`                    |
| `vibes-diy/cli/main.ts`               | Add `list` command + output handler |
