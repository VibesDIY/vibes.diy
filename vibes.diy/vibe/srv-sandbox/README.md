# `@vibes.diy/vibe-srv-sandbox`

Bridge layer between runtime postMessage events and `vibes.diy` API calls.

## `vibe.req.callAI` flow

The callAI path is implemented in `call-ai-flow.ts` and is intentionally **structured-only**:

1. Open application chat via `openChat`.
2. Send prompt with:
   - schema system message
   - `response_format: { type: "json_object" }`
3. Collect response text from `block.toplevel.line` events only.
4. Return `vibe.res.callAI`:
   - `{ status: "ok", promptId, result }`
   - or `{ status: "error", message }`

Notes:

- There is no JSON code-block fallback mode in this flow.
- Missing section events or empty toplevel content return an error response.

## Tests

Run package-local tests:

```bash
pnpm --dir vibes.diy/vibe/srv-sandbox test
```

Or from root project selection:

```bash
pnpm exec vitest run --config vitest.config.ts --project vibe-srv-sandbox
```
