# #1667 Domain-aware prompt compaction — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's continuation assembly (system + CURRENT FILES + full SEARCH/REPLACE conversation history) with a slot-based assembler that interpolates `[original, selected?, last_edit?, previous]` chronologically, compacts older assistant turns to narration + code-block summaries, and folds recovery into the same single pipeline.

**Architecture:**

- New pure modules: `last-edit-diff.ts` (Myers diff → SEARCH/REPLACE), `slot-assembler.ts` (orders slots, applies per-file content-hash dedup, picks canonical home, renders each through existing `renderCurrentFiles`).
- Modified: `assemblePromptPayload` calls the slot assembler instead of appending `CURRENT FILES` to the system prompt; `reconstructConversationMessages` gains `opts.keepFullTurnPromptId` to summarize older code blocks; `buildRecoveryRequest` becomes a thin slot consumer.
- Wire additions: `selected?: {kind:"version"|"draft", ...}`, `slots?: SlotConfig` on `reqCreationPromptChatSection`.
- CLI: `selected.draft` populated when `.undo` is absent OR disk drifted; `--focus <path>` flag for multi-file edits.

**Tech Stack:** TypeScript, Drizzle ORM, arktype (zod-ish wire schemas), vitest, miniflare D1 SQLite locally. No new dependencies — uses Node's built-in line-diff via a small Myers impl inline.

**Spec:** [docs/superpowers/specs/2026-05-12-1667-domain-aware-prompt-compaction-design.md](../specs/2026-05-12-1667-domain-aware-prompt-compaction-design.md)

**Precursor (already shipped):** [#1696 dry-run inspection](https://github.com/VibesDIY/vibes.diy/pull/1697) — provides `assemblePromptPayload` (split from dispatch) and the `--dry-run` measurement surface.

---

## Phase 1 — Wire shape additions

### Task 1: Add `selected` field to request schema

**Files:**

- Modify: `vibes.diy/api/types/chat.ts:65-77` (reqCreationPromptChatSection)
- Test: `vibes.diy/api/tests/chat-types.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/chat-types.test.ts
import { describe, it, expect } from "vitest";
import { reqCreationPromptChatSection } from "../types/chat.js";

describe("reqCreationPromptChatSection: selected wire shape", () => {
  it("accepts selected: { kind: 'version', fsId }", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { kind: "dash", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
      selected: { kind: "version", fsId: "z3xyz" },
    });
    expect(r).not.toBeInstanceOf(Error);
  });

  it("accepts selected: { kind: 'draft', files }", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { kind: "dash", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
      selected: { kind: "draft", files: [{ filename: "App.jsx", content: "..." }] },
    });
    expect(r).not.toBeInstanceOf(Error);
  });

  it("rejects selected with unknown kind", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { kind: "dash", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [] },
      selected: { kind: "bogus" },
    });
    expect(r).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run the test, expect failures**

```
pnpm --dir vibes.diy/api/tests test chat-types
```

Expected: type errors / parse rejection because `selected` isn't declared.

- [ ] **Step 3: Add the schema**

In `vibes.diy/api/types/chat.ts`, just before line 77's closing `})`:

```ts
export const selectedSlotInput = type({
  kind: "'version'",
  fsId: "string",
}).or(
  type({
    kind: "'draft'",
    files: vibeFile.array(),
  })
);

export type SelectedSlotInput = typeof selectedSlotInput.infer;
```

Then add `"selected?": selectedSlotInput,` to `reqCreationPromptChatSection`.

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test chat-types
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/types/chat.ts vibes.diy/api/tests/chat-types.test.ts
git commit -m "feat(types): add selected slot input to req-prompt-chat-section"
```

---

### Task 2: Add `SlotConfig` mute flags to request schema and env

**Files:**

- Modify: `vibes.diy/api/types/chat.ts` (after `selectedSlotInput`)
- Modify: `vibes.diy/api/svc/.dev.vars` and `wrangler.toml` (env var declarations — read-only here, document only)
- Test: `vibes.diy/api/tests/chat-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("accepts slots config with per-slot mute flags", () => {
  const r = reqCreationPromptChatSection({
    type: "vibes.diy.req-prompt-chat-section",
    mode: "chat",
    auth: { kind: "dash", token: "t" },
    chatId: "c1",
    outerTid: "tid",
    prompt: { messages: [] },
    slots: { original: "off", selected: "on", last_edit: "on", previous: "on", compaction: "on" },
  });
  expect(r).not.toBeInstanceOf(Error);
});

it("rejects invalid slot value", () => {
  const r = reqCreationPromptChatSection({
    type: "vibes.diy.req-prompt-chat-section",
    mode: "chat",
    auth: { kind: "dash", token: "t" },
    chatId: "c1",
    outerTid: "tid",
    prompt: { messages: [] },
    slots: { original: "maybe" },
  });
  expect(r).toBeInstanceOf(Error);
});
```

- [ ] **Step 2: Run, expect fail**

```
pnpm --dir vibes.diy/api/tests test chat-types
```

- [ ] **Step 3: Add the schema**

In `vibes.diy/api/types/chat.ts`:

```ts
export const slotMute = type("'on' | 'off'");

export const slotConfig = type({
  "original?": slotMute,
  "selected?": slotMute,
  "last_edit?": slotMute,
  "previous?": slotMute,
  "compaction?": slotMute,
});

export type SlotConfig = typeof slotConfig.infer;
```

Then add `"slots?": slotConfig,` to `reqCreationPromptChatSection`.

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test chat-types
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/types/chat.ts vibes.diy/api/tests/chat-types.test.ts
git commit -m "feat(types): add SlotConfig mute flags to req-prompt-chat-section"
```

---

## Phase 2 — Version timeline lookups

### Task 3: `loadVersionTimeline(chatId)` returns ordered distinct fsIds

**Files:**

- Create: `vibes.diy/api/svc/intern/version-timeline.ts`
- Test: `vibes.diy/api/tests/version-timeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/version-timeline.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createVibeDiyTestCtx } from "./helpers/test-ctx.js";
import { loadVersionTimeline } from "../svc/intern/version-timeline.js";

describe("loadVersionTimeline", () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  beforeEach(async () => {
    ctx = await createVibeDiyTestCtx();
  });

  it("returns [] for chat with no persisted turns", async () => {
    const { chatId } = await ctx.seedChat();
    const tl = await loadVersionTimeline(ctx.vctx, chatId);
    expect(tl).toEqual([]);
  });

  it("returns distinct fsIds oldest-first, deduping repeated fsId", async () => {
    const { chatId } = await ctx.seedChat();
    await ctx.seedTurn(chatId, { fsId: "fs-a", files: { "App.jsx": "v1" } });
    await ctx.seedTurn(chatId, { fsId: "fs-a", files: { "App.jsx": "v1" } }); // dup
    await ctx.seedTurn(chatId, { fsId: "fs-b", files: { "App.jsx": "v2" } });
    const tl = await loadVersionTimeline(ctx.vctx, chatId);
    expect(tl.map((v) => v.fsId)).toEqual(["fs-a", "fs-b"]);
    expect(tl[0].vfs.get("/App.jsx")).toBe("v1");
    expect(tl[1].vfs.get("/App.jsx")).toBe("v2");
  });
});
```

(`createVibeDiyTestCtx` + `seedChat` + `seedTurn` already exist as test infrastructure — do not duplicate.)

- [ ] **Step 2: Run, expect fail**

```
pnpm --dir vibes.diy/api/tests test version-timeline
```

Expected: import error (module missing).

- [ ] **Step 3: Implement**

```ts
// vibes.diy/api/svc/intern/version-timeline.ts
import { eq, asc } from "drizzle-orm";
import { parseArray } from "@adviser/cement";
import type { VibesApiSQLCtx } from "../public/sql-ctx.js";
import { vibeFile } from "../../types/vibe-file.js";

export interface TimelineEntry {
  readonly fsId: string;
  readonly created: Date;
  readonly vfs: ReadonlyMap<string, string>;
}

// Returns distinct (fsId-deduped) versions oldest-first. Turns that produced
// no file change share an fsId with the prior turn and collapse into one
// entry, matching the spec's "timeline dedup by fsId" rule.
export async function loadVersionTimeline(vctx: VibesApiSQLCtx, chatId: string): Promise<TimelineEntry[]> {
  const rows = await vctx.sql.db
    .select({
      fsId: vctx.sql.tables.promptContexts.fsId,
      created: vctx.sql.tables.promptContexts.created,
      fileSystem: vctx.sql.tables.apps.fileSystem,
    })
    .from(vctx.sql.tables.promptContexts)
    .innerJoin(vctx.sql.tables.apps, eq(vctx.sql.tables.apps.fsId, vctx.sql.tables.promptContexts.fsId))
    .where(eq(vctx.sql.tables.promptContexts.chatId, chatId))
    .orderBy(asc(vctx.sql.tables.promptContexts.created));
  const seen = new Set<string>();
  const out: TimelineEntry[] = [];
  for (const r of rows) {
    if (!r.fsId || seen.has(r.fsId)) continue;
    seen.add(r.fsId);
    const files = parseArray(r.fileSystem, vibeFile);
    const vfs = new Map<string, string>();
    for (const f of files) {
      if (f.type !== "code-block" || typeof f.content !== "string") continue;
      vfs.set(f.filename, f.content);
    }
    out.push({ fsId: r.fsId, created: r.created, vfs });
  }
  return out;
}
```

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test version-timeline
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/version-timeline.ts vibes.diy/api/tests/version-timeline.test.ts
git commit -m "feat(api): loadVersionTimeline returns fsId-deduped versions oldest-first"
```

---

### Task 4: `selectSlotSources(timeline, selected?)` picks `original`, `previous`, `prev2`

**Files:**

