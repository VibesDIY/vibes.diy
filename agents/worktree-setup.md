# Worktree setup for vibes.diy

When you need an isolated checkout of vibes.diy (typical reason: dedicated branch for a PR while another worktree owns the dev port), follow these steps. The non-obvious part is that several files needed to run dev/tests are gitignored and don't come along with `git worktree add`.

## 1. Create the worktree

```sh
cd /Users/jchris/code/fp/vibes.diy
git fetch origin main
git worktree add -b <branch-name> /Users/jchris/code/fp/vibes.diy-<topic> origin/main
cd /Users/jchris/code/fp/vibes.diy-<topic>
pnpm install --frozen-lockfile
```

## 2. Copy gitignored files from the canonical checkout

These are not in git and must be copied from `/Users/jchris/code/fp/vibes.diy/` (the long-lived checkout) into the new worktree before dev/tests will run:

```sh
SRC=/Users/jchris/code/fp/vibes.diy
DST=/Users/jchris/code/fp/vibes.diy-<topic>

# mkcert HTTPS certs for vite.localhost.vibesdiy.net
cp "$SRC/vibes.diy/pkg/_wildcard.localhost.vibesdiy.net+1-key.pem" "$DST/vibes.diy/pkg/"
cp "$SRC/vibes.diy/pkg/_wildcard.localhost.vibesdiy.net+1.pem"     "$DST/vibes.diy/pkg/"

# .env / .dev.vars (cloudflare-vite-plugin loads these at startup)
cp "$SRC/vibes.diy/.env"                 "$DST/vibes.diy/.env"
cp "$SRC/vibes.diy/pkg/.env"             "$DST/vibes.diy/pkg/.env"
cp "$SRC/vibes.diy/pkg/.dev.vars"        "$DST/vibes.diy/pkg/.dev.vars"
cp "$SRC/vibes.diy/api/svc/.dev.vars"    "$DST/vibes.diy/api/svc/.dev.vars"
cp "$SRC/vibes.diy/stable-entry/.dev.vars" "$DST/vibes.diy/stable-entry/.dev.vars"
```

Without the `.pem` pair, vite refuses to start with the "HTTPS certificates not found!" banner. Without the `.env` / `.dev.vars` files, the worker boots but reports `missing parameters: CLERK_PUBLISHABLE_KEY,DEVICE_ID_CA_*,FP_VERSION,LLM_BACKEND_*,...` and every request 500s.

## 3. Take over the dev port (8888)

If another worktree already owns 8888, find and kill it before starting yours:

```sh
lsof -nP -iTCP:8888 -sTCP:LISTEN          # look at the cwd in the command
ps -o pid,ppid,command -p <PID>           # confirm which worktree it's from
kill <parent-pid>                         # parent is the pnpm wrapper
```

Then start dev. Cloudflare's vite plugin scans worker exports at startup and OOMs Node's default heap — bump it:

```sh
cd "$DST/vibes.diy/pkg"
NODE_OPTIONS='--max-old-space-size=8192' pnpm dev > /tmp/vite-dev-<topic>.log 2>&1 &
until curl -ksf https://vite.localhost.vibesdiy.net:8888/api -o /dev/null -w "%{http_code}" | grep -q 426; do sleep 3; done
```

Ready when `/api` returns `426`. See [eval-local-dev.md](eval-local-dev.md) for the rest of the dev/eval workflow.

## 4. Verify the port is bound to the right worktree

```sh
PID=$(lsof -nP -iTCP:8888 -sTCP:LISTEN -t | head -1)
ps -o pid,command -p "$PID"
# COMMAND should reference /Users/jchris/code/fp/vibes.diy-<topic>/...
```

If the COMMAND points at the wrong checkout, you're testing the other branch. Don't trust the URL alone.
