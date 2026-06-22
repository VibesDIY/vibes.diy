# SharedSessions DO (Track B) — design

**Date:** 2026-06-22
**Tracking:** #2265 §2 (SharedSessions singleton DO)
**Parent:** [`2026-06-20-do-split-finish-design.md`](2026-06-20-do-split-finish-design.md) (Track B), living architecture doc [`agents/do-session-split.md`](../../../agents/do-session-split.md)
**Status:** Design approved — pending `writing-plans` expansion into a TDD plan.

## Plain-language summary

Today every page opens a heavy `chatApi` WebSocket to a `ChatSessions` DO just
so the shell can run a handful of stateless page-load queries (recent vibes,
memberships, model list, settings, grants, the messages inbox). That DO also
carries the full codegen/streaming machinery and a QuickJS isolate the page
never touches. This track adds a lightweight **`SharedSessions`** DO that serves
_only_ `sharedHandlers`, moves the page-load reads onto it, makes `chatApi`
**lazy** (opens on first prompt), and turns `ChatSessions` chat-only. Net result:
**every page drops to a single eager WebSocket**, and the heavy chat connection
is gone until the user actually starts a chat.

## Background — why this is safe to factor out

`sharedHandlers` (`api/svc/evento-handler-manifest.ts:60`) are stateless D1/storage
reads with no per-connection state: slug/app listing, model list, settings,
grants/invites/membership, `whoAmI`, DM thread listing, asset-upload grants,
access-fn source. They already run on **two** DO classes — the chat plane
(`chatPlaneHandlers = [...sharedHandlers, ...chatHandlers]`,
`api/svc/chat-msg-evento.ts:12`) and AppSessions
(`appMsgEvento = [...sharedHandlers, ...appHandlers, ...imgGenAppSessionStopgapHandlers]`,
`api/svc/app-msg-evento.ts:9`). Because they hold no state, a third home that
serves them in isolation is behaviourally identical — the parity tests in
`api/tests/evento-handler-parity.test.ts` are the contract.

## Target architecture

### One DO, addressed by plane and identity

`SharedSessions` is the **non-vibe-plane** DO. It never opens alongside
`vibeApi`, because `vibeApi` (AppSessions) already serves every `sharedHandler`.
The client exposes a single `sharedApi` handle that the call sites use without
caring how it is backed; the provider resolves it by route + auth:

| Route                                  | Auth   | `sharedApi` backing                                                                       | Eager connections (chat lazy) |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------- | ----------------------------- |
| Vibe (`/vibe/…`, `/chat/…` w/ appSlug) | any    | `vibeApi` (AppSessions) — reads + notify, unchanged                                       | **1** — `vibeApi`             |
| Non-vibe                               | authed | `SharedSessions` per-user shard `idFromName(userNotifyShardFor(userId))` — reads + notify | **1** — per-user shard        |
| Non-vibe                               | anon   | `SharedSessions` singleton `idFromName("global")` — reads only                            | **1** — `global`              |

Compared with today (`chatApi` heavy on every page, plus `vibeApi`/`notifyApi`),
every page collapses to one eager WebSocket and the heavy `chatApi` is deferred.

### Sharding: authed reads ride the user's own shard

`global` is **not** a hot singleton for everyone — it is the **anonymous
fallback only**. Authed reads shard by user via the _same_ shard the user's
notifications already use (`userNotifyShardFor(userId)`), so a signed-in user
does all shared-plane traffic (reads **and** notify) over a **single** per-user
connection with natural load distribution and read/notify locality on one DO
instance/colo — exactly the shape per-vibe AppSessions already runs in prod.

A client seam `sharedReadShardFor()` returns `userId ? userNotifyShardFor(userId)
: "global"` and is consulted **only on non-vibe routes**. It is the single place
to later re-bucket `global` into `global:0..k` if anonymous load ever warrants
it — instrument before assuming, but no bucketing logic is built now.

### Notifications: `notifyApi` as a distinct connection disappears

The notify subscription rides whichever shared-plane connection the page already
holds — `vibeApi` on vibe routes, the per-user `SharedSessions` shard on
non-vibe routes — registered **once per page**.
`useBuildCompletionNotifications` picks `vibeApi ?? sharedApi`. The separate
`notifyApi` ChatSessions shard is removed.

