# De-duplicate load-bearing logic (#2014) — design

**Date:** 2026-06-18
**Tracking:** #2014 ([P1] de-duplicate copy-paste-synced logic), related #1953 (rules-bag audit)
**Status:** draft design — open questions for review (see end)

## Problem

Several pieces of load-bearing logic exist as multiple hand-maintained copies kept in
sync only by copy-paste. Divergence is a latent correctness/security risk. Promote each
to a single source of truth. **No behavior change** is the contract — every promotion is a
pure move/import and lands as its own refactor commit.

## Reality check vs. the issue (2026-06-18)

The issue was filed 2026-05-28. One item has since been resolved by unrelated work and is
**dropped from scope**:

- **Event schemas (issue item 1) — already gone.** `vibes.diy/pkg/workers/doc-notify.ts`
  was deleted by the DocNotify DO retirement (see
  `docs/superpowers/specs/2026-06-09-docnotify-retire-design.md`), and
  `pkg/workers/chat-sessions.ts` no longer defines `DocChangedEvt` / `RequestGrantEvt` /
  `DocNotifyEvt`. Grep confirms **zero** local event-schema definitions remain in
  `pkg/workers/`. The grant-shape reconciliation the issue flagged as "the one place with
  real semantic risk" is therefore moot. **Open question Q1 confirms we drop this.**

The remaining duplications all survive and are in scope:

| # | Duplication | Copies (current line refs) | Priority |
|---|---|---|---|
| 1 | ACL eval (`inGroup`/`aclAllows`/`canRead`/`canWrite`) | `vibe/runtime/db-acl-allows.ts:15-36`, `api/svc/public/db-acl-resolver.ts:15-26` (+ `aclAllows`) | P1 (security) |
| 2 | "latest app per slug" query | `api/svc/public/get-app-by-fsid.ts`, `api/svc/public/fork-app.ts` (both contain `max_created`) | P1 (correctness) |
| 3 | `last30DaysUTC` ×3 | `report-growth-memberships.ts:20`, `report-growth-vibes-with-data.ts:19`, `report-active-members.ts:20` | P2 |
| 4 | `loadDevVars` ×3, `formatError` ×2 | `usage-report/admin-db.ts:22,99`, `usage-report/inspect-db.ts:114,275`, `usage-report/inspect-db-report.ts:14` | P2 |
| 5 | `deriveDisplayName`/`deriveAuthorDisplay` ×3 | `who-am-i.ts:28`, `list-members.ts:23`, `get-app-by-fsid.ts:44` | P2 |

(The issue's code snippets are also slightly stale: `inGroup` now tests `level === "override"`,
not `"owner"`, after the owner→override / userSlug→handle renames. The current bodies in the
two ACL files are byte-identical to each other — verified.)

## Design

### 1. ACL eval → one shared module in `@vibes.diy/vibe-types`

**Why vibe-types, not api-types:** `@vibes.diy/api-types` already `dependsOn`
`@vibes.diy/vibe-types` (`workspace:*`, verified in `vibes.diy/api/types/package.json`).
Putting the resolver in api-types and importing it from `vibe-runtime` would create a cycle —
which is exactly what the local-copy comment in `db-acl-allows.ts` was avoiding. Both
`@vibes.diy/api-svc` and `@vibes.diy/vibe-runtime` already depend on `@vibes.diy/vibe-types`,
so it is the correct shared home and needs **no new import-map entries**.

- **New:** `vibes.diy/vibe/types/db-acl-eval.ts` exporting `DbAcl`, `DbAclSubject`,
  `canRead`, `canWrite`, `inGroup`, `aclAllows`, typed against `DocAccessLevel` (already in
  vibe-types). Use the existing bodies **verbatim** (the host copies are what the parity test
  pins to; the runtime bodies are identical). Re-export from the vibe-types index.
- **`vibe/runtime/db-acl-allows.ts`:** re-export from the shared module (keep the public
  `aclAllows` / `DbAcl` export paths so `@vibes.diy/vibe-runtime` consumers and the parity
  test are undisturbed). Delete the local bodies.
- **`api/svc/public/db-acl-resolver.ts`:** keep `resolveDbAcl` / `checkDirectChannelAccess`
  (DB/IO — they stay here). Import `inGroup`/`aclAllows` from the shared module; delete the
  local `inGroup`. It currently sources `canRead`/`canWrite` from `./access-helpers.js` and
  `DbAcl`/`DbAclSubject` from `@vibes.diy/api-types` — see **Q2/Q3** for how to converge those
  onto the shared module without a 3rd/4th copy.
- The arktype **value** schema `DbAcl` in `api-types/db-acls.ts` (server validation surface)
  stays; the shared *eval* module only needs the **structural** `DbAcl`/`DbAclSubject` types.

### 2. "latest app per slug" query → one helper

- **New:** `selectLatestAppPerSlug(vctx, { userSlug, appSlug })` (location TBD — see **Q4**),
  returning the production-winning row or `undefined`. Move the `maxCreatedSub` + `innerJoin`
  + `orderBy(mode)` + `rows[rows.length-1]` block verbatim. Keep the
  `// "dev" < "production" → last wins` comment on the helper.
