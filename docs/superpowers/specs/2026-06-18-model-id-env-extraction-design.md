# Spec: Extract hardcoded model IDs to env variables

**Issue:** [#1474](https://github.com/VibesDIY/vibes.diy/issues/1474)
**Date:** 2026-06-18
**Status:** Reviewed — design calls resolved by @CharlieHelps ([review](https://github.com/VibesDIY/vibes.diy/pull/2416)); scope alignment with #1474 confirmed. See Resolved decisions.
**Scope:** Narrow — env-var extraction only. No remote model fetching, no naming overhaul. (Those remain future work; see Non-goals.)

## Problem

Default model IDs are hardcoded across several source files. When we rotate a
default (e.g. `sonnet-4.5` → `sonnet-4.6`) we have to grep every package and edit
each one. Some are already stale (`openai/gpt-3.5-turbo`, `openai/gpt-4o`). There
is no single place to override a default per-environment (dev/preview/prod) without
a code change and redeploy.

## Goals

- Every hardcoded default model ID becomes overridable via an environment variable,
  with the current literal kept as the in-code fallback.
- Fix the two stale call-ai defaults as part of the change.
- Follow each package's **existing** env-access pattern rather than inventing a new
  shared module (the packages do not share a config layer — see Design).

## Non-goals

- Dynamically fetching the available model list from OpenRouter or any provider.
- Consistent cross-provider naming / a model-naming scheme.
- Changing the 3-tier per-user/per-app resolution in
  `vibes.diy/api/svc/intern/get-model-defaults.ts` (app → user → `preSelected`).
  This spec only touches *hardcoded literals*, not that resolution chain.

The dynamic-fetch + naming proposal raised by @popmechanic / Marcus is explicitly
deferred to a separate spec.

> **Note (rebased onto main).** After this spec was written, a `main` dead-code
> cleanup (`245fb63`) removed the duplicate `openai/gpt-3.5-turbo` default paths in
> `non-streaming.ts`, `streaming.ts`, and `api-core.ts` (model resolution now flows
> through `chooseSchemaStrategy`). The implementation therefore touches a smaller
> call-ai surface than the inventory below: the two `FALLBACK_MODEL` consts
> (`non-streaming.ts`, `api.ts`) and the `strategy-selector.ts` default resolution.
> The env getters and api/prompts changes are unchanged.

## Verified inventory

| Suggested env var | Current value | File:line | Package | Notes |
|---|---|---|---|---|
| `CALLAI_DEFAULT_MODEL` | `openai/gpt-3.5-turbo` | `call-ai/pkg/non-streaming.ts:32` | call-ai | **stale** |
| `CALLAI_DEFAULT_MODEL` | `openai/gpt-3.5-turbo` | `call-ai/pkg/streaming.ts:432` | call-ai | **stale** — streaming path (added per review) |
| `CALLAI_DEFAULT_MODEL` | `openai/gpt-3.5-turbo` | `call-ai/pkg/api-core.ts:46,65` | call-ai | **stale** |
| `CALLAI_FALLBACK_MODEL` | `openrouter/auto` | `call-ai/pkg/non-streaming.ts:20` | call-ai | intentionally generic |
| `CALLAI_FALLBACK_MODEL` | `openrouter/auto` | `call-ai/pkg/api.ts:47` | call-ai | intentionally generic |
| `CALLAI_SCHEMA_MODEL` | `openai/gpt-4o` | `call-ai/pkg/strategies/strategy-selector.ts:12` | call-ai | **stale** |
| `LLM_BACKEND_MODEL` | `anthropic/claude-sonnet-4.6` | `vibes.diy/api/svc/create-handler.ts:106` | api | **already env-shaped** via `sthis.env.gets()` |
| `ICON_FALLBACK_MODEL` | `openai/gpt-5-image-mini` | `vibes.diy/api/queue/icon-shotter.ts:10` | api | (issue mislocated this in `prompt-chat-section.ts:1245`) |
| `DEFAULT_CODING_MODEL` | `anthropic/claude-opus-4.5` | `prompts/pkg/prompts.ts:11` | prompts | already a named constant |
| `USE_VIBES_DEFAULT_MODEL` | `anthropic/claude-sonnet-4.5` | `use-vibes/base/hooks/vibes-gen/use-vibes.ts:124,137` | use-vibes | browser hook fallback — **deferred** (left hardcoded, per review) |

Corrections vs. the issue body: the image fallback lives in
`queue/icon-shotter.ts:10` (`ICON_FALLBACK_MODEL`), not `prompt-chat-section.ts:1245`;
`LLM_BACKEND_MODEL` is already read through `sthis.env.gets()` so it needs no change
beyond possibly retiring the inline literal default.

## Design

There is **no shared config layer** across these packages, and `call-ai` is published
to npm independently of the monorepo, so a single `model-defaults.ts` consumed
everywhere is not viable. Instead, each package extends the env pattern it already uses.

### 1. call-ai — extend `CallAIEnv`

`call-ai/pkg/env.ts` already exposes a `CallAIEnv` class (`@adviser/cement`
`envFactory`) with getters like `CALLAI_CHAT_URL` that fall back to a literal default.
Add three getters following the same shape:

```ts
get CALLAI_DEFAULT_MODEL()  { return this.env().get("CALLAI_DEFAULT_MODEL")  ?? "openrouter/auto"; } // un-stale: gpt-3.5-turbo → openrouter/auto (review decision D1)
get CALLAI_FALLBACK_MODEL() { return this.env().get("CALLAI_FALLBACK_MODEL") ?? "openrouter/auto"; }
get CALLAI_SCHEMA_MODEL()   { return this.env().get("CALLAI_SCHEMA_MODEL")   ?? "openai/gpt-4o"; } // kept for now (review decision D1)
```

The stale `openai/gpt-3.5-turbo` non-schema defaults become `openrouter/auto` (matching
current routing), and the schema default stays `openai/gpt-4o` for this pass. Any broader
model-policy refresh (swapping the schema default) is a follow-up with quality/cost data.

Replace the call-ai literals with reads from `callAiEnv`. The full set of `options.model || "openai/gpt-3.5-turbo"`
sites is: `non-streaming.ts:32`, **`streaming.ts:432`** (the streaming path — `api-core.ts` dispatches to
it for `options.stream` without passing a resolved model, so it must be covered or streamed calls stay on the
stale hardcoded default — flagged in review), `api-core.ts:46,65`, plus the `FALLBACK_MODEL`/schema literals in
`api.ts:47` and `strategy-selector.ts:12`.

### 2. vibes.diy/api — `sthis.env.gets()`

- `LLM_BACKEND_MODEL`: already correct; no change (or move the literal default to the
  `model-defaults` constants list for consistency).
- `ICON_FALLBACK_MODEL`: **cannot** use `sthis.env.gets()`. The queue worker
  (`queue/worker.ts`) constructs `sthis` with `ensureSuperThis()` and never calls
  `sthis.env.sets(...)` — it copies a hand-picked allowlist of Cloudflare bindings into
  `qctx.params.vibes.env` only. So a `sthis.env.gets({ ICON_FALLBACK_MODEL })` read would
  always return the fallback and the override would no-op in production (caught in review).
  Correct mechanism: thread the var through the existing queue-env channel —
  1. add `ICON_FALLBACK_MODEL?: string` to `QueueCtxParams.vibes.env` (`queue/queue-ctx.ts:16`),
  2. add it to the binding allowlist in `queue/worker.ts` (`ICON_FALLBACK_MODEL: env.ICON_FALLBACK_MODEL`),
  3. in `icon-shotter.ts:56`, read `qctx.params.vibes.env.ICON_FALLBACK_MODEL ?? "openai/gpt-5-image-mini"`
     instead of the module-level `const` (icon-shotter already reads `qctx.params.vibes.env` at line 52).

### 3. prompts — env-overridable constant

`DEFAULT_CODING_MODEL` is a `const`. Make it read an env override at module load with the
literal as fallback (prompts already imports `@adviser/cement`, so `envFactory` is available):

The `as const` literal type widens to `string`; accepted (review decision D4). Keep the
literal available by splitting the constant so consumers needing the narrowed type still have it:

```ts
export const DEFAULT_CODING_MODEL_FALLBACK = "anthropic/claude-opus-4.5" as const;
export const DEFAULT_CODING_MODEL: string =
  envFactory({ symbol: "prompts" }).get("DEFAULT_CODING_MODEL") ?? DEFAULT_CODING_MODEL_FALLBACK;
```

### 4. use-vibes — deferred (left hardcoded)

`use-vibes.ts:124,137` runs in the browser, where env is build-time only. Per review
(decision D3), we do **not** introduce `import.meta.env.VITE_*` into the shared runtime
hook in this pass. The browser fallback stays hardcoded; env-ifying it (via the existing
`callAiEnv` / window-global runtime-config style, not Vite build env) is out of scope here.

## Testing

- call-ai: unit test that setting each env var changes the resolved model and that the
  fallback applies when unset.
- api: existing `create-handler` env tests cover `LLM_BACKEND_MODEL`; add an
  `ICON_FALLBACK_MODEL` assertion.
- prompts: assert `DEFAULT_CODING_MODEL` honors the env override.
- Fixtures that hardcode models in tests are left as-is (not env-driven).

## Rollout

Single PR touching three packages (call-ai, api, prompts; use-vibes deferred). No env vars need to be *set* anywhere on day one —
every default is preserved as the in-code fallback, so behavior is identical until an
operator chooses to override. Document the new vars in the relevant `.env.example` /
deploy config.

## Resolved decisions

Resolved by @CharlieHelps review on [PR #2416](https://github.com/VibesDIY/vibes.diy/pull/2416);
scope deferral confirmed against [#1474 comment](https://github.com/VibesDIY/vibes.diy/issues/1474#issuecomment-4452639991).

- **D1 — Stale call-ai defaults.** Clean up the clearly stale `gpt-3.5-turbo` while
  touching those callsites, keeping runtime behavior aligned with current routing:
  non-schema default → `openrouter/auto`, schema default → `openai/gpt-4o` (for now). A
  broader model-policy refresh (e.g. swapping the schema default) is a follow-up with
  quality/cost data.
- **D2 — Naming.** Keep per-package names (`CALLAI_*`, `LLM_BACKEND_MODEL`,
  `ICON_FALLBACK_MODEL`, `DEFAULT_CODING_MODEL`). A unified `VIBES_MODEL_*` namespace is a
  separate migration (aliases + docs + rollout), decoupled from this extraction.
- **D3 — use-vibes browser hook.** Do **not** introduce `import.meta.env.VITE_*` into the
  shared runtime hook. Leave hardcoded for this pass; if env-ified later, use the existing
  runtime-config style (`callAiEnv` / window globals), not Vite build env.
- **D4 — `DEFAULT_CODING_MODEL` `as const`.** Widening to `string` is acceptable; keep the
  literal via a `DEFAULT_CODING_MODEL_FALLBACK` (`as const`) + resolved
  `DEFAULT_CODING_MODEL: string` split (see §3).
- **D5 — `openrouter/auto`.** Keep as the generic default (overridable via
  `CALLAI_FALLBACK_MODEL`, default unchanged).

@popmechanic (issue assignee) is still welcome to weigh in; Charlie confirmed the narrow
scope matches the intent recorded on #1474.
