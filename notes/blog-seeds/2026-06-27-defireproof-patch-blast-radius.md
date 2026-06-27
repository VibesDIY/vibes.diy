# The patch you delete is never where you think it is: lifting the Clerk/device-id verifiers in-repo

Source: #2706 (PR), #2703 (golden harness), #2671 (security finding), #2708 (CI DX follow-up)

The de-fireproof Task 5 cutover sounded like a one-liner: lift `tokenApi` (the
server Clerk + device-id token verifiers) from `@fireproof/core-protocols-dashboard`
into the repo, and delete `patches/@fireproof__core-types-base@0.24.19.patch`. The
patch did one tiny thing — added `.catch("")`/`.catch(null)` to four Clerk profile
fields (`first`/`image_url`/`last`/`name`) so real Clerk JWTs, which **omit** those
fields, don't get rejected by a strict schema. Lift the code that needs the leniency,
own a lenient copy of the schema, drop the patch. Done.

It was not done. The interesting part is everywhere the leniency had silently leaked.

Decisions / lessons worth a full post:

- **Harden before you cut, and let the harness find the blast radius.** We wrote the
  golden auth-verify harness (#2703) *before* the lift, gated through the
  `@vibes.diy/identity/server` facade so the same suite covers both upstream-now and
  in-repo-after. Dropping the patch naively immediately reddened two wire-compat
  tests — because `CertificatePayloadSchema` embeds the Clerk claim (via
  `CreatingUserSchema`), and `Certor`/`DeviceIdCA` parse **device-id certs** through
  it. The patch's real reach was the *device-id cert path*, not just the Clerk token
  path. Fix: own `CertificatePayloadSchema`/`CreatingUserSchema` referencing the owned
  lenient `ClerkClaimSchema`. Without the pre-written harness this ships and breaks
  device auth in prod.

- **A facade has more than one door.** Even after the server path was clean, Codex
  flagged a P1: the **browser** `VibesDiyApi.getTokenClaims()` imports `ClerkApiToken`
  from the `.` facade, and `index.ts` was still re-exporting the *upstream* one —
  whose `decode()` parses with the now-strict upstream schema. Signed-in users would
  fail before `openChat`. The CLI smoke test (device-id path) couldn't see this; it's
  browser-only and was caught by reading, not running. Fix: split the browser-safe
  `ClerkApiToken` into its own `dash-api/clerk-token.ts` (zero device-id-crypto deps,
  so it doesn't drag `DeviceIdCA` into the browser bundle graph) and re-point the
  facade at it. Lesson: when you delete a compatibility shim, grep **every** re-export
  of the affected type, per entry point — `.`, `./server`, `./node` are different doors.

- **Freeze the oracle against the behavior, not the upstream.** The clerk-claim parity
  test asserts the explicit patched expectations (`first → ""`, `name → null` on
  absence) rather than diffing against the mutable upstream schema — so it survives the
  patch removal instead of evaporating with it. A parity test that compares against the
  thing you're deleting tests nothing once it's gone.

- **Two independent readers beat one runner.** Codex caught the browser door; Charlie
  caught a third instance (`clerk-claim-new-user.test.ts` still importing the strict
  upstream schema) and fixed the CI red directly. Same bug class, three sites — counting
  test failures (#2708: the JSON reporter hides failing test *names* in CI) sent us
  artifact-spelunking to find which test, which is its own DX paper-cut now filed.

The through-line: a "verbatim lift + delete the patch" is really an exercise in finding
every place a small leniency had become load-bearing — schema embedding, multiple
facade entry points, and the test surface itself.