- Modify: `vibes.diy/api/svc/intern/version-timeline.ts`
- Test: `vibes.diy/api/tests/version-timeline.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { selectSlotSources } from "../svc/intern/version-timeline.js";

describe("selectSlotSources", () => {
  const v = (fsId: string, file: string) => ({ fsId, created: new Date(), vfs: new Map([["/App.jsx", file]]) });

  it("empty timeline: all slots undefined", () => {
    const s = selectSlotSources([], undefined);
    expect(s.original).toBeUndefined();
    expect(s.previous).toBeUndefined();
    expect(s.prev2).toBeUndefined();
  });

  it("one version: original == previous, prev2 absent", () => {
    const s = selectSlotSources([v("a", "v1")], undefined);
    expect(s.original?.fsId).toBe("a");
    expect(s.previous?.fsId).toBe("a");
    expect(s.prev2).toBeUndefined();
  });

  it("two versions: original=v1, previous=v2, prev2=v1", () => {
    const s = selectSlotSources([v("a", "v1"), v("b", "v2")], undefined);
    expect(s.original?.fsId).toBe("a");
    expect(s.previous?.fsId).toBe("b");
    expect(s.prev2?.fsId).toBe("a");
  });

  it("three+ versions: prev2 is the one immediately before previous", () => {
    const s = selectSlotSources([v("a", "v1"), v("b", "v2"), v("c", "v3")], undefined);
    expect(s.original?.fsId).toBe("a");
    expect(s.previous?.fsId).toBe("c");
    expect(s.prev2?.fsId).toBe("b");
  });
});
```

- [ ] **Step 2: Run, expect fail**

```
pnpm --dir vibes.diy/api/tests test version-timeline
```

- [ ] **Step 3: Implement**

```ts
// append to vibes.diy/api/svc/intern/version-timeline.ts
export interface SlotSources {
  readonly original?: TimelineEntry;
  readonly previous?: TimelineEntry;
  readonly prev2?: TimelineEntry; // used by last_edit diff
}

export function selectSlotSources(timeline: readonly TimelineEntry[], _selected: unknown): SlotSources {
  if (timeline.length === 0) return {};
  if (timeline.length === 1) return { original: timeline[0], previous: timeline[0] };
  const previous = timeline[timeline.length - 1];
  const prev2 = timeline[timeline.length - 2];
  const original = timeline[0];
  return { original, previous, prev2 };
}
```

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test version-timeline
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/version-timeline.ts vibes.diy/api/tests/version-timeline.test.ts
git commit -m "feat(api): selectSlotSources picks original/previous/prev2 from timeline"
```

---

## Phase 3 — `last_edit` SEARCH/REPLACE diff generator

### Task 5: Line diff and hunk coalescing

**Files:**

- Create: `vibes.diy/api/svc/intern/last-edit-diff.ts`
- Test: `vibes.diy/api/tests/last-edit-diff.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// vibes.diy/api/tests/last-edit-diff.test.ts
import { describe, it, expect } from "vitest";
import { lineDiff, coalesceHunks } from "../svc/intern/last-edit-diff.js";

describe("lineDiff", () => {
  it("returns empty hunks for identical inputs", () => {
    expect(lineDiff("a\nb\nc", "a\nb\nc")).toEqual([]);
  });

  it("returns one hunk for a single-line change", () => {
    const hunks = lineDiff("a\nb\nc", "a\nX\nc");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldLines).toEqual(["b"]);
    expect(hunks[0].newLines).toEqual(["X"]);
    expect(hunks[0].oldStart).toBe(1); // 0-indexed
  });

  it("returns two hunks for two disjoint changes >3 lines apart", () => {
    const before = "a\nb\nc\nd\ne\nf\ng\nh";
    const after = "a\nB\nc\nd\ne\nf\ng\nH";
    const hunks = lineDiff(before, after);
    expect(hunks).toHaveLength(2);
  });
});

