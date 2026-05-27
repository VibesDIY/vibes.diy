# Re-enable Skipped Tests (Issue #1367) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the 9 skipped ImgVibes test scenarios to `ImgGen` and fix the timed-out "queries the llm" api test.

**Architecture:** Two independent parts. Part 1 adds `vibes.diy/tests/app/img-gen-component.test.tsx` using Firefly (the sandbox Fireproof backend) swapped in via `vi.mock`, plus a mocked `imgGen`. Part 2 fixes the broken exit condition in `api.test.ts` and pins the actual block count from the current fixture.

**Tech Stack:** vitest (browser/Playwright), `@testing-library/react`, Firefly (`use-firefly.ts`), `MockVibeApi`, `vi.mock`, `@adviser/cement` Result type

---

## Important: Failure handling

After every "Run tests" step, if tests fail, **stop and report the exact failure output** before proceeding. Do not attempt fixes without pausing. The failures are the specification.

---

## File Map

| Action | Path                                             |
| ------ | ------------------------------------------------ |
| Create | `vibes.diy/tests/app/img-gen-component.test.tsx` |
| Modify | `vibes.diy/api/tests/api.test.ts` lines 668–710  |

---

## Part 1: ImgGen component tests

### Task 1: Create the test file with all 9 scenarios

The setup uses Firefly as a drop-in Fireproof backend — the same pattern as `use-firefly.test.tsx` — with `@fireproof/use-fireproof` swapped via `vi.mock`.

**Files:**

- Create: `vibes.diy/tests/app/img-gen-component.test.tsx`

- [ ] **Step 1: Create the test file**

