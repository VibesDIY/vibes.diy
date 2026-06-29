# Wiring SSR into a render path that already runs on the edge

Source: `claude/vibe-ssr-render-vibe-wiring` — slice 4 of vibe SSR (#2802):
inject server-rendered vibe HTML into the iframe document the worker already
SSRs, behind a `data-vibe-ssr` hydrate marker and the `VIBES_SSR` flag.

The surprise going in: the vibe iframe document is **already** server-rendered
React on the Cloudflare Worker (`render-vibe.ts` → `renderToReadableStream(VibePage)`).
What it _doesn't_ do is execute the user's component — it ships an empty
`vibe-app-container` plus a script that imports `App.jsx` and mounts it
client-side. So slice 4 isn't "add SSR," it's "execute the untrusted component
in isolation and splice its HTML into a container the shell already renders."

Worth a note:

- **Two independent `react-dom/server` passes, stitched by `dangerouslySetInnerHTML`.**
  The outer `VibePage` shell renders on the worker; the inner vibe HTML comes
  from a separate isolate/executor. The container injects the inner string as
  raw HTML — opaque to the shell's React, so there's no cross-render
  reconciliation. The inner string is exactly slice-1 `renderVibeToString`, and
  `mountVibe` rebuilds the same tree, so it lines up for hydration by
  construction.

- **The hydrate trigger had to get stricter.** Slice 1 hydrated on
  `container.hasChildNodes()`; slice 4 switches to an explicit `data-vibe-ssr`
  attribute. Incidental children (a placeholder, a stray text node) must never
  be mistaken for an SSR payload — hydrating against markup the server didn't
  produce mismatches and blanks the iframe.

- **SSR is additive, so the whole attempt lives inside one fallback.**
  `attemptVibeSsr` wraps executor _selection_ (which throws on a misconfigured
  `loader` with no binding), source load, the relative-import gate, and the
  render — and returns a structured reason (`source_missing`,
  `entry_ambiguous`, `relative_import_unsupported`, `executor_error`, …) instead
  of throwing. Any non-`ok` reason ships the empty container (client-only,
  today's path). A misconfigured flag renders exactly like `off`, never a 500.

- **`es-module-lexer` can't parse raw JSX — transform first.** The single-file
  scope check (does the entry import `./Badge.jsx`?) lexes the module, but the
  lexer chokes on JSX. Run the same Sucrase pass the executor runs, then lex the
  compiled JS. Multi-file vibes fall back to client-only until the dep-graph
  bundling lands.

- **Prod stays `off`, and it's load-bearing.** `NodeExecutor` can't run on a
  Cloudflare Worker (Node-only `Buffer`/`import.meta.resolve`/`data:` import),
  and the `env.LOADER` Worker Loader binding is beta and not plumbed yet — so in
  the real worker every non-`off` mode degrades to client-only. The wiring lands
  fully built and CI-tested via `VIBES_SSR=node`, dormant behind the flag, ready
  for the binding. Same shape as slice 2 landing the executors dormant.