describe("coalesceHunks", () => {
  it("merges hunks within 3 unchanged lines", () => {
    const hunks = [
      { oldStart: 1, oldLines: ["b"], newLines: ["B"] },
      { oldStart: 3, oldLines: ["d"], newLines: ["D"] },
    ];
    const merged = coalesceHunks(hunks, ["a", "b", "c", "d", "e"], 3);
    expect(merged).toHaveLength(1);
    expect(merged[0].oldLines).toEqual(["b", "c", "d"]);
    expect(merged[0].newLines).toEqual(["B", "c", "D"]);
  });

  it("does not merge hunks >3 unchanged lines apart", () => {
    const hunks = [
      { oldStart: 1, oldLines: ["b"], newLines: ["B"] },
      { oldStart: 6, oldLines: ["g"], newLines: ["G"] },
    ];
    const merged = coalesceHunks(hunks, ["a", "b", "c", "d", "e", "f", "g"], 3);
    expect(merged).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, expect fail (module missing)**

```
pnpm --dir vibes.diy/api/tests test last-edit-diff
```

- [ ] **Step 3: Implement**

```ts
// vibes.diy/api/svc/intern/last-edit-diff.ts
export interface DiffHunk {
  readonly oldStart: number; // 0-indexed
  readonly oldLines: readonly string[];
  readonly newLines: readonly string[];
}

// Myers-style longest common subsequence diff over line arrays.
// Returns hunks where adjacent unchanged lines are NOT included in oldLines/newLines.
export function lineDiff(before: string, after: string): DiffHunk[] {
  const oldArr = before.split("\n");
  const newArr = after.split("\n");
  const n = oldArr.length;
  const m = newArr.length;
  // Build LCS table (n×m). Acceptable for typical file sizes (≤2000 lines).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldArr[i] === newArr[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // Walk back to collect hunks.
  const hunks: DiffHunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && oldArr[i] === newArr[j]) {
      i++;
      j++;
      continue;
    }
    const oldStart = i;
    const oldLines: string[] = [];
    const newLines: string[] = [];
    while (i < n && j < m && oldArr[i] !== newArr[j]) {
      // Greedy direction by LCS dp.
      if (dp[i + 1][j] >= dp[i][j + 1]) {
        oldLines.push(oldArr[i++]);
      } else {
        newLines.push(newArr[j++]);
      }
    }
    while (i < n && j === m) oldLines.push(oldArr[i++]);
    while (j < m && i === n) newLines.push(newArr[j++]);
    hunks.push({ oldStart, oldLines, newLines });
  }
  return hunks;
}

export function coalesceHunks(hunks: readonly DiffHunk[], oldArr: readonly string[], gap: number): DiffHunk[] {
  if (hunks.length <= 1) return hunks.slice();
  const out: DiffHunk[] = [];
  let cur: DiffHunk = hunks[0];
  for (let k = 1; k < hunks.length; k++) {
    const next = hunks[k];
    const curEnd = cur.oldStart + cur.oldLines.length;
    const between = next.oldStart - curEnd;
    if (between <= gap && between >= 0) {
      const bridge = oldArr.slice(curEnd, next.oldStart);
      cur = {
        oldStart: cur.oldStart,
        oldLines: [...cur.oldLines, ...bridge, ...next.oldLines],
        newLines: [...cur.newLines, ...bridge, ...next.newLines],
      };
    } else {
      out.push(cur);
      cur = next;
    }
  }
  out.push(cur);
  return out;
}
```

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test last-edit-diff
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/last-edit-diff.ts vibes.diy/api/tests/last-edit-diff.test.ts
git commit -m "feat(api): line diff + coalesce-within-3 for last_edit slot"
```

---

### Task 6: SEARCH/REPLACE rendering with uniqueness expansion

**Files:**

- Modify: `vibes.diy/api/svc/intern/last-edit-diff.ts`
- Test: `vibes.diy/api/tests/last-edit-diff.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { renderHunkAsSearchReplace, generateFileLastEdit } from "../svc/intern/last-edit-diff.js";

describe("renderHunkAsSearchReplace", () => {
  it("emits SEARCH/REPLACE block for a unique anchor", () => {
    const hunk = { oldStart: 1, oldLines: ["b"], newLines: ["B"] };
    const out = renderHunkAsSearchReplace(hunk, ["a", "b", "c"], 20);
    expect(out.ok).toBe(true);
    expect(out.text).toContain("<<<<<<< SEARCH");
    expect(out.text).toContain("b");
    expect(out.text).toContain("=======");
    expect(out.text).toContain("B");
    expect(out.text).toContain(">>>>>>> REPLACE");
  });

  it("expands context until the SEARCH is unique", () => {
    const hunk = { oldStart: 0, oldLines: ["x"], newLines: ["Y"] };
    // "x" appears twice; needs neighbor context.
    const oldArr = ["x", "next1", "ignore", "x", "next2"];
    const out = renderHunkAsSearchReplace(hunk, oldArr, 20);
    expect(out.ok).toBe(true);
    // Should include enough context to disambiguate the first x.
    expect(out.text).toContain("next1");
  });

  it("returns ok=false when 20 lines of context still don't disambiguate", () => {
    const repetitive = Array.from({ length: 30 }, () => "x")
      .join("\n")
      .split("\n");
    const hunk = { oldStart: 0, oldLines: ["x"], newLines: ["Y"] };
    const out = renderHunkAsSearchReplace(hunk, repetitive, 20);
    expect(out.ok).toBe(false);
  });
});

describe("generateFileLastEdit", () => {
  it("returns wholesale indicator on >20 hunks", () => {
    let before = "";
    let after = "";
    for (let i = 0; i < 25; i++) {
      before += `line${i}\n`;
      after += `LINE${i}\n`;
    }
    const out = generateFileLastEdit("App.jsx", before, after);
    expect(out).toBe("[App.jsx: wholesale rewrite, see PREVIOUS]");
  });

  it("returns NEW FILE marker when before is empty", () => {
    const out = generateFileLastEdit("Card.jsx", "", "<div/>");
    expect(out).toBe("[NEW FILE: Card.jsx — see PREVIOUS]");
  });

  it("returns DELETED marker when after is empty", () => {
    const out = generateFileLastEdit("Card.jsx", "<div/>", "");
    expect(out).toBe("[DELETED: Card.jsx]");
  });

  it("returns SEARCH/REPLACE blocks for ≤20 small hunks", () => {
    const out = generateFileLastEdit("App.jsx", "a\nb\nc", "a\nB\nc");
    expect(out).toContain("App.jsx:");
    expect(out).toContain("<<<<<<< SEARCH");
    expect(out).toContain(">>>>>>> REPLACE");
  });
});
```

- [ ] **Step 2: Run, expect fail**

```
pnpm --dir vibes.diy/api/tests test last-edit-diff
```

- [ ] **Step 3: Implement**

```ts
// append to vibes.diy/api/svc/intern/last-edit-diff.ts

export interface RenderResult {
  readonly ok: boolean;
  readonly text: string;
}

export function renderHunkAsSearchReplace(hunk: DiffHunk, oldArr: readonly string[], maxExpand: number): RenderResult {
  for (let ctx = 0; ctx <= maxExpand; ctx++) {
    const start = Math.max(0, hunk.oldStart - ctx);
    const end = Math.min(oldArr.length, hunk.oldStart + hunk.oldLines.length + ctx);
    const before = oldArr.slice(start, hunk.oldStart);
    const after = oldArr.slice(hunk.oldStart + hunk.oldLines.length, end);
    const searchLines = [...before, ...hunk.oldLines, ...after];
    const searchText = searchLines.join("\n");
    // Uniqueness check: searchText must appear exactly once in the full file.
    const full = oldArr.join("\n");
    const first = full.indexOf(searchText);
    if (first >= 0 && full.indexOf(searchText, first + 1) === -1) {
      const replaceText = [...before, ...hunk.newLines, ...after].join("\n");
      return {
        ok: true,
        text: `<<<<<<< SEARCH\n${searchText}\n=======\n${replaceText}\n>>>>>>> REPLACE`,
      };
    }
  }
  return { ok: false, text: "" };
}

// The pedagogical contract: the rendered SEARCH/REPLACE primes the model's
// next-turn output. It is never re-applied by applyEdits server-side. So
// "ok=false" only means "we couldn't render a clean template" — it does NOT
// mean the diff is unsafe. We degrade to wholesale in that case.
export function generateFileLastEdit(path: string, before: string, after: string): string {
  if (before === after) return "";
  if (before.length === 0) return `[NEW FILE: ${path} — see PREVIOUS]`;
  if (after.length === 0) return `[DELETED: ${path}]`;

  const oldArr = before.split("\n");
  const rawHunks = lineDiff(before, after);
  const hunks = coalesceHunks(rawHunks, oldArr, 3);
  if (hunks.length > 20) return `[${path}: wholesale rewrite, see PREVIOUS]`;

  const blocks: string[] = [];
  for (const h of hunks) {
    const rendered = renderHunkAsSearchReplace(h, oldArr, 20);
    if (!rendered.ok) return `[${path}: wholesale rewrite, see PREVIOUS]`;
    blocks.push(rendered.text);
  }
  return `${path}:\n${blocks.join("\n")}`;
}
```

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test last-edit-diff
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/last-edit-diff.ts vibes.diy/api/tests/last-edit-diff.test.ts
git commit -m "feat(api): SEARCH/REPLACE render + degrade rules for last_edit"
```

---

### Task 7: Multi-file `last_edit` for a vfs pair

**Files:**

- Modify: `vibes.diy/api/svc/intern/last-edit-diff.ts`
- Test: `vibes.diy/api/tests/last-edit-diff.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { generateLastEditBlock } from "../svc/intern/last-edit-diff.js";

describe("generateLastEditBlock", () => {
  const m = (entries: Record<string, string>) => new Map<string, string>(Object.entries(entries));

  it("returns empty string when no files changed", () => {
    expect(generateLastEditBlock(m({ "/App.jsx": "a" }), m({ "/App.jsx": "a" }))).toBe("");
  });

  it("renders one file's edit", () => {
    const out = generateLastEditBlock(m({ "/App.jsx": "a\nb\nc" }), m({ "/App.jsx": "a\nB\nc" }));
    expect(out).toContain("/App.jsx:");
    expect(out).toContain("<<<<<<< SEARCH");
  });

  it("renders multiple files, one block per file", () => {
    const prev2 = m({ "/App.jsx": "a", "/Card.jsx": "c" });
    const prev = m({ "/App.jsx": "A", "/Card.jsx": "C" });
    const out = generateLastEditBlock(prev2, prev);
    expect(out).toContain("/App.jsx:");
    expect(out).toContain("/Card.jsx:");
  });

  it("includes file deletion and creation markers", () => {
    const prev2 = m({ "/A.jsx": "a", "/Gone.jsx": "g" });
    const prev = m({ "/A.jsx": "a", "/New.jsx": "n" });
    const out = generateLastEditBlock(prev2, prev);
    expect(out).toContain("[DELETED: /Gone.jsx]");
    expect(out).toContain("[NEW FILE: /New.jsx");
    expect(out).not.toContain("/A.jsx:"); // unchanged → skipped
  });
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test last-edit-diff
```

- [ ] **Step 3: Implement**

```ts
// append to vibes.diy/api/svc/intern/last-edit-diff.ts
export function generateLastEditBlock(prev2: ReadonlyMap<string, string>, prev: ReadonlyMap<string, string>): string {
  const paths = new Set<string>();
  for (const p of prev2.keys()) paths.add(p);
  for (const p of prev.keys()) paths.add(p);
  const sorted = Array.from(paths).sort();
  const parts: string[] = [];
  for (const path of sorted) {
    const a = prev2.get(path) ?? "";
    const b = prev.get(path) ?? "";
    const rendered = generateFileLastEdit(path, a, b);
    if (rendered) parts.push(rendered);
  }
  return parts.join("\n\n");
}
```

- [ ] **Step 4: Pass**

```
pnpm --dir vibes.diy/api/tests test last-edit-diff
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/last-edit-diff.ts vibes.diy/api/tests/last-edit-diff.test.ts
git commit -m "feat(api): generateLastEditBlock walks all changed paths"
```

---

## Phase 4 — Slot assembler

### Task 8: `renderSlotsWithDedup` — multi-slot rendering with content-hash pointers

**Files:**

- Create: `vibes.diy/api/svc/intern/slot-assembler.ts`
- Test: `vibes.diy/api/tests/slot-assembler.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// vibes.diy/api/tests/slot-assembler.test.ts
import { describe, it, expect } from "vitest";
import { renderSlotsWithDedup, type SlotEntry } from "../svc/intern/slot-assembler.js";

const m = (e: Record<string, string>) => new Map<string, string>(Object.entries(e));

describe("renderSlotsWithDedup", () => {
  it("renders one slot in full when only one is present", () => {
    const slots: SlotEntry[] = [
      { label: "PREVIOUS", caption: "anchor SEARCH here", vfs: m({ "/App.jsx": "hi" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("PREVIOUS");
    expect(out[0].text).toContain("hi");
  });

  it("emits pointer in older slot when file is identical to canonical", () => {
    const slots: SlotEntry[] = [
      { label: "ORIGINAL", caption: "scaffold", vfs: m({ "/App.jsx": "same" }), canonical: false },
      { label: "PREVIOUS", caption: "anchor", vfs: m({ "/App.jsx": "same" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    // ORIGINAL slot should not duplicate "same" bytes; it should reference PREVIOUS.
    expect(out[0].text).not.toMatch(/same\s+same/); // no double-render
    expect(out[0].text).toContain("identical to PREVIOUS");
  });

  it("renders full bytes when file differs across slots", () => {
    const slots: SlotEntry[] = [
      { label: "ORIGINAL", caption: "scaffold", vfs: m({ "/App.jsx": "v1" }), canonical: false },
      { label: "PREVIOUS", caption: "anchor", vfs: m({ "/App.jsx": "v2" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    expect(out[0].text).toContain("v1");
    expect(out[1].text).toContain("v2");
  });

  it("auto-collapses ORIGINAL when content-equal to PREVIOUS across all files", () => {
    const slots: SlotEntry[] = [
      { label: "ORIGINAL", caption: "scaffold", vfs: m({ "/App.jsx": "x" }), canonical: false },
      { label: "PREVIOUS", caption: "anchor", vfs: m({ "/App.jsx": "x" }), canonical: true },
    ];
    const out = renderSlotsWithDedup(slots, "App.jsx");
    // ORIGINAL collapses entirely — nothing meaningful to render.
    const labels = out.map((b) => b.label);
    expect(labels).toEqual(["PREVIOUS"]);
  });
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test slot-assembler
```

- [ ] **Step 3: Implement**

```ts
// vibes.diy/api/svc/intern/slot-assembler.ts
import { renderCurrentFiles } from "./recovery.js";

export interface SlotEntry {
  readonly label: string;
  readonly caption: string;
  readonly vfs: ReadonlyMap<string, string>;
  readonly canonical: boolean; // true for the slot that holds the SEARCH anchor
}

export interface RenderedBlock {
  readonly label: string;
  readonly text: string;
}

// Renders slots into headed text blocks. Within a non-canonical slot, any file
// whose content matches the canonical slot's same path is replaced with a
// pointer rather than full bytes. If every file in a non-canonical slot
// pointers out, the slot is omitted entirely (auto-collapse).
export function renderSlotsWithDedup(slots: readonly SlotEntry[], focusPath: string): RenderedBlock[] {
  const canonical = slots.find((s) => s.canonical);
  const out: RenderedBlock[] = [];
  for (const s of slots) {
    if (s === canonical) {
      const body = renderCurrentFiles(s.vfs, focusPath);
      out.push({ label: s.label, text: `--- ${s.label} (${s.caption}) ---\n${body}` });
      continue;
    }
    // Non-canonical: emit pointers for files identical to canonical.
    const dedupedVfs = new Map<string, string>();
    const pointerLines: string[] = [];
    let renderedAny = false;
    for (const [path, content] of s.vfs.entries()) {
      const canonicalContent = canonical?.vfs.get(path);
      if (canonical && canonicalContent === content) {
        pointerLines.push(`--- ${path} (identical to ${canonical.label}) ---`);
      } else {
        dedupedVfs.set(path, content);
        renderedAny = true;
      }
    }
    if (!renderedAny && pointerLines.length === 0) continue;
    if (!renderedAny) {
      // Every file is a pointer — auto-collapse.
      continue;
    }
    const body = renderCurrentFiles(dedupedVfs, focusPath);
    const text = [`--- ${s.label} (${s.caption}) ---`, body, ...pointerLines].join("\n");
    out.push({ label: s.label, text });
  }
  return out;
}
```

- [ ] **Step 4: Pass**

```
pnpm --dir vibes.diy/api/tests test slot-assembler
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/slot-assembler.ts vibes.diy/api/tests/slot-assembler.test.ts
git commit -m "feat(api): renderSlotsWithDedup with per-file content-hash pointers"
```

---

### Task 9: `pickCanonicalHome` — recovery > selected.draft > previous

**Files:**

- Modify: `vibes.diy/api/svc/intern/slot-assembler.ts`
- Test: `vibes.diy/api/tests/slot-assembler.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { pickCanonicalHome } from "../svc/intern/slot-assembler.js";

describe("pickCanonicalHome", () => {
  it("returns 'recovery' when a recovery-partial slot is present", () => {
    expect(pickCanonicalHome({ recoveryPartial: m({}), previous: m({}) })).toBe("recovery");
  });

  it("returns 'selected-draft' when CLI draft present and no recovery", () => {
    expect(pickCanonicalHome({ selectedDraft: m({}), previous: m({}) })).toBe("selected-draft");
  });

  it("returns 'previous' otherwise", () => {
    expect(pickCanonicalHome({ previous: m({}) })).toBe("previous");
  });

  it("returns 'selected-draft' even when previous absent (push-seeded case)", () => {
    expect(pickCanonicalHome({ selectedDraft: m({}) })).toBe("selected-draft");
  });

  it("returns 'none' when nothing is present", () => {
    expect(pickCanonicalHome({})).toBe("none");
  });
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test slot-assembler
```

- [ ] **Step 3: Implement**

```ts
// append to vibes.diy/api/svc/intern/slot-assembler.ts
export type CanonicalKind = "recovery" | "selected-draft" | "previous" | "none";

export interface CanonicalInputs {
  readonly recoveryPartial?: ReadonlyMap<string, string>;
  readonly selectedDraft?: ReadonlyMap<string, string>;
  readonly previous?: ReadonlyMap<string, string>;
}

export function pickCanonicalHome(inputs: CanonicalInputs): CanonicalKind {
  if (inputs.recoveryPartial) return "recovery";
  if (inputs.selectedDraft) return "selected-draft";
  if (inputs.previous) return "previous";
  return "none";
}
```

- [ ] **Step 4: Pass**

```
pnpm --dir vibes.diy/api/tests test slot-assembler
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/slot-assembler.ts vibes.diy/api/tests/slot-assembler.test.ts
git commit -m "feat(api): pickCanonicalHome implements recovery > draft > previous"
```

---

### Task 10: `assembleSlotMessages` — full pipeline + SlotConfig mute

**Files:**

- Modify: `vibes.diy/api/svc/intern/slot-assembler.ts`
- Test: `vibes.diy/api/tests/slot-assembler.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { assembleSlotMessages, type AssembleInputs } from "../svc/intern/slot-assembler.js";

describe("assembleSlotMessages", () => {
  const v = (s: string) => new Map([["/App.jsx", s]]);

  it("emits synthetic user messages with ORIGINAL, LAST_EDIT, PREVIOUS in order", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 5 },
      prev2: v("v2"),
      previous: v("v3"),
      focusPath: "App.jsx",
      config: {},
    };
    const msgs = assembleSlotMessages(inputs);
    const labels = msgs.map((m) => m.label);
    expect(labels).toEqual(["ORIGINAL", "LAST_EDIT", "PREVIOUS"]);
    msgs.forEach((m) => expect(m.role).toBe("user"));
  });

  it("omits ORIGINAL when slots.original=off", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 5 },
      prev2: v("v2"),
      previous: v("v3"),
      focusPath: "App.jsx",
      config: { original: "off" },
    };
    const labels = assembleSlotMessages(inputs).map((m) => m.label);
    expect(labels).toEqual(["LAST_EDIT", "PREVIOUS"]);
  });

  it("CLI-drift case: selected.draft becomes canonical home, previous demotes", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 5 },
      prev2: v("v2"),
      previous: v("v3"),
      selectedDraft: v("disk-bytes"),
      focusPath: "App.jsx",
      config: {},
    };
    const msgs = assembleSlotMessages(inputs);
    const labels = msgs.map((m) => m.label);
    // ORIGINAL, then PREVIOUS demoted to reference, then LAST_EDIT, then canonical SELECTED_DRAFT.
    expect(labels).toEqual(["ORIGINAL", "PREVIOUS", "LAST_EDIT", "SELECTED_DRAFT"]);
    expect(msgs[msgs.length - 1].label).toBe("SELECTED_DRAFT");
  });

  it("push-seeded degenerate: only selected.draft present", () => {
    const inputs: AssembleInputs = {
      selectedDraft: v("disk-bytes"),
      focusPath: "App.jsx",
      config: {},
    };
    const labels = assembleSlotMessages(inputs).map((m) => m.label);
    expect(labels).toEqual(["SELECTED_DRAFT"]);
  });

  it("recovery turn: recovery-partial canonical, previous demoted", () => {
    const inputs: AssembleInputs = {
      original: { vfs: v("scaffold"), turnsAgo: 3 },
      prev2: v("v2"),
      previous: v("v3"),
      recoveryPartial: v("in-flight"),
      focusPath: "App.jsx",
      config: {},
    };
    const labels = assembleSlotMessages(inputs).map((m) => m.label);
    expect(labels[labels.length - 1]).toBe("RECOVERY_PARTIAL");
  });
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test slot-assembler
```

- [ ] **Step 3: Implement**

```ts
// append to vibes.diy/api/svc/intern/slot-assembler.ts
import { generateLastEditBlock } from "./last-edit-diff.js";
import type { SlotConfig } from "../../types/chat.js";

export interface AssembleInputs {
  readonly original?: { vfs: ReadonlyMap<string, string>; turnsAgo: number };
  readonly prev2?: ReadonlyMap<string, string>;
  readonly previous?: ReadonlyMap<string, string>;
  readonly selectedVersion?: { vfs: ReadonlyMap<string, string>; turnsAgo: number };
  readonly selectedDraft?: ReadonlyMap<string, string>;
  readonly recoveryPartial?: ReadonlyMap<string, string>;
  readonly focusPath: string;
  readonly config: SlotConfig;
}

export interface AssembledMessage {
  readonly role: "user";
  readonly label: string;
  readonly text: string;
}

export function assembleSlotMessages(inputs: AssembleInputs): AssembledMessage[] {
  const cfg = inputs.config;
  const muted = (k: keyof SlotConfig) => cfg[k] === "off";
  const canonical = pickCanonicalHome({
    recoveryPartial: inputs.recoveryPartial,
    selectedDraft: inputs.selectedDraft,
    previous: inputs.previous,
  });

  // Build slot entries in render order: ORIGINAL, SELECTED_VERSION, (PREVIOUS if demoted), LAST_EDIT, CANONICAL.
  const entries: SlotEntry[] = [];

  if (inputs.original && !muted("original")) {
    entries.push({
      label: "ORIGINAL",
      caption: `scaffold — first response, ${inputs.original.turnsAgo} turns ago`,
      vfs: inputs.original.vfs,
      canonical: false,
    });
  }

  if (inputs.selectedVersion && !muted("selected")) {
    entries.push({
      label: "SELECTED_VERSION",
      caption: `user is currently viewing this, from ${inputs.selectedVersion.turnsAgo} turns ago`,
      vfs: inputs.selectedVersion.vfs,
      canonical: false,
    });
  }

  // PREVIOUS demotes to reference when not canonical.
  if (inputs.previous && !muted("previous") && canonical !== "previous") {
    entries.push({
      label: "PREVIOUS",
      caption: "last server-side state — for reference; the disk/recovery state has since changed",
      vfs: inputs.previous,
      canonical: false,
    });
  }

  // LAST_EDIT computed from prev2 → previous diff.
  if (inputs.prev2 && inputs.previous && !muted("last_edit")) {
    const block = generateLastEditBlock(inputs.prev2, inputs.previous);
    if (block) {
      entries.push({
        label: "LAST_EDIT",
        caption: "the diff that produced the current PREVIOUS state",
        vfs: new Map(), // not a vfs slot
        canonical: false,
      });
      // We render LAST_EDIT separately because it doesn't go through renderCurrentFiles.
      // Mark it with a synthetic flag (see render loop below).
      (entries[entries.length - 1] as unknown as { __lastEditBody?: string }).__lastEditBody = block;
    }
  }

  // Canonical home, rendered last.
  if (canonical === "recovery" && inputs.recoveryPartial) {
    entries.push({
      label: "RECOVERY_PARTIAL",
      caption: "partial state captured during recovery; anchor SEARCH against this exact content",
      vfs: inputs.recoveryPartial,
      canonical: true,
    });
  } else if (canonical === "selected-draft" && inputs.selectedDraft && !muted("selected")) {
    entries.push({
      label: "SELECTED_DRAFT",
      caption: "current disk contents — anchor SEARCH against these bytes",
      vfs: inputs.selectedDraft,
      canonical: true,
    });
  } else if (canonical === "previous" && inputs.previous && !muted("previous")) {
    const breadcrumb = inputs.original ? `; ORIGINAL scaffold is ${inputs.original.turnsAgo} turns earlier` : "";
    entries.push({
      label: "PREVIOUS",
      caption: `current state — anchor SEARCH here${breadcrumb}`,
      vfs: inputs.previous,
      canonical: true,
    });
  }

  // Render snapshot slots through dedup; for LAST_EDIT use the captured body.
  const out: AssembledMessage[] = [];
  const snapshotEntries = entries.filter((e) => e.label !== "LAST_EDIT");
  const rendered = renderSlotsWithDedup(snapshotEntries, inputs.focusPath);

  // Splice LAST_EDIT into its proper position (immediately before canonical).
  const lastEditEntry = entries.find((e) => e.label === "LAST_EDIT");
  const result: RenderedBlock[] = [];
  for (const r of rendered) {
    if (lastEditEntry && r.label === entries[entries.length - 1].label) {
      const body = (lastEditEntry as unknown as { __lastEditBody?: string }).__lastEditBody ?? "";
      result.push({
        label: "LAST_EDIT",
        text: `--- LAST_EDIT (the diff that produced the current PREVIOUS state) ---\n${body}`,
      });
    }
    result.push(r);
  }

  for (const r of result) {
    out.push({ role: "user", label: r.label, text: r.text });
  }
  return out;
}
```

- [ ] **Step 4: Pass**

```
pnpm --dir vibes.diy/api/tests test slot-assembler
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/intern/slot-assembler.ts vibes.diy/api/tests/slot-assembler.test.ts
git commit -m "feat(api): assembleSlotMessages with canonical-home and mute config"
```

---

## Phase 5 — Conversation compaction

### Task 11: `reconstructConversationMessages` gains `opts.keepFullTurnPromptId`

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts:605-641` (function body)
- Test: `vibes.diy/api/tests/reconstruct-messages.test.ts` (extend existing file)

- [ ] **Step 1: Failing test**

```ts
// vibes.diy/api/tests/reconstruct-messages.test.ts (append)
import { reconstructConversationMessages } from "../svc/public/prompt-chat-section.js";

describe("reconstructConversationMessages: compaction", () => {
  it("replaces edit blocks in older turns with summary line", () => {
    // Synthetic events: prompt.req (P1) → create-block (full body) → prompt.req (P2) → edit-block.
    const evts = [
      { type: "prompt.req", request: { messages: [{ role: "user", content: [{ type: "text", text: "u1" }] }] } },
      { type: "block.code.begin", lang: "jsx", path: "App.jsx", streamId: "P1" },
      { type: "block.code.line", line: "function App() {", streamId: "P1" },
      { type: "block.code.line", line: "  return <div/>;", streamId: "P1" },
      { type: "block.code.line", line: "}", streamId: "P1" },
      { type: "block.code.end", stats: { lines: 3, bytes: 30 }, streamId: "P1" },
      { type: "prompt.req", request: { messages: [{ role: "user", content: [{ type: "text", text: "u2" }] }] } },
      { type: "block.code.begin", lang: "jsx", path: "App.jsx", streamId: "P2" },
      { type: "block.code.line", line: "<<<<<<< SEARCH", streamId: "P2" },
      { type: "block.code.line", line: "<div/>", streamId: "P2" },
      { type: "block.code.line", line: "=======", streamId: "P2" },
      { type: "block.code.line", line: "<span/>", streamId: "P2" },
      { type: "block.code.line", line: ">>>>>>> REPLACE", streamId: "P2" },
      { type: "block.code.end", stats: { lines: 5, bytes: 50 }, streamId: "P2" },
    ];
    const msgs = reconstructConversationMessages(evts as never, { keepFullTurnPromptId: "P2" });
    const assistantTexts = msgs.filter((m) => m.role === "assistant").map((m) => m.content[0].text);
    // P1 (older): summary instead of full body.
    expect(assistantTexts[0]).toContain("[Created App.jsx — 3 lines, 30 bytes]");
    expect(assistantTexts[0]).not.toContain("function App()");
    // P2 (kept): full body retained.
    expect(assistantTexts[1]).toContain("<<<<<<< SEARCH");
    expect(assistantTexts[1]).toContain("<span/>");
  });

  it("preserves narration verbatim in older turns", () => {
    const evts = [
      { type: "prompt.req", request: { messages: [{ role: "user", content: [{ type: "text", text: "u1" }] }] } },
      { type: "block.toplevel.line", line: "Paint the page pink.", streamId: "P1" },
      { type: "block.code.begin", lang: "jsx", path: "App.jsx", streamId: "P1" },
      { type: "block.code.line", line: "<<<<<<< SEARCH", streamId: "P1" },
      { type: "block.code.line", line: "old", streamId: "P1" },
      { type: "block.code.line", line: "=======", streamId: "P1" },
      { type: "block.code.line", line: "new", streamId: "P1" },
      { type: "block.code.line", line: ">>>>>>> REPLACE", streamId: "P1" },
      { type: "block.code.end", stats: { lines: 5, bytes: 30 }, streamId: "P1" },
      { type: "prompt.req", request: { messages: [{ role: "user", content: [{ type: "text", text: "u2" }] }] } },
    ];
    const msgs = reconstructConversationMessages(evts as never, { keepFullTurnPromptId: "P2" });
    const a = msgs.find((m) => m.role === "assistant");
    expect(a?.content[0].text).toContain("Paint the page pink.");
    expect(a?.content[0].text).toContain("[5-line edit to App.jsx]");
  });

  it("backwards-compatible: no opts → today's behavior (full bodies)", () => {
    const evts = [
      { type: "prompt.req", request: { messages: [{ role: "user", content: [{ type: "text", text: "u1" }] }] } },
      { type: "block.code.begin", lang: "jsx", path: "App.jsx", streamId: "P1" },
      { type: "block.code.line", line: "x", streamId: "P1" },
      { type: "block.code.end", stats: { lines: 1, bytes: 1 }, streamId: "P1" },
    ];
    const msgs = reconstructConversationMessages(evts as never);
    expect(msgs[1].content[0].text).toContain("x");
  });
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test reconstruct-messages
```

- [ ] **Step 3: Implement — change signature**

In `vibes.diy/api/svc/public/prompt-chat-section.ts:605`, replace the function with:

````ts
export interface ReconstructOpts {
  readonly keepFullTurnPromptId?: string;
}

export function reconstructConversationMessages(sectionMsgs: PromptAndBlockMsgs[], opts: ReconstructOpts = {}): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const assistantLines: string[] = [];
  let currentPromptId: string | undefined;
  // Buffer for the in-flight code block within an older turn.
  let blockBuffer: { path: string; lineCount: number; firstNonBlank?: string; stats?: { bytes: number; lines: number } } | null =
    null;

  function flushAssistant() {
    if (assistantLines.length === 0) return;
    messages.push({ role: "assistant", content: [{ type: "text", text: assistantLines.join("\n") }] });
    assistantLines.length = 0;
  }

  for (const msg of sectionMsgs) {
    switch (true) {
      case isPromptReq(msg):
        flushAssistant();
        currentPromptId = msg.request.messages[0]?.streamId ?? (msg as { promptId?: string }).promptId;
        messages.push(...msg.request.messages.filter((m) => m.role === "user"));
        break;
      case isToplevelLine(msg):
        assistantLines.push(msg.line);
        break;
      case isCodeBegin(msg): {
        const compact = opts.keepFullTurnPromptId !== undefined && currentPromptId !== opts.keepFullTurnPromptId;
        if (compact) {
          blockBuffer = { path: msg.path ?? "App.jsx", lineCount: 0 };
        } else {
          assistantLines.push("```" + msg.lang);
        }
        break;
      }
      case isCodeLine(msg):
        if (blockBuffer) {
          blockBuffer.lineCount++;
          if (!blockBuffer.firstNonBlank && msg.line.trim().length > 0) blockBuffer.firstNonBlank = msg.line.trim();
        } else {
          assistantLines.push(msg.line);
        }
        break;
      case isCodeEnd(msg):
        if (blockBuffer) {
          const isEdit = blockBuffer.firstNonBlank === "<<<<<<< SEARCH";
          if (isEdit) {
            assistantLines.push(`[${blockBuffer.lineCount}-line edit to ${blockBuffer.path}]`);
          } else {
            const lines = msg.stats?.lines ?? blockBuffer.lineCount;
            const bytes = msg.stats?.bytes ?? 0;
            assistantLines.push(`[Created ${blockBuffer.path} — ${lines} lines, ${bytes} bytes]`);
          }
          blockBuffer = null;
        } else {
          assistantLines.push("```");
        }
        break;
    }
  }
  flushAssistant();
  return messages;
}
````

(If `currentPromptId` cannot be obtained from the prompt.req event in the current schema, capture it from the next `block.code.begin`'s `streamId` instead — first child wins for the whole assistant turn.)

- [ ] **Step 4: Tests pass**

```
pnpm --dir vibes.diy/api/tests test reconstruct-messages
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/reconstruct-messages.test.ts
git commit -m "feat(api): reconstructConversationMessages compacts older turns via keepFullTurnPromptId"
```

---

## Phase 6 — Integration into `assemblePromptPayload`

### Task 12: Helper to find the latest `promptId` in a chat

**Files:**

- Modify: `vibes.diy/api/svc/intern/version-timeline.ts`
- Test: `vibes.diy/api/tests/version-timeline.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { loadLatestPromptId } from "../svc/intern/version-timeline.js";

it("loadLatestPromptId returns the newest promptId or undefined", async () => {
  const { chatId } = await ctx.seedChat();
  expect(await loadLatestPromptId(ctx.vctx, chatId)).toBeUndefined();
  await ctx.seedTurn(chatId, { fsId: "fs-a", promptId: "p1" });
  await ctx.seedTurn(chatId, { fsId: "fs-b", promptId: "p2" });
  expect(await loadLatestPromptId(ctx.vctx, chatId)).toBe("p2");
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test version-timeline
```

- [ ] **Step 3: Implement**

```ts
// append to vibes.diy/api/svc/intern/version-timeline.ts
export async function loadLatestPromptId(vctx: VibesApiSQLCtx, chatId: string): Promise<string | undefined> {
  const r = await vctx.sql.db
    .select({ promptId: vctx.sql.tables.promptContexts.promptId, created: vctx.sql.tables.promptContexts.created })
    .from(vctx.sql.tables.promptContexts)
    .where(eq(vctx.sql.tables.promptContexts.chatId, chatId))
    .orderBy(desc(vctx.sql.tables.promptContexts.created))
    .limit(1)
    .then((rs) => rs[0]);
  return r?.promptId;
}
```

(Import `desc` from `drizzle-orm`.)

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test version-timeline
git add vibes.diy/api/svc/intern/version-timeline.ts vibes.diy/api/tests/version-timeline.test.ts
git commit -m "feat(api): loadLatestPromptId for compaction's keep-this-turn boundary"
```

---

### Task 13: Wire slot assembler into `assemblePromptPayload`

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (the `assemblePromptPayload` function and `injectSystemPrompt`'s call site)
- Test: `vibes.diy/api/tests/prompt-assembly.test.ts` (create)

- [ ] **Step 1: Failing test**

```ts
// vibes.diy/api/tests/prompt-assembly.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createVibeDiyTestCtx } from "./helpers/test-ctx.js";
import { assemblePromptPayload } from "../svc/public/prompt-chat-section.js";

describe("assemblePromptPayload: slot interpolation", () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  beforeEach(async () => {
    ctx = await createVibeDiyTestCtx();
  });

  it("on a 3-turn chat, payload contains synthetic ORIGINAL + LAST_EDIT + PREVIOUS user messages", async () => {
    const { chatId } = await ctx.seedChat();
    await ctx.seedTurn(chatId, { fsId: "fs-a", files: { "App.jsx": "scaffold" } });
    await ctx.seedTurn(chatId, { fsId: "fs-b", files: { "App.jsx": "scaffold+1" } });
    await ctx.seedTurn(chatId, { fsId: "fs-c", files: { "App.jsx": "scaffold+1+1" } });
    const r = await assemblePromptPayload(ctx.vctx, {
      chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "next" }] }],
    });
    expect(r.isOk()).toBe(true);
    const messages = r.Ok().messages;
    const texts = messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
    expect(texts.some((t) => t.includes("ORIGINAL"))).toBe(true);
    expect(texts.some((t) => t.includes("LAST_EDIT"))).toBe(true);
    expect(texts.some((t) => t.includes("PREVIOUS"))).toBe(true);
    expect(texts.some((t) => t === "next")).toBe(true);
  });

  it("system prompt no longer contains 'CURRENT FILES' (superseded by PREVIOUS slot)", async () => {
    const { chatId } = await ctx.seedChat();
    await ctx.seedTurn(chatId, { fsId: "fs-a", files: { "App.jsx": "x" } });
    const r = await assemblePromptPayload(ctx.vctx, {
      chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "next" }] }],
    });
    const system = r.Ok().messages.find((m) => m.role === "system");
    expect(system?.content[0].text).not.toContain("CURRENT FILES (resolved so far this turn):");
  });
});
```

- [ ] **Step 2: Fail**

```
pnpm --dir vibes.diy/api/tests test prompt-assembly
```

- [ ] **Step 3: Implement**

In `vibes.diy/api/svc/public/prompt-chat-section.ts`:

1. Remove the `CURRENT FILES` append in `injectSystemPrompt` (the `isInitial ? ... : ${systemPrompt}\n\n${renderCurrentFiles(...)}` branch around line 739–741). Just emit the bare system prompt.
2. In `assemblePromptPayload`, after `reconstructConversationMessages(...)`, call the slot assembler:

```ts
import { loadVersionTimeline, selectSlotSources, loadLatestPromptId } from "../intern/version-timeline.js";
import { assembleSlotMessages } from "../intern/slot-assembler.js";

