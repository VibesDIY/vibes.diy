# CLI MVP Code Review — PR #1086

## Meno's Feedback

### `use-vibes/pkg/commands/help.ts:3` — inline text
> you know i hate inline texts

### `use-vibes/pkg/commands/help.ts:40` — injectable stdout
> inject stdout so that it could run also in the browser in future.

### `use-vibes/pkg/commands/skills.ts:10` — console.log
> or use console.log

### `use-vibes/pkg/commands/system.ts:10` — test style
> we test ! not ===

### `use-vibes/pkg/commands/system.ts:15` — if vs switch
> one thing use if

### `use-vibes/pkg/commands/system.ts:27` — switch(true)
> i use switch true in favour of Rust match

### `use-vibes/pkg/commands/system.ts:40` — let on arrays
> lets on arrays are in the most cases wrong — mutable ops like splice rather then slice ...

### `use-vibes/pkg/cli.js:18` — use zx
> zx

### `use-vibes/pkg/cli.js:20` — use cement pathops
> cements pathops

### `use-vibes/pkg/cli.js:22` — ESM not CommonJS
> we run esm so we use it — we do not simulate common js

### `use-vibes/pkg/cli.ts:15` — DRY isMessageError
> again — have it once

### `use-vibes/pkg/cli.ts:40` — use zx
> zx

### `use-vibes/pkg/cli.ts:48` — cmd-ts handles validation
> cmd-ts can do that all internally — look in the docu

### `use-vibes/tests/cli/cli.test.ts:7` — ESM not CommonJS
> again — and we run esm — not common js

### `use-vibes/tests/cli/cli.test.ts:31` — injectable stdout avoids forking
> if you have a injectable stdout you don't need to fork a new process in tests

### `use-vibes/tests/cli/cli.test.ts:1` — ESM
> esm !

### Meno's review summary
> Not a bad start — pls use cmd-ts and zx — and make stdout injectable for better testability.
> If some features are missing in cmd-ts — ask — it's made by a friend of mine.
> And use deno as primary runtime

---

## Automated Reviewer Comments (one-line references)

- **charliecreates** `notes/cli-design.md:131` — Target resolution only covers 0 and 2 slashes; 1-slash case is unspecified. Suggest explicit grammar + hard error for invalid forms.
- **charliecreates** `notes/cli-design.md:121` — `vibes.json` targets mix bare group keys and fully-qualified keys. Suggest normalizing to one format.
- **charliecreates** `notes/cli-design.md:301` — Domain inconsistency: `vibecode.garden` here vs multiple patterns in `code-mvp.md`. Pick one canonical domain.
- **charliecreates** `notes/cli-design.md:137` — Invite scope unspecified: group-level vs app-level, Fireproof tenant roles, join link encoding.
- **charliecreates** `notes/cli-intro.md:15` — Quick start assumes `cd coffee-order` matches generated slug. Could break with multi-word prompts.
- **charliecreates** `notes/code-mvp.md:179` — L3 says `mode: 'production'` but `live` mode is unspecified. API contract needs clarifying.
- **charliecreates** `cli.ts:181` — Code uses cmd-ts but docs say "no cmd-ts". Align one way or the other. (jchris replied: "we are moving to cmd-ts")
- **charliecreates** `cli.ts:2` — Shebang in cli.ts is dead code since cli.js is the real entry point. Remove or pick one strategy.
- **charliecreates** `cli.ts:102` — Two-pass validation (validateKnownCommand + validateSystemArgs) is redundant with cmd-ts parsing. Simplify to one layer.
- **charliecreates** `cli.test.ts:36` — Tests scan PNPM internals to find tsx loader. Should spawn cli.js instead (or use injectable stdout).
- **charliecreates** `cli.test.ts:27` — Tests use `fs.*Sync` which violates the no-sync-I/O constraint.
- **charliecreates** `cli.js:30` — `require.resolve("tsx")` may not resolve to the loader module. Should resolve `tsx/dist/loader.mjs` explicitly.
- **charliecreates** review summary — Docs underspecify target parsing, vibes.json normalization, and live vs publish cache invariants. Cross-doc domain inconsistency.
- **charliecreates** review summary — Code/docs mismatch on cmd-ts. Tests are brittle (PNPM scanning). Sentinel default is fragile. `padEnd(12)` formatting will break. Consider `--json` mode.
- **codex** `cli.ts:158` — P2: Stub commands declare `args: {}` so cmd-ts rejects positional args. `use-vibes generate <slug> "prompt"` fails with parser error instead of "not yet implemented".
- **codex** review summary — Automated review suggestions for commit ce18053cde.
