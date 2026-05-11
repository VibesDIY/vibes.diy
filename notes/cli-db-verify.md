# `vibes-diy db` verify runbook

Post-release smoke check for the [`vibes-diy db` subcommands](../vibes-diy/cli/cmds/db/) (PR #1668, issue #1666). Run this after publishing a dev-channel release to confirm the new commands work end-to-end against a live API.

## What's NOT required

- **No app push needed.** `db put` lazily creates the db on first write — the server only checks that you own the `userSlug`, not that the `appSlug` is registered.
- **No manual `userSlug` choice.** The CLI resolves it from your `defaultUserSlug` user setting (set on first login).

## Setup

```bash
# Install the dev-channel build of the CLI:
npx vibes-diy@dev --help                  # or whichever dist-tag the release uses

# Authenticate this device — opens a browser tab; stores a device-id cert
# in ~/.fireproof/keybag.
npx vibes-diy login

# Confirm: the next command should show your defaultUserSlug.
npx vibes-diy user-settings
```

Expected `user-settings` output includes:

```
UserId:  user_xxxxxxxxxxxxxxxxxxxxxxxx
Setting:
 Type: defaultUserSlug  userSlug: <your-slug>
```

If `defaultUserSlug` is missing, run `vibes-diy login` again or visit the dashboard once to bind a slug.

## App slug for this run

Every command below passes `--app-slug=verify-db-1` inline. If you re-run the runbook on the same account, bump the number (`verify-db-2`, `verify-db-3`, ...) so each run gets a fresh app namespace.

## 1. `db put` — auto-creates db on first write

```bash
npx vibes-diy db put '{"text": "hello", "type": "note"}' --app-slug=verify-db-1
```

Expected:

```json
{
  "id": "<some-uuid-or-timestamped-id>",
  "ok": true
}
```

Capture the id from a second put:

```bash
DOC_ID=$(npx vibes-diy db put '{"text": "second", "type": "note"}' --app-slug=verify-db-1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "Captured: $DOC_ID"
```

## 2. `db get` — round-trip

```bash
npx vibes-diy db get "$DOC_ID" --app-slug=verify-db-1
```

Expected:

```json
{
  "text": "second",
  "type": "note",
  "_id": "<DOC_ID>"
}
```

Negative case:

```bash
npx vibes-diy db get nonexistent-id --app-slug=verify-db-1
```

Expected (non-zero exit + stderr):

```
Error: Document not found: nonexistent-id
```

## 3. `db query` — field-name index

Add a couple more docs first:

```bash
npx vibes-diy db put '{"type": "todo",  "rating": 3}'  --app-slug=verify-db-1
npx vibes-diy db put '{"type": "todo",  "rating": 7}'  --app-slug=verify-db-1
npx vibes-diy db put '{"type": "todo",  "rating": 10}' --app-slug=verify-db-1
npx vibes-diy db put '{"type": "agent", "rating": 5}'  --app-slug=verify-db-1
```

### Query by key

```bash
npx vibes-diy db query type --key '"todo"' --app-slug=verify-db-1
```

Expected: array of 3 docs (rating 3, 7, 10).

### Query by range — the Codex P1 regression test

```bash
npx vibes-diy db query rating --range '[3, 7]' --app-slug=verify-db-1
```

Expected: 2 docs (rating 3 and 7). **The pre-fix bug would have excluded `rating: 10` only via lexical compare, but also incorrectly returned `10` if range was `[3, 20]`.** Verify with the latter:

```bash
npx vibes-diy db query rating --range '[3, 20]' --app-slug=verify-db-1
```

Expected: 3 docs (rating 3, 7, 10). If you see only 2, the charwise encoding regressed.

### Sort order — the other Codex P1 regression test

```bash
npx vibes-diy db query rating --app-slug=verify-db-1
```

Expected: docs ordered by rating numerically: 3, 5, 7, 10. **The pre-fix bug would have ordered `[10, 3, 5, 7]` lexically.**

### Limit + descending

```bash
npx vibes-diy db query rating --descending --limit 2 --app-slug=verify-db-1
```

Expected: top 2 by rating descending (rating 10, 7).

## 4. `db list` — confirm db was created

```bash
npx vibes-diy db list --app-slug=verify-db-1
```

Expected: includes `default` (the implicit db all the above puts went to).

Try a named db:

```bash
npx vibes-diy db put '{"x": 1}' --db notes --app-slug=verify-db-1
npx vibes-diy db list --app-slug=verify-db-1
```

Expected: includes both `default` and `notes`.

## 5. `db del` — delete

```bash
npx vibes-diy db del "$DOC_ID" --app-slug=verify-db-1
```

Expected:

```json
{
  "id": "<DOC_ID>",
  "ok": true
}
```

Verify it's gone:

```bash
npx vibes-diy db get "$DOC_ID" --app-slug=verify-db-1
```

Expected: `Error: Document not found: <DOC_ID>`.

## 6. `db subscribe` — streaming events

Open two terminals.

**Terminal A:**

```bash
npx vibes-diy db subscribe --app-slug=verify-db-1
```

Expected: prints `Subscribed to verify-db-1/default — waiting for events (Ctrl+C to exit)` and blocks.

**Terminal B:**

```bash
npx vibes-diy db put '{"text": "ping from terminal B"}' --app-slug=verify-db-1
```

**Terminal A** should immediately print one JSON line like:

```json
{"type":"vibes.diy.evt-doc-changed","userSlug":"<slug>","appSlug":"verify-db-1","dbName":"default","docId":"<id>"}
```

Then `Ctrl+C` Terminal A to exit cleanly.

## 7. stdin pipe for `db put`

```bash
echo '{"piped": true, "source": "stdin"}' | npx vibes-diy db put - --app-slug=verify-db-1
```

Expected: same `{id, ok: true}` shape as inline JSON.

## 8. `--user-slug` override

```bash
npx vibes-diy db list --user-slug=someone-else-i-dont-own --app-slug=verify-db-1
```

Expected: server rejects with an access-denied or empty result. (No leak of other users' data.)

## Cleanup

There's no `db drop` command yet; for a true wipe, delete docs one by one via `db query` + `db del`, or just leave them — they're under a disposable app slug. Next runbook run, bump to `verify-db-2`.

## Summary checklist

- [ ] `npx vibes-diy login` succeeds
- [ ] `user-settings` shows a `defaultUserSlug`
- [ ] `db put` returns `{id, ok: true}` against a fresh app+db
- [ ] `db get <id>` returns the doc
- [ ] `db get bogus` returns the not-found error
- [ ] `db query <field>` filters/sorts correctly (including numeric range + sort — Codex P1 regression bait)
- [ ] `db list` shows the dbs you wrote to
- [ ] `db del` + `db get` confirms deletion
- [ ] `db subscribe` receives an event when another terminal writes
- [ ] `db put -` reads JSON from stdin
- [ ] `--user-slug` override against an unowned slug is rejected

If any step fails, the failure mode (and which command) tells you which subsystem regressed.
