# Owner role seeding — retire `isOwner` from the access function — design

**Date:** 2026-06-23
**Branch:** `claude/vibe-save-permissions-zehx4d`
**Status:** proposed design, pending review

## Problem

A vibe's `access.js` decides who can write. Today the owner's write authority
runs through a single magic boolean — `user.isOwner` — that is computed in one
place (`checkDocAccess`, `vibes.diy/api/svc/public/access-helpers.ts:29`) by
matching the `handleBinding` row for the vibe's `ownerHandle` to the
currently-acting `userId`, and then threaded through three independent code
paths: the server write gate, the server read gate, and the client `can`
predictor that `useVibe` runs.

When any of those layers resolves `isOwner` to `false` — the owner is acting
under a different handle than the one bound to the vibe, a handle-binding gap, or
the client predictor not knowing ownership — and the `access.js` grants owner
write **only** via `isOwner`, the owner is locked out of their own vibe with no
fallback.

This is not hypothetical. `garden-gnome/aegina-checklist` is broken right now:
its `access.js` is `if (!user.isOwner) ctx.requireRole("editor")` and the owner
is never added to the `editor` role, so owner-write hinges 100% on `isOwner`
resolving true at every layer. The moment it resolves false anywhere, the owner
cannot save.

`isOwner` is used in **62 of 80** example vibes' `access.js`, overwhelmingly as
`if (!user.isOwner) throw { forbidden: "owner only" }` (57×) and as the
owner-is-implicitly-X bootstrap `if (!user.isOwner) ctx.requireRole("X")` (a
handful). It is load-bearing precisely because there is no other way to seed the
first privileged user in a fresh vibe.

Goal: make data authority inside a vibe expressed **purely as roles/grants**, the
same path for everyone, and remove `isOwner` from the access function's `user`
context. "Owner" stays a real concept, but only as an **out-of-vibe overload** —
who controls the code/deploy/owner-panel — not as an ambient super-user inside
the data-access function.

## Key insight: declare, don't extract

A "role" at enforcement time is nothing but a handle appearing in a `members`
map. `ctx.requireRole(roleName)` is literally
`gs.members[roleName].includes(user.userHandle)`
(`vibes.diy/api/svc/public/access-function.ts:85-86`), and `gs.members` is built
by reducing stored `accessFnOutputs`
(`vibes.diy/api/svc/public/app-documents-write-eventos.ts:303-327`).

So the only thing the owner ever needed was to **start out holding the right
roles**. The generator already knows those role names — it just wrote them into
`access.js`. Rather than the runtime statically parsing `ctx.requireRole("…")`
calls back out of the source (brittle) or shipping an owner-panel UI to grant
roles by hand, the **generator declares the owner's seed roles** as a literal
emitted alongside the code. Declaration preserves knowledge the model already
has; extraction tries to recover it after the fact. Declaration wins.

This eliminates both the role-name extraction step **and** the owner-panel
grant UI for the seeding problem. Granting roles to _other_ users continues to
happen through the vibe's own in-app grant docs (the existing `editorGrant`
pattern) — no platform UI required.

## Design

### 1. The manifest — generator declares owner seed roles

The generator emits, alongside `access.js`, a declaration of the roles the owner
should hold at deploy time. Two viable homes (decision below):

- **Sidecar field in the push payload** (preferred): `ownerRoles: string[]`,
  read at deploy without evaluating the access module. Per-`dbName` if needed:
  `ownerRoles: Record<dbName, string[]>` or a flat list applied to all dbs.
- **Named export in `access.js`**: `export const ownerRoles = ["admin", "editor"]`.
  Colocated, and the push pipeline already extracts per-db export sources
  (`extractExportSource`), so reading a named export is in-band — but it mixes a
  data declaration into the executable module.

Recommendation: **sidecar field on the push/ensureAppSlug payload**, schema-
validated, because it is read with zero code evaluation and is trivially
inspectable. Open to the export form if single-file ergonomics win.

### 2. The seed — deploy-time grant injected into the reducer

Roles today are minted **only** by stored `accessFnOutputs` (outputs of prior
doc writes). A deploy-time owner seed is not a doc write, so it needs a synthetic
grant source folded into `GrantReduce` next to the stored outputs.

At deploy (push / `ensureAppSlug`), the platform records a seed binding
`ownerHandle → ownerRoles` for the vibe's databases, and every grant reducer
includes it when building `members`. Concretely: a shared seed-injection helper
unions the declared `ownerRoles` (plus the reserved `owner` role) into
`members[role]` for `(ownerHandle, appSlug, dbName)` before the access fn runs.
This reuses the existing enforcement path — `requireRole` needs no change.

