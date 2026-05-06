# Eval/codegen-edit harness against local dev server

End-to-end runbook for hitting the local vite dev server with the eval/codegen-edit harness (single prompts or batches) and correlating eval results with server-side recovery markers.

## 1. Start dev server

```sh
pkill -f "react-router|workerd|miniflare"
cd vibes.diy/pkg && NODE_OPTIONS="--max-old-space-size=12288" pnpm dev > /tmp/vite-dev.log 2>&1 &
until curl -sk -o /dev/null -w "%{http_code}" https://vite.localhost.vibesdiy.net:8888/api | grep -q "426"; do sleep 2; done
```

Ready when `/api` returns 426 (Upgrade Required for the websocket endpoint). HMR does not reliably reload worker code, so kill+restart after editing `api/svc/**`.

## 2. CA cert for mkcert (CLI-side)

The eval harness uses node fetch which won't trust mkcert's root by default. Set:

```sh
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
```

(`/Users/jchris/Library/Application Support/mkcert/rootCA.pem` on this machine.)

## 3. Run a single prompt

```sh
cd vibes.diy/eval/codegen-edit
node_modules/.bin/tsx src/run.ts task-tracker --api-url=https://vite.localhost.vibesdiy.net:8888/api
```

Available promptIds live in `vibes.diy/eval/codegen-edit/prompts/seed.jsonl`. The first 5 we use as a "batch" are: `task-tracker kanban-priority recipe-book journal-sentiment bookmarks` (10 total in the corpus).

## 4. Run a batch of 5, appending to log

```sh
cd vibes.diy/eval/codegen-edit && (
  export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
  for id in task-tracker kanban-priority recipe-book journal-sentiment bookmarks; do
    echo "=== START $id $(date +%H:%M:%S) ==="
    node_modules/.bin/tsx src/run.ts "$id" --api-url=https://vite.localhost.vibesdiy.net:8888/api 2>&1
    echo "=== END $id $(date +%H:%M:%S) ==="
  done
) >> /tmp/eval-runs.log 2>&1
```

Sequential — 2–30 min/batch depending on LLM latency.

## 5. Inspect results

Per-run archive: `vibes.diy/eval/codegen-edit/archive/<timestamp>_<id>/manifest.json` — has `appSlug`, `exitState`, per-turn `applyErrorCount`, `upstreamErrorCount`, `resolvedFileCount`. Note: `chatId` is NOT in the manifest; pull it from server logs by `appSlug` or by grepping the per-turn `promptId` field (which IS in `manifest.json` under `turns[].promptId`).

Index: `vibes.diy/eval/codegen-edit/archive/index.jsonl` (one line per run, in order).

## 6. Server log gotchas (`/tmp/vite-dev.log`)

- The file has weird leading spaces/CR from pnpm's TUI prefix; use `grep -a` (treat as binary) or `grep -aE` to avoid silent misses.
- Worker logs (the JSON `{"module":"...","msg":"..."}` lines) only appear AFTER pnpm's TUI prefix on disk — they're real, just behind a wall of spaces on the first "line."
- `wc -l` lies about line count for the same reason.

Useful greps for recovery-orchestrator markers:

```sh
grep -aE "apply-error|recovery-(start|call-started|call-failed|stream-end|exhausted|build-failed|addendum-failed)" /tmp/vite-dev.log
```

## 7. Truncate before each session

```sh
: > /tmp/vite-dev.log
: > /tmp/eval-runs.log   # optional — eval-runs.log is normally appended to across sessions
```
