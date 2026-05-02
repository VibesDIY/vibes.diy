# Settings Model Catalog Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the `/settings` Default Models card so (1) dropdowns are scoped by capability, (2) stale OpenRouter IDs are updated, (3) `openai/gpt-5.4-image-2` is added as the new image default.

**Architecture:** Add an optional `supports: ("chat"|"app"|"img")[]` field to the `Model` arktype schema. Backend `listModels` continues to return the full catalog unchanged. The `ModelSection` UI component filters the catalog by `usage` using a pure helper, defaulting missing `supports` to `["chat","app"]` so image dropdowns never accidentally include untagged models. Data is curated manually in `vibes.diy/api/svc/models.json`.

**Tech Stack:** TypeScript, arktype (type runtime), React, Vitest, @testing-library/react.

**Spec:** [docs/superpowers/specs/2026-04-23-settings-model-catalog-refresh-design.md](../specs/2026-04-23-settings-model-catalog-refresh-design.md)

---

## File Map

**Modified:**
- `vibes.diy/api/types/chat.ts` — add `"supports?"` to `Model` arktype schema (1 line).
- `vibes.diy/api/svc/models.json` — data refresh (~60 edits; described below).
- `vibes.diy/pkg/app/components/ModelSettingsCards.tsx` — apply `filterModelsByUsage` in `ModelSection`.

**Created:**
- `vibes.diy/pkg/app/components/filterModelsByUsage.ts` — pure helper.
- `vibes.diy/tests/app/filterModelsByUsage.test.ts` — unit tests for the helper.

**Unchanged:**
- `vibes.diy/api/svc/public/list-models.ts` — API returns full catalog; filtering stays in UI.
- `vibes.diy/pkg/app/routes/settings.tsx` — no structural change.

---

## Task 1: Add `supports` field to `Model` arktype schema

**Files:**
- Modify: `vibes.diy/api/types/chat.ts:21-27`

- [ ] **Step 1: Add the `supports?` property to the `Model` arktype definition**

Open `vibes.diy/api/types/chat.ts`. The current `Model` schema (lines 21-27) is:

```ts
export const Model = type({
  id: "string",
  name: "string",
  description: "string",
  "featured?": "boolean",
  "preSelected?": PromptStyle.array(),
});
```

Replace with:

```ts
export const Model = type({
  id: "string",
  name: "string",
  description: "string",
  "featured?": "boolean",
  "preSelected?": PromptStyle.array(),
  "supports?": PromptLLMStyle.array(),
});
```

Note: `PromptLLMStyle` is already defined at line 6 of the same file as `type("'chat' | 'app' | 'img'")`. `PromptStyle` (used by `preSelected`) is the union with fs-update/fs-set; we use the narrower `PromptLLMStyle` here.

- [ ] **Step 2: Verify the api-types package still builds**

Run from repo root:

```bash
pnpm --filter @vibes.diy/api-types build
```

Expected: exit code 0, no TypeScript errors.

- [ ] **Step 3: Verify existing api tests still pass**

Run from repo root:

```bash
pnpm --filter @vibes.diy/api-tests test
```

Expected: all tests pass. (The existing `models.json` is parsed by `parseArrayWarning(raw, Model)` in `loadModels` — since `supports` is optional, pre-existing entries parse unchanged.)

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/types/chat.ts
git commit -m "feat(api-types): add supports field to Model schema"
```

---

## Task 2: Create and test `filterModelsByUsage` helper

**Files:**
- Create: `vibes.diy/pkg/app/components/filterModelsByUsage.ts`
- Create: `vibes.diy/tests/app/filterModelsByUsage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/filterModelsByUsage.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { filterModelsByUsage } from "~/vibes.diy/app/components/filterModelsByUsage.js";
import type { Model } from "@vibes.diy/api-types";

const CHAT_ONLY: Model = {
  id: "anthropic/claude-sonnet-4.6",
  name: "Sonnet 4.6",
  description: "chat",
  supports: ["chat", "app"],
};

const IMG_ONLY: Model = {
  id: "openai/gpt-5.4-image-2",
  name: "GPT-5.4 Image 2",
  description: "image generator",
  supports: ["img"],
};

const UNTAGGED: Model = {
  id: "legacy/untagged",
  name: "Legacy",
  description: "no supports field",
};

