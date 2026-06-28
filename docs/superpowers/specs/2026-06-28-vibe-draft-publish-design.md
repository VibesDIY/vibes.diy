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
- **Expose it via an EXPLICIT selection mode — not a silent default change** (Charlie review,
  2026-06-28). Add `selectMode?: "published" | "ownerLatest"` to `getAppByFsId` (the no-`fsId`
  path), or a dedicated `getLatestDraft` endpoint. **Existing no-`fsId` callsites keep `"published"`
  (the default)** — share / published-state UX depends on production semantics and must not
  regress. The `/vibe` route and the owner CLI paths **opt in** to `"ownerLatest"`, and the server
  still verifies the caller's `userId` owns the app before honoring it (a non-owner asking for
  `ownerLatest` falls back to `published`).
- **Resolver contract (no-regress):** document that `"published"` is byte-for-byte today's
  `selectLatestAppPerSlug` behavior; `"ownerLatest"` only differs for the authenticated owner.
  Audit existing `getAppByFsId` no-`fsId` consumers and assert they pass `"published"` (or omit it).

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

**Route-pin guardrails (Charlie review):**

- **Only re-pin UNVERSIONED URLs.** A versioned `/vibe/.../{fsId}` is an explicit request — never
  override it (acceptance criterion: a versioned URL is byte-for-byte unchanged for the owner).
- **Preserve query params** when re-pinning (merge, don't drop `?token`/etc.).
- **Avoid a visible double-load.** The first paint is the production iframe (SSR); the owner re-pin
  swaps to the draft fsId. Gate the swap so it's a single transition (no flash to production →
  draft → production), and skip it entirely when the owner's latest already _is_ production
  (no unpublished draft).

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
  - **Pinned semantics (Charlie review):** the switch's publish target is **the latest dev,
    selected ATOMICALLY on the server** (don't trust a client-passed fsId for the common case — the
    `fsId?` param is the CLI/`versions` "publish a specific version" path, owner-verified). **Do NOT
    demote old production rows** — they stay as history; the new top-of-stack production simply wins.
    **Preserve event parity:** publish emits `evt-new-fs-id` exactly like other production updates,
    so downstream consumers (Discord, caches, recency) react identically.
  - **Race / no-op acceptance:** concurrent publishes converge (the `MAX+1` allocation is atomic);
    publishing when the latest dev is already the highest production is a **no-op success** (clears
    to "Up to date" without minting a duplicate).
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

- **PR-D1 — owner draft read + indicator.** ✅ shipped (#2774). The resolver (§3a) + the route's
  owner-pin + draft indicator (§3b). The owner sees their latest draft on `/vibe`; everyone else
  unchanged.
- **PR-D2 — publish from the switch.** ✅ implemented. `publishApp` RPC (mints a new top-of-stack
  production at `MAX+1`, no demote, owner-auth, emits `evt-new-fs-id`) + the in-card Publish banner
  (`onPublish`/`publishing` on `UnifiedVibeCard`) + the route re-resolves the draft on success so
  the badge/banner clear and the iframe re-pins to the published version. Charlie's note — guard the
  async re-pin incl. query-param preservation — landed as `buildPinnedIframeUrl` + tests.
- **PR-D3 — CLI draft/published + versions.** `pull` owner-draft-default + `--published`, the
  `versions` command + access-any-version, `codegen-log` alignment (§3d). Depends on the resolver +
  `listVersions`.

D1 first (it's the principle); D2 and D3 follow and are independent of each other.

---

## 6. Decisions (Charlie review + jchris, 2026-06-28 — "agree with Charlie")

1. **Draft-read mechanism → route-pin** (not a viewer-aware entry-point). Guardrails in §3b.
2. **Draft indicator → a compact header badge** "Draft · unpublished" in the card header. Sketch in
   Storybook before building.
3. **Publish control → an in-card banner near the edit context** — state + action together
   ("unpublished changes · Publish"), not a bare nav button. Sketch before building.
4. **Publish target → the latest dev only** (selected atomically server-side); "publish a specific
   older version" stays a CLI/`versions` capability.
5. **CLI `versions` → a dedicated `versions` command**, with `pull --published` and `pull --fsId`
   as fast paths.
6. **Draft cleanup / GC** — dev rows accumulate (≈6.4k dev vs 6.5k production globally). Out of scope
   here; follow-up if it matters.

---

## 7. Test matrix + acceptance criteria (Charlie review)

Cover **owner / member / anon × route / CLI × before / after publish**:

| viewer × surface                     | before publish                 | after publish                               |
| ------------------------------------ | ------------------------------ | ------------------------------------------- |
| owner · `/vibe` (unversioned)        | latest dev (draft) + indicator | latest production, indicator clears         |
| anon/member · `/vibe` (unversioned)  | latest production              | latest production (now the published draft) |
| any · `/vibe/.../{fsId}` (versioned) | that exact fsId (NO re-pin)    | that exact fsId (NO re-pin)                 |
| owner · CLI `pull` (default)         | latest dev                     | latest production (= the published draft)   |
| owner · CLI `pull --published`       | latest production              | latest production                           |
| anon/member · CLI `pull`             | latest production              | latest production                           |
| CLI `versions`                       | lists dev + production rows    | reflects the new production release         |

Plus: **versioned-URL no-repin guarantee** (byte-for-byte unchanged for the owner); **publish race**
(concurrent publishes converge via atomic `MAX+1`); **publish no-op** (latest dev already highest
production → success, no duplicate row); **`getAppByFsId` no-regress** (existing no-`fsId` consumers
on `"published"` are unchanged).

---

## 8. Relationship to the epic

- Consistent with PR-A (in-place gen writes drafts) and PR-B (a non-owner fork creates a new owned
  vibe → the forker is the owner → sees their draft; publishes when ready). No conflict.
- This is the "draft/publish" half the in-place-gen feature implies; it makes the owner's edits
  legible (route + CLI) and shippable (publish), while keeping the public surface stable.
