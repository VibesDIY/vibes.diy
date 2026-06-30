# DMs become an access function — deleting a special case by turning auth into data

- **Branch / PR:** `claude/2290-infrastructure-migration-qs4iw2` — #2290
- **Hook:** Direct messages were gated by a bespoke `_d.<a>.<b>` ownerHandle slug
  and a hardcoded `isDirectChannel(...)` fork in **five** read/write/subscribe/delete
  handler sites — each re-implementing "are you one of the two participants?" and
  each carrying an _implicit_ invariant (leave `access = "none"`) so the owner-override
  read bypass couldn't reach another user's private DMs. We moved DMs onto the
  ordinary access-fn + channel-gating pipeline and deleted the forks.

## The trade-off / why

A DM db (`appSlug: "dm"`, `dbName: "messages"`, `ownerHandle: "_d.a.b"`) now resolves
to a **built-in DM access function** via a _synthetic_ binding — no `/access.js`,
no `AccessFunctionBindings` row, no new table. The fn parses the two participants
out of the channel slug, denies non-participants, and routes each message into one
channel granting both participants and only them. The owner-override boundary then
falls out of the data: nobody holds the `owner` role on a synthetic `_d.a.b`
namespace, so override structurally cannot reach a DM.

Two pieces of plumbing made it work:

- **`ctx.ownerHandle`** — the access fn never received the db's ownerHandle, but the
  DM fn's whole job is to read the channel slug. We pass it into the QuickJS sandbox
  as `ctx.ownerHandle` (optional, additive — every existing `access.js` ignores it).
- **A centralized binding resolver** — the same `(ownerHandle, appSlug, dbName)`
  binding lookup was duplicated inline in five handlers. It's now one
  `resolveAccessBinding` that short-circuits `appSlug === "dm"` to the built-in CID,
  with a sibling `resolveAccessFnSource` that returns the compiled-in source (the
  CID is a genuine `base58btc(sha256(source))` content address, not a magic string).

## Gotcha worth a post

Two front gates fought the migration, and both are the same lesson — a coarse gate
runs _before_ the fine-grained one and must learn to defer:

1. **Reads.** `readAllowed` requires app-level read access (or `publicAccess.enable`)
   _before_ the channel filter runs. A DM participant has neither on the synthetic
   "dm" app, so naively deleting the fork denied every DM read. Fix: for DM dbs the
   front gate defers to the channel filter (scoped to `appSlug === "dm"` so real
   apps are byte-identical).
2. **Writes.** `aclAllows(undefined, "write", "none")` is `false`, so an
   authenticated participant would be denied by the imperative ACL gate the instant
   the fork was gone. Fix: DM writes skip the ACL gate and let the built-in fn be
   the sole authority — which also _re-derives_ the old "DMs require auth" rule for
   free (the fn returns `forbidden` when `user` is null).

Honest scorecard: net line count is roughly break-even (~110–140 lines of forking +
duplicated queries deleted, ~70–90 added for the built-in fn + resolver + wiring).
The win isn't deletion — it's that DM authorization stopped being a parallel code
path and became a 15-line access function plus a synthetic binding. The
load-bearing "owner can't read DMs" invariant is now _declared_, not implied by the
shape of an `if`. And the next channel feature (group channels, say) reuses the
same path instead of growing a sixth fork.