- Update `get-app-by-fsid.ts` and `fork-app.ts` to call it. **Preserve each caller's
  `fsId`-present fast path inline** — that branch differs per caller and stays.

### 3–5. P2 helpers

- `last30DaysUTC` → one shared report-dates util; import in the three report files. Fold in
  `inspect-db-report.ts`'s near-identical `last30Days` only if shapes match exactly.
- `loadDevVars` → one shared util under `api/svc/usage-report/`; import in `admin-db.ts`,
  `inspect-db.ts`, `inspect-db-report.ts` (the three bodies are identical — pure de-dup).
- `formatError` → **not a pure de-dup; the two copies have drifted.** `inspect-db.ts:275`
  also unwraps a nested `error.message` (handles `{ error: { message } }`); `admin-db.ts:99`
  only checks the top-level `message`. Adopt the **superset** (the `inspect-db` body) as the
  single shared helper. This preserves `inspect-db` exactly and is strictly additive for
  `admin-db` — it only changes output for inputs `admin-db` currently passes to `String(error)`
  (nested-`error.message`-shaped values). That is a (tiny, strictly-better) behavior change for
  `admin-db`, so under the no-behavior-change contract it must be **called out and accepted
  explicitly**, not landed silently. See **Q7**. (Do not adopt the `admin-db` body — that would
  regress `inspect-db` for nested errors.)
- `deriveDisplayName` / `deriveAuthorDisplay` → one exported helper (single name); update the
  three call sites and drop the now-obsolete "keep aligned with X" comments.

## Verification

```bash
pnpm build                                   # types must compile after the moves
cd vibes.diy/tests && pnpm test db-acl-allows-parity   # ACL parity (see Q5)
cd vibes.diy/tests && pnpm test comments-acl who-am-i api
pnpm lint
# inGroup/aclAllows defined (not imported) in exactly ONE file:
rg -ln "export function inGroup|export (const|function) aclAllows" vibes.diy --glob '*.ts' --glob '!*node_modules*' --glob '!*.test.*'
# each P2 helper defined once; max_created in one helper not two handlers:
rg -n "function last30DaysUTC|function loadDevVars|function deriveDisplayName|function deriveAuthorDisplay" vibes.diy --glob '*.ts' --glob '!*node_modules*'
rg -n "max_created" vibes.diy/api/svc --glob '*.ts'
```

Per `agents/code-quality.md`: `pnpm check` is the full gate. Per `agents/flaky-tests.md`:
rerun a failing suite in isolation before treating it as real. Rules-bag: no `export default`,
no `any`, no casts to bridge package boundaries — unify the types instead.

## Risk & rollout

- **No behavior change is the contract.** The ACL parity, comments-acl, who-am-i, and
  get-app/fork tests already characterize the surfaces. Never bundle a behavior change.
- **Safe to split:** the three promotions (ACL, query, P2 helpers) are independent — land as
  separate commits so a regression bisects cleanly. P2 helpers are lowest-risk and go first.
- The semantic-risk item (event-schema reconciliation) is **already resolved** and out of scope.

## Open questions for review (Charlie)

1. **Event schemas — confirm dropped.** Item 1 of the issue is already gone (DocNotify
   retirement). Agree we strike it from the acceptance criteria rather than re-introducing a
   shared `DocNotifyEvt`?
2. **ACL structural-type single source of truth.** Host `db-acl-resolver.ts` imports
   `DbAcl`/`DbAclSubject` from the api-types **arktype** schema (`db-acls.ts`); runtime keeps
   local structural copies. To avoid a 3rd/4th copy without a cycle: should the **structural**
   `DbAcl`/`DbAclSubject` live in the new `vibe-types/db-acl-eval.ts` and have the api-types
   arktype schema `import type` them (safe — api-types already depends on vibe-types)? Or keep
   the arktype schema fully self-describing and derive the structural type from it via
   `typeof schema.infer`, re-exported from vibe-types?
3. **`canRead`/`canWrite` ownership.** Today runtime defines them and host imports them from
   `access-helpers.js`. Plan: shared `db-acl-eval.ts` becomes the single definition and
   `access-helpers.ts` re-exports them. Any reason `access-helpers` must keep owning these?
4. **Query helper home.** `selectLatestAppPerSlug` under `api/svc/public/select-app.ts`, or
   `api/svc/intern/`? (Both callers are in `public/`; the helper is pure DB selection.)
5. **Parity test fate.** Once both `aclAllows` resolve to one shared impl, the parity test
   compares the impl to itself. Keep it verbatim as a cheap regression guard, or convert it to
   assert both package exports resolve to the **same function reference**?
6. **Packaging.** One PR with three reviewable commits, or three separate PRs (issue calls the
   promotions "safe to split")?
7. **`formatError` superset (raised by Codex review).** The two copies have drifted —
   `inspect-db` unwraps nested `error.message`, `admin-db` does not. Plan adopts the `inspect-db`
   superset, a strictly-additive change to `admin-db`'s output for nested-shaped errors. Accept
   that as within the "no behavior change" spirit, or keep two helpers to preserve `admin-db`
   byte-for-byte?