// ... inside assemblePromptPayload, replace the reconstructConversationMessages
// call's args + the system prompt branch:

const latestPromptId = await loadLatestPromptId(vctx, chatId);
const timeline = await loadVersionTimeline(vctx, chatId);
const slotSources = selectSlotSources(timeline, args.selected);

const conversationMessages = reconstructConversationMessages(allSectionMsgs, {
  keepFullTurnPromptId: latestPromptId,
});

const slotMessages = assembleSlotMessages({
  original: slotSources.original ? { vfs: slotSources.original.vfs, turnsAgo: timeline.length - 1 } : undefined,
  prev2: slotSources.prev2?.vfs,
  previous: slotSources.previous?.vfs,
  selectedVersion: undefined, // wired in Task 16
  selectedDraft:
    args.selected?.kind === "draft" ? new Map(args.selected.files.map((f) => [f.filename, f.content as string])) : undefined,
  focusPath: args.focusPath ?? "App.jsx",
  config: args.slots ?? {},
});

// Wire slot messages into the message list. They go between the
// last persisted assistant turn and the new user turn — i.e. at the seam.
const finalMessages: ChatMessage[] = [
  { role: "system", content: [{ type: "text", text: systemPrompt.Ok().systemPrompt }] },
  ...conversationMessages,
  ...slotMessages.map((s) => ({ role: "user" as const, content: [{ type: "text", text: s.text }] })),
  ...newUserMessages.filter((m) => m.role === "user"),
];
```

Add `args.selected` and `args.focusPath` and `args.slots` to `AssemblePromptPayloadArgs`.

- [ ] **Step 4: Pass**

```
pnpm --dir vibes.diy/api/tests test prompt-assembly
```

- [ ] **Step 5: Commit**

```
git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/prompt-assembly.test.ts
git commit -m "feat(api): assemblePromptPayload interpolates slots, drops CURRENT FILES from system prompt"
```

---

### Task 14: Selected version-pick lookup (`{kind:"version"}`)

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (selected resolution)
- Test: `vibes.diy/api/tests/prompt-assembly.test.ts`

- [ ] **Step 1: Failing test**

```ts
it("selected:{kind:'version',fsId} loads that fsId's vfs into SELECTED_VERSION slot", async () => {
  const { chatId } = await ctx.seedChat();
  await ctx.seedTurn(chatId, { fsId: "fs-a", files: { "App.jsx": "old" } });
  await ctx.seedTurn(chatId, { fsId: "fs-b", files: { "App.jsx": "new" } });
  const r = await assemblePromptPayload(ctx.vctx, {
    chatId,
    model: "anthropic/claude-sonnet-4-6",
    newUserMessages: [{ role: "user", content: [{ type: "text", text: "look back" }] }],
    selected: { kind: "version", fsId: "fs-a" },
  });
  const texts = r.Ok().messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
  expect(texts.some((t) => t.includes("SELECTED_VERSION"))).toBe(true);
  expect(texts.some((t) => t.includes("currently viewing this"))).toBe(true);
});
```

- [ ] **Step 2: Fail; Step 3: Implement**

In `assemblePromptPayload`, after `selectSlotSources`:

```ts
let selectedVersionVfs: { vfs: ReadonlyMap<string, string>; turnsAgo: number } | undefined;
if (args.selected?.kind === "version") {
  const idx = timeline.findIndex((t) => t.fsId === args.selected!.fsId);
  if (idx >= 0) {
    selectedVersionVfs = { vfs: timeline[idx].vfs, turnsAgo: timeline.length - 1 - idx };
  }
}
// ...then pass selectedVersionVfs into assembleSlotMessages.
```

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test prompt-assembly
git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/prompt-assembly.test.ts
git commit -m "feat(api): selected:{kind:version} resolves fsId to SELECTED_VERSION slot"
```