```typescript
// vibes.diy/tests/app/img-gen-component.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ImgGen } from "@vibes.diy/base";
import { Result } from "@adviser/cement";
import { registerFirefly } from "../../vibe/runtime/use-firefly.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

// Swap @fireproof/use-fireproof with Firefly — mirrors the sandbox import-map behavior.
// Must be declared before any imports that use it (vitest hoists vi.mock calls).
vi.mock("@fireproof/use-fireproof", async () => {
  const { useFireproof } = await import("../../vibe/runtime/use-firefly.js");
  return { useFireproof };
});

// Control imgGen without hitting the real API.
const mockImgGen = vi.hoisted(() => vi.fn());
vi.mock("@vibes.diy/vibe-runtime", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  imgGen: mockImgGen,
}));

// ── Test helpers ────────────────────────────────────────────────────

let mockApi: MockVibeApi;
let dbCounter = 0;
/** Unique DB name per test — avoids Firefly dbCache cross-contamination. */
function freshDb() {
  return `img-gen-test-${++dbCounter}`;
}

/** Pre-built image doc with a URL-bearing _files entry. */
function makeImageDoc(id: string, url: string, versions = 1) {
  const versionList = Array.from({ length: versions }, (_, i) => ({
    id: `v${i + 1}`,
    created: Date.now() - (versions - i) * 1000,
    promptKey: "p1",
  }));
  const files: Record<string, unknown> = {};
  versionList.forEach((v, i) => {
    files[v.id] = {
      url: i === versions - 1 ? url : `${url}-v${i + 1}`,
      uploadId: `upl-${i + 1}`,
      cid: `bafy-${i + 1}`,
      type: "image/png",
      size: 100,
      lastModified: Date.now(),
    };
  });
  return {
    _id: id,
    type: "image",
    prompt: "test prompt",
    currentVersion: versions - 1,
    versions: versionList,
    currentPromptKey: "p1",
    prompts: { p1: { text: "test prompt", created: Date.now() } },
    _files: files,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockApi = createMockVibeApi("test-app");
  await registerFirefly(asSandboxApi(mockApi));
});

// ── Tests ───────────────────────────────────────────────────────────

describe("ImgGen component", () => {
  it("shows 'No prompt provided' when neither prompt nor _id is given", () => {
    render(<ImgGen database={freshDb()} />);
    expect(screen.getByText("No prompt provided")).toBeInTheDocument();
  });

  it("shows generating state when prompt is given but no image exists yet", () => {
    // imgGen is a never-resolving promise — component stays in generating state
    mockImgGen.mockImplementation(() => new Promise(() => {}));
    render(<ImgGen prompt="mountain sunset" database={freshDb()} />);
    expect(screen.getByText("Generating image...")).toBeInTheDocument();
    expect(screen.getByText("mountain sunset")).toBeInTheDocument();
  });

  it("shows error state when imgGen rejects", async () => {
    mockImgGen.mockRejectedValue(new Error("Prodia API failed"));
    render(<ImgGen prompt="test prompt" database={freshDb()} />);
    await waitFor(() => {
      expect(screen.getByText("Prodia API failed")).toBeInTheDocument();
    });
  });

  it("calls imgGen with the correct prompt and stores the result doc", async () => {
    const mockFile = { uploadId: "upl-abc", cid: "bafy-abc", mimeType: "image/png", size: 1024 };
    mockImgGen.mockResolvedValue(Result.Ok([mockFile]));

    render(<ImgGen prompt="beautiful sunset" database={freshDb()} />);

    await waitFor(() => {
      expect(mockImgGen).toHaveBeenCalledWith("beautiful sunset", undefined, undefined);
    });
    // Verify the doc written to the DB has the right shape
    await waitFor(() => {
      const stored = [...mockApi._docs.values()].find(
        (d) => d.type === "image" && d.prompt === "beautiful sunset"
      );
      expect(stored).toBeDefined();
      expect(stored?._files).toEqual(
        expect.objectContaining({ v1: expect.objectContaining({ uploadId: "upl-abc" }) })
      );
    });
  });

  it("renders <img> with the correct src when a pre-existing image doc is present", async () => {
    mockApi._docs.set("img-existing", makeImageDoc("img-existing", "https://example.com/img.png"));
    render(<ImgGen _id="img-existing" database={freshDb()} />);
    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/img.png");
    });
  });

  it("applies className to the root element in generating state", () => {
    mockImgGen.mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <ImgGen prompt="test" className="my-custom-class" database={freshDb()} />
    );
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  it("switches to a new image when _id changes", async () => {
    mockApi._docs.set("doc-1", makeImageDoc("doc-1", "https://example.com/doc1.png"));
    mockApi._docs.set("doc-2", makeImageDoc("doc-2", "https://example.com/doc2.png"));
    const db = freshDb();

    const { rerender } = render(<ImgGen _id="doc-1" database={db} />);
    await waitFor(() =>
      expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/doc1.png")
    );

    rerender(<ImgGen _id="doc-2" database={db} />);
    await waitFor(() =>
      expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/doc2.png")
    );
  });

  it("shows prev/next version controls for a doc with multiple versions", async () => {
    mockApi._docs.set("img-multi", makeImageDoc("img-multi", "https://example.com/multi.png", 2));
    render(<ImgGen _id="img-multi" database={freshDb()} />);
    await waitFor(() => {
      expect(screen.getByTitle("Previous version")).toBeInTheDocument();
      expect(screen.getByTitle("Next version")).toBeInTheDocument();
    });
  });

  it("switches from generating state to image display when _id replaces prompt", async () => {
    mockImgGen.mockImplementation(() => new Promise(() => {}));
    mockApi._docs.set("img-from-id", makeImageDoc("img-from-id", "https://example.com/from-id.png"));
    const db = freshDb();

    const { rerender } = render(<ImgGen prompt="a sunset" database={db} />);
    expect(screen.getByText("Generating image...")).toBeInTheDocument();

    rerender(<ImgGen _id="img-from-id" database={db} />);
    await waitFor(() =>
      expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/from-id.png")
    );
  });
});
```

- [ ] **Step 2: Run the tests (first pass)**

```bash
cd vibes.diy/tests/app && DISABLE_REACT_ROUTER=true pnpm vitest run img-gen-component
```

**If any tests fail: stop here and report the exact failure output. Do not attempt fixes.**

Expected on a clean first pass: all 9 tests pass. The most likely failure points if something is wrong are noted in the spec — namely mock wiring issues or Firefly initialization order.

- [ ] **Step 3: Commit if all pass**

```bash
git add vibes.diy/tests/app/img-gen-component.test.tsx
git commit -m "test(img-gen): add 9 component scenarios ported from skipped ImgVibes tests"
```

---

## Part 2: Fix "queries the llm" in api.test.ts

### Task 2: Fix the exit condition and discover the actual block count

**Files:**

- Modify: `vibes.diy/api/tests/api.test.ts`

- [ ] **Step 1: Remove `.skip` and fix the exit condition**

In `vibes.diy/api/tests/api.test.ts`, replace lines 668–710:

