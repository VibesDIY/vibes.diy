# Validate before you mutate: rejecting a bad push without a partial commit

Source: `claude/backend-js-b2b-bindings` (B2b of #2856; follows the B2a parser)

B2b wires `backend.js` discovery into the push pipeline: when an author pushes a vibe, the server now
records which trigger handlers exist and the validated schedule interval, the same conceptual move it
already makes for access-function bindings. The interesting design tension was *where* to enforce the
"reject a sub-5s interval at push time" rule. The push pipeline does real work in order — store assets,
ensure the app, write access bindings — and the natural place to call the new `processBackendBindings`
is right after the access bindings, mirroring the existing code. But rejecting there means the asset
store and access bindings have *already* been mutated: a bad interval would fail the push while leaving
half the work committed. The fix is to split validation from persistence: run the *pure*
`parseBackendConfig` against the in-memory `req.fileSystem` **before any storage or DB call**, return a
clean `app-slug-invalid` error if the interval is out of bounds, and only do the persistence *after*
the app is ensured — by which point the config is known-good.

The second draft of this slice taught the better lesson: the *first* version added a dedicated
`BackendFunctionBindings` table, copying the access-bindings shape one-for-one. Grounding the
requirement against what's actually read showed the copy was unjustified — the access table exists
because its CID is read on the every-write `putDoc` hot path, and backend discovery has no equivalent
hot path (the source already lives in `Apps.fileSystem`, read once per runtime cold-start). So the
rework *deletes* the table and stores discovery as an `active.backend` entry in the existing AppSettings
JSON, written with the same direct-update pattern as `ensureAppMetadata`. Dropping the table also drops
the migration — turning a deploy-first change into a garden-variety one. Three things worth a post:
(1) the general "validate before you mutate" principle for any multi-step write pipeline, and how a pure
parser makes the early gate cheap; (2) "do you even need a table?" — copying an existing pattern is the
default, but the precedent only applies if the *reason* for it (a hot path) also applies; the cheapest
schema change is the one you don't make; and (3) the subtlety that a client transport can surface a
server "res-error" as a `Result.Err` rather than an `Ok(error)` — the kind of contract you only
discover by reading how the existing rejection tests assert, not by guessing.