---

## Phase 7 — Recovery unification

### Task 15: `buildRecoveryRequest` becomes a slot consumer

**Files:**

- Modify: `vibes.diy/api/svc/intern/recovery.ts:83-130` (`buildRecoveryRequest`)
- Test: `vibes.diy/api/tests/recovery.test.ts`

- [ ] **Step 1: Failing test**

```ts
// vibes.diy/api/tests/recovery.test.ts (extend)
import { buildRecoveryRequest } from "../svc/intern/recovery.js";

it("recovery payload puts recovery-partial as canonical slot, anti-gaslight stays in system", () => {
  const baseMsgs = [
    { role: "system", content: [{ type: "text", text: "BASE-SYS" }] },
    { role: "user", content: [{ type: "text", text: "u1" }] },
  ];
  const partialVfs = new Map([["/App.jsx", "in-flight"]]);
  const result = buildRecoveryRequest({
    messages: baseMsgs,
    partialVfs,
    focusPath: "App.jsx",
  });
  const texts = result.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
  // Anti-gaslight directive lives in system prompt.
  const sys = result.find((m) => m.role === "system");
  expect(sys?.content[0].text).toContain("verify your partial");
  // recovery-partial slot present as a user message close to the end.
  expect(texts.some((t) => t.includes("RECOVERY_PARTIAL"))).toBe(true);
  expect(texts.some((t) => t.includes("in-flight"))).toBe(true);
});
```