```typescript
// Before (broken — times out because blocks never reaches 44):
// TODO: consistently times out at 5s waiting for 44 blocks from the fixture
// stream — broken since aa354215. Needs a rewrite of the block-count
// expectation to match current LLM fixture output.
it.skip("queries the llm", async () => {
  const rChatRes = await api.openChat({
    mode: "chat",
  });
  expect(rChatRes.isOk()).toBe(true);
  const chat = rChatRes.Ok();
  console.log("pre-chat.prompt");
  const rPrompt = await chat.prompt({
    messages: [{ role: "user", content: [{ type: "text", text: `use fixture response` }] }],
  });
  expect(rPrompt.isOk()).toBe(true);
  console.log("post-chat.prompt");
  const firstStream = processStream(chat.sectionStream, async () => {
    await sleep(100);
    // console.log("Received message in llm query test", msg);
  });

  const rNext = await api.openChat({
    chatId: chat.chatId,
    mode: "chat",
  });
  // console.log("pre-processStream");
  const nextFn = vi.fn();
  Promise.all([
    firstStream,
    await processStream(rNext.Ok().sectionStream, async (msg) => {
      nextFn(msg);
      const blocks = nextFn.mock.calls.reduce((acc, call) => acc + call[0].blocks.length, 0);
      // console.log("Received message in llm query test", blocks, "blocks so far", msg);
      if (blocks >= 44) {
        await rNext.Ok().close();
      }
      // if (msg.type === "vibes.diy.section-event" && msg.promptId === rPrompt.Ok().promptId && isPromptBlockEnd(msg.blocks[0])) {
      //   rNext.Ok().close();
      // }
    }),
  ]);
  // console.log("LLM query test, received blocks:", nextFn.mock.calls.flatMap((call) => call[0].blocks))
  expect(nextFn.mock.calls.flatMap((call) => call[0].blocks).length).toEqual(44);
});
```

Replace with:

```typescript
it("queries the llm", async () => {
  const rChatRes = await api.openChat({
    mode: "chat",
  });
  expect(rChatRes.isOk()).toBe(true);
  const chat = rChatRes.Ok();
  const rPrompt = await chat.prompt({
    messages: [{ role: "user", content: [{ type: "text", text: `use fixture response` }] }],
  });
  expect(rPrompt.isOk()).toBe(true);
  const firstStream = processStream(chat.sectionStream, async () => {
    await sleep(100);
  });

  const rNext = await api.openChat({
    chatId: chat.chatId,
    mode: "chat",
  });
  const nextFn = vi.fn();
  await Promise.all([
    firstStream,
    processStream(rNext.Ok().sectionStream, async (msg) => {
      nextFn(msg);
      if (msg.type === "vibes.diy.section-event" && msg.blocks.some(isPromptBlockEnd)) {
        await rNext.Ok().close();
      }
    }),
  ]);
  const allBlocks = nextFn.mock.calls.flatMap((call) => call[0].blocks);
  console.log(
    "[queries the llm] block count:",
    allBlocks.length,
    "blocks:",
    allBlocks.map((b: { type: string }) => b.type)
  );
  expect(allBlocks.some(isPromptBlockEnd)).toBe(true);
  // TODO: replace FIXME_BLOCK_COUNT with the actual count logged above, then remove console.log
  expect(allBlocks.length).toEqual("FIXME_BLOCK_COUNT" as unknown as number);
});
```

- [ ] **Step 2: Run the test (first pass — will fail on the FIXME assertion)**

```bash
cd vibes.diy/api/tests && pnpm vitest run api.test.ts -t "queries the llm"
```

**If the test fails with a reason OTHER than the FIXME assertion (e.g. timeout, `isPromptBlockEnd` assertion fails, unexpected error): stop and report the exact output before proceeding.**

If the only failure is `Expected "FIXME_BLOCK_COUNT" to equal N` where N is a number: that is expected — record N and proceed to Step 3.

- [ ] **Step 3: Pin the real block count**

Replace the two `console.log` + FIXME lines with the exact count observed:

```typescript
const allBlocks = nextFn.mock.calls.flatMap((call) => call[0].blocks);
expect(allBlocks.some(isPromptBlockEnd)).toBe(true);
expect(allBlocks.length).toEqual(N); // N = observed value from Step 2
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd vibes.diy/api/tests && pnpm vitest run api.test.ts -t "queries the llm"
```

Expected: PASS. If it fails: stop and report.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/tests/api.test.ts
git commit -m "test(api): fix 'queries the llm' — use isPromptBlockEnd exit, pin real block count"
```

---

## Task 3: Full check

- [ ] **Run pnpm check**

```bash
pnpm check
```

Expected: all tests pass, no lint or type errors. If failures: stop and report.
