# The prod-DB query tool that hides in plain sight (and why psql hangs in the cloud)

Source: `agents/db-inspect.md`, `vibes.diy/api/svc/usage-report/inspect-db.ts`

Diagnosing why a growth chart flatlined meant querying prod Neon. First instinct —
`psql "$NEON_DATABASE_URL"` — **hangs and times out** in a cloud session: outbound only
leaves via the agent HTTPS proxy, and the Postgres wire protocol isn't HTTPS, so the TCP
connect never completes (even `connect_timeout` doesn't save you — the socket is accepted
by the proxy, just never speaks Postgres).

The fix was already in the repo: `pnpm --dir vibes.diy/api/svc run db:inspect`. It talks
to Neon through `@neondatabase/serverless`, whose transport rides HTTPS and therefore
sails through the proxy (`info` even reports `server_addr 127.0.0.1` — the local proxy).
It was referenced in three task-specific agent docs but had no canonical home, so the next
agent would rediscover the psql dead-end from scratch. This PR gives it one, plus two
Quick-Reference pointers.

Worth a post because it's a clean example of the cloud-session network model biting an
obvious tool, and of the fix being "document the sanctioned path" rather than new code.
Gotchas captured in the doc: the `sql` subcommand's "read-only" check is only a prefix
allowlist (SELECT/WITH/SHOW/EXPLAIN) — writable CTEs and `explain analyze <dml>` slip
through, so it's not mutation-proof against prod (hardening tracked in #2982); it always
hits **prod** (never local SQLite — a known trap); and identifiers are case-sensitive
camelCase where the Drizzle field name often differs from the SQL column (`ownerHandle` →
`"userSlug"`). Codex's review of the PR caught both the "cannot mutate" overclaim and a
"newest rows" claim that was really "ordered by the first column."
