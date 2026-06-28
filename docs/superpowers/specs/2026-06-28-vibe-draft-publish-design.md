# Draft / published model for in-place generation on `/vibe` (#2772)

**Date:** 2026-06-28
**Status:** design — principle + requirements set by jchris (2026-06-28); implementation not started.
**Issue:** #2772 (child of the agent-in-vibe epic #2675; follows PR-A #2762 in-place generation).

---

## 0. What this is — and the principle

In-place generation on `/vibe` (PR-A) writes a **`dev`** Apps row per codegen turn. The published
public version is a **`production`** Apps row. Today the unversioned read resolves to **production
for everyone** (`selectLatestAppPerSlug` prefers production), so an owner who generates in place
can't see their own draft on a plain reload or via `pull` — which is what made #2772 first look
broken (it isn't; the gen pipeline works end-to-end).

**The principle (jchris):**

> The only thing draft state changes is **owner-only read**. Even a draft should **auto-resolve
> its latest `fsId`** the way production does.

So this is **not** a leak fix (nothing leaks today — drafts are served to no one unversioned). It's
**additive**: give the **owner** a read of their own latest draft, keep everyone else on published,
and add the controls to publish a draft and to reach any version from the CLI.

---

## 1. Verified current model (DB + code)

DB ground truth for the `tide-clock` / `garden-gnome` example (`db:inspect`):

| mode       | releaseSeq | meaning                                     |
| ---------- | ---------- | ------------------------------------------- |
| dev        | 3          | latest in-place gen (the "AHOY" edit)       |
| dev        | 2          | earlier in-place gen                        |
| production | 1          | published baseline — what `pull` / anon get |

- **In-place gen writes `mode:"dev"`** Apps rows (`api/svc/public/prompt-chat-section.ts:768` →
  `ensure-app-slug-item.ts` → `app-seq-allocation.ts`); production stays put.
- **Unversioned resolution prefers production:** `selectLatestAppPerSlug`
  (`api/svc/public/select-app.ts:5-46`) takes the max-created row per mode, then `orderBy(mode)`
  so `dev < production` → **production always wins**, even over a newer dev row. Used by the worker
  entry-point (`serv-entry-point.ts:229-241`) and by `getAppByFsId` with no fsId.
- **No draft leak today**, and no owner-draft read either: owner and anon both get production
  unversioned. (An explicit `/{fsId}` URL serves that exact row to anyone who has the link — fine
  for the owner pinning their own draft; not discoverable on the public URL.)
- **Publish exists only as a mode-upgrade**, with no web control: `buildUpgradeToProduction`
  (`app-seq-allocation.ts:145`) flips `dev → production`; CLI `push` writes production directly.
  There is **no `publish` RPC** and **no web Publish button** today.

---

## 2. Target behavior — the symmetry

> **Owner sees draft (route + CLI); everyone else sees published (route + CLI); publish promotes
> draft → published everywhere.**

| surface                             | owner (authed, owns app)                                | everyone else / anon        |
| ----------------------------------- | ------------------------------------------------------- | --------------------------- |
| `/vibe/{owner}/{app}` (unversioned) | latest **incl-dev** (auto-latest draft)                 | latest **production**       |
| `/vibe/.../{fsId}` (versioned)      | that exact fsId (unchanged)                             | that exact fsId (unchanged) |
| CLI `pull` / `codegen-log`          | latest **incl-dev** (default); `--published` opts out   | latest **production**       |
| CLI `versions`                      | lists **all** rows (dev + production), pull any by fsId | published rows              |
| Publish                             | promotes latest dev → production (everywhere)           | n/a                         |

Plus a **draft indicator** on `/vibe` when the owner is viewing an unpublished draft, and a
**Publish control in the Vibes switch** (`UnifiedVibeCard`).

---

## 3. Implementation design

### 3a. Owner-aware "latest including dev" resolver (backend)

Add a resolver that returns the latest row **across all modes** for the owner (auto-latest by
`releaseSeq`/`created`), parallel to `selectLatestAppPerSlug` (which stays the public,
production-preferred path):

- `selectLatestDraftOrPublished(vctx, { ownerHandle, appSlug })` → max-(releaseSeq, created) over
  **all** modes (so a newer `dev` wins; falls back to production when no dev exists).
- Surface it through `getAppByFsId` (the no-fsId path) **when the authenticated caller owns the
  app**: owner → incl-dev; non-owner/anon → production-preferred (today's behavior). This makes the
  route _and_ the CLI owner-aware through one server change, keyed on the verified `userId`.

### 3b. `/vibe` route: pin the owner's latest-dev fsId + the draft indicator (frontend)

The loader runs SSR with no viewer auth, so it keeps building the **unversioned (production)**
iframe URL — correct default for anon and for first paint. Then, client-side, when `isOwner`
resolves true and the URL has no explicit `fsId`:

- Call the owner-aware resolver (`getAppByFsId` authed, or a dedicated `getLatestDraft`) to get the
  latest **incl-dev** fsId + whether it's an unpublished draft (latest dev `releaseSeq` > latest
  production `releaseSeq`).
- If it's a draft, **re-pin the iframe** to that fsId (reuse the existing `setIframeUrl` sync the
  PR-B P1 fix added) so the owner sees their draft, and **show a draft indicator** (e.g. a "Draft ·
  unpublished" badge in the card header / near the title). Non-owners: no change.

This keeps serving **fsId-pinned** (no server-side viewer gating), with owner-awareness in the
route where `isOwner` is already known.

### 3c. Publish from the Vibes switch (frontend + a new RPC)

- **New RPC `publishApp({ ownerHandle, appSlug, fsId? })`** (owner-only, auth-checked): makes the
  chosen content the **served public latest**. **It must allocate a NEW highest-seq production
  release for that content — not just flip the row to `production` in place** (Codex review,
  2026-06-28). Rationale: the entry-point + `selectLatestAppPerSlug` pick the **highest production
  `releaseSeq`**, so flipping a row's mode keeps its old seq.
  - Publishing the **latest dev** (the switch's common case) happens to work either way, since the
    latest dev already carries the highest `releaseSeq`.
  - Publishing an **older `fsId`** (the CLI/`versions` "publish this version" case) would **fail** if
    upgraded in place — a newer production row still out-ranks it. So publish must **re-release** the
    chosen content as a new top-of-stack production row (allocate `releaseSeq = MAX+1`, same
    `fsId`/content), so `pull` / anon / `codegen-log` reflect exactly the published version.
  - One uniform rule: **publish always mints `production` at `MAX(releaseSeq)+1` for the chosen
    `fsId`'s content** (idempotent no-op when that content is already the highest production).
    Reuse the release-allocation infra (`app-seq-allocation.ts`); `buildUpgradeToProduction` alone is
    insufficient for the older-version case.
- **`UnifiedVibeCard` Publish control:** shown to the owner when an unpublished draft exists
  ("needs publish"); calls `publishApp`; on success the indicator clears to "Up to date" and the
  draft becomes the production everyone sees. Placement: a Publish affordance in the switch (the
  exact spot — header action vs a banner above the nav — is a sketch decision, §6).
- **"needs publish" / "up to date" state:** derived from latest-dev `releaseSeq` vs latest-production
  `releaseSeq` (resolver returns both).

### 3d. CLI: draft default for the owner, `--published`, and `versions` (CLI)

- **`pull` (`cli/cmds/pull-cmd.ts`)** — for the authenticated owner, resolve latest **incl-dev** by
  default (via the owner-aware resolver); `--published` flag forces production. Non-owner: production
  (unchanged). Round-trips (`pull` → edit → `push`) then operate on the source the owner sees live.
- **`codegen-log` (`cli/cmds/codegen-log-cmd.ts`)** — owner sees draft turns by default (already
  lists turns incl. dev fsIds; align the "current" pointer to the draft).
- **`versions` (new command)** — list every Apps row for `(owner, appSlug)`: `fsId`, `mode`,
  `releaseSeq`, `created`, and a published/draft marker; `pull --fsId <id>` (or `versions pull <id>`)
  fetches any specific version. Needs a `listVersions` API (or reuse an existing list) returning the
  rows for the owner.

---

## 4. Backend coordination (what needs the server)

1. **`selectLatestDraftOrPublished`** + owner-aware branch in `getAppByFsId` (§3a) — unblocks the
   route draft-read **and** the CLI draft-default through one change.
2. **`publishApp` RPC** (§3c) — promotes dev → production (existing mode-upgrade), owner-auth.
3. **`listVersions`** read (§3d) — for the CLI `versions` command (may reuse existing app-list infra).

The serving entry-point stays **unchanged** (still fsId-pinned / production-preferred unversioned);
no viewer-aware worker gating needed.

---

## 5. PR slices (independently mergeable)

- **PR-D1 — owner draft read + indicator.** The resolver (§3a) + the route's owner-pin + draft
  indicator (§3b). The owner sees their latest draft on `/vibe`; everyone else unchanged. (Resolver
  is the backend dependency; route/indicator are frontend.)
- **PR-D2 — publish from the switch.** `publishApp` RPC + the Publish control + needs-publish/up-to-date
  state (§3c). Depends on the resolver returning both release seqs.
- **PR-D3 — CLI draft/published + versions.** `pull` owner-draft-default + `--published`, the
  `versions` command + access-any-version, `codegen-log` alignment (§3d). Depends on the resolver +
  `listVersions`.

D1 first (it's the principle); D2 and D3 follow and are independent of each other.

---

## 6. Open decisions (recommendations; confirm before/within build)

1. **Draft-read mechanism — route-pins-fsId (recommended) vs server-side viewer-aware entry-point.**
   Recommend route-pins (the entry-point has no viewer auth; keeps serving simple). Confirm.
2. **Draft indicator placement/look** — a "Draft · unpublished" badge in the card header (near the
   title/handle), distinct from the running app. Sketch in Storybook before building.
3. **Publish control placement** — in the `UnifiedVibeCard`: a Publish button that appears in the
   Edit view (or a thin "unpublished changes — Publish" banner above the nav) when a draft exists.
   Sketch options.
4. **What "publish" promotes** — the latest dev `fsId` (recommended: one click ships the newest
   draft). A "publish a specific older version" is a CLI/`versions` capability, not the switch button.
5. **CLI `versions` UX** — `versions` lists; `pull --fsId <id>` fetches any. Confirm the command
   surface (a `versions` subcommand vs flags on `pull`).
6. **Draft cleanup / GC** — dev rows accumulate (6.4k dev vs 6.5k production globally). Out of scope
   here; note for a follow-up if it matters.

---

## 7. Relationship to the epic

- Consistent with PR-A (in-place gen writes drafts) and PR-B (a non-owner fork creates a new owned
  vibe → the forker is the owner → sees their draft; publishes when ready). No conflict.
- This is the "draft/publish" half the in-place-gen feature implies; it makes the owner's edits
  legible (route + CLI) and shippable (publish), while keeping the public surface stable.
