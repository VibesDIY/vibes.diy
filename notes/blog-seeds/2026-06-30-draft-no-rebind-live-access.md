# Saving a draft shouldn't silently rewrite who can touch the live data

Source: `claude/fix-2902-1bxgik` — #2902: an unpublished dev draft was re-binding
the live access function for a published app, with no publish/consent step.

`AccessFunctionBindings` is keyed `(ownerHandle, appSlug, dbName)` with no version
dimension, and write-time enforcement (`app-documents-write-eventos`) reads it by
`appSlug` alone. So whoever wrote that row *last* governed the whole live data
namespace. The row was (re)written on **every** version creation in
`ensureAppSlugItem` regardless of `mode` — and the streaming-codegen auto-save
during in-editor iteration routes through that path with `mode: "dev"`. Net
effect: just editing `access.js` in a draft flipped the enforced policy for the
published app's real users.

The fix keeps the single-row schema (no migration) but makes the *governing
version* the only writer:

- **Dev drafts are inert once a published version exists.** `processAccessBindings`
  now takes `mode`; when `mode === "dev"` and a `production` Apps row exists, it
  returns without touching the binding. Before first publish there's no production
  row, so the latest dev draft still governs — an owner can iterate on `access.js`
  pre-publish.
- **Publish is the consent step.** `publishApp` didn't touch bindings at all (it
  only mints a release row), so a naive "gate on production" would have frozen the
  binding forever on the normal web flow. New `publishAccessBindings` re-hydrates
  the published fsId's `access.js` source from storage (the stored filesystem
  carries only content-addressed refs) and binds in production mode.

Worth a note:

- **A "just gate it on publish" one-liner was wrong because the publish path
  didn't own the binding.** The binding was a side effect of *version creation*,
  and the web publish flow creates its production row in a different function
  (`mintProductionRelease`) that never called the binding code. Tracing where the
  write actually happened — not where it conceptually belongs — turned a one-line
  guard into "move the write to the publish path AND make drafts inert."

- **Forks insert their Apps row directly, so they were invisible to the binding
  code.** `fork-app` bypasses `ensureAppSlugItem`, so forked apps carried *no*
  binding — and the new dev-gate would have stopped a cloned (production) app from
  ever acquiring one via a later edit. Closed that latent gap by binding from the
  shared filesystem at fork time.

- **Fail-closed on a re-bind error.** If `publishAccessBindings` can't fetch the
  source, it logs and leaves the previous published binding in place (the old
  policy), never a draft's — a stale-but-published policy beats an
  accidentally-loosened one.

- **The UI surfaces the new model instead of hiding it.** The share modal's
  publish control now warns, when a published app has unpublished changes, that the
  live version — *including its `access.js` rules* — won't change until you publish.
