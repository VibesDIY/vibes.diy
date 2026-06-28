# Make-it-yours without leaving the page: the seamless non-owner fork

Source: #2677 PR-B (seamless non-owner fork on `/vibe`), branch `claude/in-vibe-nonowner-fork`.
Plan: `docs/superpowers/plans/2026-06-28-pr-b-nonowner-fork.md`. Built subagent-driven, TDD,
two-stage review per task.

Goal: when a signed-in non-owner edits a vibe they don't own, fork it to their handle **in
place** and generate their change in the copy — no hop to `/remix` or `/chat`. The card stays
mounted; the URL becomes `/vibe/$yours/$forkSlug`; the iframe de-blurs into the fork.

Findings worth a full post:

- **The hard constraint shapes the whole flow.** A non-owner literally cannot write the owner's
  chat — the server rejects on a `userId` mismatch. So you can't "generate first, fork on
  save." The fork has to complete and the URL has to *be* the fork before any codegen opens.
  The design falls out of that: fork inline → `navigate(replace)` to the fork's `/vibe` →
  auto-fire there. The constraint isn't a footnote; it's the architecture.

- **No new backend — `forkApp` already is make-it-yours.** The `/remix` route already calls
  `chatApi.forkApp` (code-only copy → your handle, `remixOf` anchor). PR-B reuses it verbatim
  and just changes the *destination*: land on `/vibe` (not `/chat`) and auto-generate. The
  whole slice is frontend-only.

- **The prompt rides along the URL, not a closure.** The non-owner's typed change is base64'd
  into `?prompt64` on the fork's `/vibe` URL (the same hand-off `/remix`→`/chat` used). The
  forked page decodes it once `isOwner` resolves true and fires `generation.sendPrompt` — then
  scrubs the param. Carrying it through the URL (vs. component state) means it survives the
  navigation and any re-render cleanly.

- **`isOwner` is the safety gate, twice.** PR-A's hook is `enabled: isOwner`, and the auto-fire
  effect is *also* gated on `isOwner`. On the owner's source vibe a non-owner is `isOwner:
  false`, so neither the chat opens nor the prompt fires there. The codegen only ever happens
  on a page the viewer owns. One predicate enforces the hard constraint at both layers.

- **One-shot refs and reused route components don't mix.** The auto-fire guard was a
  `useRef(false)` "fire once" — but React Router *reuses* the `/vibe` component across
  vibe→vibe nav, so a second fork in the same session found the ref still `true` and silently
  dropped the prompt. Same bug class PR-A hit with its reducer. The fix is the same discipline:
  reset the ref in the slug-keyed effect. Lesson: any "once per page" ref on a reused route
  must reset on the route key, or it's "once per session" by accident.

- **Scoping the seam: signed-in seamless, logged-out keeps `/remix`.** The seamless inline fork
  needs a signed-in user (you can't fork anonymously). Rather than rebuild the login round-trip,
  logged-out non-owners keep the existing `/remix` hop (which already does login→fork→prompt).
  The win lands where it's cheap; the logged-out seamless path is a deliberate follow-up.
