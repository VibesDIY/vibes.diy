# Browserless device auth: logging in a headless `vibes-diy` CLI with a Fireproof keybag

> Draft tech-stack post pitched from [PR #2363](https://github.com/VibesDIY/vibes.diy/pull/2363). Audience: developers running `vibes-diy` outside a laptop — CI, a remote container, Claude Code on the web.

## The problem: login assumes a browser

`vibes-diy login` doesn't ask for a password. It enrolls a **device certificate**. The flow in [`login-cmd.ts`](../vibes-diy/cli/cmds/login-cmd.ts) is a classic CSR round-trip:

1. The CLI generates an EC P-256 keypair and stashes the private key in the local **Fireproof keybag**.
2. It builds a CSR and starts a throwaway `localhost` collector on a random high port.
3. It opens your browser to `vibes.diy/settings/csr-to-cert?csr=…&returnUrl=http://localhost:<port>/cert`.
4. Your logged-in web session authorizes the request; the CA signs a cert; the browser redirects back to the collector with the signed JWT.
5. The CLI stores `{ deviceId, cert }` in the keybag.

From then on, every command signs a short-lived (120s) ES256 JWT with the device key — see the token minting in [`main.ts`](../vibes-diy/cli/main.ts). The private key never leaves the box; the server is the authority on whether the cert is still good.

Lovely on a laptop. **Impossible in a headless environment** — there's no browser to complete step 3, and no way to reach a `localhost` collector inside an ephemeral container. The CLI simply can't authenticate there.

A red herring worth calling out: in a sandbox you'll often see a `403` from `vibes.diy` that looks like an auth failure but isn't. Check the response header — `x-deny-reason: host_not_allowed` means the *egress policy* blocked the host, not that your cert was rejected. Auth and reachability are two different walls; don't debug one thinking it's the other.

## The fix: carry the keybag item over one env var

The credential is just a file: `~/.fireproof/keybag/<id>.json`, holding the device private key and the signed cert. If you already logged in somewhere with a browser, the natural move is to carry that artifact into the headless environment.

[PR #2363](https://github.com/VibesDIY/vibes.diy/pull/2363) adds `VIBES_DEVICE_ID`. Set it, and the CLI seeds its keybag from it on startup — no `login`, no browser. The whole feature is one small module, [`device-id-env.ts`](../vibes-diy/cli/device-id-env.ts):

```ts
export async function seedDeviceIdFromEnv(sthis: SuperThis): Promise<SeedDeviceIdResult> {
  const raw = sthis.env.get(VIBES_DEVICE_ID_ENV);
  if (!raw) return "unset";
  const kb = await getKeyBag(sthis);
  const existing = await kb.getDeviceId();
  if (existing.cert.IsSome()) return "already-authenticated"; // an interactive login wins
  const { deviceId, cert } = extractDeviceId(parseEnvValue(raw));
  await kb.setDeviceId(deviceId, cert);
  return "seeded";
}
```

Usage:

```bash
# on a machine where you've run `vibes-diy login`:
base64 -w0 ~/.fireproof/keybag/z3QkefAC57rcrs.json   # copy this

# in the headless env (CI secret, env var, etc.):
export VIBES_DEVICE_ID="<paste>"
vibes-diy user-settings   # just works
```

Because it seeds the same keybag the rest of the CLI already reads, **nothing downstream changes** — the token-minting path, every subcommand, the MCP server all keep calling `keyBag.getDeviceId()` exactly as before. The env var is a new *source*, not a new code path.

## Four decisions that kept it safe

The interesting part isn't the plumbing — it's the guardrails. Auth code is exactly where a "just make it work" shortcut becomes a footgun.

### 1. Validate the key strictly; treat the cert as opaque

We `JWKPrivateSchema.parse()` the device key — that's the thing we *sign with*, so a malformed key should fail loudly and early. But we deliberately **do not** run the full `CertificatePayloadSchema` over the certificate. We only check that `certificateJWT` and `certificatePayload` are present.

Why under-validate? Because the **server is the authority on cert validity**, not the client. If the CLI deep-validated the cert payload, every future field the CA adds would break old clients that were technically fine. Opaque-cert keeps the client forward-compatible; a bad cert gets rejected at the network layer where that decision actually belongs.

### 2. An interactive login always wins

Seeding only happens when the keybag has **no** certificate. If you've run a real `vibes-diy login` on that machine, the env var is ignored. This means a stale `VIBES_DEVICE_ID` left in a shell profile can never silently hijack a session you explicitly established.

### 3. …but say so out loud (the UX guard)

"Silently ignored" is its own trap: an operator who set the env var and sees it skipped has no idea *which* identity is active. So `seedDeviceIdFromEnv` returns a three-state result — `"unset" | "seeded" | "already-authenticated"` — and [`main.ts`](../vibes-diy/cli/main.ts) turns the last one into a one-line notice:

```
Note: VIBES_DEVICE_ID is set but ignored — this device is already logged in (use 'vibes-diy login --force' to re-enroll).
```

The precedence rule and the notice are two halves of the same UX: *do the safe thing, and tell the human why.*

### 4. Malformed input warns, it doesn't crash

A garbled `VIBES_DEVICE_ID` shouldn't brick commands that don't even need auth — `login`, `--help`. So a parse failure is caught, surfaced as a `Warning:` on stderr, and the CLI carries on. The accepted input is also forgiving on purpose: raw JSON *or* base64 (base64 sidesteps quoting and newline pain in env vars), and either the full keybag file or the bare `{ deviceId, cert }`.

## Takeaway

Making a browser-based auth flow work headlessly didn't mean inventing a second login protocol. It meant recognizing the credential was already a portable artifact, adding one well-guarded *source* for it, and being disciplined about the boundaries: strict where we hold the key, deferential where the server owns the truth, and loud where a human might otherwise be misled. The diff is small; the decisions are the product.