There are **three** independent `GrantReduce` construction sites, and the seed
must reach **all three** or the system desyncs:

1. **Write path** — `app-documents-write-eventos.ts:303-327` (server write gate).
2. **Read path** — `app-documents-read-eventos.ts` (server read gate).
3. **who-am-i / `resolveGrants`** — `who-am-i.ts:42` builds its own
   `GrantReduce` from `accessFnOutputs` (`who-am-i.ts:96`) and emits
   `grants[dbName] = { channels, publicChannels, roles }` (`who-am-i.ts:111`),
   which is what the client `can.*` predictor (`use-vibe.ts`) evaluates against.
   **Miss this one and the owner passes the server `requireRole("owner")` gate
   but `can.create/edit/delete` returns `not in role: owner` — owner-only UI is
   hidden / writes disabled client-side even though the server would allow.**
   (Caught in review; verified — `resolveGrants` is a separate reducer from the
   read/write paths.)

Because there are three call sites, the injection belongs in **one shared
helper** they all call, not three copies. This is **the one piece of real
plumbing** in the design; everything else is a generator/prompt change.

Properties:

- **Idempotent and additive.** Re-deploy re-applies the declared set. Never
  auto-revoke roles no longer declared (avoid surprise lockout); reconciliation
  to a smaller set, if ever wanted, is a separate explicit action.
- **Tied to a concrete handle**, like every other member. "Owner signed in under
  a different handle" stops being a confusing flag-resolution bug and becomes an
  honest "that handle isn't a member" — surfaceable by the member list /
  who-am-i.

### 3. Reserved-role backstop

If the generator ever omits `ownerRoles`, the owner holds no roles and we have
rebuilt the lockout. Mitigation: **always seed a reserved `owner` role**
unconditionally (`members.owner = [ownerHandle]`), plus any declared extras.
Then:

- "owner-only" management docs become `ctx.requireRole("owner")` — which can
  never be forgotten into a brick.
- Domain roles (`blog-author`, `moderator`, …) are additive via `ownerRoles`,
  or self-granted by the owner through the vibe's in-app grant docs.

This may look like `isOwner` reborn, but the difference is the entire point: it
is now a **normal, visible, revocable, transferable grant** in the member list,
not an ambient boolean evaluated through three fragile code paths.

### 4. Split `isOwner`: keep the chrome bit, drop the access-fn bit

- **Keep `me.isOwner`** (the client identity bit exposed by `useVibe`/who-am-i,
  `prompts/pkg/llms/use-vibe.md:13`) for app-shell chrome ("you own this") and
  the owner panel / code-update control. This _is_ the out-of-vibe overload and
  stays.
- **Stop _teaching_ `isOwner` now; remove the _field_ later.** These are two
  separate steps, deliberately split across the phases below. Now: the prompts
  stop emitting code that reads `user.isOwner` (§5), so new vibes don't depend on
  it. Later (after migration): stop populating the field in the access-fn `user`
  context (`app-documents-write-eventos.ts:242`) so data authority is strictly
  roles-only.

  **Why the field can't be removed in the same change (P1, from review).**
  `user.isOwner` is read by ~62 deployed/example vibes as `if (!user.isOwner) …`.
  The moment the field is absent, JS reads it as `undefined`, so those branches
  **deny the owner** — and the seeded reserved `owner` role does **not** save
  them, because the old functions never call `ctx.requireRole("owner")`. So the
  field removal must come **after** every still-served vibe has been migrated off
  it. Until then, `isOwner` stays populated; it is simply no longer _taught_.

### 4a. Phasing

This work is forward-only and lands cleanly without bricking anything:

1. **Phase 1 — this PR's implementation (additive).** Add the new surface
   (`ownerRoles` manifest + deploy-time seed into all three reducers + reserved
   `owner` role) **and** remove `isOwner` from the prompts (§5). `me.isOwner` and
   the access-fn `isOwner` field both stay populated. Nothing breaks: old vibes
   still read the field; new vibes are role-only by construction.
2. **Phase 2 — migrate the back catalog (after-task A).** Codemod/regenerate
   every still-served vibe off `user.isOwner` onto role checks + `ownerRoles`
   seeds; unbrick the ones currently relying on it (incl. `aegina-checklist`).
3. **Phase 3 — remove the field (after-task B).** Once nothing reads it, drop
   `isOwner` from the access-fn `user` context. `me.isOwner` (chrome) stays
   forever.

### 5. Prompt changes (the cheapest lever for new vibes)

