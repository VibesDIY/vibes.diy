# Design: Re-enable Skipped Tests (Issue #1367)

## Context

Issue #1367 tracks three skipped test blocks from `jchris/go-live`. Since then:

- `ImgVibes` was replaced by `ImgGen` (simpler \_files-keyed approach)
- The old `ImgVibes.test.tsx` and `ImgVibesIdSwitching.test.tsx` scenarios are still valuable coverage

## Scope

Two parts:

1. **New `ImgGen` component tests** — retarget the 9 skipped ImgVibes scenarios to `ImgGen`
2. **Fix `api.test.ts` "queries the llm"** — unskip the LLM replay test

---

## Part 1: ImgGen component tests

### Location

New file: `vibes.diy/tests/app/img-gen-component.test.tsx`

### Setup

Use Firefly + `MockVibeApi` — same pattern as `use-firefly.test.tsx` and `firefly-database.test.ts`.

```typescript
import { registerFirefly } from "../../vibe/runtime/use-firefly.js";
import { createMockVibeApi, asSandboxApi } from "./mock-vibe-api.js";

// Swap @fireproof/use-fireproof with Firefly (mirrors sandbox import-map behavior)
vi.mock("@fireproof/use-fireproof", async () => {
  const { useFireproof } = await import("../../vibe/runtime/use-firefly.js");
  return { useFireproof };
});

// Mock imgGen — controls generation results without hitting the real API
const mockImgGen = vi.hoisted(() => vi.fn());
vi.mock("@vibes.diy/vibe-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vibes.diy/vibe-runtime")>()),
  imgGen: mockImgGen,
}));

beforeAll(async () => {
  await registerFirefly(asSandboxApi(createMockVibeApi("test-app")));
});
```

### Test scenarios (ported from skipped ImgVibes tests)

**From `ImgVibes.test.tsx`:**

1. **No prompt/id** — renders `"No prompt provided"` text
2. **Has prompt, no existing doc** — shows `"Generating image..."` + the prompt text
3. **imgGen rejects** — shows error container with the error message
4. **imgGen resolves → generation verified** — mock records that `imgGen` was called with the correct prompt; DB receives a `put` with correct `versions`/`_files` shape (verified via `mockApi._docs`)
5. **Pre-existing image renders** — pre-populate `mockApi._docs` with a doc containing `_files: { v1: { url: "https://example.com/test.png", ... } }`; render `<ImgGen _id="…">` and assert `<img src="https://example.com/test.png">` is present
6. **Custom props** — accepts `className`, `alt`, `style` without throwing

**From `ImgVibesIdSwitching.test.tsx`:**

7. **ID switching** — pre-populate two docs in `mockApi._docs`; rerender with `_id="doc-1"` then `_id="doc-2"`; assert each `<img>` src matches the respective doc's URL
8. **Multiple versions** — pre-populate a doc with 2 versions and valid URLs for both; render and assert prev/next buttons appear
9. **Prompt → \_id mode switch** — render with `prompt="…"` (shows "Generating image..."), then rerender with `_id="…"` pointing at a pre-populated doc; assert component transitions to `<img>`

### Why pre-population instead of generation flow for display tests

`ImgGen` only renders `<img>` when `hasExistingImage = versions.length > 0 && !!displayUrl`.
`displayUrl` is `doc._files[ver.id].url`. Firefly stores exactly what is `put` — it never mints a URL.
In production, `url` is computed server-side when the doc is read back. Tests that want to verify the `<img>` rendering path must pre-populate docs with a `url` field directly in `mockApi._docs`, not rely on the generation flow to produce one. Tests that want to verify the generation flow check `mockImgGen` call args and `mockApi._docs` contents instead.

---

## Part 2: Fix "queries the llm" in api.test.ts

### Problem

The fixture (`fixture.llm`) now has 3 SSE events, producing far fewer than 44 blocks. The test exits via `blocks >= 44` which never triggers, causing a 5s timeout.

### Fix

**Step 1 — fix the exit condition** (the comment at line 701–705 already shows the correct pattern):

```typescript
// Before (broken — never exits if fixture produces < 44 blocks):
if (blocks >= 44) {
  await rNext.Ok().close();
}

// After (correct — exits when the prompt stream ends):
if (msg.type === "vibes.diy.section-event" && msg.blocks.some(isPromptBlockEnd)) {
  await rNext.Ok().close();
}
```

**Step 2 — determine the real block count**

After fixing the exit condition, run the test with the assertion temporarily commented out. Record the actual block count the current fixture produces. Then update the assertion to that exact number:

```typescript
// Don't weaken to toBeGreaterThan(0) — that would hide regressions.
// Determine the real count from a run, then pin it:
expect(nextFn.mock.calls.flatMap((call) => call[0].blocks).length).toEqual(/* actual N */);
```

The test should also assert the replay correctness already tested elsewhere — the block list ends with a `prompt.block-end` type:

```typescript
expect(nextFn.mock.calls.flatMap((call) => call[0].blocks).some(isPromptBlockEnd)).toBe(true);
```

This preserves the original intent (exact block count check + replay completeness) without weakening the assertion.

---

## Success criteria

- `pnpm check` passes in `vibes.diy/tests/app` and `vibes.diy/api/tests`
- All 9 ImgGen scenarios pass in the browser test runner with assertions that would catch real regressions (display tests assert specific `src` URLs; generation tests verify `mockImgGen` call args and DB doc shape)
- "queries the llm" passes without timeout; block count assertion is the exact number the current fixture produces, not a weakened lower bound
- No regressions in existing tests
