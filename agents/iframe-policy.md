# Vibe iframe permissions policy

Vibes run inside an `<iframe>`. The iframe's `sandbox` and `allow` (permissions-policy)
attributes decide which browser capabilities the embedded app may use. If a capability
is missing from `allow`, the browser blocks it inside the iframe — e.g. a vibe calling
`navigator.clipboard.writeText()` throws
`NotAllowedError: The Clipboard API has been blocked because of a permissions policy
applied to the current document.`

## Single source of truth

All runtime/preview iframes read their policy from one module:
[`vibes.diy/pkg/app/lib/iframe-policy.ts`](../vibes.diy/pkg/app/lib/iframe-policy.ts).

- `RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS` → joined into `RUNTIME_PREVIEW_IFRAME_ALLOW`
  (the `allow` attribute / permissions-policy).
- `RUNTIME_PREVIEW_IFRAME_SANDBOX_TOKENS` → joined into `RUNTIME_PREVIEW_IFRAME_SANDBOX`
  (the `sandbox` attribute).

Two iframes consume these constants, so editing the tokens updates both at once:

- Published viewer — [`routes/vibe.$ownerHandle.$appSlug.tsx`](../vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx)
  (the `/vibe/{owner}/{app}` route)
- Editor preview — [`components/ResultPreview/PreviewApp.tsx`](../vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx)

[`components/ResultPreview/DataView.tsx`](../vibes.diy/pkg/app/components/ResultPreview/DataView.tsx)
is a deliberate exception: it hard-codes a narrower `sandbox` and no `allow`, because the
data inspector needs fewer capabilities. Leave it out of the shared tokens.

## Adding a capability

1. Add the token to the relevant array in `iframe-policy.ts` (keep alphabetical-ish order).
2. Prefer least privilege. For clipboard, `clipboard-write` (programmatic copy) is benign;
   `clipboard-read` can pull arbitrary clipboard contents, so only add it when a real paste
   feature needs `navigator.clipboard.read*`.
3. No test pins these strings, so `pnpm fast-check` (build + lint) is enough locally.

### How delegation works

The `allow` attribute's default allowlist for each token is the iframe's `src` origin, so
listing `clipboard-write` delegates it to the app content whether the vibe is served
same-origin or cross-origin. You do not need an explicit `'self'`/origin list.

## Validating a deployed policy on cli

After tagging `vibes-diy@c*` and CI's `deploy_cli` job goes green, confirm the deployed
bundle carries the new token. The policy array gets minified into a route chunk; reach the
cli environment through stable-entry routing (no cli hostname needed):

```bash
# 1. cli is up
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://vibes.diy/?.stable-entry.=cli"

# 2. pull the route manifest, grep every chunk for the token
curl -s "https://vibes.diy/?.stable-entry.=cli" -o /tmp/cli-home.html
manifest=$(grep -oE '/assets/manifest-[a-z0-9]+\.js' /tmp/cli-home.html | head -1)
curl -s "https://vibes.diy${manifest}?.stable-entry.=cli" \
  | grep -oE '"/assets/[a-zA-Z0-9_.-]+\.js"' | tr -d '"' | sort -u \
  | while read -r f; do
      curl -s "https://vibes.diy${f}?.stable-entry.=cli" \
        | grep -q 'clipboard-write' && echo "FOUND in $f"
    done

# 3. confirm it is the runtime-preview array, not an unrelated embed
curl -s "https://vibes.diy/assets/<chunk-from-step-2>?.stable-entry.=cli" \
  | grep -oE '\["autoplay","camera","clipboard-write","encrypted-media","microphone"\]'
```

Step 3 matters: the `help` route chunk already grants `clipboard-write` to its YouTube
embed, so a bare `clipboard-write` hit is not proof on its own — match the full
`RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS` array.

For a live behavioral check, drive Chrome through stable-entry routing
(see [chrome-mcp-debug.md](chrome-mcp-debug.md)) to a published vibe with a copy button and
confirm the click no longer throws `NotAllowedError`.

## See also

- [cli-then-prod.md](cli-then-prod.md) — stage on `@c`, validate, promote to `@p`
- [environments.md](environments.md) — dev/prod/cli/preview and stable-entry routing
- [deploy-tags.md](deploy-tags.md) — tag naming and deploy runbook