- [ ] **Step 2: Fail; Step 3: Implement**

In `vibes.diy/api/svc/intern/recovery.ts`, rewrite `buildRecoveryRequest`:

```ts
import { assembleSlotMessages } from "./slot-assembler.js";

export function buildRecoveryRequest(input: {
  messages: ChatMessage[];
  partialVfs: ReadonlyMap<string, string>;
  focusPath: string;
}): ChatMessage[] {
  const { messages, partialVfs, focusPath } = input;
  const slotMessages = assembleSlotMessages({
    recoveryPartial: partialVfs,
    focusPath,
    config: {},
  });
  // Merge the anti-gaslight directive into the existing system prompt.
  const firstSystemIdx = messages.findIndex((m) => m.role === "system");
  const directive = "verify your partial against the RECOVERY_PARTIAL slot; anchor every SEARCH against text that appears there.";
  let withDirective = messages;
  if (firstSystemIdx === -1) {
    withDirective = [{ role: "system", content: [{ type: "text", text: directive }] }, ...messages];
  } else {
    const orig = messages[firstSystemIdx];
    const origText = orig.content[0]?.type === "text" ? orig.content[0].text : "";
    withDirective = [
      ...messages.slice(0, firstSystemIdx),
      { role: "system", content: [{ type: "text", text: `${origText}\n\n${directive}` }] },
      ...messages.slice(firstSystemIdx + 1),
    ];
  }
  // Append slot messages at the end (canonical home closest to where the
  // continuation will resume).
  return [...withDirective, ...slotMessages.map((s) => ({ role: "user" as const, content: [{ type: "text", text: s.text }] }))];
}
```

Old `renderCurrentFiles`-merge code path is replaced. Keep `renderCurrentFiles` itself — it's still used by `renderSlotsWithDedup` internally.

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test recovery
git add vibes.diy/api/svc/intern/recovery.ts vibes.diy/api/tests/recovery.test.ts
git commit -m "feat(api): buildRecoveryRequest folds into slot assembler"
```

---

## Phase 8 — Server-side wire glue

### Task 16: Pipe `selected` and `slots` from request into `assemblePromptPayload`

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (the handler that calls `assemblePromptPayload`)
- Test: `vibes.diy/api/tests/prompt-handler.test.ts` (create)

- [ ] **Step 1: Failing test**

```ts
// minimal integration test using the existing test harness
import { describe, it, expect, beforeEach } from "vitest";
import { createVibeDiyTestCtx } from "./helpers/test-ctx.js";

