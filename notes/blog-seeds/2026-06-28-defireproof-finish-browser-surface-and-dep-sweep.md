# Finishing the browser identity surface — and why "owning the schema" was the cheap part, dropping the dep was the win

Source: de-fireproof identity epic, Tasks 6.2 / 6.3 / 7 (partial). Keybag write-path lift split out to its own design issue (#2716).

By this point the epic had already lifted the device-id crypto and the Clerk
token verifier in-repo. What was left on the browser `.` surface and the leftover
`core-types-base` value imports looked like cleanup — but it's where two
non-obvious things showed up.

Decisions / gotchas worth a full post:

- **A facade has three doors, and the browser one is the trap.** `@vibes.diy/identity`
  exposes `.` (browser), `./server` (worker), `./node`. The last `@fireproof/*`
  *value* import on the browser door was `clerkDashApi`/`DashboardApiImpl` from
  `core-protocols-dashboard`. It's a pure HTTP client — a single PUT-per-request
  JSON wrapper — so lifting it carried none of the strict-claim-decode bug class that
  bit Task 5 (verified: it never decodes a JWT). The only friction was *types*: the
  upstream signature pulls `LoadedClerk` from `@clerk/shared`, which the identity
  package doesn't (and shouldn't) depend on. Fix: narrow the parameter to the minimal
  `LoadedClerkLike` surface the client actually touches (`addListener` +
  `session.getToken`) — the sole consumer already adapts via
  `Parameters<typeof clerkDashApi>[0]` + `as unknown as`, so nobody downstream cares.

- **TS2883 is invisible until ship.** The owned device-id payload schemas
  (`Subject`/`Extensions`/`FPDeviceIDCSRPayload`/`FPDeviceIDSession`) infer Zod types
  that reference zod-internal symbols by a pnpm-hashed path that can't be named in an
  emitted `.d.ts`. `tsc --noEmit` (normal CI) and esbuild (worker builds) never emit
  declarations, so this only blows up in the *publish* build. The discipline that
  works: keep internal building-block schemas un-exported, annotate the
  externally-consumed ones with their upstream named type (`z.ZodType<Subject>` via an
  `as` cast — runtime byte-identical, declaration portable), and **run
  `core-cli build` locally** (it stops at `ENEEDAUTH` — that's the declaration step
  passing) instead of trusting green CI.

- **"Own it leniently" applies transitively.** The CSR payload's optional
  `creatingUser` carries a Clerk claim. The deleted `core-types-base` patch made those
  profile fields (`first`/`image_url`/`last`/`name`) lenient; a real Clerk JWT omits
  them. So the owned CSR schema wires its `CreatingUserSchema` to the *owned* lenient
  `ClerkClaimSchema`, not a fresh strict copy — and a parity test freezes it by
  asserting the owned schema **accepts** the lean claim while the now-unpatched
  upstream **rejects** it. That divergence is the feature, pinned as a gate.

- **The deliverable is the dependency count dropping — and the grep is what makes it
  safe.** Before deleting any dep line: `grep` the *whole repo* for every importer.
  `core-protocols-dashboard` had exactly **one** importer repo-wide (the browser
  facade we just repointed) → removable from all 9 declaring packages.
  `core-device-id` was imported **only** by `api/tests` baseline fixtures (kept
  deliberately — they generate the comparison oracle) → removable from the other 6.
  Net: two heavy deps gone from ~13 package.jsons, zero source changes in those
  packages, full monorepo build still green. The keybag (`core-keybag`) couldn't go
  in this PR — it's a credential *write* path with no enroll coverage, so it got a
  spec-first design issue instead of a hasty lift.

The through-line: the risky-looking lifts (HTTP client, schemas) were mechanical
once you respected the byte-compat and declaration-emit constraints; the
*satisfying* part was that the actual goal — `pnpm` resolving fewer `@fireproof/*`
packages — fell out of a careful grep, not a rewrite.
