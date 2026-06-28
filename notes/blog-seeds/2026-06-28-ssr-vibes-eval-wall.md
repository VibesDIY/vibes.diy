# Why true SSR of a vibe can't run on a Cloudflare Worker (and the dead prototype that proved it)

Source: `claude/vibe-controls-review-bjx9as`

We deleted a long-dead, build-excluded `vibes.diy/pkg/slack/serve/*` prototype —
a per-request server-side render of arbitrary vibe code — but mined it for one
sharp lesson first (captured in #2802). The render path compiled the user's
component with `esbuild-wasm` and then *executed* it via
`await import("data:text/javascript;base64,…")` to call `renderToString`.
Cloudflare Workers forbid runtime code evaluation (no `eval`, no dynamic import
of request-time `data:`/`blob:` URLs), so the design hit a hard wall and shipped
a Node/Deno container instead — which is the real origin of the orphaned
k8s/Hetzner manifest people kept finding. The `cf-vibes-diy-srv.ts` file is the
fossil record of the attempt: it adapts the handler to a Workers `fetch` export
and swaps in a virtual filesystem, then funnels straight back into the
`import(data:)` call.

The trade-off worth remembering: true SSR means *running* untrusted, freshly
compiled React on the server, which is exactly what the edge runtime won't let
you do — and arguably shouldn't, for sandbox-isolation reasons. The escape hatch
the same prototype sketched (Sucrase transpile-as-a-service, Workers-safe) works
precisely because it never executes the code server-side, so it isn't SSR at
all. The likely real answer is to pre-render at *publish* time, not per request:
compile + `renderToString` once when a vibe deploys, serve the static shell from
a Worker, hydrate on the client. Knowledge-capture-before-deletion is the
meta-lesson — permalink the doomed files to a commit SHA so the "why" outlives
the `git rm`.
