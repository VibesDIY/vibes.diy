# Validate before you mutate: rejecting a bad push without a partial commit

Source: `claude/backend-js-b2b-bindings` (B2b of #2856; follows the B2a parser)

B2b wires `backend.js` discovery into the push pipeline: when an author pushes a vibe, the server now
persists a `BackendFunctionBindings` row (which handlers exist, the validated schedule interval) the
same way it already persists access-function bindings. The interesting design tension was *where* to
enforce the "reject a sub-5s interval at push time" rule. The push pipeline does real work in order —
store assets, ensure the app, write access bindings — and the natural place to call the new
`processBackendBindings` is right after the access bindings, mirroring the existing code. But rejecting
there means the asset store and access bindings have *already* been mutated: a bad interval would fail
the push while leaving half the work committed. The fix is to split validation from persistence: run
the *pure* `parseBackendConfig` against the in-memory `req.fileSystem` **before any storage or DB
call**, return a clean `app-slug-invalid` error if the interval is out of bounds, and only do the
persistence (the upsert) *after* the app is ensured — by which point the config is known-good. Three
things worth a post: (1) the general "validate before you mutate" principle for any multi-step
write pipeline, and how a pure parser makes the early gate cheap; (2) a nice property of this codebase
— it's schema-as-source-of-truth via `drizzle-kit push`, so adding a table is *just* editing the
schema (no hand-written migration), and the test harness's globalSetup pushes the schema into a fresh
SQLite DB so an end-to-end test exercises the real table; and (3) the subtlety that a client transport
can surface a server "res-error" as a `Result.Err` rather than an `Ok(error)` — the kind of contract
you only discover by reading how the existing rejection tests assert, not by guessing.
