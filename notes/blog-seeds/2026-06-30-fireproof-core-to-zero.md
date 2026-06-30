# Driving a meta-package to zero: @fireproof/core was 8 declarations and 1 test import

Source: #2936 (`claude/fireproof-protocols-core-2935-2936`)

`@fireproof/core` (the Fireproof database umbrella) was declared in 8 packages but
imported exactly once — a type-only `SuperThis` in a CLI test, and `SuperThis` is
already owned by `@vibes.diy/identity`. Repoint that one import, drop the 8
nominal declarations, and the meta-package is gone. The angle: meta/umbrella
packages accrue nominal declarations because "the database" feels load-bearing —
but the import graph tells the truth, and the lockfile delta (importer-cleanup
only, no other package entries touched) is the proof that a declaration drop is
surgical and not unhoisting a transitive provider (the #2947 lesson).
