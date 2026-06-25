# Heavy vs light sessions — route img-gen + callAI streaming off the per-vibe app session — design

## Summary

Image generation is broken on prod (`vibes-diy@p2.5.4`): a running vibe that calls `ImgGen` gets back

```
Not Implemented: {"src":"…/api/app?vibe=garden-gnome--story-crossroads","payload":{"mode":"img","type":"vibes.diy.req-open-chat",…}}
```

The proximate cause is a handler-registration gap. The deeper question — the reason this is a _design_ doc and not a one-line fix — is **where heavy, per-user work (image generation, runtime `callAI`) should run**: on the warm, shared, per-vibe **app session**, or on a cold, sharded **chat/heavy session**.

This spec argues the platform already has the right two-plane split (it's documented in [`agents/do-session-split.md`](../../../agents/do-session-split.md)); #2306 routed img _streaming_ to the wrong plane; and the fix is to treat streaming/compute as **heavy-session** work while keeping the persisted result on the **light** (app) session for live delivery. The maintainer-confirmed requirement — _generated content only needs to appear live for the user who triggered it_ — means **no cross-DO `evt-doc-changed` coordinator is required** to ship this.

## Background: the two planes already exist

Worker routing ([`pkg/workers/app.ts:101-108`](../../../vibes.diy/pkg/workers/app.ts)):

```js
// app-api  → /api/app?vibe=…
const id = env.APP_SESSIONS.idFromName(vibe); // keyed by VIBE SLUG
// api-do   → /api?shard=…
const id = env.CHAT_SESSIONS.idFromName(shard ?? crypto.randomUUID()); // keyed by RANDOM UUID
```

| Plane                 | Binding         | Shard key   | Topology                                 | Temp     | doc-changed delivery                                                  |
| --------------------- | --------------- | ----------- | ---------------------------------------- | -------- | --------------------------------------------------------------------- |
| **Light** = `vibeApi` | `APP_SESSIONS`  | `vibe` slug | **one DO per app**, all viewers share it | **warm** | local broadcast to co-located viewers — its whole job                 |
| **Heavy** = `chatApi` | `CHAT_SESSIONS` | random UUID | **one DO per connection**                | **cold** | none local (`guarded no-op`); only cross-DO fan-out via `USER_NOTIFY` |

This is exactly the "light session | heavy session" model: the warm per-vibe DO is a cheap **fan-out hub** (many viewers, one isolate, broadcast doc-changed); the cold sharded DO is a **compute lane** (one connection, scales horizontally without bound). The target architecture in [`agents/do-session-split.md`](../../../agents/do-session-split.md) already scopes `ChatSessions` to _"openChat, promptChatSection, streaming only."_

### Current routing of the three open-chat modes

[`open-chat.ts`](../../../vibes.diy/api/svc/public/open-chat.ts) handles all three modes; the difference is which **connection** the client opens it on ([`vibe/srv-sandbox/srv-sandbox.ts`](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts)):

| Flow              | Mode   | Opens on  | Lands on             | Status                 |
| ----------------- | ------ | --------- | -------------------- | ---------------------- |
| Builder / codegen | `chat` | `chatApi` | ChatSessions (heavy) | ✅ correct             |
| Runtime `callAI`  | `app`  | `chatApi` | ChatSessions (heavy) | ✅ works               |
| Runtime `imgGen`  | `img`  | `vibeApi` | AppSessions (light)  | ❌ **Not Implemented** |

`openChat` + `promptChatSection` are registered only in `chatHandlers` ([`evento-handler-manifest.ts`](../../../vibes.diy/api/svc/evento-handler-manifest.ts)); the light session's evento (`appMsgEvento`) loads `sharedHandlers + appHandlers` only, so an `img`-mode `req-open-chat` falls through to the WildCard → `Not Implemented`. `callAI` was left on `chatApi`, which masked the gap.

## Why #2306 moved img — and why it over-reached

[#2306](https://github.com/VibesDIY/vibes.diy/issues/2306) ("close the silent ChatSession leak") correctly established: **vibe document writes must ride `AppSessions`**, because `ChatSessions` deliberately wires no `localBroadcast`, so a `putDoc` there persists but never emits — live cross-user sync dies silently. That rule is right for **doc ops**.

But img-gen's `openChat`/`prompt` are **streaming**, not doc ops, and got swept along (the doc's own open-question #3 flagged this as unresolved: _"imgGen moves to vibeApi; should callAI also move, or stay on the user/chat session?"_). Two facts show the streaming move was unnecessary:

1. **The image bytes go to the abstract, content-addressed asset store, not DO-local storage.** `storeAndAuditAsset` ([`store-and-audit-asset.ts`](../../../vibes.diy/api/svc/public/store-and-audit-asset.ts), called from [`prompt-chat-section.ts`](../../../vibes.diy/api/svc/public/prompt-chat-section.ts)) writes through a storage abstraction whose backend varies by context (its internals are out of scope here). The only property this design relies on is the abstraction's contract: assets are **CID-addressed and retrievable by CID from any DO**, independent of which session generated them — so the streaming-plane choice does not constrain storage.
2. **The only thing that must broadcast is the final Fireproof doc**, and the client already writes that over `vibeApi` (the data path #2306 correctly fixed). The server-side `imgGen` handler returns image file refs to the iframe; the `ImgGen` component persists the doc.

So the streaming and the persist are **separable**: stream on heavy, persist on light.

## The physics argument

- **Cold-start is negligible against the work.** Image gen and LLM streams take seconds; a DO spin-up is in the noise. Heavy work gains almost nothing from a warm host.
- **A per-vibe DO is a single isolate — a bad place to run N concurrent streams.** It's optimized for cheap high-fan-out broadcast, not for holding many in-flight LLM/image jobs (memory pressure from image blobs, head-of-line). A popular slug would funnel _every_ user's generation through one DO. Routing img to AppSessions (per-vibe) _manufactures_ the scale wall the maintainer flagged.
- **Therefore: heavy work belongs on a sharded lane, light work on the warm hub.** `callAI` is already there; img should join it.

### The shard-key lever (the real design choice)

"App vs chat session" understates the options. The lever is the **heavy-session shard key**:

| Key                               | DOs                     | Scale                    | Warmth                           | Notes                                             |
| --------------------------------- | ----------------------- | ------------------------ | -------------------------------- | ------------------------------------------------- |
| `idFromName(vibe)`                | one per app             | bottlenecked by hot slug | warm                             | where #2306 put img — wrong for heavy             |
| `idFromName(randomUUID)`          | one per call/connection | unbounded                | always cold                      | current `chatApi` / codegen                       |
| `idFromName(user)` or `user+vibe` | one per user(+app)      | scales with users        | **warm within a user's session** | the missing middle — best for per-user heavy work |

Recommendation: route img + callAI to the **heavy** session, and evaluate keying it **per-user** (or `user+vibe`) rather than the current per-call UUID, so a user's repeated generations reuse a warm DO while a hot app still spreads load across users.

## Result delivery (resolved)

Requirement (maintainer-confirmed): **generated content only needs to appear live for the triggering user.** Other concurrent viewers may see it eventually (on next query), not necessarily in real time.

Delivery path under the proposed design:

1. Heavy session generates the image, stores bytes to shared R2 (CID), streams the section events (with the image ref) **back to the triggering iframe** over its own connection — the user sees their result immediately, regardless of plane.
2. The `ImgGen` component persists the resulting Fireproof doc over **`vibeApi`** (light/AppSessions), whose `localBroadcast` reaches that user's app connection (and any co-located viewers) live.
3. Other viewers converge via the existing data path; **no `evt-doc-changed` coordinator DO is needed.** (The parked coordinator would only be required for live cross-viewer multiplayer generation — explicitly out of scope here.)

## Proposed design

1. **Route `imgGen` streaming to `chatApi` (heavy)**, alongside `callAI` — reverting #2306's transport move for the _streaming_ calls (`openChat`/`prompt`) while **keeping vibe doc ops on `vibeApi`** (that part of #2306 stays).
2. **Unify the runtime-AI rule:** both `callAI` and `imgGen` _stream on the heavy session_ and _persist results via the light session_. Document this as the canonical split.
3. **(Enhancement, separable) Heavy shard key per-user.** Evaluate `idFromName(user)` / `user+vibe` for the heavy session to amortize cold starts without reintroducing a per-vibe bottleneck.
4. **Adopt "light / heavy session" as the mental model** layered over `vibeApi`/`chatApi`, and fold it into [`agents/do-session-split.md`](../../../agents/do-session-split.md).

## Fallout / migration

- Fixes the prod `Not Implemented` and removes the per-vibe img bottleneck.
- Interplays with do-session-split [#2263](https://github.com/VibesDIY/vibes.diy/issues/2263) step 5 ("remove `appHandlers` from `chatMsgEvento`"): `openChat`/`promptChatSection` **stay** chat-only; the change is on the _client_ (which connection img opens on), not the manifest.
- Verify the `ImgGen` client's `putDoc` is guaranteed on `vibeApi` post-#2306, and that the iframe receives the image ref over the heavy stream.
- No schema, no DO-binding, no wrangler changes anticipated — primarily a client-routing change in `srv-sandbox`.

## Out of scope

- **`evt-doc-changed` coordinator DO** — not needed for triggering-user-live delivery.
- **Live cross-viewer multiplayer generation** — would need the coordinator; revisit only if the visibility requirement changes.
- **Headless/CLI transport** — already canonical on `/api/app` (#2303/#2304).
- **Asset-store backend internals** — the storage abstraction is pluggable; this design depends only on its CID-addressed contract, not on any backend.

## Open questions

1. **Heavy shard key:** per-user vs per-call vs `user+vibe`? `callAI` carries user auth/billing — does per-user keying simplify or complicate metering?
2. **Does `callAI` need anything in the data plane**, or is it pure request/response streamed back to the caller? If pure, it never needs `vibeApi` at all.
3. **Exact `ImgGen` persist site:** confirm the component's `putDoc` rides `vibeApi` in every render path (viewer `/vibe/` and editor `/chat/`).
4. **Laziness:** do-session-split wants `chatApi` lazy (open on first prompt focus). For a vibe whose _first_ action is image gen, what opens the heavy connection, and does that add first-image latency worth pre-warming?
5. **Stopgap vs full move:** is it worth landing the trivial registration fix (put `openChat`/`prompt` reachable on the app session) to unblock img _today_ while this design is reviewed, or go straight to the client-routing change?