const MULTI: Model = {
  id: "multi/model",
  name: "Multi",
  description: "supports chat and img",
  supports: ["chat", "img"],
};

describe("filterModelsByUsage", () => {
  it("returns only models that list the usage in supports", () => {
    const result = filterModelsByUsage([CHAT_ONLY, IMG_ONLY], "img");
    expect(result).toEqual([IMG_ONLY]);
  });

  it("includes a model in multiple usage dropdowns when supports has multiple entries", () => {
    const chat = filterModelsByUsage([MULTI], "chat");
    const img = filterModelsByUsage([MULTI], "img");
    const app = filterModelsByUsage([MULTI], "app");
    expect(chat).toEqual([MULTI]);
    expect(img).toEqual([MULTI]);
    expect(app).toEqual([]);
  });

  it("treats missing supports as ['chat','app'] — never image", () => {
    expect(filterModelsByUsage([UNTAGGED], "chat")).toEqual([UNTAGGED]);
    expect(filterModelsByUsage([UNTAGGED], "app")).toEqual([UNTAGGED]);
    expect(filterModelsByUsage([UNTAGGED], "img")).toEqual([]);
  });

  it("preserves input order", () => {
    const input = [IMG_ONLY, CHAT_ONLY, MULTI];
    const result = filterModelsByUsage(input, "chat");
    expect(result).toEqual([CHAT_ONLY, MULTI]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from repo root:

```bash
cd vibes.diy/tests && pnpm test filterModelsByUsage
```

Expected: FAIL with module not found (`filterModelsByUsage.js` doesn't exist yet).

- [ ] **Step 3: Implement the helper**

Create `vibes.diy/pkg/app/components/filterModelsByUsage.ts` with:

```ts
import type { Model } from "@vibes.diy/api-types";

export type ModelUsage = "chat" | "app" | "img";

const DEFAULT_SUPPORTS: readonly ModelUsage[] = ["chat", "app"];

export function filterModelsByUsage(models: Model[], usage: ModelUsage): Model[] {
  return models.filter((m) => {
    const supports = m.supports ?? DEFAULT_SUPPORTS;
    return supports.includes(usage);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run from repo root:

```bash
cd vibes.diy/tests && pnpm test filterModelsByUsage
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/filterModelsByUsage.ts vibes.diy/tests/app/filterModelsByUsage.test.ts
git commit -m "feat(settings): add filterModelsByUsage helper with tests"
```

---

## Task 3: Apply filter in `ModelSection`

**Files:**
- Modify: `vibes.diy/pkg/app/components/ModelSettingsCards.tsx:1-76`

- [ ] **Step 1: Add the import**

Open `vibes.diy/pkg/app/components/ModelSettingsCards.tsx`. After line 3 (the existing `import { useVibesDiy } from "../vibes-diy-provider.js";`), add:

```ts
import { filterModelsByUsage } from "./filterModelsByUsage.js";
```

- [ ] **Step 2: Apply the filter in the `listModels` effect**

Locate the `useEffect` block at lines 56-76 that calls `vibeDiyApi.listModels({})`. Current code:

```ts
useEffect(() => {
  if (viewState.current === "start") {
    viewState.current = "loading";
    vibeDiyApi.listModels({}).then((res) => {
      viewState.current = "loaded";
      if (res.isOk()) {
        setModels(res.Ok().models);
        for (const model of res.Ok().models) {
          if (model.preSelected?.includes(usage))
            setAIParam((prev) => {
              if (!prev?.model) {
                return { ...prev, model };
              }
              return prev;
            });
        }
      }
    });
    return;
  }
}, [vibeDiyApi, usage]);
```

Replace with:

```ts
useEffect(() => {
  if (viewState.current === "start") {
    viewState.current = "loading";
    vibeDiyApi.listModels({}).then((res) => {
      viewState.current = "loaded";
      if (res.isOk()) {
        const eligible = filterModelsByUsage(res.Ok().models, usage);
        setModels(eligible);
        for (const model of eligible) {
          if (model.preSelected?.includes(usage))
            setAIParam((prev) => {
              if (!prev?.model) {
                return { ...prev, model };
              }
              return prev;
            });
        }
      }
    });
    return;
  }
}, [vibeDiyApi, usage]);
```

The two differences: `const eligible = filterModelsByUsage(res.Ok().models, usage);`, then `setModels(eligible);` and `for (const model of eligible)`.

- [ ] **Step 3: Verify the package typechecks**

Run from repo root:

```bash
pnpm --filter @vibes.diy/pkg typecheck 2>&1 | tail -20
```

Expected: no TypeScript errors related to the edited file. (If this filter name isn't used: `pnpm --filter vibes.diy-pkg` — check the root `pnpm-workspace.yaml` / `package.json` for the exact filter.)

If the filter name differs, run the equivalent from the package dir:

```bash
cd vibes.diy/pkg && pnpm typecheck 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/app/components/ModelSettingsCards.tsx
git commit -m "feat(settings): filter ModelSection dropdowns by usage"
```

---

## Task 4: Add `supports` field to every existing entry in `models.json`

**Files:**
- Modify: `vibes.diy/api/svc/models.json` (all 30 entries get `"supports": ["chat", "app"]`)

- [ ] **Step 1: Add `"supports": ["chat", "app"]` to every existing entry**

Open `vibes.diy/api/svc/models.json`. For every one of the 30 entries currently in the file, add `"supports": ["chat", "app"]` as the last field of the object (after `featured` / `preSelected`).

Note: `openai/gpt-5-image-mini` is the one existing entry that currently has `"preSelected": ["img"]`. For this entry only, set `"supports": ["img"]` instead (and we'll remove its `preSelected` in Task 6).

Concretely, edit every object so its shape becomes (for non-image entries):

```json
{
  "id": "...",
  "name": "...",
  "description": "...",
  "featured": true | false,
  "preSelected": [...],   // if already present
  "supports": ["chat", "app"]
}
```

And for the one image entry (`openai/gpt-5-image-mini`):

```json
{
  "id": "openai/gpt-5-image-mini",
  "name": "GPT-5 Image Mini",
  "description": "OpenAI's GPT-5 Image Mini model for fast image generation",
  "featured": false,
  "preSelected": ["img"],
  "supports": ["img"]
}
```

(The `preSelected` on this entry is removed in Task 7 Step 1 when we replace the image catalog.)

- [ ] **Step 2: Fix the duplicate `"featured": false` key on `openai/gpt-5.4-mini`**

Current entry (lines 137-143 of the file you just edited):

```json
{
  "id": "openai/gpt-5.4-mini",
  "name": "GPT-5.4 Mini",
  "description": "GPT-5.4 Mini is OpenAI's latest compact model optimized for fast, cost-efficient structured output",
  "featured": false,
  "featured": false,
  "supports": ["chat", "app"]
}
```

Replace with (single `featured` key):

```json
{
  "id": "openai/gpt-5.4-mini",
  "name": "GPT-5.4 Mini",
  "description": "GPT-5.4 Mini is OpenAI's latest compact model optimized for fast, cost-efficient structured output",
  "featured": false,
  "supports": ["chat", "app"]
}
```

- [ ] **Step 3: Verify JSON is valid and still loads via `loadModels`**

Run from repo root:

```bash
python3 -c "import json; json.load(open('vibes.diy/api/svc/models.json'))" && echo "JSON_OK"
```

Expected: `JSON_OK` printed. No JSON parse error.

Run the api tests to confirm `parseArrayWarning(raw, Model)` still accepts the file:

```bash
pnpm --filter @vibes.diy/api-tests test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/models.json
git commit -m "fix(models): tag supports on all entries, dedupe featured key"
```

---

## Task 5: Replace stale Google Gemini entries

**Files:**
- Modify: `vibes.diy/api/svc/models.json`

- [ ] **Step 1: Rename `google/gemini-3-pro-preview` → `google/gemini-3.1-pro-preview`**

Find the object with `"id": "google/gemini-3-pro-preview"` and replace it with:

```json
{
  "id": "google/gemini-3.1-pro-preview",
  "name": "Gemini 3.1 Pro",
  "description": "Gemini 3.1 Pro is Google's frontier reasoning model for software engineering and agentic tasks",
  "featured": true,
  "supports": ["chat", "app"]
}
```

- [ ] **Step 2: Remove `google/gemini-2.5-flash-lite-preview-06-17`**

Delete the entire object whose `"id"` is `"google/gemini-2.5-flash-lite-preview-06-17"` (including its trailing comma adjustment). The sibling entry `google/gemini-2.5-flash-lite` remains.

- [ ] **Step 3: Validate JSON**

```bash
python3 -c "import json; json.load(open('vibes.diy/api/svc/models.json'))" && echo "JSON_OK"
```

Expected: `JSON_OK`.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/models.json
git commit -m "fix(models): replace stale gemini-3-pro-preview, remove dead flash-lite preview"
```

---

## Task 6: Add latest-generation chat/app entries

**Files:**
- Modify: `vibes.diy/api/svc/models.json`

- [ ] **Step 1: Append the seven new chat/app entries to the array**

Before the closing `]` of the JSON array, append these seven objects (preserve array comma syntax — add a comma after the last existing entry):

```json
{
  "id": "anthropic/claude-opus-4.7",
  "name": "Claude Opus 4.7",
  "description": "Claude Opus 4.7 is the next generation of Anthropic's Opus family, built for long-running, asynchronous agents",
  "featured": true,
  "supports": ["chat", "app"]
},
{
  "id": "openai/gpt-5.4",
  "name": "GPT-5.4",
  "description": "GPT-5.4 is OpenAI's flagship model, building on GPT-5 with unified architecture and improved reasoning",
  "featured": true,
  "supports": ["chat", "app"]
},
{
  "id": "openai/gpt-5.4-pro",
  "name": "GPT-5.4 Pro",
  "description": "GPT-5.4 Pro is OpenAI's most advanced model, building on GPT-5.4's unified architecture with enhanced reasoning capabilities",
  "featured": false,
  "supports": ["chat", "app"]
},
{
  "id": "x-ai/grok-4.20",
  "name": "Grok 4.20",
  "description": "Grok 4.20 is xAI's latest flagship model with industry-leading speed and agentic tool calling",
  "featured": true,
  "supports": ["chat", "app"]
},
{
  "id": "z-ai/glm-5.1",
  "name": "GLM 5.1",
  "description": "GLM 5.1 delivers a major leap in coding capability, with significant gains in handling long-horizon tasks",
  "featured": false,
  "supports": ["chat", "app"]
},
{
  "id": "moonshotai/kimi-k2.6",
  "name": "Kimi K2.6",
  "description": "Kimi K2.6 is MoonshotAI's next-generation multimodal model for long-horizon coding and multi-agent orchestration",
  "featured": false,
  "supports": ["chat", "app"]
},
{
  "id": "deepseek/deepseek-v3.2",
  "name": "DeepSeek V3.2",
  "description": "DeepSeek V3.2 is the stable release of the V3.2 architecture, alongside the experimental variant",
  "featured": false,
  "supports": ["chat", "app"]
},
{
  "id": "openai/gpt-5.3-codex",
  "name": "GPT-5.3 Codex",
  "description": "GPT-5.3 Codex is the newer specialized coding model in the GPT-5.3 family, optimized for software engineering workflows",
  "featured": false,
  "supports": ["chat", "app"]
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json; json.load(open('vibes.diy/api/svc/models.json'))" && echo "JSON_OK"
```

Expected: `JSON_OK`.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/models.json
git commit -m "feat(models): add latest-generation chat/app entries (Opus 4.7, GPT-5.4, Grok 4.20, etc.)"
```

---

## Task 7: Replace image generation entries

**Files:**
- Modify: `vibes.diy/api/svc/models.json`

- [ ] **Step 1: Update the existing `openai/gpt-5-image-mini` entry**

Find the `openai/gpt-5-image-mini` entry and replace it with (dropping `preSelected`):

```json
{
  "id": "openai/gpt-5-image-mini",
  "name": "GPT-5 Image Mini",
  "description": "OpenAI's GPT-5 Image Mini model for fast image generation",
  "featured": false,
  "supports": ["img"]
}
```

- [ ] **Step 2: Append the five new image-generation entries to the array**

Before the closing `]` of the JSON array, append these five objects (add a comma after the previous last entry):

```json
{
  "id": "openai/gpt-5.4-image-2",
  "name": "GPT-5.4 Image 2",
  "description": "GPT-5.4 Image 2 combines OpenAI's GPT-5.4 with state-of-the-art image generation, enabling multimodal workflows across reasoning, code, and visual output",
  "featured": true,
  "preSelected": ["img"],
  "supports": ["img"]
},
{
  "id": "google/gemini-3.1-flash-image-preview",
  "name": "Nano Banana 2",
  "description": "Google's latest image generation and editing model (Gemini 3.1 Flash Image Preview) delivering professional visual quality at fast speed",
  "featured": true,
  "supports": ["img"]
},
{
  "id": "google/gemini-3-pro-image-preview",
  "name": "Nano Banana Pro",
  "description": "Google's Gemini 3 Pro Image Preview for highest-quality image generation and editing",
  "featured": false,
  "supports": ["img"]
},
{
  "id": "openai/gpt-5-image",
  "name": "GPT-5 Image",
  "description": "OpenAI's GPT-5 Image model for high-quality image generation",
  "featured": false,
  "supports": ["img"]
},
{
  "id": "google/gemini-2.5-flash-image",
  "name": "Nano Banana",
  "description": "Google's Gemini 2.5 Flash Image model for image generation and editing",
  "featured": false,
  "supports": ["img"]
}
```

- [ ] **Step 3: Validate JSON**

```bash
python3 -c "import json; json.load(open('vibes.diy/api/svc/models.json'))" && echo "JSON_OK"
```

Expected: `JSON_OK`.

- [ ] **Step 4: Validate the arktype schema still accepts all entries**

```bash
pnpm --filter @vibes.diy/api-tests test
```

Expected: all tests pass.

- [ ] **Step 5: Quick sanity check — count image entries**

```bash
python3 -c "
import json
models = json.load(open('vibes.diy/api/svc/models.json'))
img = [m for m in models if 'img' in (m.get('supports') or [])]
print(f'Image models: {len(img)}')
for m in img:
    print(f\"  {m['id']} preSelected={m.get('preSelected')}\")"
```

Expected output:

```
Image models: 6
  openai/gpt-5-image-mini preSelected=None
  openai/gpt-5.4-image-2 preSelected=['img']
  google/gemini-3.1-flash-image-preview preSelected=None
  google/gemini-3-pro-image-preview preSelected=None
  openai/gpt-5-image preSelected=None
  google/gemini-2.5-flash-image preSelected=None
```

Exactly one image model has `preSelected=['img']`, and it's `openai/gpt-5.4-image-2`.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/models.json
git commit -m "feat(models): refresh image catalog, default to gpt-5.4-image-2"
```

---

## Task 8: Full repository check

**Files:** none (verification only).

- [ ] **Step 1: Run `pnpm check` at repo root**

Run from repo root:

```bash
pnpm check
```

Expected: format, build, test, and lint all pass. Exit code 0.

If any step fails:
- **Format errors:** run `pnpm format` and amend the most recent commit.
- **Build/typecheck errors:** fix the reported files; if the error is in code this plan changed, re-examine the changes.
- **Lint errors:** fix inline (no `--fix` shortcuts that mask real issues).
- **Test failures:** read the failure, determine if it's legitimate regression (fix the code) or a stale snapshot/assertion (update the test deliberately).

- [ ] **Step 2: Manually verify the Settings page renders correctly**

Start the dev server:

```bash
pnpm --filter @vibes.diy/pkg dev
```

In the browser, log in, navigate to `/settings`, scroll to the "Default Models" card:
- **Chat Model** dropdown: contains all chat/app-tagged entries (featured models at top if ordered). Does NOT contain any model whose id contains `image`.
- **App Model** dropdown: same as Chat.
- **Imaging Model** dropdown: contains exactly 6 entries — `gpt-5.4-image-2`, Nano Banana 2, Nano Banana Pro, gpt-5-image-mini, gpt-5-image, Nano Banana. First load pre-selects `GPT-5.4 Image 2`.

If a dropdown shows wrong entries, check the browser console and network tab for the `listModels` response — the raw catalog should contain all 43 entries with correct `supports` fields; the filter is client-side.

- [ ] **Step 3: (No commit if everything passes.)**

If `pnpm check` and the manual verification both pass, no further commits needed. If you fixed anything in Step 1, commit those fixes with a descriptive message and re-run `pnpm check` to confirm.

---

## Post-implementation

- Confirm all 8 tasks are committed.
- Tell the user the branch is ready for PR.
- Mention: users with previously-saved `modelDefaults.img = gpt-5-image-mini` in their user settings keep that value (it's not derived from the catalog's `preSelected`), and the catalog still lists `gpt-5-image-mini`, so their dropdown will still show it selected.
