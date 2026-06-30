# In-sourcing real crypto: a frozen golden vector beats a live parity oracle

Source: `claude/device-id-keybag-crypto-urwu0l` (#2937)

The long pole of de-fireproofing was the device-id / keybag crypto in
`@vibes.diy/identity` — the genuine cryptographic kernel, not a type swap. By the
time we got here the *runtime* (CA, CSR, signer, verifier, Certor, keybag) was
already lifted verbatim; what remained was owning the ~30 base/device-id TYPES it
imported and dropping the last `@fireproof/core-device-id` value usage (the
`createTestDeviceCA` / `createTestUser` harness that ~70 api tests reach for).

Two things worth a post:

1. **TS2883 forces you to hand-write the types.** You can't just
   `export type X = z.infer<typeof Schema>` across a package boundary — the emitted
   `.d.ts` names zod-internal symbols by a pnpm-hashed path that can't be portably
   named. So the owned types are hand-written erasable interfaces, and the schemas
   are annotated `z.ZodType<Owned>`. Reproducing upstream *mutability* exactly
   (z.infer is mutable; `.readonly()` maps to `Readonly<>`) matters — a stray
   `readonly` would break assignability at 100+ call sites.

2. **Freeze a golden vector instead of keeping a live parity oracle.** The old
   gate cross-verified the owned signer against the *live* `@fireproof` signer on
   every CI run — which means you can never actually delete the dependency. We
   captured the upstream signer's exact JWT *header* bytes (kid/x5c/x5t/x5t#S256 —
   all deterministic from key+cert, no timestamps) into a frozen fixture,
   cross-checked byte-identical against the owned signer at capture time, then
   dropped the dep. The permanent test asserts owned == frozen. The trade-off: a
   frozen oracle can't catch upstream drift (there's no upstream anymore — that's
   the point), but it pins the byte contract forever with zero residual coupling.
   The randomized ES256 signature and wall-clock `iat`/`exp` are intentionally
   excluded from the freeze.

Gotcha captured: the owned `JWTPayload` (no index signature, matching upstream)
isn't comparable to jose's index-signatured `JWTPayload` via a direct `as` — the
lift had added an `as JoseJWTPayload` cast that upstream never needed (it passed
the payload straight through, relying on structural assignability). The fix was
to match upstream's intent with `as unknown as`.
