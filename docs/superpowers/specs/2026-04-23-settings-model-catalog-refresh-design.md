# Settings Model Catalog Refresh — Design

**Date:** 2026-04-23
**Scope:** `/settings` → Default Models card
**Status:** Approved, ready for implementation plan

## Problem

The `/settings` page's "Default Models" card shows three dropdowns (Chat, App, Imaging) that all pull from the same hand-curated list in `vibes.diy/api/svc/models.json`. Three issues:

1. **Stale versions.** Two IDs no longer exist in OpenRouter's catalog (`google/gemini-3-pro-preview`, `google/gemini-2.5-flash-lite-preview-06-17`). Several families have newer generations available (Opus 4.7, GPT-5.4, Grok 4.20, Kimi K2.6, GLM 5.1, DeepSeek V3.2 stable).
2. **Image dropdown pollution.** All 30 models appear in the Imaging dropdown even though only one (`openai/gpt-5-image-mini`) actually generates images. There is no capability filter.
3. **Missing latest image model.** User requested adding `openai/gpt-5.4-image-2` (released 2026-04-21).

## Goals

- Refresh the catalog to reflect current OpenRouter state (manual curation, not dynamic fetch).
- Scope each dropdown to models that support the corresponding usage.
- Add all OpenRouter image-generation models, with `openai/gpt-5.4-image-2` as the new image default.
- Preserve currently-working entries (no aggressive pruning).

## Non-goals

- Live OpenRouter API integration or caching.
- Backend filtering — `listModels` continues to return the full catalog; the UI filters.
- Redesign of the Default Models card UI.

## Design

### 1. Schema change

Add a `supports` field to the `Model` type in `vibes.diy/api/types/chat.ts`:

```ts
export const Model = type({
  id: "string",
  name: "string",
  description: "string",
  "featured?": "boolean",
  "preSelected?": PromptStyle.array(),
  "supports?": PromptLLMStyle.array(),   // NEW: "chat" | "app" | "img"
});
```

**Semantics:**
- `supports` — which usages this model is *eligible* for (shown in dropdown).
- `preSelected` — which usages this model is the *default* for (pre-filled on first load).
- These are independent: a model can support multiple usages; at most one model per usage is pre-selected.

### 2. UI filter

In `vibes.diy/pkg/app/components/ModelSettingsCards.tsx`, the `ModelSection` component accepts a `usage: "chat" | "app" | "img"` prop. After fetching models via `vibeDiyApi.listModels({})`, filter before rendering:

```ts
const eligible = res.Ok().models.filter((m) =>
  (m.supports ?? ["chat", "app"]).includes(usage)
);
setModels(eligible);
```

**Fallback:** missing `supports` defaults to `["chat", "app"]` — never image. This protects the Imaging dropdown if future catalog edits forget to tag a model.

The existing preSelected loop iterates only the filtered `eligible` set, so a model can't be pre-selected for a usage it doesn't support.

### 3. models.json edits

#### Fix stale IDs
- `google/gemini-3-pro-preview` → rename to `google/gemini-3.1-pro-preview`, refresh description.
- `google/gemini-2.5-flash-lite-preview-06-17` → **remove** (duplicate of `google/gemini-2.5-flash-lite`, which is kept).
- `openai/gpt-5.4-mini` → remove the duplicate `"featured": false` key (current bug at [models.json:141-142](vibes.diy/api/svc/models.json:141)).

#### Add latest-generation entries (keep older versions alongside)
| ID | Name | Featured | Notes |
|---|---|---|---|
| `anthropic/claude-opus-4.7` | Claude Opus 4.7 | yes | next-gen Opus for long-running agents |
| `openai/gpt-5.4` | GPT-5.4 | yes | flagship replaces GPT-5 as featured |
| `x-ai/grok-4.20` | Grok 4.20 | yes | newer Grok |
| `z-ai/glm-5.1` | GLM 5.1 | no | newer GLM |
| `moonshotai/kimi-k2.6` | Kimi K2.6 | no | newer Kimi |
| `deepseek/deepseek-v3.2` | DeepSeek V3.2 | no | stable V3.2, alongside existing `-exp` |
| `openai/gpt-5.3-codex` | GPT-5.3 Codex | no | newer Codex alongside `gpt-5-codex` |

All non-image additions get `"supports": ["chat", "app"]`.

#### Image models — full OpenRouter image-output set
Every entry gets `"supports": ["img"]` **only** (excluded from chat/app).

| ID | Name | Featured | preSelected |
|---|---|---|---|
| `openai/gpt-5.4-image-2` | GPT-5.4 Image 2 | yes | `["img"]` (NEW default) |
| `google/gemini-3.1-flash-image-preview` | Nano Banana 2 | yes | — |
| `google/gemini-3-pro-image-preview` | Nano Banana Pro | no | — |
| `openai/gpt-5-image-mini` | GPT-5 Image Mini | no | — (was `["img"]`, moved) |
| `openai/gpt-5-image` | GPT-5 Image | no | — |
| `google/gemini-2.5-flash-image` | Nano Banana | no | — |

#### Existing non-image entries
Every existing entry gets `"supports": ["chat", "app"]` added. No other changes to their fields.

### 4. Default model shifts
- `preSelected: ["app"]`: stays on `anthropic/claude-opus-4.6-fast` (no change).
- `preSelected: ["chat"]`: stays on `anthropic/claude-sonnet-4.6` (still latest Sonnet).
- `preSelected: ["img"]`: **moves** from `openai/gpt-5-image-mini` → `openai/gpt-5.4-image-2`.

## Affected files

1. [vibes.diy/api/types/chat.ts](vibes.diy/api/types/chat.ts) — add `supports?` field to `Model` arktype schema (1 line).
2. [vibes.diy/api/svc/models.json](vibes.diy/api/svc/models.json) — data edits per tables above.
3. [vibes.diy/pkg/app/components/ModelSettingsCards.tsx](vibes.diy/pkg/app/components/ModelSettingsCards.tsx) — filter models by `usage` in `ModelSection` (~3 lines).

No changes to:
- `vibes.diy/api/svc/public/list-models.ts` — API continues to return full catalog.
- `vibes.diy/pkg/app/routes/settings.tsx` — no UI structural change.
- `ModelPicker.tsx` — per-chat picker is out of scope; if it needs filtering later it can read the same `supports` field.

## Testing

- **Data:** every entry in `models.json` has a non-empty `supports` array.
- **Data:** every image-output model has `supports: ["img"]` only.
- **Type:** arktype `Model` schema continues to parse the file (`parseArrayWarning` in `loadModels`).
- **UI:** Imaging dropdown shows exactly 6 models; Chat/App dropdowns show neither of those 6 nor each other's exclusives.
- **UI:** First-load pre-selection lands on `gpt-5.4-image-2` for Imaging.
- **Backward compat:** an entry without `supports` appears in Chat and App but not Imaging.

## Risks / open points

- Users who had saved `modelDefaults.img` = `gpt-5-image-mini` will keep that setting (stored in user settings, not derived from catalog). Since that ID stays in the catalog with `supports: ["img"]`, the dropdown will still render it. No migration needed.
- `openrouter/auto` appears in OpenRouter's image-output list but is a meta-router, not a generator. Excluded deliberately.