The **fan-out hub stays on `UserNotify`** — it is the plane-agnostic mailbox: a
producer (doc change, build completion) posts to the stable `notify-user-<userId>`
address without knowing which plane(s) the user currently holds, and UserNotify
fans out to every registered shard across AppSessions **and** SharedSessions. The
WS-holding + `registerUserSubscription` for the non-vibe plane moves to
`SharedSessions` (mirroring what AppSessions already does for the vibe plane);
the fan-out hub does **not** move. Collapsing the hub into one plane's shard
would break delivery to a user connected on two planes at once and merely
relocate the fan-out one hop.

> **Future (out of scope):** the per-user SharedSessions shard and `UserNotify`
> are now both 1:1 with `userId`. A later consolidation could let SharedSessions
> absorb UserNotify and hold the cross-plane registry itself. UserNotify is
> shared infra on the vibe/doc path, so that is a separate, larger-blast-radius
> change — file as follow-up, not here.

### Re-home the non-prompt `chatHandlers` first (prerequisite)

`chatHandlers` is not all prompt/codegen. It still holds **stateless,
identity/settings-scoped** ops that non-chat pages call on load/save:

- `listHandleBindingsEvento` / `createHandleBindingEvento` /
  `deleteHandleBindingEvento` — user-slug bindings. Called on `chatApi` from
  `settings.tsx` (load + the create/delete save paths), `messages.tsx`,
  `messages.$ownerHandleA.$ownerHandleB.tsx`, `useChatOwnership.ts`,
  `DataView.tsx`, and the vibe route.
- `getCertFromCsrEvento` — custom-domain cert issuance, called from
  `settings/csr-to-cert.tsx`.
- `report*Evento` (×7, growth/analytics) — called from the reporting dashboard,
  also a non-chat page.

If `chatApi` is lazy and `SharedSessions` serves only `sharedHandlers`, these
calls have **no usable connection** on a settings/messages page; conversely, if
the page keeps opening `chatApi` to reach them, the "zero ChatSessions on
non-chat pages" invariant is false. (Caught in review — Codex P2.)

Resolution: **move these handlers from `chatHandlers` → `sharedHandlers`**, the
same factoring A2 already did for `listDmThreads` + `assetUploadGrant` (manifest
comment, `evento-handler-manifest.ts:91-98`). They are stateless D1 ops with no
per-chat-session/QuickJS state and are user/identity-scoped — the exact
`sharedHandlers` category — so SharedSessions (and AppSessions) serve them
unchanged, and the parity tests move with them. This lands **before** making
`chatApi` lazy, so the lazy step never strands a caller. After the move, what
remains in `chatHandlers` is genuinely chat-only: `openChat`, `promptChatSection`,
`ensureAppSlugItem`, `getChatDetails`, `listApplicationChats`, `forkApp`,
`setModeFsId`.

### ChatSessions → chat-only + lazy

- `chat-msg-evento.ts`: `chatPlaneHandlers` becomes `[...chatHandlers]` only
  (drop `...sharedHandlers`). Update `evento-handler-parity.test.ts` so the
  contract is "`sharedHandlers` never in the chat plane" (it already asserts
  `appHandlers` never re-enters the chat plane). ChatSessions keeps its local
  QuickJS for the app-create access-binding backfill (that is `chatHandlers`).
- Provider stops constructing `chatApi` eagerly; build it lazily on the first
  **remaining chat-handler** call (`openChat`/`promptChatSection`/app-create),
  not merely on prompt focus — a belt-and-suspenders guard so any overlooked
  chat-handler caller still triggers connection setup rather than erroring.
  `srvVibeSandbox` (today fed `chatApi`) takes it through the same lazy getter.
  Verify non-chat pages (settings, messages, reporting) open **zero**
  ChatSessions connections — which the re-homing above is what makes true.

## Server-side pieces

### Routing (the known gotcha)

- `route-decision.ts`: new `shared-do` Route matched **before** the generic
  `/api/` branch (`pathname === "/api/shared" || startsWith("/api/shared/")`).
  New `route-decision` test.
