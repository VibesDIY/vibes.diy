# Per-User Codegen Shard + Admission-Control Auto-Roll — Design

**Status:** design, pre-implementation
**Issue:** TBD (file before implementation)
**Predecessors (shipped):** [#2714](https://github.com/VibesDIY/vibes.diy/issues/2714) — declarative shard-keyed API (`ShardKind`, `SHARD_POLICY`, branded shard keys); #2265 Track B — per-user `notify-user-<uid>` shared shard.

## Summary

Today every website chat session opens the heavy **codegen** Durable Object on a fresh `crypto.randomUUID()` shard (`vibes.diy/api/impl/index.ts:290`, `vibes.diy/pkg/workers/app.ts:160`). A brand-new DO is cold on every chat, which is the 10–15s "waiting for the chat API to become available" the user experiences. The random sharding exists on purpose — to keep one heavy codegen stream per DO so concurrent load can't exhaust a single instance (`index.ts:284`).

This spec improves **website** cold-start by pinning each authenticated user to a **deterministic per-user codegen shard** (so the 2nd+ chat rejoins their already-warm DO), and re-earns the CPU isolation the random sharding gave us with **admission control + a deterministic auto-roll**: the codegen DO admits at most **3 concurrent codegen streams**; the 4th gets a coded `shard-overloaded` `ResError`, and the client deterministically rolls to the next shard in the user's shard family and retries.

The **CLI is unchanged** — it never passes a `shardKey`, so it keeps the random-UUID-per-connection behavior, and never participates in the roll. The feature is opt-in through the existing `shardKey` seam.

## Decisions (locked)

| Decision              | Choice                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website codegen shard | Deterministic per-user: `userNotifyShardFor(userId)` (the existing `notify-user-<uid>` string), deferred until `clerk.loaded` (mirror `deferredSharedReadShard`) |
| Anonymous users       | Keep `crypto.randomUUID()` (no stable identity to pin to)                                                                                                        |
| CLI                   | Unchanged — never passes `shardKey`, never rolls                                                                                                                 |
| Admission limit       | **3** concurrent **codegen streams** per DO instance; 4th admission attempt is rejected                                                                          |
| Overload signal       | Server **sends** a coded `ResError` `code: "shard-overloaded"` and stops dispatch (does NOT rely on catching a hard CF CPU/memory limit)                         |
| Counted unit          | In-flight codegen streams (`open-chat` / `prompt-chat-section` with a codegen mode), not open WebSocket connections                                              |
| Next-shard function   | `base` for n=0; `` `${base}~${n}` `` for n≥1, monotonically increasing                                                                                           |
| Roll trigger          | Client receives `shard-overloaded` (or the open handshake fails on a pinned shard)                                                                               |
| Roll stickiness       | Persist the current index in `sessionStorage` keyed by user, so reconnects/reloads land on the working shard, not back on `~0`                                   |
| Shard mutability      | The `VibesDiyApi` instance rewrites its own `?shard=` and reconnects; the provider's URL-keyed instance cache key stays the **original** per-user URL            |

### Why 3, and why streams not connections

The random-UUID scheme effectively allowed **1** heavy stream per DO. Pinning per user means a single user's tabs/devices now share one DO, so we need headroom > 1 but small enough that a user can't monopolize codegen capacity. **3** gives a normal user room for a couple of concurrent generations (e.g. two tabs, or a retry overlapping a stream) while still bounding a single DO's heavy load. The limit counts **active codegen streams**, not open connections — idle WebSocket connections cost almost nothing; what needs isolation is concurrent heavy generation (`agents/do-session-split.md`, `index.ts:284`).

## Architecture

### 1. Per-user pinning (browser only)

`vibes.diy/pkg/app/vibes-diy-provider.tsx:254-268` builds the lazy `chatApi`. Today it passes `shardKey` only on `/vibe/...` viewer routes and leaves it `undefined` (→ random UUID) on chat/codegen routes. Change: on the website, when Clerk is loaded and a user is present, pass a per-user codegen shard.

```ts
// vibes-diy-provider.tsx — chatApi factory
const codegenShard = clerk.loaded && clerk.user?.id ? userNotifyShardFor(clerk.user.id) : undefined;
const shardKey = vibeMatch ? `${vibeMatch[1]}--${vibeMatch[2]}` : codegenShard; // anon → undefined → random UUID
```

- The `chatApi` is a lazy proxy (`makeLazyChatApi`), so deferring the shard decision until `clerk.loaded` costs no extra socket — same reasoning as `deferredSharedReadShard` (`pkg/app/shared-read-shard.ts:24`).
- Base shard string is exactly `userNotifyShardFor(userId)`, so it **already satisfies** the per-user notify-registration guard (`session-callbacks.ts:88`) for `n=0`.
- CLI path (`vibes-diy/cli/main.ts:67`) passes no `shardKey` → `crypto.randomUUID()` in `index.ts:294`. Untouched.

### 2. Admission control in the codegen DO

The DO is the unified `Sessions` class (`vibes.diy/pkg/workers/sessions.ts`); the codegen branch is `sessions.ts:125-134`, dispatching via `chatMsgEvento`. The instance already holds `this.connections: Set<WSSendProvider>`. Add a per-instance counter for **active codegen streams**.

- A small `CodegenAdmission` holder on the DO instance: `activeStreams: number` (in-memory; resets on DO eviction, which is correct — an evicted/cold DO has zero active streams).
- Gate the codegen stream entry points — `open-chat` (`api/svc/public/open-chat.ts`) and `prompt-chat-section` (`api/svc/public/prompt-chat-section.ts`) — **only for codegen modes** (`chatShardsForMode(req.mode)` includes `"codegen"`; img-gen/runtime are out of scope here). At the point a stream is about to start:
  - if `activeStreams >= MAX_CONCURRENT_CODEGEN_STREAMS (3)` → send `ResError { code: "shard-overloaded" }` and return `EventoResult.Continue` (same fail-loud-and-stop shape as `shard-gate.ts:70`), **without** starting generation.
  - else increment, run the stream, and decrement in a `finally` (covering completion, error, and WS close mid-stream).
- `MAX_CONCURRENT_CODEGEN_STREAMS` and the `"shard-overloaded"` code live in `api-types` next to `SHARD_POLICY` so client and worker share one source of truth.

This is admission control, not crash-detection: the limit is enforced _before_ heavy work, so the signal is deterministic and testable, and we never depend on surviving a hard CF CPU/memory kill to emit it.

### 3. Deterministic next-shard family + generalized guard

`userNotifyShardFor(userId)` (`api/types/notifications.ts`) currently returns a single string; `session-callbacks.ts:88` guards with **exact equality** (`shard !== userNotifyShardFor(userId)`). Rolled shards (`notify-user-<uid>~1`) must (a) be addressable and (b) still pass the per-user guard so notify registration and the "one shard family per user" anti-forgery bound hold.

- Add to `api-types/notifications.ts`:
  - `codegenShardForUser(userId, n)` → `n===0 ? base : ` `` `${base}~${n}` `` (single source for the family).
  - `shardBelongsToUser(shard, userId)` → true if `shard === base || shard.startsWith(`${base}~`)` with a numeric suffix.
- Replace the exact-equality checks in `session-callbacks.ts:88` and `:98` with `shardBelongsToUser(shard, userId)`. This keeps the anti-forgery property (a client still can't register a shard outside its own user's family) while admitting rolled shards.
- Registration semantics on a rolled shard: build-complete `notifyUser` already fires unconditionally (`session-callbacks.ts:67`); on the website, notifications ride `sharedApi`, not the codegen shard, so the roll does not change notification delivery. The guard generalization is about _not silently warning/no-oping_ on legitimate rolled shards.

### 4. Rollable client connection

The shard is baked into `cfg.apiUrl` at construction (`index.ts:290`), `cfg` is readonly, and the provider caches instances by URL (`vibesDiyApis.get(apiUrl).once()` in `vibes-diy-provider.tsx`). To roll without churning the cache key:

- Track a mutable `currentShardIndex` and a `baseApiUrl` (shard param stripped) inside the `VibesDiyApi` instance. `getReadyConnection()` (`index.ts:349`) builds the WS URL from `baseApiUrl` + `codegenShardForUser(userId, currentShardIndex)` instead of a frozen `cfg.apiUrl`.
- On a received `shard-overloaded` `ResError` (or an open-handshake failure on a pinned shard): increment `currentShardIndex`, persist it to `sessionStorage` (key `vibes-codegen-shard-idx:<userId>`), drop `currentConnection`, and `getReadyConnection()` again. The pending request that triggered the roll is retried on the new shard.
- On construction, seed `currentShardIndex` from `sessionStorage` so a reload returns to the last-working shard instead of cold-starting `~0` and immediately re-overflowing.
- Roll is **only enabled when a deterministic `shardKey` was supplied** (website per-user path). Random-UUID shards (CLI, anon) get a fresh DO on every construction anyway, so rolling is meaningless there — guard the roll behind "started from a stable per-user shard."
- Bound the roll (e.g. max index 8) to avoid an unbounded climb if the whole codegen plane is saturated; past the bound, surface the error to the user instead of looping.

## Edge cases

- **Reconnect stability.** Reconnect (`index.ts:387` `onClose` → `getReadyConnection`) must reuse `currentShardIndex`, not reset it — otherwise a mid-turn disconnect would drop back to `~0` and lose continuity. Index lives on the instance + `sessionStorage`, not in the URL key.
- **Multiple tabs / devices.** Each client rolls independently when _it_ hits overload; `sessionStorage` is per-tab, so convergence is soft, not guaranteed. That's acceptable — the admission limit is what enforces isolation; the roll just finds headroom.
- **Anonymous → signed-in transition.** Anon uses random UUID; once Clerk loads with a user, the lazy `chatApi` rebuilds on the per-user shard (the provider already reacts to `clerk.loaded`). No special-casing beyond the existing deferral.
- **DO eviction resets the counter.** Correct: a cold DO has zero active streams. No persistence of `activeStreams` needed.
- **Decrement on abnormal close.** The `finally`/decrement must fire on WS close mid-stream, not just clean completion, or the counter leaks and the DO wedges at "full." Tie the decrement to stream teardown, and as a backstop derive the count from live stream state rather than a free-running integer if teardown paths are hard to make exhaustive.

## Testing

- **Unit (api-types):** `codegenShardForUser` / `shardBelongsToUser` family + suffix parsing; `MAX_CONCURRENT_CODEGEN_STREAMS` wired to the gate.
- **Admission gate:** 3 concurrent codegen streams admitted; 4th gets `shard-overloaded` and starts no generation; decrement frees a slot (4th succeeds after one completes); decrement fires on mid-stream close.
- **Guard generalization:** `shardBelongsToUser` accepts `base` and `base~3`, rejects another user's base and forged suffixes; notify registration no longer warns on rolled shards.
- **Client roll:** on `shard-overloaded`, index increments, URL rewrites to `~1`, request retries and succeeds; index persists across reconnect and across a simulated reload (seeded from `sessionStorage`); roll is a no-op for random-UUID (CLI/anon) instances; roll stops at the bound.
- **CLI parity:** a CLI `VibesDiyApi` still gets a random UUID and never rolls (assert no `shardKey`, no index state).

## Rollout

- Land server admission control + guard generalization first (behavior-preserving for random-UUID traffic; only adds a never-hit limit until clients pin).
- Gate the website per-user pinning + client roll behind a flag (env/`stable-entry` group) so it can be enabled on dev/preview and measured (cold-start time, `shard-overloaded` rate, roll depth distribution) before prod.
- Watch: `shard-overloaded` frequency (is 3 too low for power users?), roll-depth histogram (are users climbing far?), cold-start p50/p95 before vs after.

## Open questions

1. **Is 3 right?** Starting value per the request; the rollout metrics (overload rate, roll depth) should confirm or tune it. Consider making it an env-tunable constant rather than a hard literal.
2. **Roll bound + UX past it.** What does the user see if they exhaust the bound (whole-plane saturation)? Proposed: a normal "service busy, retry" error rather than an infinite silent climb.
3. **Should the base shard be `userNotifyShardFor(userId)` (reuse the notify string) or a distinct `codegen-user-<uid>` prefix?** Reusing the notify string makes `n=0` pass the existing guard for free and co-locates nothing physically (different DO namespace from `shared:`); a distinct prefix is cleaner conceptually but needs the guard taught about a second family. Leaning reuse — flagged for review.