describe("promptChatSection handler with selected+slots", () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  beforeEach(async () => {
    ctx = await createVibeDiyTestCtx();
  });

  it("dryRun:true with selected:{kind:draft,files} renders SELECTED_DRAFT as canonical", async () => {
    const { chatId } = await ctx.seedChat();
    // No persisted turns — push-seeded case.
    const payload = await ctx.dryRun({
      chatId,
      promptText: "make it pink",
      selected: { kind: "draft", files: [{ type: "code-block", filename: "App.jsx", lang: "jsx", content: "on-disk content" }] },
    });
    const texts = payload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
    expect(texts.some((t) => t.includes("SELECTED_DRAFT"))).toBe(true);
    expect(texts.some((t) => t.includes("on-disk content"))).toBe(true);
  });
});
```

`ctx.dryRun(...)` is a helper to add to `helpers/test-ctx.js` — wraps an Evento call with `dryRun: true` and pulls the `prompt.dry-run-payload` block.

- [ ] **Step 2: Fail; Step 3: Implement**

In the handler, when building `AssemblePromptPayloadArgs`, pass `selected: req.selected`, `slots: req.slots`, and `focusPath: req.prompt.focusPath ?? "App.jsx"` (also add `focusPath` to the LLMRequest schema if not already there).

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test prompt-handler
git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/prompt-handler.test.ts vibes.diy/api/tests/helpers/test-ctx.ts
git commit -m "feat(api): prompt handler wires selected and slots into assembly"
```

---

### Task 17: `SlotConfig` env-var defaults (per-deployment mute)

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (read env)
- Test: `vibes.diy/api/tests/slot-env-defaults.test.ts`

- [ ] **Step 1: Failing test**

```ts
// vibes.diy/api/tests/slot-env-defaults.test.ts
import { describe, it, expect } from "vitest";
import { resolveSlotConfig } from "../svc/intern/slot-assembler.js";

describe("resolveSlotConfig", () => {
  it("request config overrides env defaults", () => {
    const cfg = resolveSlotConfig({ original: "off" }, { SLOTS_ORIGINAL: "on", SLOTS_LAST_EDIT: "off" });
    expect(cfg.original).toBe("off"); // request wins
    expect(cfg.last_edit).toBe("off"); // env applies
  });

  it("missing env values default to 'on'", () => {
    const cfg = resolveSlotConfig({}, {});
    expect(cfg.original).toBe("on");
    expect(cfg.last_edit).toBe("on");
    expect(cfg.previous).toBe("on");
    expect(cfg.selected).toBe("on");
    expect(cfg.compaction).toBe("on");
  });
});
```

- [ ] **Step 2: Fail; Step 3: Implement** in `slot-assembler.ts`:

```ts
export function resolveSlotConfig(req: SlotConfig | undefined, env: Record<string, string | undefined>): Required<SlotConfig> {
  const read = (key: keyof SlotConfig, envKey: string): "on" | "off" => {
    const r = req?.[key];
    if (r === "on" || r === "off") return r;
    const e = env[envKey];
    if (e === "on" || e === "off") return e;
    return "on";
  };
  return {
    original: read("original", "SLOTS_ORIGINAL"),
    selected: read("selected", "SLOTS_SELECTED"),
    last_edit: read("last_edit", "SLOTS_LAST_EDIT"),
    previous: read("previous", "SLOTS_PREVIOUS"),
    compaction: read("compaction", "SLOTS_COMPACTION"),
  };
}
```

Then call `resolveSlotConfig(req.slots, env)` in the handler before passing to assembly.

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test slot-env-defaults
git add vibes.diy/api/svc/intern/slot-assembler.ts vibes.diy/api/tests/slot-env-defaults.test.ts vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "feat(api): SlotConfig request override + env default resolution"
```

---

## Phase 9 — CLI drift detection and `--focus`

### Task 18: `.undo`-absence detection in CLI

**Files:**

- Create: `vibes-diy/cli/cmds/disk-drift.ts`
- Test: `vibes-diy/cli/cmds/disk-drift.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// vibes-diy/cli/cmds/disk-drift.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { collectDiskDraft } from "./disk-drift.js";

describe("collectDiskDraft", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibes-disk-drift-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns draft when .undo absent and source files exist", async () => {
    await fs.writeFile(path.join(dir, "App.jsx"), "function App(){}");
    const r = await collectDiskDraft(dir);
    expect(r).not.toBeNull();
    expect(r!.files.map((f) => f.filename)).toContain("App.jsx");
  });

  it("returns null when .undo present and contents match disk", async () => {
    await fs.writeFile(path.join(dir, "App.jsx"), "function App(){}");
    await fs.writeFile(path.join(dir, ".undo"), JSON.stringify([{ filename: "App.jsx", content: "function App(){}" }]));
    expect(await collectDiskDraft(dir)).toBeNull();
  });

  it("returns draft when .undo present but disk differs", async () => {
    await fs.writeFile(path.join(dir, "App.jsx"), "function App(){ return 1; }");
    await fs.writeFile(path.join(dir, ".undo"), JSON.stringify([{ filename: "App.jsx", content: "function App(){}" }]));
    const r = await collectDiskDraft(dir);
    expect(r).not.toBeNull();
  });

  it("returns null when dir is empty", async () => {
    expect(await collectDiskDraft(dir)).toBeNull();
  });
});
```

- [ ] **Step 2: Fail; Step 3: Implement**

```ts
// vibes-diy/cli/cmds/disk-drift.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface DiskFile {
  readonly type: "code-block";
  readonly filename: string;
  readonly lang: string;
  readonly content: string;
}

export interface DiskDraft {
  readonly files: readonly DiskFile[];
}

const SOURCE_EXT = new Set([".jsx", ".tsx", ".js", ".ts", ".css", ".html", ".md"]);

function langOf(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  return ext === "js" || ext === "jsx" ? "jsx" : ext;
}

async function readDiskSourceFiles(dir: string): Promise<DiskFile[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: DiskFile[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith(".")) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!SOURCE_EXT.has(ext)) continue;
    const content = await fs.readFile(path.join(dir, e.name), "utf8");
    out.push({ type: "code-block", filename: e.name, lang: langOf(e.name), content });
  }
  return out;
}

export async function collectDiskDraft(dir: string): Promise<DiskDraft | null> {
  const sourceFiles = await readDiskSourceFiles(dir);
  if (sourceFiles.length === 0) return null;

  const undoPath = path.join(dir, ".undo");
  let undoFiles: DiskFile[] | null = null;
  try {
    const raw = await fs.readFile(undoPath, "utf8");
    undoFiles = JSON.parse(raw) as DiskFile[];
  } catch {
    undoFiles = null;
  }

  if (undoFiles === null) {
    return { files: sourceFiles };
  }
  const sameContent =
    undoFiles.length === sourceFiles.length &&
    sourceFiles.every((s) => undoFiles!.find((u) => u.filename === s.filename)?.content === s.content);
  if (sameContent) return null;
  return { files: sourceFiles };
}
```

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --filter vibes-diy test disk-drift
git add vibes-diy/cli/cmds/disk-drift.ts vibes-diy/cli/cmds/disk-drift.test.ts
git commit -m "feat(cli): collectDiskDraft detects .undo absence or drift"
```

---

### Task 19: `--focus` flag on `edit` and `generate`

**Files:**

- Modify: `vibes-diy/cli/cmds/edit-cmd.ts`, `generate-cmd.ts`
- Test: extend existing cmd tests, or add `--help` snapshot

- [ ] **Step 1: Failing test**

```ts
// vibes-diy/cli/cmds/edit-cmd.test.ts (or new test)
import { describe, it, expect } from "vitest";
import { editCommand } from "./edit-cmd.js";

it("edit command exposes --focus flag", () => {
  const { args } = editCommand.toUsageBuilder();
  expect(args).toMatchObject({ focus: expect.anything() });
});
```

