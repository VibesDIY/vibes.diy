# `createVibe()` — meta-vibes (VibesDIY/vibes.diy#2690)

A `createVibe(prompt)` helper that lets a vibe hand a rich, pre-constructed prompt
to the builder, producing a second, personalized vibe as its output. The
motivating case is **interviewer vibes** (interview the user → generate the
artifact, pre-filled). Issue: VibesDIY/vibes.diy#2690.

## The decided behavior: button-gated, new tab

The open question in #2690 was whether a vibe should auto-navigate when it calls
`createVibe()`, or gate the hand-off behind an explicit click. **Decision
(jchris): button-gated, opens a new tab.** The interviewer stays open in the
original tab so the user can tweak and re-run; the builder opens alongside it.

This isn't just a UX preference — it's what the runtime sandbox allows. Vibes run
in an iframe whose `sandbox` (`vibes.diy/pkg/app/lib/iframe-policy.ts`) grants
`allow-popups` + `allow-popups-to-escape-sandbox` but **not**
`allow-top-navigation`. So the realistic mechanisms are:

- **New tab** via `window.open()` — works, but only from inside a user gesture
  (the popup blocker fires otherwise). A button satisfies that naturally.
- **Same-tab replace** — the vibe can't top-navigate; it would have to round-trip
  through the host over `postMessage` (a new RPC), and the async hop means it
  can't reliably open a *new* tab. Deferred.

Button-gated + new tab is the only combination that needs zero new platform
plumbing and no new sandbox token, so it ships as Phase 1.

## What shipped (Phase 1)

- `createVibe(prompt, options?)` and `buildCreateVibeUrl(prompt, baseURL?)` in
  `vibes.diy/vibe/runtime/create-vibe.ts`, exported from `@vibes.diy/vibe-runtime`
  (the sandbox alias target for `use-vibes`) and re-exported from
  `@vibes.diy/use-vibes-base` + the `use-vibes` npm package — same export path as
  `useViewer`.
- Encodes the prompt with the **same `sthis.txt.base64` codec the builder decodes
  with** (`routes/chat/prompt.tsx`), and targets **`/chat/prompt?prompt64=`** —
  the route that actually consumes the param. (The issue's sketch wrote
  `/?prompt64=`; the bare homepage ignores it, so we use `/chat/prompt`.)
- A ~6,000-char safe-URL-length guard that warns (but still proceeds) on very long
  prompts.
- A `create-vibe` skill (`prompts/pkg/llms/create-vibe.{ts,md}`), registered in
  the catalog so the pre-alloc step can select it for interviewer/meta-vibe
  requests — making `createVibe` a first-class primitive the codegen knows, the
  same way it knows `callAI` / `useFireproof`. It is **not** a default skill (only
  pulled in when the request implies a meta-vibe).

## Phase 2 (when URL length bites)

A rich brief can run a few thousand chars; base64 inflates it ~4/3, so the URL can
approach the ~8 KB practical limit. When that bites, swap the helper's body to POST
the prompt and redirect to a short id — **call sites stay identical**:

```js
async function createVibe(prompt) {
  const { id } = await fetch("/api/pending-prompt", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  }).then((r) => r.json());
  window.open(`https://vibes.diy/?pending=${id}`, "_blank");
}
```

Needs: a `/api/pending-prompt` endpoint that stores a prompt short-term (TTL) and
returns an id, plus builder support for `?pending=<id>` (look up → behave like
`prompt64`). Not urgent until we see URL truncation in the wild.

## Future: same-tab / host-driven hand-off

If we later want a same-tab hand-off (or a more controlled transition), add a
`vibe.req.createVibe` RPC so the host performs the navigation — mirrors the
existing `requestLogin()` bridge in `register-dependencies.ts`. Deferred; not
needed for the interviewer pattern.
