# Slice B4 — Durable layer: `scheduled` alarms, single-flight, retry/backoff — design

Parent epic: [#2856](https://github.com/VibesDIY/vibes.diy/issues/2856), per-app `backend.js`.
Epic design: [`2026-06-29-per-app-backend-js-design.md`](./2026-06-29-per-app-backend-js-design.md).
Predecessor: **B3** (the `BackendDO` + `_api` → isolate request path + `attemptBackendFetch`).

> **Status: spec-first.** Design only; implementation follows on the branch after Charlie's feedback.
> Built **dark** behind `BACKEND_JS=off` — whole-epic deploy at the end.

## Goal

Give the `BackendDO` a **durable timer lane**: arm a Cloudflare alarm from a vibe's
`config.scheduled.interval`, run the `scheduled` handler in the per-vibe isolate on each tick, and
re-arm — with **single-flight** (no overlapping ticks), **retry-with-backoff** on handler failure, and
clean **lifecycle** (interval change re-arms, removing `scheduled` disarms, deleting the vibe tears it
down). This is the first genuinely-stateful slice; B3 deliberately left the DO stateless.

Non-goals (later slices): `onChange` (B5), real `ctx.db` write-back (B6), secrets (B7), egress (B8).
`scheduled` handlers in B4 get the same B3 `ctx` (`appInfo` baked, `userInfo`, `db`/`secrets` throw).

## The central decision — which release's schedule, and what arms it

B3 established that serving derives from the **selected release** (`selectLatestAppPerSlug`), not the
release-agnostic `active.backend` entry. B4 must make the **same** choice for the alarm, and Charlie
flagged exactly this carry-forward: _"B4's alarm-arming must make the same release-vs-latest-push choice
explicitly."_

**Proposal: the DO is the source of truth for its own schedule, re-evaluated from the selected
release.** A push doesn't _tell_ the DO an interval; it _pokes_ the DO to **re-evaluate**. On a poke
(and on each tick) the DO resolves its schedule the B3 way — `selectLatestAppPerSlug(owner, slug)` →
read `/backend.js` → `parseBackendConfig` → `schedule?.intervalMs` — and arms/re-arms/disarms to match.
This keeps one invariant: **the alarm always reflects the same release `_api` serves**, and a poke
carrying a stale dev interval can never set the wrong schedule (the DO ignores the poke's payload and
reads canonical truth). Idempotent: a poke when nothing changed is a no-op.

- **Poke mechanism:** at push time, after `processBackendBindings` persists `active.backend`,
  `ensure-app-slug-item` sends a `evt-backend-arm` message (`{ownerHandle, appSlug}`) onto the
  `VIBES_SERVICE` queue → the service worker addresses `BACKEND_DO.idFromName(backendDoName(...))` and
  calls an internal `/arm` route → the DO re-evaluates. (Open question 1: queue vs. a direct DO fetch
  from the push handler — see below.)
- **No backend / no `scheduled` export / interval removed** ⇒ the re-evaluation finds no schedule and
  **clears** the alarm (`deleteAlarm`). Deleting the vibe tears down the DO (and its alarm) with it.

## Components

### 1. Arm / re-evaluate (`BackendDO.arm()` via an internal route)

- Resolve the selected release's `config.scheduled.intervalMs` (B3 resolver + parser, cached by content
  hash like B3's gate). Clamp is already enforced at push time (B2a: 5s–1h); re-validate defensively.
- Compare to the persisted armed interval in DO storage:
  - no schedule now ⇒ `deleteAlarm`, clear stored state;
  - schedule changed (or no alarm set) ⇒ `setAlarm(now + intervalMs)`, store `{intervalMs, attempt: 0}`;
  - unchanged ⇒ no-op (don't reset the running clock).

### 2. The tick (`BackendDO.alarm()`)

Cloudflare invokes `alarm()` when the timer fires. The DO:

1. **Single-flight guard:** if a tick is already running (`this.ticking` in-memory flag), skip — never
   overlap `scheduled` with itself. (CF runs one `alarm()` at a time per DO; the flag guards the
   await-interleaved edge and a manual re-entrancy.)
2. Re-resolve the selected release (config can have changed since arming) and run the `scheduled`
   handler in the per-vibe isolate via the B1 executor (`handler: "scheduled"`, `trigger.userHandle =
owner` — `scheduled` acts as the vibe owner).
3. **Re-arm at the END** (not the start), so a tick that overruns its interval can't stack — the next
   tick is always `≥ intervalMs` after the previous one _finished_. This is the structural half of
   single-flight (the in-memory flag is the belt-and-suspenders half).
4. `fetch` and `onChange` are **not** gated by `this.ticking` — they run unblocked (per Charlie); only
   the `scheduled` timer lane is single-flighted.

### 3. Retry / backoff

- On `scheduled` handler throw (or isolate error), **don't** re-arm at `intervalMs`; set a **backoff**
  alarm `min(intervalMs, base · 2^attempt)` capped (e.g. base 5s, cap 5 min), increment `attempt`, and
  record `lastErrorAt` + a short `lastError` summary in storage (observability).
- On success, reset `attempt = 0` (clear `lastError*`) and re-arm at `intervalMs`.
- **Give-up policy (resolved — cap-and-resume-interval):** after `MAX_ATTEMPTS` consecutive failures,
  stop the exponential backoff, **reset `attempt` at the cap**, and resume the normal interval on the
  next natural tick — so a permanently-broken handler degrades to "runs once per interval, fails, waits"
  (configured cadence stays the source of truth) instead of hammering at the backoff cap or disarming.

### 4. State (DO storage)

`{ ownerHandle: string, appSlug: string, intervalMs: number | null, attempt: number, lastRunAt?: string, lastErrorAt?: string, lastError?: string }`
(`lastErrorAt`/`lastError` for observability, per Charlie — a short summary, not the full stack).

**The identity MUST be persisted, not recovered from the DO name (Codex review).** `idFromName` is a
one-way hash, so `backendDoName(owner, slug)` can't be reversed; and `alarm()` has **no incoming
request**, so the `x-vibe-*` headers the `fetch`/`arm` paths read aren't available either. If the DO is
evicted between `/arm` and the tick (the normal cold-start case), `alarm()` would have no way to know
_which vibe to run_ — it could neither `selectLatestAppPerSlug(owner, slug)` nor set
`trigger.userHandle`, so the `scheduled` handler would fail or silently skip. So the `/arm` route
**writes `{ownerHandle, appSlug}` into DO storage** (alongside the interval/attempt state), and `alarm()`
reads its identity from there. A self-check: an `alarm()` that finds no stored identity (e.g. an alarm
that somehow outlived its state) clears itself (`deleteAlarm`) rather than throwing.

Building `VibesApiSQLCtx` inside `alarm()` — which has no incoming request — synthesizes a minimal
internal `Request` for `cfServeAppCtx` (open question 3); the vibe identity comes from storage, not that
synthetic request.

## Lifecycle summary

| Event                                       | Effect                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| Push adds/keeps `scheduled`                 | poke → arm/re-arm to the (production) interval           |
| Push changes the interval                   | poke → re-arm to the new interval                        |
| Push removes `scheduled` (or `/backend.js`) | poke → `deleteAlarm`, clear state                        |
| Tick succeeds                               | run handler, reset `attempt`, re-arm at interval         |
| Tick throws                                 | backoff alarm, `attempt++`; give up after `MAX_ATTEMPTS` |
| Vibe deleted                                | DO + alarm torn down                                     |

## Testing (fake binding, flag off; DO alarm via the storage/alarm test surface)

- **Arm:** a vibe with `scheduled` + interval sets an alarm at `now + intervalMs`; no-schedule clears it.
- **Tick:** `alarm()` dispatches `handler: "scheduled"` to the isolate (fake loader) and re-arms.
- **Single-flight:** an overrunning tick doesn't start the next until it finishes; a re-entrant
  `alarm()` while `ticking` is a no-op.
- **Interval change:** re-arm picks up the new interval; unchanged is a no-op (clock not reset).
- **Backoff:** a throwing handler sets a backoff alarm and increments `attempt`; success resets it;
  give-up after `MAX_ATTEMPTS`.
- **Disarm:** removing `scheduled` deletes the alarm.
- **Release-scope:** the armed interval follows the **production** release, not a later dev push (the
  B3 release-skew regression, applied to scheduling).
- **fetch not gated:** a `fetch` during a running tick is served (not blocked behind the timer lane).
- **Cold-start identity (Codex):** an `alarm()` on a freshly-constructed DO (state read from storage,
  no prior `fetch`/`arm` in memory) recovers `(owner, slug)` from storage and runs the right vibe; an
  `alarm()` with no stored identity self-clears instead of throwing.

## Codex review folded in

Codex caught that the original state shape omitted the vibe identity, so a DO evicted between `/arm` and
the tick couldn't know which vibe to run (`idFromName` is one-way; `alarm()` has no request headers).
Fixed above: `/arm` persists `{ownerHandle, appSlug}` to DO storage and `alarm()` reads it from there
(with a self-clear when absent). This also settles part of open question 3 — the identity is durable
state, independent of the synthetic request used only to build `vctx`.

## Open questions — resolved (Charlie's review)

1. **Poke transport → `VIBES_SERVICE` queue (`evt-backend-arm`).** Fits the existing `evt-*`
   architecture and decouples push latency from DO availability. **Two implementation caveats (Charlie):**
   - the new queue handler **must propagate transient failures** (return `Err` / throw) so the queue
     runtime's `message.retry()` fires — explicitly **NOT** the log-and-continue pattern other handlers
     use, or a poke lost to a transient DO miss never retries and the schedule silently goes stale;
   - `/arm` is **idempotent + payload-agnostic** — it recomputes from the selected release every time and
     ignores the message payload (which carries only `{ownerHandle, appSlug}` for addressing).
2. **Give-up policy → cap-and-resume-interval** after `MAX_ATTEMPTS`. Preserves configured cadence as the
   source of truth (no permanent drift/disarm), avoids manual recovery for transient incidents. Persist
   `lastErrorAt` (+ a short last-error summary) for observability, and **reset `attempt` at the cap** so
   the next natural tick runs at the normal interval.
3. **`vctx` in `alarm()` → synthetic internal `Request` + the single `cfServeAppCtx` bootstrap** (same
   pattern as other internal worker/DO calls). **Harden (Charlie):** a synthetic request has no real
   `request.cf`, so the `netHash` derivation in `cfServeAppCtx` needs a safe fallback/override for the
   missing `cf` — verify it doesn't throw on `undefined` `request.cf`.
4. **Owner identity → `trigger.userHandle = ownerHandle`.** Confirmed: matches the backend trigger
   contract (`scheduled → owner`) and keeps B6's write-identity plumbing aligned.

### Implementation pre-check (Charlie)

Because the **queue consumer** worker is what pokes `BackendDO`, its runtime bindings must include
`BACKEND_DO` (and whatever helper env the poke path needs). That's a **second wrangler file** —
`wrangler.queue-consumer.toml` — beyond the main `wrangler.toml` B3 already updated; the queue consumer
must cross-script-bind `BACKEND_DO` to the main worker (the same pattern its `USER_NOTIFY` binding uses),
since the DO class lives in the main worker, not the consumer. Add it alongside the B4 implementation,
and confirm the consumer can address the DO before relying on the poke path.
