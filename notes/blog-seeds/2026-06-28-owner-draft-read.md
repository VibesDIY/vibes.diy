# Your draft is yours alone: owner-only draft read on `/vibe`

Source: #2772 PR-D1 (owner draft read + indicator), branch `claude/vibe-draft-publish`.
Spec: `docs/superpowers/specs/2026-06-28-vibe-draft-publish-design.md`. The first slice of the
draft/publish model that in-place generation (#2677 PR-A) implied.

Goal: after the owner generates in place on `/vibe`, their latest is a `dev` (draft) row while
the public still sees the last `production`. Give the **owner** a read of their own latest draft
— route + a "Draft · unpublished" badge — without changing what anyone else sees.

Findings worth a full post:

- **The principle that kept the diff small: "the only thing draft state changes is owner-only
  read."** No viewer-aware serving, no new gating in the worker entry-point. The public surface
  is byte-for-byte unchanged because the *server-side* resolution defaults to `published`. The
  owner's draft read is an **opt-in** (`selectMode: "ownerLatest"`) that only the `/vibe` route
  asks for, and the server only honors it for the authenticated owner. Additive, not a rewrite.

- **Explicit `selectMode`, never a silent default flip.** The tempting move is "make the
  resolver prefer the newest row." That would regress every share/published-state callsite that
  depends on production semantics. Instead `getAppByFsId` takes `selectMode?: "published" |
  "ownerLatest"`; existing no-`fsId` callers keep `published` (the default). The no-regress
  contract is a test, not a comment: "owner default still returns production."

- **Owner-only is enforced where ownership is actually known — the server.** `selectMode:
  "ownerLatest"` resolves the caller's newest row across modes, then checks `row.userId ===
  callerUserId`. A non-owner asking for `ownerLatest` falls back to `published` and never sees
  the draft. The "no leak" guarantee is a server check plus a test (`api2` asking ownerLatest
  gets `production`), not a frontend convention.

- **The badge needs no new response field — `mode` already encodes it.** `ownerLatest` returns a
  `dev` row exactly when there's an unpublished draft (newest-created wins; ties go to
  production so a stale tie never raises a spurious draft). So `res.mode === "dev"` *is* the
  draft signal: pin that fsId, show the badge. Publishing later mints a newer production row →
  newest-created → `mode: "production"` → the badge clears for free.

- **"Versioned URLs are never re-pinned" is a one-line function with a three-line test.** An
  explicit `/vibe/.../{fsId}` is a request to be honored. The pin decision is `fsId ?? draftFsId`
  — and `draftFsId` is only ever set when `fsId` is absent (the draft effect guards on it). That's
  double-guarded, but the guarantee is load-bearing enough (spec §7 acceptance) to extract into
  `pinnedIframeFsId()` and pin with a regression test, the same way PR-B extracted
  `forkDestination`.

- **Single transition, not a flash.** SSR paints the production iframe (correct for anon and for
  the owner's first paint). Then, once `isOwner` resolves and the draft fsId comes back, the
  iframe-sync effect re-pins once. When the owner's latest *is* already production, `draftFsId`
  stays unset and nothing moves. No production→draft→production flicker.
