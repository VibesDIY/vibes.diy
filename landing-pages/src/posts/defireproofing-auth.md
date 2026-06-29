---
title: "We deleted our auth dependency. Nothing changed."
date: 2026-06-28T09:00:00Z
author: "Vibes DIY"
summary: "We moved our device-id PKI and Clerk token verifiers in-house, out of @fireproof/*, with zero call-site changes — gated by a byte-compatible golden harness so the lift was provably identical before we cut the dependency."
glyph: "lift the runtime ↑"
---

Dropping `@fireproof/*` from our login path looked like a one-line delete. It was a heart transplant — and the whole trick was making nothing above the cut notice.

An earlier round of "facade" work had already relocated *where* the imports lived — everything routed through `@vibes.diy/identity`. But the runtime values were still `export … from "@fireproof/*"`: the device-id key/sign/CSR/verify crypto, the server CA, the keybag, the Clerk token verifier, the dashboard client, the auth wire-types. The package boundary had moved; the code hadn't. This is the story of pulling a live PKI runtime in-house without changing a single thing above that boundary — and the gates that made it not-reckless.

## Lift verbatim behind an unchanged facade

The whole strategy rests on one decision: **no call site changes.** Because every consumer already imports from `@vibes.diy/identity`, the extraction is invisible above the package boundary. The blast radius is one package, not the repo. The facade is the seam, and the seam doesn't move.

That also reframed an issue we'd filed against ourselves. A "coordinate with upstream" ticket (#2649) turned out to be *our* code to fix — mid-extraction, the boundary had already moved in-repo, so there was no upstream to coordinate with anymore.

## A byte-compat gate, not a trust-me

Vendoring security-critical code is a real trade: you own the PKI, you own the bugs. The gate that makes it survivable is proving the lifted crypto is identical to the original *before* the dependency is cut, not after.

