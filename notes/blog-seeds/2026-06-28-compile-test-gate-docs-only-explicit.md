# A gate that infers an invariant vs. one that asserts it

Source: `claude/harden-compile-test-gate-docs-only` — follow-up to #2782 (CI
sharding), hardening the `compile_test` gate job

#2782 split CI into `scope → checks + test(matrix) → compile_test`, where
`compile_test` is a tiny gate job that keeps the required-check name and reports
red/green based on the upstream jobs' `result`s. Codex + Charlie both flagged the
first cut: it accepted `skipped` as a pass, so a `scope` error (checkout /
changed-scope) that cascades `checks`+`test` to `skipped` could green the required
check — and feed the deploy-time "is this SHA `compile_test`-green?" skip — with
nothing actually run. That hole was closed in #2782 by requiring `scope` AND
`checks` to conclude `success`.

This follow-up tightens the remaining `test=skipped` branch. The merged version
was *correct* but *implicit*: "scope succeeded ⇒ a skipped test must be the
docs-only skip." This makes it *explicit* — accept `test=skipped` only when
`needs.scope.outputs.docs_only == 'true'`.

Worth a note:

- **`skipped` is overloaded in Actions** — it means both "intentionally guarded
  out by `if:`" and "a dependency didn't succeed, so I was cascaded out." A gate
  that treats the two the same is a false-green waiting to happen. The robust move
  is to assert the *reason* you expect the skip (here: `docs_only == 'true'`),
  not to back it out from a sibling job's status.
- **Prefer asserting the invariant to inferring it.** The implicit version breaks
  silently the day someone adds a second `if:` condition to the test job — the
  inference "scope==success ⇒ docs-only" quietly stops holding, but the gate keeps
  passing. The explicit `docs_only` check keeps failing closed regardless of what
  else changes about why `test` skipped.
- **Required-check gates should fail closed.** When a gate job can't positively
  confirm the thing it's standing in for actually ran, the safe default is red,
  not green — especially when a downstream optimization (deploy suite-skip) trusts
  that green.
