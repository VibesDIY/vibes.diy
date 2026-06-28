# Why generated apps duplicate their starter content — and the one-line fix

Source: `claude/pitch-deck-deck-reference-error-ozems2`

A deployed pitch-deck vibe kept piling up copies of its six seed slides — six, then twelve, then eighteen. The cause is a trap baked into the local-first reactive model: `useLiveQuery` renders **empty before data arrives**, so a first-load seeding effect guarded by `docs.length === 0` fires on *every* fresh load. The seeds were written with `database.put({ ...s })` — no `_id` — so Fireproof minted a new random id each time, and a `useRef` "already seeded" flag only covered the current session, never the next reload, a second device, or a collaborator. Result: unbounded duplication.

The fix is one principle: **seed/starter content gets a deterministic `_id`** (`"seed:" + key`), exactly like channels/profiles/config singletons already do. Then the seed write is idempotent — re-running overwrites the same N docs instead of cloning them. Corollary gotcha: don't stamp `Date.now()` into seed payloads, or each redundant seed rewrites the doc with new content and churns revisions even though the id is stable.

The durable change is to the codegen prompt (`prompts/pkg/llms/fireproof.md`): a new "Seeding starter data" section on the App.jsx side, plus extending the access-fn `_id`-strategy note to list seeds. The interesting tension for a post: the empty-state-not-loading-spinner pattern is a *feature* of the reactive model, but it silently breaks naive seed-on-empty code — the same property that makes the UI feel instant is what makes "is this DB empty?" an unreliable question to seed off of.
