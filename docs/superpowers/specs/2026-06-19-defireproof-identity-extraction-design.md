# Removing the `@fireproof/*` dependency — extracting the identity/PKI core

Status: **DESIGN / DISCUSSION** — not yet a plan. Do not start implementation.

Related:

- [#1616](https://github.com/VibesDIY/vibes.diy/issues/1616) — cert callback success page lives in fireproof's CLI handler (the visible symptom of owning none of the login PKI surface).
- [#1438](https://github.com/VibesDIY/vibes.diy/issues/1438) / [standalone fireproof node design](2026-05-10-standalone-fireproof-node-design.md) — the Node `fireproof()` factory that already re-homed the _database_ surface onto in-repo firefly.

## Problem

The database/sync layer already moved in-repo to **firefly**. What still pins us to
the external [`fireproof`](https://github.com/fireproof-storage/fireproof) repo
(all `@fireproof/*` packages, locked at `0.24.19`, plus a
[`core-types-base` patch](../../../patches/@fireproof__core-types-base@0.24.19.patch))
is **not** the database — it's the **identity / PKI / auth-token machinery** plus
some **runtime glue** and a **legacy in-browser IndexedDB hook**.

That residual coupling is why a one-line UX fix like #1616 can't be fixed in this
repo: the localhost `/cert` success page is rendered by fireproof's
`core-cli` device-id-register handler, which we don't own.

We don't want to vendor the whole fireproof repo. We want to **extract the
specific portions we use into our own module(s)** with a clean target
architecture — possibly a new public npm package — so that:

1. The login/cert/token surface (including #1616's success page) is ours to style and evolve.
2. `pnpm` stops resolving `@fireproof/*` for anything except, at most, a clearly-scoped legacy shim.
3. The auth wire-format (device-id certs already in users' keybags, deployed CA keys, cloud token format) stays **byte-compatible** — no forced re-login, no key rotation.

`@adviser/cement` is explicitly **out of scope as a removal target**: it's a
separate `@adviser`-scoped utility library (Result/Option/URI/Lazy/streams/evento)
that **firefly itself depends on**. It is used in ~209 source files. This effort
removes `@fireproof/*`, not cement.

## What actually still depends on `@fireproof/*`

Source-only (excluding tests/docs), grouped by concern. Symbol → package → role.

### Bucket A — Identity, keybag & PKI ("deep library operations like cert signing")

This is the hard core. Three near-identical copies of the **client** signing flow
exist today and should be DRY'd as part of extraction:
[`vibes-diy/cli/main.ts:47`](../../../vibes-diy/cli/main.ts) (`vibesDiyApiFactory`),
[`use-vibes/base/firefly-defaults.node.ts:20`](../../../use-vibes/base/firefly-defaults.node.ts) (`loadDeviceIdGetToken`),
and `eval/codegen-edit/src/auth.ts`.

| Symbol | Package | Role |
| --- | --- | --- |
| `getKeyBag` | `core-keybag` | Open/read/write the local device keystore at `~/.fireproof/keybag/<id>.json` (a fireproof DB) — `.getDeviceId()` / `.setDeviceId()` |
| `DeviceIdKey` | `core-device-id` | Load ES256 P-256 signing key from JWK; `.fingerPrint()` |
| `DeviceIdSignMsg` | `core-device-id` | Sign `FPDeviceIDSession` JWT claims with ES256 (the per-request device token) |
| `deviceIdCAFromEnv`, `getCloudPubkeyFromEnv`, `tokenApi` | `core-protocols-dashboard` | **Server** side: load CA priv key + cloud pubkey from env; `tokenApi[type].verify(token)`; CA `.processCSR(csr, claims)` issues the cert ([`get-cert-from-csr.ts:14`](../../../vibes.diy/api/svc/public/get-cert-from-csr.ts), [`create-handler.ts:143-149`](../../../vibes.diy/api/svc/create-handler.ts)) |
| `DeviceIdCAIf` | `core-types-device-id` | CA interface on the service ctx ([`svc/types.ts:37`](../../../vibes.diy/api/svc/types.ts)) |
| `JWKPrivate`, `JWKPrivateSchema`, `DeviceIdKeyBagItem` | `core-types-base` | Keybag item shapes; headless-auth env seeding ([`cli/device-id-env.ts`](../../../vibes-diy/cli/device-id-env.ts)) |

### Bucket B — Auth wire-types

| Symbol | Package | Role |
| --- | --- | --- |
| `DashAuthType` | `core-types-protocols-dashboard` | **The** auth token union (`device-id` \| `clerk`) threaded through every request (~21 files) |
| `ReqCertFromCsr`, `ResCertFromCsr` | `core-types-protocols-dashboard` | CSR→cert exchange shapes |
| `VerifiedAuthResult`, `VerifiedClaimsResult`, `VerifiedResult`, `WithAuth` | `core-types-protocols-dashboard` | Post-verify result shapes ([`check-auth.ts`](../../../vibes.diy/api/svc/check-auth.ts)) |
| `FPDeviceIDSession` | `core` / `core-types-base` | Device JWT claim shape (type-only) |
| `ClerkClaim`, `ClerkClaimSchema` | `core-types-base` | Zod schema validating Clerk JWTs — **carries the load-bearing patch** (`.catch("")` on optional fields) |

These are (almost) all erasable types. The exceptions that carry runtime values are
`JWKPrivateSchema` and `ClerkClaimSchema` (Zod), which is also where the patch lives.

### Bucket C — The login localhost server (#1616)

| Symbol | Package | Role |
| --- | --- | --- |
| `ReqDeviceIdRegister`, `isResDeviceIdRegister` | `core-cli` | [`login-cmd.ts:40`](../../../vibes-diy/cli/cmds/login-cmd.ts) builds a `core-cli.device-id-register` DTO; the fireproof handler spins up the localhost Hono server, opens the browser to `/settings/csr-to-cert`, and **renders the unstyled `/cert` success page we can't touch**. |

### Bucket D — Legacy in-browser IndexedDB (NOT "deep ops")

This is the original **local** fireproof database, still used in the browser — it is
_not_ part of the firefly cloud migration and _not_ a deep library op.

| Symbol | Package | Where |
| --- | --- | --- |
| `useFireproof`, `fireproof`, `Database`, `DocFileMeta`, `DocSet`, `DocResponse`, `DocWithId` | `use-fireproof` / `@fireproof/use-fireproof` | ImgGen image metadata ([`base/hooks/img-gen/use-img-gen.ts`](../../../vibes.diy/base/hooks/img-gen/use-img-gen.ts), [`base/components/ImgGen.tsx`](../../../vibes.diy/base/components/ImgGen.tsx)), vibe-card file metadata, `databaseManager`, `useAllGroups`, `useChatHydration` (~15 files) |

### Bucket E — Runtime glue (the pervasive bottleneck)

| Symbol | Package | Role |
| --- | --- | --- |
| `ensureSuperThis`, `ensureLogger`, `runtimeFn`, `hashObjectSync` | `core-runtime` | Init the global `SuperThis` context + logger at every CLI/service entry (~30 files) |
| `SuperThis` | `core` / `core-types-base` | Platform-abstraction context: `env`, `txt` (base58/base64/utf8 codecs), `nextId()`, crypto. Threaded almost everywhere identity/crypto code runs. |

`SuperThis` is the crux of "can we ever reach _zero_ `@fireproof/*`": it's generic
runtime plumbing, not database code, but it lives in `@fireproof/core-runtime`.

## Target architecture

A new package — working name **`@vibes.diy/identity`** — owns Buckets A + B + C.
It is the single home for "how a vibes device authenticates and how the cloud
issues/verifies its credentials." Unidirectional deps; built on `@adviser/cement`
+ standard primitives, **never** on `@fireproof/*`.

```
                 @vibes.diy/identity   (NEW — publishable?)
                 ├── keybag        load/save device key+cert (local store)
                 ├── device-id     ES256 key + JWT session signer (client)
                 ├── ca            CSR -> cert issuance + token verify (server)
                 ├── login-server  localhost device-id-register + STYLED /cert page  (#1616)
                 └── types         DashAuthType, FPDeviceIDSession, ReqCertFromCsr/Res,
                                   VerifiedAuth*, JWKPrivate*, ClerkClaimSchema(+patch inlined)
                       ▲                    ▲                         ▲
        ┌──────────────┘        ┌───────────┘             ┌───────────┘
   vibes-diy/cli          vibes.diy/api/svc          use-vibes (Node factory)
   (login, getToken)      (create-handler, check-auth,  (firefly-defaults.node)
                           get-cert-from-csr)
```

Buckets D and E are handled separately (below) — D is an app-migration track, E is
an ownership decision about `SuperThis`.

### Extraction strategy (the central design choice)

Two ways to populate `@vibes.diy/identity`'s crypto, and they trade differently:

- **(1) Lift the used fireproof source modules verbatim** into the package (the
  literal "extract the used portions" reading). Fastest path to wire-compat — it
  _is_ the same code — and lowest risk of a cert/token format drift. Cost: we
  inherit fireproof's internal style and its `SuperThis` coupling, and we own
  maintenance of crypto we didn't write.
- **(2) Reimplement on standard libraries** — [`jose`](https://github.com/panva/jose)
  for ES256 JWT sign/verify (already a dep via `hkdf-key.ts`), WebCrypto for HKDF
  (already used directly in [`hkdf-key.ts`](../../../vibes.diy/api/svc/hkdf-key.ts)),
  and an x509/PKI lib for CSR→cert. Cleaner long-term, drops `SuperThis` from the
  crypto path, but **must prove byte-compatibility** against (a) device certs
  already sitting in users' `~/.fireproof/keybag`, (b) the deployed CA, and (c) the
  cloud token verifier. A format mismatch = silent auth breakage / forced re-login.

Recommendation: **(1) for the crypto core** (certs/tokens are a deployed wire
format; do not risk it), **(2) opportunistically** for the parts already standard
(HKDF, and JWT verify where `jose` provably matches). This is the single biggest
open question — see Q2.

### Phasing (risk-ordered, each independently shippable)

1. **Type ownership (mechanical, low-risk).** Re-home Bucket B types into
   `@vibes.diy/identity` and re-export. Inline the `ClerkClaimSchema` `.catch()`
   patch as source. Deletes the `core-types-base` patch and the `core-types-*`
   runtime deps. Mostly erasable; large but low-blast-radius diff.
2. **Identity runtime extraction (Bucket A).** Move keybag + device-id signer
   (client) + CA/verify (server) into the package; collapse the three duplicated
   client signers behind one `createDeviceIdGetToken()` API. Golden-vector tests
   that assert byte-compat with existing certs/tokens gate this step.
3. **Own the login localhost server (Bucket C → fixes #1616).** Replace the
   `core-cli` device-id-register dependency with our `login-server`, and ship the
   styled "Certificate received" page (grid background / branding). Drops
   `core-cli`. This is where #1616 actually closes.
4. **`SuperThis` decision (Bucket E).** See Q1 — re-home into identity, push down
   into `@adviser/cement`, or thin in-repo replacement. Until resolved, full
   `@fireproof/*`-zero is blocked.
5. **Legacy IndexedDB migration (Bucket D) — separate track.** Migrate ImgGen /
   vibe-card metadata off classic local fireproof (onto firefly or a small in-repo
   local store). Largest app-surface change; gated independently. Until done, a
   single narrowly-scoped `@fireproof/use-fireproof` dep may legitimately remain.

### Wire-compatibility constraints (hard requirements)

- Device certs already in `~/.fireproof/keybag` must keep validating — no forced re-login.
- The deployed `DEVICE_ID_CA_*` / `CLOUD_SESSION_TOKEN_*` env material must keep working unchanged.
- `device-id` ES256 token + Clerk token verification must remain bit-identical.
- The `VIBES_DEVICE_ID` headless-auth env seeding ([`device-id-env.ts`](../../../vibes-diy/cli/device-id-env.ts)) must keep accepting existing keybag-file payloads.

## Open questions (for Charlie + owner)

- **Q1 — `SuperThis` home.** Fold into `@vibes.diy/identity`, relocate into
  `@adviser/cement` (same author; we already depend on cement everywhere), or write
  a thin in-repo context? This decides whether _zero_ `@fireproof/*` is even reachable.
- **Q2 — Extraction vs reimplementation** of the crypto core (see strategy above).
  Lift-verbatim for safety, or reimplement on `jose`/WebCrypto/x509 for cleanliness?
- **Q3 — Keybag location/format.** Keep `~/.fireproof/keybag` for backward-compat
  with logged-in devices, or migrate to `~/.vibes` with a one-time import shim?
- **Q4 — Publish target.** Is `@vibes.diy/identity` a public npm package (so external
  Node/Wrangler/generated-vibe consumers authenticate against a stable surface), or
  internal-only? Affects naming, API-stability commitments, and packaging.
- **Q5 — Bucket D scope.** Is the legacy in-browser IndexedDB migration part of this
  initiative, or explicitly deferred? It's the long pole to truly zeroing `@fireproof/*`.
- **Q6 — Upstream tracking.** After extraction, do we keep pulling security fixes
  from upstream fireproof `0.24.x` into the lifted crypto, or hard-fork and own it outright?

## Non-goals (this spec)

- No implementation, no step-by-step plan yet (awaiting go-ahead).
- Not touching `@adviser/cement`.
- Not changing the firefly database/sync wire protocol.