(If the test infrastructure for command-level introspection isn't present, settle for an end-to-end CLI test: spawn the CLI with `edit --help` and grep for `--focus`.)

- [ ] **Step 2: Fail; Step 3: Implement**

In `edit-cmd.ts` add to the args:

```ts
focus: flag({
  long: "focus",
  type: optional(string),
  description: "Path to focus first in slot rendering (e.g. Card.jsx for multi-file edits)",
}),
```

Pass `focusPath: args.focus` through into the request envelope. Same in `generate-cmd.ts`.

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --filter vibes-diy test edit-cmd
git add vibes-diy/cli/cmds/edit-cmd.ts vibes-diy/cli/cmds/generate-cmd.ts vibes-diy/cli/cmds/edit-cmd.test.ts
git commit -m "feat(cli): --focus <path> on edit and generate"
```

---

### Task 20: CLI sends `selected.draft` automatically before edit

**Files:**

- Modify: `vibes-diy/cli/cmds/edit-cmd.ts` (the place that builds the prompt request)
- Test: `vibes-diy/cli/cmds/edit-cmd.test.ts`

- [ ] **Step 1: Failing test**

```ts
// vibes-diy/cli/cmds/edit-cmd.test.ts (extend existing)
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { buildEditPromptRequest } from "./edit-cmd.js"; // factor a pure builder out

async function tmpDirWith(contents: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibes-edit-req-"));
  for (const [name, body] of Object.entries(contents)) {
    await fs.writeFile(path.join(dir, name), body);
  }
  return dir;
}

it("buildEditPromptRequest includes selected.draft when .undo absent and disk has source files", async () => {
  const dir = await tmpDirWith({ "App.jsx": "function App(){}" });
  const req = await buildEditPromptRequest({
    chatId: "c1",
    appSlug: "x",
    userSlug: "u",
    prompt: "make it pink",
    dir,
    focus: undefined,
  });
  expect(req.selected).toEqual({ kind: "draft", files: expect.any(Array) });
});

it("omits selected when .undo matches disk", async () => {
  const dir = await tmpDirWith({
    "App.jsx": "function App(){}",
    ".undo": JSON.stringify([{ filename: "App.jsx", content: "function App(){}" }]),
  });
  const req = await buildEditPromptRequest({ chatId: "c1", appSlug: "x", userSlug: "u", prompt: "go", dir, focus: undefined });
  expect(req.selected).toBeUndefined();
});
```

- [ ] **Step 2: Fail; Step 3: Implement**

Extract a pure `buildEditPromptRequest` from `edit-cmd.ts`'s handler. Inside it call `collectDiskDraft(dir)`; if it returns non-null, set `selected: { kind: "draft", files: drift.files }` on the request envelope.

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --filter vibes-diy test edit-cmd
git add vibes-diy/cli/cmds/edit-cmd.ts vibes-diy/cli/cmds/edit-cmd.test.ts
git commit -m "feat(cli): edit auto-attaches selected.draft when disk diverges or .undo absent"
```

---

## Phase 10 — Synthetic-user vs system A/B switch (pre-merge gate)

### Task 21: `slotDeliveryMode` env var to render slots as `system` instead of `user`

**Files:**

- Modify: `vibes.diy/api/svc/intern/slot-assembler.ts`
- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts`
- Test: `vibes.diy/api/tests/slot-delivery-mode.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { renderSlotMessagesAs } from "../svc/intern/slot-assembler.js";

it("renderSlotMessagesAs('user') emits role:user messages", () => {
  const r = renderSlotMessagesAs([{ role: "user", label: "ORIGINAL", text: "..." }], "user");
  expect(r[0].role).toBe("user");
  expect(r).toHaveLength(1);
});

it("renderSlotMessagesAs('system') concatenates into a single role:system message", () => {
  const r = renderSlotMessagesAs(
    [
      { role: "user", label: "ORIGINAL", text: "A" },
      { role: "user", label: "PREVIOUS", text: "B" },
    ],
    "system"
  );
  expect(r).toHaveLength(1);
  expect(r[0].role).toBe("system");
  expect(r[0].content[0].text).toContain("A");
  expect(r[0].content[0].text).toContain("B");
});
```

- [ ] **Step 2: Fail; Step 3: Implement**

```ts
// append to slot-assembler.ts
export function renderSlotMessagesAs(msgs: readonly AssembledMessage[], mode: "user" | "system"): ChatMessage[] {
  if (mode === "user") return msgs.map((m) => ({ role: "user" as const, content: [{ type: "text", text: m.text }] }));
  const joined = msgs.map((m) => m.text).join("\n\n");
  return joined ? [{ role: "system", content: [{ type: "text", text: joined }] }] : [];
}
```

In `assemblePromptPayload`, read `env.SLOT_DELIVERY_MODE` (default `"user"`) and call `renderSlotMessagesAs(slotMessages, mode)`.

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test slot-delivery-mode
git add vibes.diy/api/svc/intern/slot-assembler.ts vibes.diy/api/tests/slot-delivery-mode.test.ts vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "feat(api): SLOT_DELIVERY_MODE env switches synthetic user vs system for slots"
```

---

## Phase 11 — Eval scenarios

### Task 22: C7 scaffold-revert fixture

**Files:**

- Create: `vibes.diy/api/tests/eval/c7-scaffold-revert.fixture.ts`
- Create: `vibes.diy/api/tests/eval/c7-scaffold-revert.test.ts`

- [ ] **Step 1: Failing test**

```ts
// vibes.diy/api/tests/eval/c7-scaffold-revert.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createVibeDiyTestCtx } from "../helpers/test-ctx.js";
import { c7Scenario } from "./c7-scaffold-revert.fixture.js";

describe("C7 scaffold-revert: dry-run payload includes ORIGINAL caption and breadcrumb", () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  beforeEach(async () => (ctx = await createVibeDiyTestCtx()));

  it("payload includes ORIGINAL slot and breadcrumb on PREVIOUS", async () => {
    const { chatId } = await c7Scenario.setup(ctx);
    const payload = await ctx.dryRun({ chatId, promptText: c7Scenario.prompt });
    const texts = payload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
    expect(texts.some((t) => t.includes("ORIGINAL"))).toBe(true);
    expect(texts.some((t) => t.includes("ORIGINAL scaffold is"))).toBe(true);
  });
});
```

- [ ] **Step 2: Fail; Step 3: Implement**

```ts
// vibes.diy/api/tests/eval/c7-scaffold-revert.fixture.ts
import type { createVibeDiyTestCtx } from "../helpers/test-ctx.js";

export const c7Scenario = {
  prompt: "Go back to the simpler version we had at the start, then add a footer.",
  async setup(ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>) {
    const { chatId } = await ctx.seedChat();
    // Scaffold turn — minimal counter app.
    await ctx.seedTurn(chatId, {
      fsId: "fs-scaffold",
      files: { "App.jsx": "export default function App(){return <div>0</div>}" },
      promptId: "p0",
    });
    // 15 evolution turns.
    for (let i = 1; i <= 15; i++) {
      await ctx.seedTurn(chatId, {
        fsId: `fs-${i}`,
        files: { "App.jsx": `export default function App(){return <div>turn ${i}</div>}` },
        promptId: `p${i}`,
      });
    }
    return { chatId };
  },
};
```

- [ ] **Step 4: Pass; Step 5: Commit**

```
pnpm --dir vibes.diy/api/tests test c7-scaffold-revert
git add vibes.diy/api/tests/eval/c7-scaffold-revert.fixture.ts vibes.diy/api/tests/eval/c7-scaffold-revert.test.ts
git commit -m "test(eval): C7 scaffold-revert fixture and breadcrumb assertion"
```

---

### Task 23: A/B harness — synthetic-user vs system for C1–C7

**Files:**

- Create: `vibes.diy/api/tests/eval/slot-delivery-ab.test.ts`

- [ ] **Step 1: Write the test (this is the runnable A/B gate; no implementation step)**

```ts
// vibes.diy/api/tests/eval/slot-delivery-ab.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createVibeDiyTestCtx } from "../helpers/test-ctx.js";
import { c7Scenario } from "./c7-scaffold-revert.fixture.js";
// Import C1-C6 fixtures here (one file per scenario, same shape).

const scenarios = [
  // c1Scenario, c2Scenario, …, c6Scenario,
  c7Scenario,
];

describe("Slot delivery mode A/B: payload shape parity", () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  beforeEach(async () => (ctx = await createVibeDiyTestCtx()));

  for (const s of scenarios) {
    it(`${s.name ?? "scenario"}: user-mode and system-mode payloads carry the same slot content`, async () => {
      const { chatId } = await s.setup(ctx);
      const userPayload = await ctx.dryRun({ chatId, promptText: s.prompt, env: { SLOT_DELIVERY_MODE: "user" } });
      const sysPayload = await ctx.dryRun({ chatId, promptText: s.prompt, env: { SLOT_DELIVERY_MODE: "system" } });
      const userTexts = userPayload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : ""))).join("\n");
      const sysTexts = sysPayload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : ""))).join("\n");
      // Both must contain the same slot bodies — only the delivery role differs.
      for (const marker of ["ORIGINAL", "PREVIOUS"]) {
        expect(userTexts).toContain(marker);
        expect(sysTexts).toContain(marker);
      }
    });
  }
});
```

(The live fidelity A/B against the actual LLM is run out-of-band against this same harness — this test only verifies parity of the assembled payloads.)

- [ ] **Step 2: Run, expect pass (the implementation already supports both modes from Task 21)**

```
pnpm --dir vibes.diy/api/tests test slot-delivery-ab
```

- [ ] **Step 3: Commit**

```
git add vibes.diy/api/tests/eval/slot-delivery-ab.test.ts
git commit -m "test(eval): A/B parity harness for synthetic-user vs system slot delivery"
```

---

## Phase 12 — Cleanup

### Task 24: Remove dead code — old `loadPriorFileSystem` callsite in `injectSystemPrompt`

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts`

The append-`CURRENT FILES`-to-system-prompt branch (line 729–741 originally) was removed in Task 13. `loadPriorFileSystem` is no longer called from `injectSystemPrompt` — but it may still be called from elsewhere (e.g., recovery's orchestrator). Verify with grep and remove unused imports.

- [ ] **Step 1: Grep current callers**

```
rg -n "loadPriorFileSystem" vibes.diy/api
```

- [ ] **Step 2: If any remain, leave them; otherwise mark unused and remove**

- [ ] **Step 3: Run full suite**

```
pnpm check
```

- [ ] **Step 4: Commit (if anything changed)**

```
git add vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "chore(api): drop unused loadPriorFileSystem callsite after slot interpolation"
```

---

### Task 25: Final check — pnpm check passes, all tests green

- [ ] **Step 1: Format**

```
pnpm format
```

- [ ] **Step 2: Full check**

```
pnpm check 2>&1 | tee /tmp/pnpm-check-1667.log
```

Expected: all green. If a flaky test fails (see [agents/flaky-tests.md](../../agents/flaky-tests.md)), rerun before treating as real.

- [ ] **Step 3: Verify behavior on local dev**

Use [agents/local-cli-against-local-dev.md](../../agents/local-cli-against-local-dev.md) to:

- `vibes-diy edit <existing-chat-appSlug> "make it pink" --dry-run` and confirm `ORIGINAL`, `LAST_EDIT`, `PREVIOUS` synthetic user messages appear in the payload.
- `vibes-diy edit <push-seeded-appSlug> "make it pink" --dry-run` from a directory with `App.jsx` but no `.undo` — confirm `SELECTED_DRAFT` is canonical.
- Verify with `sqlite3` on the local D1 file that PromptContexts/ChatSections row counts are unchanged after dry-run.

- [ ] **Step 4: Commit anything left over**

(If new lint or formatter touched files, commit. Otherwise this is a no-op.)

---

## Out of plan

These are intentionally **not** implemented in this plan and are out-of-scope per the spec:

- Significance tagging UI and `version_significance` table
- `mid-A` / `mid-B` slots
- Fork-history feature
- Conversation prose compaction
- Recovery-turn dry-run beyond attempt #1

If the post-merge ablation measurements (spec § Post-merge ablation measurements) show ORIGINAL is only load-bearing on scaffold-revert prompts, consider a follow-up PR to gate ORIGINAL on prompt heuristics — file as a new issue, not a plan amendment.
