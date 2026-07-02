# "The code reads the env var" is not "the deploy sets it"

**Hook:** We shipped a merge-safe security gate keyed on `env.BACKEND_INTERNAL_SECRET` and called it
done. It wasn't reachable: nothing put that secret into the worker. Reading an env var in code and
provisioning it at deploy are two entirely separate wiring jobs.

**Source:** #2856 backend.js control-plane gate follow-up. The gate merged; activating it needs the
secret in the worker runtime env.

**The trade-off / why / gotcha:**

The deploy doesn't hand the whole GitHub-Actions env to the worker. It pushes an explicit allow-list
to Cloudflare via `wrangler secret bulk`, built from `deploy-cli writeEnv --fromEnv X --fromEnv Y …`.
A key reaches the worker only if it's (1) an action input, (2) passed from the deploy job's `with:`,
and (3) named in that `--fromEnv` list — for *each* worker. Our new secret was in none of those, so
`grep BACKEND_INTERNAL_SECRET .github/` came back empty: adding a GitHub secret alone would have been
a silent no-op.

Two nice properties fell out of doing it the repo's way instead of `wrangler secret put` by hand:

- **One env secret covers both workers.** The main worker (`vibes.diy/pkg`) and the queue consumer
  (`vibes.diy/api/queue`) deploy in the *same job under the same `environment:`*, each with its own
  `--fromEnv` line. So a single `prodv2` environment secret feeds both atomically — the "set it in
  both or you get split-brain" hazard the gate's design warned about just disappears.
- **Guarded `--fromEnv` makes it merge-safe.** `${BACKEND_INTERNAL_SECRET:+--fromEnv …}` only adds the
  key when it's non-empty, mirroring `CLERK_WEBHOOK_SECRET`. Merge the plumbing with the secret unset:
  nothing changes. Set the secret later: the next deploy injects it and the gate activates. No
  flag-day.

**Lesson:** when a feature depends on a new runtime secret, the PR isn't done at "the code reads
`env.X`." Trace the value all the way to the worker — input → job `with:` → per-worker `--fromEnv` —
and prove it with a grep. A security control that's dormant because its secret never arrives looks
exactly like one that's working.
