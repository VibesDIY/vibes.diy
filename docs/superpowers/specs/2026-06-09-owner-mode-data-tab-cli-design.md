# Owner-mode data tab + CLI `db query` — Design

**Issue:** [#2278](https://github.com/VibesDIY/vibes.diy/issues/2278)
**Date:** 2026-06-09

## Problem

The owner of a vibe can't see all of their own data. Both the **data tab** in the
builder and the **`vibes-diy` CLI `db query`** command return a channel-scoped subset
of documents instead of the full database. As the owner, you expect a complete view.

The platform already has an owner bypass — the **admin / `override` access level**
(PRs [#2171](https://github.com/VibesDIY/vibes.diy/pull/2171),
[#2175](https://github.com/VibesDIY/vibes.diy/pull/2175),
[#2176](https://github.com/VibesDIY/vibes.diy/pull/2176)). It works for **writes** but
not for **reads**, and neither the data tab nor the CLI currently requests it.

## Root cause (the load-bearing bug)

When the owner has admin mode on, `checkDocAccess(...)` correctly returns
`access: "override"`, and `canRead("override") === true`, so the ACL gate passes. But
the **channel-gating** layer added by
[#2098](https://github.com/VibesDIY/vibes.diy/pull/2098) runs _after_ the ACL check and
does **not** consult the access level. It filters documents by channel membership
unconditionally:

- `getDoc` channel gate — `api/svc/public/app-documents-read-eventos.ts` (~lines 98–177):
  if an access-function binding exists, the doc is returned as not-found unless the
  caller is in one of its channels. No `override` short-circuit.
- `queryDocs` — same file (~lines 284–325): result set is passed through
  `filterDocsByChannel(...)`, which drops every doc whose channels the caller isn't in.
- `filterDocsByChannel` — `api/svc/public/channel-read-filter.ts`: a pure filter with no
  awareness of access level.

Contrast the **write** path, which already honors the bypass: `cf-serve.ts`
`requireAccess`/`requireRole` return success immediately when `adminMode === true`, and
`putDoc` passes `adminMode: isOwner && connectionAdminMode(ctx)` into the access fn.

So even if a client set `adminMode: true` today, reads would still be channel-filtered.
**The server read-path fix is the necessary core; the two client surfaces are what make
it reachable.**

## How adminMode reaches the server (already built)

Connection-level, via the `whoAmI` handshake — no per-request plumbing needed:

1. Client sends `vibe.req.whoAmI` with `adminMode: true`
   (`ReqVibeWhoAmI` already has the optional field — `vibe/types/index.ts`).
2. `whoAmIEvento` sets `WSSendProvider.adminMode = adminMode === true`
   (`api/svc/public/who-am-i.ts` ~line 233).
3. Read handlers pull it back via `connectionAdminMode(ctx)`
   (`api/svc/public/app-documents-shared.ts`) and pass it into `checkDocAccess`.

**Safety:** `checkDocAccess` only returns `override` when the authenticated `userId`
matches the app owner binding (`access-helpers.ts` ~line 27). A non-owner that sends
`adminMode: true` still gets `editor`/`none`. So defaulting `adminMode: true` on an
owner-only inspection surface grants nothing extra to non-owners.

## Design

Three coordinated changes. The chosen transport is the existing **connection-level
`adminMode`** flag (reuse `whoAmI` + `WSSendProvider`), not new per-request wire fields.

### 1. Server: honor `override` on the read path (the fix)

- `getDoc`: skip the channel-membership gate when `access === "override"`.
- `queryDocs`: skip `filterDocsByChannel` when `access === "override"` (gate at the call
  site so the filter stays a pure function).
- `listDbNames`: already `isOwner`-gated; confirm `override` callers (who are owners by
  definition) still pass. No relaxation of the `isOwner` requirement.

### 2. Data tab: connect the db-explorer in admin/override mode

The db-explorer iframe runs the runtime `whoAmI()`
(`vibe/runtime/register-dependencies.ts` ~line 305), which does **not** pass `adminMode`.
The parent's `viewerChanged` push (`PreviewApp.tsx`) sets only the _client-side_ `access`
display — it never sets the _connection_ `adminMode` flag the server reads. So the
db-explorer's whoAmI must send `adminMode: true` when it's the owner's preview/inspection
context (`?preview=yes`).

### 3. CLI: `db query` (and `db get` / `db ls`) in admin/override mode

`vibes-diy db query` never calls `whoAmI` — it goes straight to `adapter.queryDocs(...)`
(`cli/cmds/db/query-cmd.ts` → `firefly-api-adapter.ts`). It must issue a
`whoAmI({ adminMode: true })` on connect (or thread `adminMode` so the adapter does),
then query. Same applies to the get/list subcommands for a consistent owner view.

## Resolved decisions (CharlieHelps review, [#2286](https://github.com/VibesDIY/vibes.diy/pull/2286))

1. **Default-on vs explicit flag → default-on.** `adminMode: true` by default on the
   data tab and CLI `db` reads; non-owners can't elevate because `override` is owner-bound.
2. **Data tab vs builder admin toggle → always owner-mode.** The data tab is an owner
   inspection surface; "what a restricted viewer sees" belongs in preview/runtime
   surfaces. A "view as collaborator" mode can be a later follow-up.
3. **Per-request vs connection-level → connection-level.** Ship on the existing
   `whoAmI` → `WSSendProvider.adminMode` path; per-request wire fields are a follow-up,
   not a blocker.
4. **Other override grant paths → confirmed none.** `checkDocAccess` owner-binding +
   `adminMode === true` (`api/svc/public/access-helpers.ts`) is the only path emitting
   `access: "override"`. Encoded as a regression test (plan Task 3).
5. **db-explorer non-owner exposure → no client-side owner gate exists today.** The
   server still prevents non-owner elevation, but the client must gate sending
   `adminMode: true` on **confirmed owner state** so we never signal a misleading mode
   (plan Task 5).

## Out of scope

- Delegated/non-owner admins (override for anyone but the app owner).
- Write-path changes (already honor adminMode).
- UI for per-channel filtering inside the data tab.
