# The dependency you keep on purpose

Source: `claude/implement-2483-phf3oe` (#2483, Bucket F — the deferred
build-toolchain item from the de-fireproof far-shore work #2459/#2470/#2478).

The runtime coupling to `@fireproof/core-cli` got contained behind a one-file
re-export seam (#2478). Bucket F was the *other* half: `core-cli tsc` / `build` /
`pack` / `publish` wired through 33 package scripts and 22 devDependency
declarations. The obvious instinct on a "technical-debt" issue is to rip the
dependency out. The right answer was to write down *why we're keeping it.*

Worth a note:

- **"core-cli" is two tools wearing one name, with opposite replaceability.**
  `core-cli tsc` is just a `tsc` front-end (the replacement compilers — tsgo,
  typescript@6 — are already devDeps; swapping it is medium-risk and internal).
  `core-cli build` is an *isolated publish build*: it copies only one package's
  sources into `dist/npm/`, runs a standalone `tsc` with `include: ["**/*"]`, and
  emits the published export map. Conflating them makes the migration look either
  trivial or impossible; separating them is the whole analysis.

- **The thing you'd replace is the thing CI just doubled-down on.** Weeks before
  this issue, #2862/#2864/#2879 made `pnpm -r run --if-present pack` (i.e.
  `core-cli build --doPack` for every package) a *required* PR check, precisely
  because the isolated publish build catches the "compiles in the bundle, breaks
  at publish" bug class that no dev build exercises. Replacing the publish build
  now would mean re-implementing it *and* re-validating the guard against the
  replacement — fighting the most recent decision for no present payoff. And it
  ships npm bytes, where esm.sh caches bad URLs, so a wrong cut can't be quietly
  rolled back.

- **A decision record is an implementation.** The acceptance criterion was "a
  clear decision record (extract/replace now vs defer) with rationale" — the
  byte-for-byte-equivalence criterion was explicitly *conditional on migrating*.
  So the deliverable for this issue is a verified inventory + a DEFER decision +
  documenting the coupling in the publish runbook, not a code migration. The issue
  said as much ("likely wants its own brainstorm/spec before any code"); honoring
  that is the work, not a dodge of it.

- **"Reduce where practical" has a lockfile-shaped catch.** The inventory surfaced
  one real cleanup: a lone `^0.24.19` caret outlier among 21 exact `0.24.19` pins.
  Trivial edit — but flipping a package.json specifier without regenerating
  `pnpm-lock.yaml` reddens `--frozen-lockfile` CI. An offline branch can't safely
  regen the lock, so the honest move is to file it as a quick-win for a session
  that can `pnpm install`, not to "fix" it blind.
