# B — SharedSessions singleton DO (design + outline)

> **Status: design-level.** This track introduces net-new architecture and has
> open decisions (see below). Before executing, run `brainstorming` then
> `writing-plans` to turn this into a full TDD plan. Do **not** execute the
> outline below verbatim — it is a scaffold, not a step-by-step.

**Goal:** A singleton Durable Object (`idFromName("global")`) serving the
stateless, read-mostly D1 queries every page needs (the `sharedHandlers` set:
recent vibes, memberships, models, settings, `whoAmI`, user-notification
subscribe). Always warm. Removes the need to open a heavy `chatApi` (codegen) or
a `vibeApi` just for sidebar/settings data, and is the prerequisite for lazy
ChatSessions and Track C. Closes #2265 §2.

**Spec:** `../../specs/2026-06-20-do-split-finish-design.md` (Track B).

**Depends on:** ideally lands after A3 so connection-role changes stay isolated.
Independent of Tracks A1–A3 otherwise.

---

## Routing note (review correction, @chatgpt-codex-connector)

`/api/shared` must be dispatched by the **top-level worker**, not via
`resolveShardDO`. Today `route-decision.ts:36` matches `/api` and `/api/*`
(including `/api/shared`) as the generic `api-do` route, and `app.ts:126` sends
that to `env.CHAT_SESSIONS`. `resolveShardDO` is only used by `UserNotify`'s
fan-out (`user-notify.ts:109`), **not** by the fetch router. So Track B must add
a dedicated `/api/shared` Route (e.g. `shared-do`) in `route-decision.ts`
**before** the generic `/api/` branch, and a matching
`env.SHARED_SESSIONS.idFromName("global")` dispatch in `app.ts` — otherwise,
once `sharedHandlers` leave `chatMsgEvento`, these calls land on ChatSessions and
fail.

## Open decisions (resolve in brainstorm before planning)

1. **Singleton hot-shard contention.** One DO instance for _all_ read traffic.
   Cloudflare singleton DOs are single-threaded — measure expected QPS. If it
   saturates, shard `global:0..k` by a stable hash of userId and route in the
   client. Decide k (or "1 for now, instrument first").
2. **`subscribeUserNotifications` placement.** It is in `sharedHandlers` but is
   a subscription, not a one-shot read. Keep its fan-out on `UserNotify`
   (current home) and have SharedSessions only register the subscribe RPC, or
   move the whole thing? Default: leave notification fan-out on `UserNotify`.
3. **First-paint cost.** SharedSessions adds one more WS at page load. Confirm
   it replaces (not adds to) the `notifyApi`/`chatApi`-for-sidebar connections
   so net connection count drops.
4. **SSR.** Does any `sharedHandler` data need to be available during SSR
   (`vibe-route-ssr`)? If so, define the server-side fetch path.

---

## File map (provisional)

| File                                                                                                | Change                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Create `vibes.diy/pkg/workers/shared-sessions.ts`                                                   | singleton DO; serves `sharedMsgEvento`                                                                      |
| Create `vibes.diy/api/svc/shared-msg-evento.ts`                                                     | `sharedHandlers + WildCard/Error` only                                                                      |
| `vibes.diy/pkg/workers/app.ts`                                                                      | export `SharedSessions`                                                                                     |
| `vibes.diy/api/types/cf-env.ts`                                                                     | add `SHARED_SESSIONS: DurableObjectNamespace`                                                               |
| `vibes.diy/pkg/wrangler.toml` (6 blocks)                                                            | bind `SHARED_SESSIONS` + `v8 new_classes = ["SharedSessions"]`; cli cross-script → prod (like APP_SESSIONS) |
| `vibes.diy/pkg/workers/route-decision.ts` + `app.ts`                                                | **route `/api/shared` → `SHARED_SESSIONS`** (see routing note below) — new `shared-do` Route + dispatch     |
| `vibes.diy/pkg/workers/resolve-shard-do.ts`                                                         | add `shared:` prefix (only for `UserNotify` fan-out, **not** top-level request routing)                     |
| `vibes.diy/pkg/app/vibes-diy-provider.tsx`                                                          | add `sharedApi` to `VibesDiyCtx`, opened on every page → `/api/shared`                                      |
| `useRecentVibes.ts`, `useMemberships.ts`, settings routes, `list-models` callers, non-vibe `whoAmI` | move from `chatApi` → `sharedApi`                                                                           |
| `vibes.diy/api/svc/chat-msg-evento.ts`                                                              | drop `...sharedHandlers` (chat plane → `chatHandlers` only)                                                 |
| `vibes.diy/pkg/workers/chat-sessions.ts` + provider                                                 | make ChatSessions **lazy** (open on first prompt focus)                                                     |
| `vibes.diy/api/tests/evento-handler-parity.test.ts`                                                 | assert `sharedHandlers` only in `sharedMsgEvento`                                                           |

---

## Task outline (expand into TDD plan)

1. **Server: SharedSessions DO + evento.** New DO mirroring `chat-sessions.ts`
   structure but serving `sharedMsgEvento`; no doc ops, no streaming, no
   `invokeAccessFn`. Parity test: `sharedMsgEvento` set == `sharedHandlers`.
2. **wrangler: bind + `v8` migration in all six envs** (cli cross-script-binds
   prod like APP_SESSIONS/USER_NOTIFY). Per-env `--dry-run` gate. Deploy
   prod-before-cli.
3. **Top-level routing for `/api/shared`.** Add a `shared-do` Route in
   `route-decision.ts` (before the generic `/api/` branch) + an
   `env.SHARED_SESSIONS.idFromName("global")` dispatch in `app.ts`; extend
   `route-decision`'s tests. Also add the `shared:` prefix to `resolveShardDO`
   (for `UserNotify` fan-out) with a `resolve-shard-do.test.ts` case — these are
   two distinct mechanisms; do not conflate them.
4. **Client: `sharedApi` connection.** Add to context, open on every page to
   `/api/shared` with `skipShard: true` (singleton — no per-client shard).
5. **Client: migrate `sharedHandler` call sites** off `chatApi`/`notifyApi`
   onto `sharedApi`, route by route, each with a test asserting the target
   connection. Collapse `notifyApi` if SharedSessions subsumes it (per open
   decision 2).
6. **Server: chat plane → chat-only.** Remove `...sharedHandlers` from
   `chatMsgEvento`; ChatSessions now serves only `chatHandlers`. Parity test
   update.
7. **Lazy ChatSessions.** Stop constructing `chatApi` at page load; construct on
   first prompt focus. Verify non-chat pages open zero ChatSessions connections
   (network panel / a test on the provider).
8. **Verify + deploy + close #2265 §2.** `pnpm check`, dry-run, `qa-pr` preview
   smoke (sidebar/settings/models load with no chat connection until a prompt).

---

## Risks

- Singleton saturation (decision 1) — instrument before assuming 1 instance is
  enough; the `global:0..k` fallback should be designed in even if k=1 at launch.
- Migrating `sharedHandlers` call sites is broad; do it route-by-route with a
  per-route test, not one mega-commit.
- Lazy ChatSessions can regress flows that assumed a warm chat connection
  (notifications, title generation). Audit `useBuildCompletionNotifications`,
  `titleGenerator` for chat-connection assumptions.
