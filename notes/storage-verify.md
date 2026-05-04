# Verifying storage changes without shipping a release

The fast loop for testing storage / push protocol changes end-to-end. Beats both the published CLI (`npx vibes-diy`) and the cli/prod environments — no npm publish, no tag immutability, no real users in blast radius. Edit-push-validate cycle is ~2 minutes.

## The three pieces

1. **PR preview worker** — every push to a branch with an open PR triggers `.github/workflows/vibes-diy-pr-preview.yaml`, which deploys a per-PR worker named `pr-${PR_NUMBER}-vibes-diy-v2` at `https://pr-${PR_NUMBER}-vibes-diy-v2.jchris.workers.dev`. It uses the `[env.preview]` block of [vibes.diy/pkg/wrangler.toml](../vibes.diy/pkg/wrangler.toml) — same R2 bucket as prod (`vibes-diy-fs-ids`), same Neon DB, isolated worker. Auto-deletes when the PR closes.
2. **CLI `--api-url` flag** — `vibes-diy push --api-url=https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api` redirects all push traffic to a specific environment. Works for any vibes-diy subcommand. The validation script at [vibes.diy/api/svc/usage-report/r2-validate.sh](../vibes.diy/api/svc/usage-report/r2-validate.sh) honors `VIBES_API_URL` and passes it through.
3. **Local CLI build via tsx** — `vibes-diy/cli/package.json` declares `@vibes.diy/api-impl: "workspace:*"` and several other workspace deps. Running the source directly with `tsx` picks up local changes; `npx vibes-diy` would pull from npm and miss them.

## Setup

```bash
# Confirm wrangler is logged into the right Cloudflare account
npx wrangler whoami
# Expect: Jchris@fireproof.storage's Account, ID f031392067b661e91963881fb76b4ea3

# Confirm device-id certificate is registered for vibes-diy
npx vibes-diy login --api-url=https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api
# "Device already has a certificate. Registration not needed." is the success
# state — the device-id auth carries across environments, no per-env login.
```

The auth model is mTLS-style device certificates, not bearer tokens. One cert covers all envs, no expiry to chase per-env.

## The loop

### 1. Edit + push

Edit code in `vibes.diy/api/...` or `vibes-diy/cli/...`. Commit and push to your branch.

```bash
git add <files> && git commit -m "..." && git push origin <branch>
```

Open a PR if there isn't one. The preview workflow fires on `pull_request` types `[opened, synchronize, reopened]`.

### 2. Wait for the preview deploy

```bash
# Block until the latest run completes (~1-2 minutes typical)
until [ "$(gh run list --branch <branch> --workflow='Deploy vibes.diy PR Preview' -L1 --json status --jq '.[0].status')" = "completed" ]; do sleep 15; done
gh run list --branch <branch> --workflow='Deploy vibes.diy PR Preview' -L1
```

If the deploy is failing, the new code never made it to the preview worker — fix CI before going further.

### 3. Tail the worker logs

In a separate terminal (or `run_in_background`):

```bash
cd vibes.diy/pkg && npx wrangler tail pr-NNNN-vibes-diy-v2 --format=pretty
```

`pretty` format gives one log line per `console.log` / `console.error` from the worker. Errors emitted by `R2ToS3Api` (the `console.error` in `get/put/rename`) show up here verbatim — this is the tool that captured the literal R2 `TypeError: Provided readable stream must have a known length` during the cli c2.2.25 root-cause investigation.

If the worker has been redeployed since the tail started, the tail dies with `Error: This script has been upgraded. Please send a new request to connect to the new version.` Restart it.

### 4. Trigger the test from the local CLI

For the published `vibes-diy` CLI, use `npx`:

```bash
npx vibes-diy push --mode dev --app-slug "test-$(date +%s)" \
  --api-url=https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api
```

For local code changes (anything in `vibes-diy/cli` or workspace deps like `@vibes.diy/api-impl`), run directly via tsx:

```bash
/Users/jchris/code/fp/vibes.diy/node_modules/.bin/tsx \
  /Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts \
  push --mode dev --app-slug "test-$(date +%s)" \
  --api-url=https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api
```

This was the path that proved out the idle-timeout fix in `VibesDiyApi.request` — npm-published CLI didn't have the change yet, but tsx running the workspace source did.

For controlled-size pushes that exercise the small / multipart split:

```bash
DIR=$(mktemp -d) && {
  printf 'export default function App() { return <div>'
  yes 'verify ' | head -c 8388484
  printf '</div>; }\n'
} > "$DIR/App.jsx" && cd "$DIR" && SLUG="verify-$(date +%s)" && \
  /Users/jchris/code/fp/vibes.diy/node_modules/.bin/tsx \
    /Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts \
    push --mode dev --app-slug "$SLUG" \
    --api-url=https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api
```