So we extended the golden harness with an extracted ⇄ fireproof cross-verification step, and — crucially — we wrote the golden auth-verify harness (#2703) **before** the lift, routed through the `@vibes.diy/identity/server` facade so the same suite covers both upstream-now and in-repo-after. The rule we set: every lifted symbol carries source-lock provenance — annotated with the upstream it was copied from — so a future upstream fix is a deliberate re-sync, not a silent drift. "We forked this" never becomes "we forgot where this came from."

## The patch you delete is never where you think it is

Task 5 sounded like a one-liner: lift `tokenApi` (the server Clerk + device-id token verifiers) from `@fireproof/core-protocols-dashboard`, then delete `patches/@fireproof__core-types-base@0.24.19.patch`. The patch did one tiny thing — added `.catch("")`/`.catch(null)` to four Clerk profile fields (`first`/`image_url`/`last`/`name`) so real Clerk JWTs, which omit those fields, don't get rejected by a strict schema.

Dropping the patch naively immediately reddened two wire-compat tests. The reason is where the leniency had leaked: `CertificatePayloadSchema` embeds the Clerk claim (via `CreatingUserSchema`), and `Certor`/`DeviceIdCA` parse **device-id certs** through it. The patch's real reach was the device-id cert path, not just the Clerk token path. Without the pre-written harness, that ships and breaks device auth in prod.

The fix: own `CertificatePayloadSchema` and `CreatingUserSchema`, both pointing at our owned, lenient `ClerkClaimSchema`. And freeze the oracle against the *behavior*, not the upstream — the parity test asserts the patched expectations (`first → ""`, `name → null` on absence) rather than diffing against a schema we were about to delete. A parity test that compares against the thing you're deleting tests nothing once it's gone.

## A facade has more than one door

Even after the server path was clean, Codex flagged a P1: the **browser** `VibesDiyApi.getTokenClaims()` imports `ClerkApiToken` from the `.` facade, and `index.ts` was still re-exporting the *upstream* one — whose `decode()` parses with the now-strict upstream schema. Signed-in users would fail before `openChat`. The CLI smoke test couldn't see it; it's browser-only, caught by reading rather than running.

> When you delete a compatibility shim, grep **every** re-export of the affected type, per entry point. `.`, `./server`, `./node` are different doors.

The fix split the browser-safe `ClerkApiToken` into its own `dash-api/clerk-token.ts` — zero device-id-crypto deps, so it doesn't drag `DeviceIdCA` into the browser bundle graph — and re-pointed the facade at it.

## Finishing the browser surface — and dropping the dep

The last `@fireproof/*` *value* import on the browser door was `clerkDashApi`/`DashboardApiImpl` from `core-protocols-dashboard`. It's a pure HTTP client — a single PUT-per-request JSON wrapper — so it carried none of the strict-decode bug class. The only friction was *types*, which is its own story below.

The actual deliverable was the dependency count dropping, and a `grep` is what made it safe. Before deleting any dep line, we grepped the whole repo for every importer. `core-protocols-dashboard` had exactly **one** importer repo-wide (the browser facade we'd just repointed) → removable from all 9 declaring packages. `core-device-id` was imported only by `api/tests` baseline fixtures (kept deliberately — they generate the comparison oracle) → removable from the other 6. Net: two heavy deps gone from ~13 `package.json`s, zero source changes in those packages, full monorepo build green.

One path we *didn't* lift: the keybag (`core-keybag`). It's a credential **write** path with no enroll coverage, so it got a spec-first design issue (#2716) and a characterization harness instead of a hasty lift — pinning the on-disk contract first. That harness also taught us something a careless probe gets backwards: `getKeyBag` caches per-URL in memory, so a warm read returns what you just wrote and never touches the schema. Force a cold read and the truth shows: write is opaque, read **strict-parses the full `CertificatePayloadSchema`**. That asymmetry is exactly the kind of thing a harness exists to lock.

## Restoring the real Clerk type, cast-free

The dashboard client's type friction was tempting to paper over. We first typed `clerkDashApi`'s `clerk` param as a hand-written minimal `LoadedClerkLike` (`addListener` + `session.getToken`) to avoid pulling `@clerk/shared`. It compiled clean, no cast at the call site. But a fabricated stand-in type is a soft cast — and we don't do casts.

Restoring the real `LoadedClerk` revealed *why* the minimal interface compiled so easily: it was papering over a version skew. Upstream `core-protocols-dashboard@0.24.19` was built against `@clerk/shared@4.6.0`, where `getToken` took a loose options type. Our app uses `@clerk/shared@4.15.0` (via `@clerk/react@6.7.3`), where `getToken: (options?: GetTokenOptions) => …` is strict. The exact upstream line `session.getToken(cfg.getTokenCtx)` compiles against 4.6.0 but not 4.15.0.

The honest fix:

1. Import the real `LoadedClerk` from `@clerk/shared/types` and depend on `@clerk/shared@^4.15.0` — the same version `@clerk/react` resolves, so `useClerk()`'s return type and our param type are one identity. The consumer passes `clerk` directly, no cast.
2. Constrain the generic: `clerkDashApi<T extends GetTokenOptions = GetTokenOptions>`. On the Clerk path the token-fetch context *is* a `GetTokenOptions`, so it type-checks against the strict SDK with no cast.

The one remaining cast lives in a test's partial stub (`as unknown as LoadedClerk`) — localized scaffolding for a vendor type, not production type-laundering.

The through-line across all of it: a "verbatim lift + delete the patch" is really an exercise in finding every place a small leniency had become load-bearing — schema embedding, multiple facade doors, the test surface itself, and a version skew hiding behind a too-convenient type. The risky-looking lifts were mechanical once we respected the byte-compat and declaration-emit constraints. The satisfying part was that the real goal — `pnpm` resolving fewer `@fireproof/*` packages — fell out of a careful grep, not a rewrite.

<div class="post-cta">
  <h3>Own the runtime that signs you in.</h3>
  <p>Identity you can read, fork, and prove — not a black box you import on faith.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
