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
  alarm `min(intervalMs, base · 2^attempt)` capped (e.g. base 5s, cap 5 min), increment `attempt` in
  storage.
- On success, reset `attempt = 0` and re-arm at `intervalMs`.
- **Give-up policy (open question 2):** after `MAX_ATTEMPTS` consecutive failures, stop retrying and
  resume the normal interval on the next natural tick (so a permanently-broken handler degrades to
  "runs once per interval, fails, waits" instead of hammering). Alternative: keep backing off at the cap
  indefinitely. Proposal: cap-and-resume-interval.

### 4. State (DO storage)

`{ ownerHandle: string, appSlug: string, intervalMs: number | null, attempt: number, lastRunAt?: string }`.

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

## Open questions for review (Charlie)

1. **Poke transport.** `VIBES_SERVICE` queue event (durable, matches existing `evt-*` patterns, survives
   a transient DO miss) vs. a direct `BACKEND_DO.get(id).fetch('/arm')` from the push handler (simpler,
   synchronous, but no retry if the DO is briefly unavailable). I lean queue for durability — agree?
2. **Give-up policy** after `MAX_ATTEMPTS` failures: cap-and-resume-interval (proposed) vs. back off at
   the cap indefinitely vs. disarm-until-next-push. Which matches how you want a chronically-failing
   `scheduled` to behave?
3. **Building `vctx` in `alarm()`** with no request — synthesize a minimal internal `Request` for
   `cfServeAppCtx`, or is there a request-less ctx-construction path I should use instead?
4. **Owner identity for `scheduled`.** `trigger.userHandle = ownerHandle` (the vibe owner) — confirming
   that's the right acting identity for a timer (it has no session user), ahead of B6 hanging
   write-identity off it.
