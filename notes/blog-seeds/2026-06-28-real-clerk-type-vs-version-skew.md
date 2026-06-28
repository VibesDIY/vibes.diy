# When a "minimal interface" is hiding a version skew: restoring the real Clerk type cast-free

Source: de-fireproof follow-up to #2719, branch `claude/dash-client-real-clerk-type`. Replaces a fabricated minimal clerk interface with `@clerk/shared`'s real `LoadedClerk`.

When we lifted the dashboard HTTP client in-repo (#2719), I typed `clerkDashApi`'s `clerk` param as a hand-written minimal `LoadedClerkLike` (`addListener` + `session.getToken`) to avoid pulling `@clerk/shared`. It compiled clean and the call site needed no cast. Looked tidy. It wasn't — "we don't do casts," and a fabricated stand-in type is a soft cast: it asserts "this object is close enough" without the compiler ever checking against the real shape.

Restoring the real `LoadedClerk` surfaced *why* the minimal interface compiled so easily — it was papering over a real dependency skew:

- **Upstream `core-protocols-dashboard@0.24.19` was built against `@clerk/shared@4.6.0`**, whose `getToken` accepted a loose/unconstrained options type. Our app uses `@clerk/shared@4.15.0` (via `@clerk/react@6.7.3`), where `getToken: (options?: GetTokenOptions) => …` is strict. So the exact upstream line `session.getToken(cfg.getTokenCtx)` — with `getTokenCtx: T` (an unconstrained generic) — compiles against 4.6.0 but *not* 4.15.0. The minimal interface dodged this by typing `getToken(opts?: unknown)`.

The fix that's both faithful and cast-free at the call site:
1. **Import the real `LoadedClerk` from `@clerk/shared/types`** and depend on `@clerk/shared@^4.15.0` — the *same* version `@clerk/react` resolves, so `useClerk()`'s return type and our param type are one identity. The consumer (`VibeContext`) now passes `clerk` directly, no cast.
2. **Constrain the generic: `clerkDashApi<T extends GetTokenOptions = GetTokenOptions>`.** That's the honest type — on the Clerk-specific path the token-fetch context *is* a `GetTokenOptions` — and it lets `session.getToken(cfg.getTokenCtx)` type-check against the strict 4.15.0 SDK with no cast.

The one remaining cast is in the *test's* partial clerk stub (`as unknown as LoadedClerk`) — legitimate, localized test scaffolding for a vendor SDK type, not production type-laundering.

Two lessons worth a post: (1) a hand-rolled minimal interface that "just compiles" against a third-party SDK is often masking a version mismatch you'll meet later — using the real type forces the skew into the open where you can fix it honestly; (2) the right answer to a generic-vs-vendor-type friction is usually to *constrain the generic to the truth* (`T extends GetTokenOptions`), not to cast it away.
