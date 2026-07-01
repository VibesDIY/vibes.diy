# The import map hides which deps are real: 17 nominal protocol-type pins vs 1 that mattered

Source: #2935 (`claude/design-spec-2905-au2501`)

`@fireproof/core-types-protocols-{cloud,dashboard}` were declared in 17 places
across the workspace. Exactly one was load-bearing: `@vibes.diy/identity` really
imports the dashboard types. The other 17 declarations were nominal version pins
— zero source imports (cloud had *zero* imports anywhere; dashboard only in
identity, which declares its own).

The angle worth a post: **you can't read dependency reality off package.json in a
repo with an import map.** The instinct is to trust declarations and the
node-hoisting model — but for these SDK/vibe packages, `use-fireproof` gets
rewritten to `@vibes.diy/vibe-runtime` (Firefly) at serve time by
`grouped-vibe-import-map.ts`, so a fixture's `use-fireproof` entry isn't the
runtime resolution authority at all. The real resolution authority is split three
ways: (1) type-only packages that erase at build (the protocol types — safe to
drop, import-map irrelevant), (2) the vibe import map (runtime rewriting), and
(3) node-side test resolution, where an *under-declaring* consumer
(`eval/codegen-matrix` imports `use-fireproof` without declaring it) resolves
through hoisting — the live #2947 trap that makes the `use-fireproof` cluster
unsafe to sweep mechanically.

So the clean cut is the type-only protocol pins, and the proof they're surgical
is the lockfile: 51 lines removed, all importer `specifier`/`version` refs, zero
`resolution:`/package-graph entries touched (the 25 package definitions stay,
pulled transitively by `use-fireproof`/`identity`). Same safe-delta signature as
#2951/#2953. The docker test matrix — not a local build — is what actually
certifies no unhoisting happened.
