# `@vibes.diy/eval-preamble-probe`

Fast-loop probe for the pre-allocation prompt (`makePreAllocUserMessage` + `preAllocSchema`). Calls the LLM directly with the same `call-ai` production uses — bypasses the worker, the chat flow, D1, and the codegen turn. ~3-8s per call instead of ~60-90s.

Use it to iterate on:

- the user message that goes to pre-alloc (skill catalog framing, platform brief, exemplars)
- the schema's `enrichedPrompt` description (terseness, structure)
- the model choice (override with `--model`)

## Setup

The probe reads `LLM_BACKEND_URL` / `LLM_BACKEND_API_KEY` from `vibes.diy/pkg/.dev.vars`. If you haven't set up local dev, see [agents/worktree-setup.md](../../agents/worktree-setup.md).

## Run

```sh
cd eval/preamble-probe
pnpm install   # only first time, picks up workspace links
pnpm run -- --variant v0-baseline,v1-platform-brief,v2-exemplar
```

Or one variant at a time:

```sh
pnpm run -- --variant v1-platform-brief --concurrency 5
```

By default it runs all variants against all prompts in `prompts/seed.jsonl` with concurrency 3. Output goes to `runs/<timestamp>.jsonl`.

## Flags

- `--variant <ids,…>` — comma list of variant ids (see `variants/index.ts`). Default: all.
- `--prompts <path>` — path to a JSONL of `{id, prompt}`. Default: `prompts/seed.jsonl`.
- `--prompts-ids <ids,…>` — filter the corpus to specific prompt ids.
- `--model <id>` — override the model. Default: `anthropic/claude-opus-4.6-fast` (matches production's `preSelected: ["app"]`).
- `--concurrency <n>` — parallel calls. Default: 3.
- `--out <path>` — output JSONL path. Default: `runs/<timestamp>.jsonl`.

## Variants

Listed in `variants/index.ts`. To add a new one: implement `ProbeVariant` and add it to `allVariants`.

- **v0-baseline** — production `makePreAllocUserMessage` verbatim. Ground truth for whatever's currently shipping.
- **v1-platform-brief** — prepends a 6-line brief naming what Fireproof / callAI / useViewer / ImgGen actually are, so the model isn't relying on the schema description to learn the platform.
- **v2-exemplar** — platform brief + one worked-example enrichedPrompt for a sample app.

## Output

Each row in the JSONL is:

```jsonc
{
  "variantId": "v1-platform-brief",
  "promptId": "todo",
  "userPrompt": "Build a simple todo list…",
  "model": "anthropic/claude-opus-4.6-fast",
  "startedAt": "2026-05-13T…",
  "latencyMs": 4382,
  "raw": "{\"skills\":[…],\"pairs\":[…],…}",
  "parsed": {
    /* PreAllocParsed shape */
  },
  "enrichedPromptPresent": true,
  "enrichedPromptLen": 482,
}
```

A summary lands on stdout when the run finishes — per-variant fill rate, avg `enrichedPrompt` length, avg latency.

## Reading results

```sh
# Side-by-side preamble text per prompt across variants
jq -r '"\(.variantId)\t\(.promptId)\t" + ((.parsed.enrichedPrompt // "—") | tostring | gsub("\\n"; " ") | .[0:160])' runs/<timestamp>.jsonl | column -t -s $'\t'

# Where preamble is missing
jq -c 'select(.enrichedPromptPresent == false) | {variant: .variantId, prompt: .promptId, err: .parseErr, rawHead: (.raw | .[0:200])}' runs/<timestamp>.jsonl
```

## Caveats

- Currently the production `call-ai` Anthropic path uses `tool_mode` and reads `toolDef.parameters` — our `preAllocSchema` has `properties` at the top level (no `parameters` wrapper), so the schema actually sent to the model is **empty**. The probe reproduces this faithfully. If you fix `call-ai` to map `properties` → `parameters` on the Anthropic path, the probe will pick up that improvement automatically.
- Latency varies with OpenRouter load. A noisy probe run isn't variant signal — repeat suspicious results.