We do **not** care about old vibes (see after-task). The generator stops emitting
`if (!user.isOwner) …` and starts emitting role-gated checks plus the
`ownerRoles` declaration. Canonical examples to rewrite:

- `prompts/pkg/system-prompt.md:407-420` ("owner manages channels") →
  `ctx.requireRole("owner")` with `ownerRoles` declaring the seed.
- `prompts/pkg/llms/use-vibe.md:40-42` ("Owner-only and role-gated surfaces") →
  describe role-gating; drop the `if (!user.isOwner) throw` exemplar.
- Any access-fn authoring guidance that references `user.isOwner`.

Because the generator stops depending on `isOwner` within one codegen
generation, new vibes are correct by construction.

## Scope

**In scope:**

- Manifest format for `ownerRoles` (generator output + push/ensureAppSlug
  payload field, schema-validated).
- Deploy-time seed binding `ownerHandle → roles` and its injection — via one
  shared helper — into **all three** `GrantReduce` sites: the write gate, the
  read gate, **and** `who-am-i.ts`'s `resolveGrants` that feeds the client
  `can.*` predictor.
- Reserved `owner` role always seeded.
- Remove `isOwner` from the access-fn authoring **prompts** (§5). Keep both
  `me.isOwner` (chrome) and the access-fn `isOwner` field **populated** — the
  field is removed only in phase 3, after migration.
- Tests: seed appears in `grantState`; `requireRole("owner")` passes for owner;
  owner-write works with **no** `isOwner` in the fn; multi-handle owner behaves
  as "not a member" when acting under a non-owner handle.

**Out of scope (explicit after-tasks — see Phasing §4a):**

- **Phase 2 — back-catalog migration.** Migrating existing deployed/example
  vibes off `user.isOwner`. A hard prerequisite for phase 3.
- **Phase 3 — remove the `isOwner` field** from the access-fn `user` context.
  Cannot land until phase 2 is complete (else owner-lockout, P1).
- Unbricking `garden-gnome/aegina-checklist` specifically (one-line editor
  grant) — folds into phase 2; not part of this change.
- A platform owner-panel UI for granting arbitrary in-vibe roles to other users
  (the in-app grant-doc pattern already covers this).

## Decisions to confirm

1. **Manifest home:** sidecar push-payload field (preferred) vs. `export const
ownerRoles` in `access.js`.
2. **Reserved role name:** `owner` vs. `admin` vs. configurable. Recommendation:
   `owner`, reserved and always seeded.
3. **Per-db vs. flat `ownerRoles`.** Access fns are selected per `dbName`; a
   `Record<dbName, string[]>` is the precise form, a flat list the simple one.
   Recommendation: flat list applied to all of the app's dbs unless a real case
   needs per-db.
4. **Re-deploy reconciliation:** additive-only (recommended) vs. reconcile-to-
   declared.

## After-tasks (separate PRs, not this one)

**Phase 2 — migrate old vibes.** A sweep of the back catalog to remove
`user.isOwner` dependence: codemod/regenerate the 62 affected example vibes (and
any still-served deployed vibes) to role-gated `access.js` + `ownerRoles` seeds,
and unbrick the ones currently relying on `isOwner` (including
`aegina-checklist`). Runs against the surface phase 1 ships, so it's a pure
data/source migration with no platform changes.

**Phase 3 — remove the `isOwner` field.** Once phase 2 confirms nothing reads
`user.isOwner`, drop it from the access-fn `user` context (server) and the
viewer payload that feeds it. `me.isOwner` (app-shell chrome / out-of-vibe
overload) stays. Small change, but gated entirely on phase 2 being complete.

This phasing keeps the present PR a clean, forward-only, additive change to the
platform + generator — nothing it ships can break an existing vibe.

## Risks

- **Reducer injection is the only non-trivial code.** Getting the seed folded
  into `grantState.members` for _both_ the read and write paths (they build the
  reduce separately) is where a regression would hide. Cover both with tests.
- **Forgotten declaration → lockout** is mitigated by the always-seeded reserved
  `owner` role; without that backstop, a generator miss reproduces the aegina
  bug universally.
- **Stale client predictor.** `can.*` must reflect the seeded roles too, or the
  UI hides write affordances the server would allow. The client grant state is
  built by a **separate** reducer — `who-am-i.ts`'s `resolveGrants` — so the seed
  must reach it, not just the server read/write paths. This is the easiest of the
  three sites to forget; cover it with a test that asserts `can.create` is `ok`
  for an owner whose only path to the role is the seed.
