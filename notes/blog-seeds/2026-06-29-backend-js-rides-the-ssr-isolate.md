# `backend.js` doesn't build a runtime — it rides the one SSR already paid for

Source: `claude/per-app-backend-vibe-execution-382t9z` (design doc for #2856, supersedes #2202)

The original `backend.js` design (#2202, the 2026-06-03 spec) left one question open — "how does
untrusted server code actually run?" — and its first answer was the dangerous one: compile author
handlers with `new Function()` *inside a Durable Object's own isolate*. Then the vibe-SSR work
(#2802) shipped the real answer to that exact question for `App.jsx`: a Cloudflare **Worker Loader**
isolate (`env.LOADER.get(sha, () => WorkerCode)`), with `globalOutbound` as the network leash and a
fake-binding test seam because the binding is beta-and-absent-from-CI. The post writes itself around
one reframe: **a Durable Object is not the sandbox.** The DO owns the genuinely-new delta — alarms,
single-flight, retry/backoff, token state — and *drives* an isolate for the untrusted code; it never
runs author code in its own isolate. Three nuggets worth expanding: (1) the **Codex-RCE lesson** —
in-process eval of persisted vibe source reached `node:fs`/`process.env`, which is why "isolate-only
on the live path" is a hard rule, not a preference, and why `backend.js` (secret-bearing,
network-capable) inherits it a fortiori; (2) **`globalOutbound` inverted** — SSR pins it `null`
(no network); backend.js sets it to a controlled egress proxy, never `null`, never inherit-parent —
the same knob, opposite default, because the threat model flipped; (3) **the cache-key foot-gun** —
SSR JSON-embeds `mountParams` into the hashed worker source, which is fine for public render but
*lethal* for per-trigger `ctx` (identity + secrets), because baking request-varying data into the
`sha` both defeats isolate reuse and risks leaking one trigger's identity into another's isolate — so
`ctx` must ride `WorkerCode.env`/RPC, not the hashed module. The throughline: the cheapest way to ship
a new capability is to notice the adjacent team already built 80% of it and resist the urge to fork.
