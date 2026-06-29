# Per-User Codegen Shard + Admission-Control Auto-Roll — Design

**Status:** design, pre-implementation
**Issue:** TBD (file before implementation)
**Predecessors (shipped):** [#2714](https://github.com/VibesDIY/vibes.diy/issues/2714) — declarative shard-keyed API (`ShardKind`, `SHARD_POLICY`, branded shard keys); #2265 Track B — per-user `notify-user-<uid>` shared shard.

## Summary

Today every website chat session opens the heavy **codegen** Durable Object on a fresh `crypto.randomUUID()` shard (`vibes.diy/api/impl/index.ts:290`, `vibes.diy/pkg/workers/app.ts:160`). A brand-new DO is cold on every chat, which is the 10–15s "waiting for the chat API to become available" the user experiences. The random sharding exists on purpose — to keep one heavy codegen stream per DO so concurrent load can't exhaust a single instance (`index.ts:284`).

This spec improves **website** cold-start by pinning each authenticated user to a **deterministic per-user codegen shard** (so the 2nd+ chat rejoins their already-warm DO), and re-earns the CPU isolation the random sharding gave us with **admission control + a deterministic auto-roll**: the codegen DO admits at most **3 concurrent codegen streams**; the 4th gets a coded `shard-overloaded` `ResError`, and the client deterministically rolls to the next shard in the user's shard family and retries.

The **CLI is unchanged** — it never passes a `shardKey`, so it keeps the random-UUID-per-connection behavior, and never participates in the roll. The feature is opt-in through the existing `shardKey` seam.

## Decisions (locked)

| Decision              | Choice                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website codegen shard | Deterministic per-user: `userNotifyShardFor(userId)` (the existing `notify-user-<uid>` string), deferred until `clerk.loaded` (mirror `deferredSharedReadShard`)                                                     |
| Anonymous users       | Keep `crypto.randomUUID()` (no stable identity to pin to)                                                                                                                                                            |
| CLI                   | Unchanged — never passes `shardKey`, never rolls                                                                                                                                                                     |
| Admission limit       | **3** concurrent **codegen streams** per DO instance; 4th admission attempt is rejected                                                                                                                              |
| Overload signal       | Server **sends** a coded `ResError` `code: "shard-overloaded"` and stops dispatch (does NOT rely on catching a hard CF CPU/memory limit)                                                                             |
| Counted unit          | In-flight streams on the codegen DO (`open-chat` / `prompt-chat-section`), **any** mode that routes there — `codegen`, `runtime`, and `img`'s codegen leg all share one budget — not open WebSocket connections      |
| Next-shard function   | `base` for n=0; `` `${base}~${n}` `` for n≥1, monotonically increasing                                                                                                                                               |
| Roll trigger          | Client receives `shard-overloaded` (or the open handshake fails on a pinned shard)                                                                                                                                   |
| Roll stickiness       | Persist the current index in `sessionStorage` keyed by user, so reconnects/reloads land on the working shard, not back on `~0`                                                                                       |
| Shard mutability      | The `VibesDiyApi` instance rewrites its own `?shard=` and reconnects; the provider's instance-cache key includes the **base (n=0) per-user shard**, and rolls advance an index inside the instance without re-keying |
| Roll gating           | Explicit per-user-codegen metadata (`codegenUserId`) on the instance — **not** `shardKey !== undefined` (which also matches the per-vibe `owner--app` path)                                                          |

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
- **The chatApi instance cache must be keyed by the codegen shard identity, not the bare `/api` URL.** Today the provider caches the lazy chat API under `vibesDiyApis.get(apiUrl).once()` with `apiUrl` = the base `/api` URL — identical for anon and signed-in. If any `chatApi` method is touched before Clerk loads (or after an account switch), that first instance (random-UUID or previous user) wins forever and later renders never move to `userNotifyShardFor(userId)`, silently defeating the per-user warm shard. Fix: include the resolved per-user codegen shard (n=0) / user id in the cache key — `vibesDiyApis.get(codegenCacheKey(apiUrl, codegenShard))` — so a shard/identity change yields a **new** instance, and close the superseded anon/previous-user instance on the transition (its socket must not linger). The cache key carries the **base** (n=0) shard only; rolls (§4) advance an index **inside** the instance and do **not** re-key the cache.

### 2. Admission control in the codegen DO

The DO is the unified `Sessions` class (`vibes.diy/pkg/workers/sessions.ts`); the codegen branch is `sessions.ts:125-134`, dispatching via `chatMsgEvento`. The instance already holds `this.connections: Set<WSSendProvider>`. Add a per-instance counter for **active streams on this codegen DO**.

- A small `CodegenAdmission` holder on the DO instance: `activeStreams: number` (in-memory; resets on DO eviction, which is correct — an evicted/cold DO has zero active streams).
- **What counts toward the budget (resolves the runtime/img question — Charlie #1).** Every mode that opens a stream on the codegen shard counts, because the budget protects the DO's CPU regardless of which workload loaded it. Per `chatShardsForMode` (`api/types/shard-policy.ts`), **all three** chat modes route to codegen: `codegen → ["codegen"]`, `runtime → ["codegen"]`, `img → ["codegen","vibe"]`. So the counter is "active streams on this codegen DO instance," not "codegen-mode streams only" — `runtime` and the codegen leg of `img` share the same budget. (The earlier "codegen modes only" framing was wrong: runtime and img-gen also consume this DO.) If a future need arises to give `runtime`/`img` a separate budget, split the counter then; phase 1 keeps one budget for simplicity and correctness.
- Gate the stream entry points — `open-chat` (`api/svc/public/open-chat.ts`) and `prompt-chat-section` (`api/svc/public/prompt-chat-section.ts`). At the point a stream is about to start:
  - if `activeStreams >= MAX_CONCURRENT_CODEGEN_STREAMS (3)` → send `ResError { code: "shard-overloaded" }` and return `EventoResult.Continue` (same fail-loud-and-stop shape as `shard-gate.ts:70`), **without** starting generation.
  - else increment, run the stream, and decrement in a `finally` (covering completion, error, and WS close mid-stream).
- `MAX_CONCURRENT_CODEGEN_STREAMS` and the `"shard-overloaded"` code live in `api-types` next to `SHARD_POLICY` so client and worker share one source of truth.

This is admission control, not crash-detection: the limit is enforced _before_ heavy work, so the signal is deterministic and testable, and we never depend on surviving a hard CF CPU/memory kill to emit it.

### 3. Deterministic next-shard family + generalized guard

`userNotifyShardFor(userId)` (`api/types/notifications.ts`) currently returns a single string; `session-callbacks.ts:88` guards with **exact equality** (`shard !== userNotifyShardFor(userId)`). Rolled shards (`notify-user-<uid>~1`) must (a) be addressable and (b) pass the per-user guard so the roll is legitimate — **without** weakening Track B's bounded-subscriber-set property.

- Add to `api-types/notifications.ts`:
  - `codegenShardForUser(userId, n)` → `n===0 ? base : ` `` `${base}~${n}` `` (single source for the family). `n` is bounded `0..MAX_ROLL_INDEX` (the same constant that caps the client roll in §4).
  - `shardBelongsToUser(shard, userId)` → true iff `shard === base`, **or** `shard` is `` `${base}~${n}` `` with `n` a **strictly-parsed integer in `1..MAX_ROLL_INDEX`** (no leading zeros, no non-numeric suffix, no out-of-range). Strict parsing + a hard upper bound is what keeps the accepted set finite.

- **Critical: do NOT generalize the shared plane (Charlie #3).** `shardBelongsToUser` preserves _ownership_ (a client can't register another user's family) but, used everywhere, it would let a user register an unbounded spray of suffix shards and **grow the UserNotify fan-out / subscriber set per user** — exactly the Track B invariant ("one shard per user, bounded subscribers") it would otherwise erode. So the guard is split by plane:
  - **Shared plane** (`userNotifyCallbacksForSharedSessions`): keep **strict equality** `shard === userNotifyShardFor(userId)`. Unchanged. The shared singleton/notify shard stays exactly one per user.
  - **Codegen plane** (`userNotifyCallbacksForChatSessions`, `session-callbacks.ts:88`/`:98`): use `shardBelongsToUser` — the bounded family — **only here**, because this is the only plane that rolls. The subscriber set per user is therefore capped at `MAX_ROLL_INDEX + 1`, not unbounded.
- Registration semantics on a rolled shard: build-complete `notifyUser` already fires unconditionally (`session-callbacks.ts:67`); on the website, notifications ride `sharedApi` (strict, one shard), not the codegen shard, so the roll does not change notification delivery. The codegen-plane generalization is about _not silently warning/no-oping_ on legitimate rolled shards while keeping the fan-out bounded.

### Security invariants (explicit, per Charlie #3)

| Invariant                                                                             | Shared plane             | Codegen plane                                                      |
| ------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| **Ownership** — a client can only register a shard belonging to its verified `userId` | strict equality          | `shardBelongsToUser` (family)                                      |
| **Bounded subscriber set** — fan-out cost per user is `O(1)`, not `O(shards seen)`    | exactly 1 (`base`)       | ≤ `MAX_ROLL_INDEX + 1` (hard cap)                                  |
| **Suffix parsing** — no injection via crafted shard strings                           | n/a (no suffix accepted) | strict integer `1..MAX_ROLL_INDEX`, no leading zeros / non-numeric |

The point of the split: rolling is a **codegen-only** affordance, so only the codegen plane relaxes from "exactly one" to "bounded family." The shared plane — which is where the original Track B subscriber-set bound lives — stays strictly one shard per user.

### 4. Rollable client connection

The shard is baked into `cfg.apiUrl` at construction (`index.ts:290`) and `cfg` is readonly. The cache key now includes the base per-user shard (§1), so each per-user instance is distinct; rolls advance an index **inside** that instance without re-keying the cache:

- Construct the per-user instance with explicit **rollable codegen metadata** — `{ codegenUserId, shardFamilyBase }` — set **only** on the website per-user-codegen path. Track a mutable `currentShardIndex` and a `baseApiUrl` (shard param stripped). `getReadyConnection()` (`index.ts:349`) builds the WS URL from `baseApiUrl` + `codegenShardForUser(codegenUserId, currentShardIndex)` instead of a frozen `cfg.apiUrl`.
- On a received `shard-overloaded` `ResError` (or an open-handshake failure on a pinned shard): increment `currentShardIndex`, persist it to `sessionStorage` (key `vibes-codegen-shard-idx:<userId>`), drop `currentConnection`, and `getReadyConnection()` again. The pending request that triggered the roll is retried on the new shard.
- On construction, seed `currentShardIndex` from `sessionStorage` so a reload returns to the last-working shard instead of cold-starting `~0` and immediately re-overflowing.
- **Roll only when the instance carries per-user-codegen metadata — not merely `shardKey !== undefined`.** This is the subtle gate: the `/vibe/...` viewer path **also** passes a deterministic `shardKey` (`owner--app`), but it is **not** a per-user family. Gating on "a shardKey was supplied" would let an overloaded viewer connection roll `owner--app` → `owner--app~1`, which has no `userId` for the `sessionStorage` key / `shardBelongsToUser` guard and destroys the intended per-vibe pinning. So rolling is keyed off the explicit `codegenUserId` flag, which only the per-user path sets. Random-UUID (CLI, anon) and per-vibe (`owner--app`) instances never roll — the former gets a fresh DO per construction anyway, the latter must stay pinned to its vibe.
- Bound the roll at `MAX_ROLL_INDEX` (the **same constant** the server guard accepts up to, §3 — they must agree, or the client could roll to a shard the registration guard rejects). Past the bound, surface the error to the user instead of looping.

## Edge cases

- **Reconnect stability.** Reconnect (`index.ts:387` `onClose` → `getReadyConnection`) must reuse `currentShardIndex`, not reset it — otherwise a mid-turn disconnect would drop back to `~0` and lose continuity. Index lives on the instance + `sessionStorage`, not in the URL key.
- **Multiple tabs / devices.** Each client rolls independently when _it_ hits overload; `sessionStorage` is per-tab, so convergence is soft, not guaranteed. That's acceptable — the admission limit is what enforces isolation; the roll just finds headroom.
- **Anonymous → signed-in transition (and account switch).** Anon uses random UUID; once Clerk loads with a user, the lazy `chatApi` must rebuild on the per-user shard. This works **only** because the instance cache is keyed by codegen shard identity (§1) — a URL-only key would reuse the anon instance forever. On the transition the superseded anon/previous-user instance is closed so its socket doesn't linger. Same applies to switching accounts (userId changes → new cache key → new instance, old one closed).
- **DO eviction resets the counter.** Correct: a cold DO has zero active streams. No persistence of `activeStreams` needed.
- **Decrement on abnormal close.** The `finally`/decrement must fire on WS close mid-stream, not just clean completion, or the counter leaks and the DO wedges at "full." Tie the decrement to stream teardown, and as a backstop derive the count from live stream state rather than a free-running integer if teardown paths are hard to make exhaustive.

## Testing

- **Unit (api-types):** `codegenShardForUser` / `shardBelongsToUser` family + suffix parsing; `MAX_CONCURRENT_CODEGEN_STREAMS` wired to the gate.
- **Admission gate:** 3 concurrent codegen streams admitted; 4th gets `shard-overloaded` and starts no generation; decrement frees a slot (4th succeeds after one completes); decrement fires on mid-stream close.
- **Guard split (security invariants):** `shardBelongsToUser` accepts `base` and `base~3`, rejects another user's base, forged/non-numeric suffixes, leading zeros, and `n > MAX_ROLL_INDEX`. **Shared-plane registration stays strict** — assert `userNotifyCallbacksForSharedSessions` still rejects `base~1` (only the codegen plane admits the family), so the shared subscriber set stays exactly one per user.
- **Client roll:** on `shard-overloaded`, index increments, URL rewrites to `~1`, request retries and succeeds; index persists across reconnect and across a simulated reload (seeded from `sessionStorage`); roll is a no-op for random-UUID (CLI/anon) instances; roll stops at the bound.
- **CLI parity:** a CLI `VibesDiyApi` still gets a random UUID and never rolls (assert no `shardKey`, no index state).

## Rollout

- Land server admission control + the codegen-plane guard change first (behavior-preserving for random-UUID traffic; only adds a never-hit limit until clients pin). The shared-plane guard is **untouched**.
- Gate the website per-user pinning + client roll behind a flag (env/`stable-entry` group) so it can be enabled on dev/preview and measured before prod.
- **Make `MAX_CONCURRENT_CODEGEN_STREAMS` env-tunable, not a hard literal, and instrument from day one (Charlie #1):** admission **reject rate**, **active-stream high-watermark** per DO, and a **roll-index histogram**. Plus cold-start p50/p95 before vs after.
- Watch: `shard-overloaded` frequency (is 3 too low for power users?), roll-depth histogram (are users climbing far → raise the limit or the bound?), and whether the per-user subscriber set stays within `MAX_ROLL_INDEX + 1`.

## Open questions

1. **Is 3 right?** Starting value per the request; env-tunable (per Rollout), and the metrics (overload rate, roll depth) confirm or tune it. _Charlie #1: keep tunable + instrument from day one — folded into Rollout._
2. **Roll bound + UX past it.** What does the user see if they exhaust `MAX_ROLL_INDEX` (whole-plane saturation)? Proposed: a normal "service busy, retry" error rather than an infinite silent climb.
3. **Base shard: reuse `userNotifyShardFor(userId)` vs a distinct `codegen-user-<uid>` prefix.** _Resolved for phase 1 (Charlie #2): **reuse** the notify string — less churn, no physical collision (worker namespaces shard planes, `codegen:<…>` vs `shared:<…>`), and `n=0` passes the existing guard for free. The tradeoff is semantic coupling (one prefix now spans two planes); a distinct prefix stays a documented future option if we want stricter conceptual boundaries. Acceptable **because** the guard split (§3 Security invariants) keeps the codegen-family semantics tight._
