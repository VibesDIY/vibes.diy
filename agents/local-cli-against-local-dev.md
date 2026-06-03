# Running the user-facing CLI from a worktree against local dev

Companion to [eval-local-dev.md](eval-local-dev.md). That runbook drives the
`eval/codegen-edit` harness (a separate runner that talks to chat directly).
This one runs the **actual `vibes-diy` CLI binary** from a worktree against
local dev so you can see both client- and server-side logs end-to-end —
useful for reproducing CLI-only failure modes (silent no-op edits, `Edit
turn produced no file changes`, recovery exhaustion, etc.) without waiting
for a `pkg@d*` npm publish.

## 1. Worktree must be runnable

After `git worktree add`, copy the gitignored files (TLS certs, dev secrets):

```sh
WT=.worktrees/<name>
cp vibes.diy/pkg/*.pem $WT/vibes.diy/pkg/
cp vibes.diy/pkg/.dev.vars $WT/vibes.diy/pkg/
cp vibes.diy/stable-entry/.dev.vars $WT/vibes.diy/stable-entry/
cp vibes.diy/api/svc/.dev.vars $WT/vibes.diy/api/svc/
cd $WT && pnpm install
```

See [worktree-setup.md](worktree-setup.md) for the full list and reasoning.

## 2. Start dev server (from the worktree)

```sh
: > /tmp/vite-dev.log
cd $WT/vibes.diy/pkg && NODE_OPTIONS="--max-old-space-size=16384" pnpm dev > /tmp/vite-dev.log 2>&1 &
until curl -sk -o /dev/null -w "%{http_code}" https://vite.localhost.vibesdiy.net:8888/api | grep -q "426"; do sleep 5; done
```

12288 isn't enough on a fresh worktree — vite re-optimizes every dep on
first boot and OOMs. Use 16384.

## 3. Authenticate the CLI against local dev (one time)

The device cert is per-API-URL. The first `vibes-diy ... --api-url
https://vite.localhost.vibesdiy.net:8888/api?.stable-entry.=cli` will fail
with `[authentication_required]`. Run login with `--force` and complete the
browser CSR-to-cert handoff yourself (the local dev's CSR page is signed by
the dev CA in [.dev.vars](../vibes.diy/api/svc/.dev.vars)):

```sh
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
export PATH="$WT/vibes-diy/node_modules/.bin:$PATH"   # so run.js's tsx fallback resolves
node $WT/vibes-diy/cli/run.js login --force \
  --api-url "https://vite.localhost.vibesdiy.net:8888/api?.stable-entry.=cli" \
  --timeout 180
```

Browser opens, handoff happens, cert lands. Subsequent CLI calls against the
same URL succeed without prompting.

## 4. Run the CLI against local dev

`vibes-diy generate` writes a directory under cwd; `vibes-diy edit` works
in-place with `--dir`. Always pass `--api-url` and keep `tsx` on PATH:

```sh
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
export PATH="$WT/vibes-diy/node_modules/.bin:$PATH"
mkdir -p /tmp/eval-local && cd $_
node $WT/vibes-diy/cli/run.js generate "Build a drink tracker" \
  --api-url "https://vite.localhost.vibesdiy.net:8888/api?.stable-entry.=cli" \
  --verbose
cd <appSlug-printed-by-generate>
node $WT/vibes-diy/cli/run.js edit <appSlug> "Add a tea button" \
  --dir . --verbose \
  --api-url "https://vite.localhost.vibesdiy.net:8888/api?.stable-entry.=cli"
```

## 5. Correlate with server logs

`/tmp/vite-dev.log` has both vite + worker output. `grep -a` to bypass
pnpm's TUI byte prefix (see [eval-local-dev.md § 6](eval-local-dev.md)).
For the silent-no-op symptom specifically, grep for recovery markers:

```sh
grep -aE "applyRecovery|recovery-(start|exhausted|stream-end|build-failed|addendum-failed)" /tmp/vite-dev.log
```

`recovery-exhausted` with `consecutiveFruitless: 3` paired with CLI verbose
showing `snapshots=0 apply-errors=0 turn-end=true` is the silent no-op:
model emitted blocks, all SEARCH anchors missed, server retried 3× and gave
up.

## Local data plane: miniflare D1 SQLite, not Neon

Local dev runs against a SQLite database via miniflare's D1 binding. The data is at:

```
vibes.diy/pkg/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
```

Use `sqlite3` directly to read it:

```sh
DB=$(find vibes.diy/pkg/.wrangler/state/v3/d1/miniflare-D1DatabaseObject -name '*.sqlite' -not -name 'metadata.sqlite' | head -1)
sqlite3 "$DB" ".tables"
sqlite3 "$DB" "select chatId, userHandle, appSlug from ChatContexts where appSlug = 'foo'"
```

**Do not use `pnpm --dir vibes.diy/api/svc run db:inspect` to verify local state.** That tool reads `NEON_DATABASE_URL` from `vibes.diy/api/svc/.dev.vars` and goes to the prod Neon Postgres, not the local SQLite. Use it for prod investigations only — never for verifying a local test ran clean.

Tables in local D1 mirror the prod schema: `ChatContexts`, `ChatSections`, `PromptContexts`, `Apps`, `AppSettings`, `AppSlugBindings`, `AssetUploads`, `Assets`, `UserSettings`, `UserSlugBindings`, etc. Same Drizzle ORM hits whichever binding the runtime hands it.

Local chats have different `chatId` values than prod (they were created locally), so `--appSlug` is the stable cross-DB lookup key.

## 6. Reload after server changes

HMR does not reliably reload worker code. After editing `api/svc/**`,
`pkill -f "react-router|workerd|miniflare"` and restart from §2. Client-side
CLI changes need a `pnpm build` in `$WT/vibes-diy` (or rely on the run.js
tsx fallback, which is automatic when no `cli/main.js` exists).
