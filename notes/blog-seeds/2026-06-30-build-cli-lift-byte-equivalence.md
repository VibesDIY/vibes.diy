# Proving a build-tool swap is a no-op: pack the tarball before and after

Source: `jchris/build-cli-lift` (#2904) — executing the Bucket F lift: in-sourcing
`@fireproof/core-cli`'s build tool as the private `@vibes.diy/build-cli`, repointing
32 package scripts off the external dep.

The brief promised a "mechanical, byte-equivalent" lift. The trap with that promise
is that *mechanical* and *byte-equivalent* are two different claims, and only the
second one is checkable. So the verification wasn't "did I copy the files faithfully"
— it was "does the publish artifact come out identical." You prove that by running
the **same package's `pack` with the old bin and the new bin and diffing the two
tarballs**, not by reading diffs of the source you lifted.

Worth a note:

- **Keep a clean checkout of `main` around as the oracle.** The before-tarball has to
  come from *somewhere*. The parent checkout still on `main` (with the old
  `@fireproof/core-cli` bin wired) packs the OLD artifact; the worktree packs the NEW
  one. `tar tzf | sort` for the file list, then a **key-normalized** JSON diff of the
  published `package.json` (`json.dumps(sort_keys=True)`) so a non-deterministic
  dependency reorder doesn't masquerade as a regression. After normalization the only
  difference was the one you intended: `@fireproof/core-cli` → `@vibes.diy/build-cli`
  in devDeps. That's the whole proof.

- **The bin name is the API; keep it.** The package is `@vibes.diy/build-cli`, but its
  `bin` is still `{ "core-cli": "run.js" }`. That's what lets ~32 `core-cli tsc` /
  `core-cli build` scripts keep working with a one-line devDep swap instead of 32
  script rewrites. Rename the package, not the command.

- **Watch the hoisting traps.** A live `grep` found 12 packages that invoke `core-cli`
  in scripts but declare *no* dependency on it — they were resolving the bin via the
  hoisted root install. Swap the root's provider and those silently get the new one
  (or nothing). Give every script consumer an *explicit* devDep so bin resolution is
  deterministic and the publish-pack guard covers the whole workspace.

- **Trim at the import seam, not the file boundary.** The slice is clean only if you
  drop `main.js` (imports `@fireproof/core-runtime`) and trim the evento registry to
  `tsc` + `build` (the full registry imports device-id → the runtime tree). Verified
  with `pnpm ls` from the new package: zero `@fireproof/core-*` resolved. The two
  runtime-seam owners (`vibes-diy`, `identity`) keep the old dep on purpose — they're
  the follow-on tickets.
