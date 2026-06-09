# DocNotify DO retirement — design

**Date:** 2026-06-09
**Tracking:** #2265 (item 1), follow-up of #2264 / PR #2253 (AppSessions DO split)
**Status:** approved design, pending implementation

## Problem

The `DocNotify` Durable Object (cross-shard doc-changed coordinator) is **dead code**: declared in `wrangler.toml`, exported from `pkg/workers/app.ts`, typed in `cf-env.ts`, but `env.DOC_NOTIFY` is **never invoked** anywhere. The AppSessions DO split (PR #2253) moved live fan-out to per-vibe `localBroadcastCallbacks` inside `AppSessions`, leaving `DocNotify` orphaned.

Goal: remove `DocNotify` from all environments safely, honoring Cloudflare's Durable Object migration rules and the cross-script binding between `cli` and `prod`.

## Scope

**In scope:** delete the `DocNotify` DO class, its bindings, its source file, its env type; add `deleted_classes` migrations.

**Out of scope:**

- `AccessFnDO` — **still live**. `chatMsgEvento` includes `...appHandlers`, and `chat-sessions` calls `cfServeAppCtx` without an `invokeAccessFn` override, so the chat plane falls through to the default that calls `env.ACCESS_FN_DO` (`cf-serve.ts:400`). Blocked on #2263 (remove `appHandlers` from the chat plane). Do **not** delete.
- The no-op `registerDocSubscription`/`deregisterDocSubscription` svc plumbing and `notifyDocChanged` local fan-out — keep (harmless; `notifyDocChanged` is the live local path).
- cli's dormant `v2 new_classes=["DocNotify"]` history entry — leave it (the team already judged a full 3-step retire "not worth the churn"), **unless** dry-run proves it must be `deleted_classes`'d once the code is gone (see Risks).

## Environment map (wrangler.toml)

| Env           | worker name            | DOC_NOTIFY binding             | v2 new_classes | highest tag |
| ------------- | ---------------------- | ------------------------------ | -------------- | ----------- |
| top-level     | `vibes-diy-v2` (test)  | L22 (local)                    | L33            | v5          |
| `env.local`   | `vibes-diy-v2-local`   | L75 (local)                    | L86            | v5          |
| `env.dev`     | `vibes-diy-v2-dev`     | L134 (local)                   | L145           | v5          |
| `env.preview` | `vibes-diy-v2-preview` | L195 (local)                   | L206           | v5          |
| `env.prod`    | `vibes-diy-v2-prod`    | L255 (local — the real class)  | L266           | v5          |
| `env.cli`     | `vibes-diy-v2-cli`     | L323 (**cross-script → prod**) | L348 (dormant) | v4          |

Only `cli` cross-script-references prod's class. cli also cross-script-binds prod's `APP_SESSIONS` and `USER_NOTIFY` (L322, L324) — **leave those**, they are live.

## The chain (two PRs, deploy-ordered)

The crux: Cloudflare error **10061** — you cannot apply a `--delete-class` migration to a class while a binding still references it. cli's cross-script binding (L323) references prod's `DocNotify`, so cli must drop that binding and deploy **before** prod deletes the class.

### Step 1 — PR A: cli unbinding (deploy FIRST)

- `wrangler.toml` `[env.cli.durable_objects]`: remove the L323 `DOC_NOTIFY` cross-script binding. Keep cli's dormant `v2` entry. Update the comment block (L311–345) to note the binding was removed.
- No code/source changes in this PR (keeps it a pure, fast cli deploy).
- **Deploy:** `vibes-diy-v2-cli`. After it is live, prod's `DocNotify` has no external reference.

### Step 2 — PR B: class deletion (deploy AFTER PR A is live)

- `wrangler.toml`: in **test, local, dev, preview, prod** blocks — remove the `DOC_NOTIFY` binding **and** append a `v6` migration with `deleted_classes = ["DocNotify"]`. Keep every historical `v1..v5`. cli is **not** edited here.
- `pkg/workers/app.ts`: remove `export { DocNotify } from "./doc-notify.js"`.
- delete `pkg/workers/doc-notify.ts`.
- `api/types/cf-env.ts`: remove `DOC_NOTIFY: DurableObjectNamespace;`.
- update stale comments/test descriptions that present `DocNotify` as live (route-decision.test.ts description; `firefly-database.ts` / `use-firefly.ts` comments). No behavior change.
- **Deploy order:** `prod` only after `cli` (PR A) is live; `test`/`dev`/`preview`/`local` have no cross-env constraint.

## Verification (gates)

- `pnpm check` (build + test + lint) on each PR.
- **Per-env `wrangler deploy --dry-run`** (test, dev, preview, prod, cli) before any real deploy — this is the authoritative gate for migration/class-registry errors.
- Post-change grep: zero `env.DOC_NOTIFY` references; `DOC_NOTIFY` absent from all non-cli binding blocks.
- After deploy: smoke-test live doc updates within a single vibe still work (unchanged path).

## Risks & contingencies

1. **cli dormant class after code deletion.** Once PR B removes `doc-notify.ts`, cli still carries `v2 new_classes=["DocNotify"]` with no code and (post-PR A) no binding. If `wrangler deploy --dry-run --env cli` errors (e.g. 10074 "missing class") → contingency: add `deleted_classes=["DocNotify"]` as cli `v5` in PR A (allowed once the binding is dropped in the same config). This expands cli beyond "drop binding only" but only if dry-run forces it.
2. **Wrong deploy order** → 10061. Mitigation: PRs are separate; deploy runbook states cli-first, prod-after. Reverse of the usual "prod before cli" order from #2264 — call it out explicitly.
3. **`deleted_classes` is irreversible** (drops DO instances/state). Safe here because `DocNotify` only stored a transient `subscribers` shard-id set, never user data.
4. **top-level ≠ prod.** top-level is the `test` worker; prod is `[env.prod]`. Both need the change.

## Out-of-scope follow-ups (track on #2265)

- `AccessFnDO` deletion — after #2263 removes `appHandlers` from the chat plane.
- cli dormant `DocNotify` v2 full retire — optional cosmetic cleanup.
