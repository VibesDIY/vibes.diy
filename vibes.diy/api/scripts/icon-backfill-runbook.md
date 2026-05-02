# Icon backfill runbook

Live apps get icons automatically: the first prompt's `preAllocate` call
returns an `iconDescription`, which `ensureChatId` writes alongside title
and skills, then enqueues `evt-icon-gen`. New flows are covered.

Apps that predate this feature have neither an `ActiveIconDescription` nor
an `ActiveIcon` entry. There's no read-path repair — operators run this
runbook by hand when ready to backfill the population.

## 1. Find candidates

Apps that have an `ActiveTitle` entry but no `ActiveIconDescription`:

```sql
SELECT user_slug, app_slug
FROM app_settings
WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(settings) AS e
        WHERE e->>'type' = 'active.title'
      )
  AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(settings) AS e
        WHERE e->>'type' = 'active.icon-description'
      );
```

(Adjust JSON-path syntax for SQLite/D1 if running locally.)

Sanity-check the count before doing anything else.

## 2. Pick a description per app

Two paths, operator's choice:

**(a) Verbatim title.** Quick, low-effort, lower icon quality. Loop the
candidate list and `UPDATE app_settings SET settings = settings ||
jsonb_build_object('type','active.icon-description','description', <title>)`
for each. Then enqueue (see step 3).

**(b) LLM-expand the title.** Call the same backend the live request path
uses (`LLM_BACKEND_URL`) with a short prompt like:

> Convert this app title into a one-line subject for an icon — what the
> icon depicts, not how it's drawn. 2–8 words. No colors or letters.
> Examples: "Recipe Tracker" → "a chef whisking eggs"; "Habit Counter"
> → "a streak of paper checkmarks".
> Title: "${title}"

Take the response verbatim, write it as the `ActiveIconDescription`.

The live path is always (a)-quality at minimum and (b)-quality whenever
`preAllocate` returns. (b) brings legacy apps to parity with new apps.
Slowness is fine here — admin code, batch.

## 3. Enqueue regen

After upserting `ActiveIconDescription`, post a queue message per app:

```jsonc
{
  "payload": { "type": "vibes.diy.evt-icon-gen", "userSlug": "...", "appSlug": "..." },
  "tid": "queue-event",
  "src": "icon-backfill",
  "dst": "vibes-service",
  "ttl": 1
}
```

Send via `wrangler queues producer send VIBES_SERVICE …` or by hitting the
queue producer binding from a small worker.

## 4. Throttle

Image gen is the most expensive step on this path. Either:

- Sleep 2s between enqueues so the queue worker drains them at a steady
  rate without spiking concurrent LLM cost, OR
- Send all enqueues at once and let the queue worker pace via its own
  concurrency settings.

Either is fine — the handler dedups via `descriptionAt` so idempotent
re-runs are safe. Pick the one that feels appropriate to the population
size.

## 5. Spot-check

After ~10s × population-size:

```sql
SELECT user_slug, app_slug
FROM app_settings
WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(settings) AS e
        WHERE e->>'type' = 'active.icon-description'
      )
  AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(settings) AS e
        WHERE e->>'type' = 'active.icon'
      );
```

Should return a small set: queue retries in flight, or LLM failures
worth investigating. Re-running the enqueue step on this list is safe
(handler dedups).
