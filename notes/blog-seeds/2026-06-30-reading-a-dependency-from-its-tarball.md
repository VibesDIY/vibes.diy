# Reading a dependency's shape from its tarball when you can't clone it

Source: `claude/implement-2483-phf3oe` (#2483 follow-up) — preparing the
mechanical lift of `@fireproof/core-cli`'s build tool into the monorepo.

The goal flipped from "defer" to "in-source it and kill the dep." The mechanical
path wants the source — which lives in a repo this session couldn't reach
(`add_repo` approval channel was down; the agent proxy `403`s any out-of-scope
clone). The unlock: you don't need the repo to map the lift. `npm view <pkg>
dist.tarball` + `tar xzf` gives you the published surface, and the **import graph
of the compiled JS is enough to prove the slice is clean.**

Worth a note:

- **A "kitchen-sink" dependency is usually three dependencies in a trench coat.**
  `@fireproof/core-cli` reads as one coupling, but it backs three unrelated things
  we consume: the build-tool bin, the cmd-ts runtime primitives (already seamed),
  and device-id symbols (owned by identity). Its scary-looking dep tree
  (`core-runtime`, `core-keybag`, `core-device-id`) is real — but it belongs to
  the *other two* tenants. Grepping the build-tool slice's actual imports showed it
  pulls in only `cmd-ts`/`zx`/`arktype`/`fs-extra`/`semver`/cement — zero Fireproof
  runtime. The migration that looked like "drag in the whole database" is actually
  "lift two commands and a version-pinner."

- **The dist you'd never ship is a perfect map of what to lift.** We want the TS
  *source* (for ownership), not the compiled dist — but the dist's file list and
  import edges tell a privileged agent *exactly* which source files and symbols to
  take, and which to drop (`main.js` imports `core-runtime`; `cmd-evento.js`
  imports every command — trim both). The artifact you're replacing doubles as the
  spec for replacing it.

- **`core-cli tsc` was ~70 lines.** The command that's wired through 30-odd build
  scripts is, at bottom, `$ ${FP_TSC ?? "tsgo"} ${args}` with PowerShell quoting.
  Knowing that up front right-sizes the whole effort: the `tsc` half is trivial,
  the `build` half (isolated publish build + workspace-version rewriting) is the
  only real code.

- **When you're blocked on a capability, the deliverable is the brief, not the
  apology.** Couldn't finish the lift (no source access), so the unit of work
  became a handoff a more-privileged agent can execute cold: goal, verified
  inventory, the tarball anatomy, the clean dep set, staged plan, byte-equivalence
  verification, and the gotchas already paid for.