8388484 bytes triggers the multipart path (>5 MiB). Adjust to test boundaries.

### 5. Verify ground truth in the DB

The CLI prints a deploy URL but its stdout is text-only ([handoff note from prior agent](../-Users-jchris-code-fp-vibes-diy/memory/MEMORY.md): "the CLI's `--json` flag prints text anyway"). The Apps table is the authoritative record of routing decisions:

```bash
pnpm --dir vibes.diy/api/svc run db:inspect sql \
  "select \"appSlug\", \"fileSystem\" from \"Apps\" where \"appSlug\" = 'verify-...' order by created desc limit 1" \
  | awk '/^\{/,EOF' | jq '.rows[0].fileSystem[]? | {fileName, size, assetURI}'
```

Each `assetURI` will be either `s3://r2/<cid>` (R2-routed) or `pg://Assets/<cid>` (SQL-routed). For a 6 KB push expect `2 in R2, 1 in SQL`; for an 8 MiB push the same tally with multipart on the wire.

For an even more thorough check, `r2-validate.sh` does push + DB query + cross-check in one command:

```bash
VIBES_API_URL='https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/api' \
  ./vibes.diy/api/svc/usage-report/r2-validate.sh 8388608
```

### 6. Confirm asset retrieval

Ground truth on the read path is fetching the asset back through the worker:

```bash
curl -s "https://pr-NNNN-vibes-diy-v2.jchris.workers.dev/assets/cid?url=s3%3A%2F%2Fr2%2F<cid>" \
  -o /tmp/fetched.bin && wc -c /tmp/fetched.bin
# Expect: byte-exact size match to source
```

A 200 + size match proves the rename completed cleanly and the R2 final key is readable.

## Why this beats alternatives

**vs. published CLI** — `npx vibes-diy` pulls from the registry. Local server changes don't affect it (CLI talks to whatever URL you pass), but local CLI changes are invisible. tsx + workspace source closes that gap.

**vs. cli/prod tag deploys** — tags are immutable per saved policy. Each iteration would burn a tag. Preview workers redeploy in-place on every push to the branch, no tag pollution.

**vs. local `pnpm dev`** — could be done but the local worker won't have the same R2 binding as preview/cli/prod (different account, different bucket). Preview matches prod's R2 setup so issues that depend on real R2 (the `Provided readable stream must have a known length` finding, for example) only show up there.

**vs. unit tests with stubs** — the StubS3Api in [tests](../vibes.diy/api/tests/stub-s3-api.ts) accepts any `WritableStream` body, including the broken TransformStream form that real R2 rejects. Stubs aren't faithful to R2's "known length" requirement. Preview is where stubs and reality reconcile.

## Gotchas

- **Preview comment SHA shows the merge commit, not the branch HEAD.** The deploy job builds from `pull/<PR>/merge` (your branch merged into current main); the comment posts that merge SHA. Branch HEAD and merge SHA differ but represent the same code unless main moves under you.
- **Both preview and cli write to the same R2 bucket and Neon DB.** Test traffic is visible in production queries. Use a unique slug prefix (e.g. `verify-$(date +%s)` or `r2-validate-...`) so backend lookups are unambiguous.
- **`wrangler r2 object list/get` against `vibes-diy-fs-ids` returns "key not found" from a different account.** The R2 bucket lives on the account the worker deploys to; your local wrangler may be authed to a different account. The DB cross-check is the reliable signal; the wrangler R2 lookup was dropped from `r2-validate.sh` for this reason.
- **Tail dies on redeploy.** Keep a one-liner ready: `cd vibes.diy/pkg && npx wrangler tail pr-NNNN-vibes-diy-v2 --format=pretty`. On `Error: This script has been upgraded`, just rerun.
- **Auth check first.** `npx vibes-diy login --api-url=...` once per machine to make sure the device-id cert is registered. After that the cert is global; no per-env login needed.

## Diagnostic shortcut

When something looks wrong, the fastest path to root cause:

1. Add a tight `console.error("R2ToS3Api.<method> failed:", e)` (or wherever) on the side branch.
2. Push, deploy, tail.
3. Re-run the validator.
4. Read the literal error in the tail, not the collapsed cement message.
5. Either land the diagnostic permanently (log lines that surface real errors are useful in prod too) or revert it and ship a real fix.

This is exactly the loop that turned `peer 1: peer timeout after 5000ms` into the actionable `TypeError: Provided readable stream must have a known length` during the streaming investigation.