- `app.ts`: dispatch `shared-do` → `shard ? SHARED_SESSIONS.idFromName(shard) :
SHARED_SESSIONS.idFromName("global")`. Export `SharedSessions` from `app.ts`.
- `resolve-shard-do.ts`: add a `shared:` prefix → `SHARED_SESSIONS` **for
  UserNotify fan-out only** (non-vibe delivery). SharedSessions'
  `registerUserSubscription` registers `shared:<shard>` so UserNotify routes
  delivery back to it — mirroring the existing `app:` prefix for AppSessions.
  Vibe delivery keeps fanning to `app:<vibeKey>`. New `resolve-shard-do` case.
  These two mechanisms (top-level route vs. fan-out prefix) stay distinct.

### The DO and its evento

New `vibes.diy/pkg/workers/shared-sessions.ts` (`SharedSessions`) +
`vibes.diy/api/svc/shared-msg-evento.ts` serving
**`sharedMsgEvento = [...sharedHandlers]` + WildCard/Error only** — no doc ops,
no streaming, no codegen QuickJS. Parity test: `sharedMsgEvento`'s handler set
== `sharedHandlers`. It also carries the two notification pieces currently in
`chat-sessions.ts`: the `userNotifyCallbacks` (register/deregister, gated by
`isUserNotifyShard`) and the `POST /user-notify` fan-out delivery loop (filter
`subscribedUserKey === targetUserId`).

### No SSR path

`app.ts` SSR uses `getVibeRouteHints` (direct D1 via `vibesCtx`), not DO RPCs.
All `sharedHandler` data loads client-side post-hydration, same as today — no
server-side SharedSessions invocation is added.

## Client wiring (`vibes-diy-provider.tsx`)

- Add `sharedApi` to `VibesDiyCtx`, resolved per the table above.
- Remove the standalone `notifyApi` connection; notify subscription rides
  `vibeApi ?? sharedApi`.
- Migrate `sharedHandler` call sites off `chatApi` → `sharedApi`, **route by
  route, each with a test asserting the target connection**: `useRecentVibes`,
  `useMemberships`, `listModels` callers, settings routes, `whoAmI`,
  `listDmThreads` (messages inbox), `assetUploadGrant` (HandleAvatarEditor),
  grants/invites/membership RPCs, `accessFnSource`, and the newly re-homed
  `listHandleBindings`/`createHandleBinding`/`deleteHandleBinding` (settings,
  messages, `useChatOwnership`, `DataView`), `getCertFromCsr`
  (`settings/csr-to-cert`), and the `report*` analytics calls.

## wrangler / migration

- Bind `SHARED_SESSIONS` + `v8 new_classes = ["SharedSessions"]` in all six env
  blocks (keep `v1..v7`). Add to `cf-env.ts`.
- cli cross-script-binds prod (`script_name = "vibes-diy-v2-prod"`), same pattern
  as `APP_SESSIONS` / `USER_NOTIFY`.
- Per-env `wrangler deploy --dry-run` gate. **Deploy prod before cli** (cli's
  cross-script binding requires the prod class to exist first).

## Decisions (settled)

1. **Singleton vs. shard** → reads shard by user (`userNotifyShardFor`);
   `global` is the anon fallback; `SharedSessions` opens **only on non-vibe
   routes**. Seam (`sharedReadShardFor`) left in to re-bucket `global` later.
2. **`subscribeUserNotifications`** → fan-out hub stays on `UserNotify`;
   SharedSessions/AppSessions hold the WS + register the subscription.
3. **Connection count** → `chatApi` lazy everywhere, ChatSessions chat-only;
   `notifyApi` removed; every page is one eager WebSocket.
4. **SSR** → no server-side path needed.

## Risks

- **Anon `global` saturation** — instrument before assuming k=1 holds; the
  re-bucket seam is designed in. Authed traffic is already sharded, so this is
  bounded to logged-out browsing.
- **Broad call-site migration** — route-by-route with per-route
  connection-target tests, not one mega-commit.
- **Lazy ChatSessions regressing warm-connection assumers** — audit
  `srvVibeSandbox`, `titleGenerator`, `useBuildCompletionNotifications` (the last
  already off `chatApi`).

## Out of scope

- Track C (`/chat/` route deprecation) — separate spec; unblocked by lazy
  ChatSessions landing here.
- SharedSessions absorbing `UserNotify` (future consolidation, see note above).
- Building the `global:0..k` bucketing logic (seam only; instrument first).
