# Retire /chat — Phase 1: in-page tabbed editor surface on /vibe (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-page tabbed editor surface (Code / Data / Chat / Settings) to the `/vibe` route, opened from the unified card, so an owner can inspect/manage a vibe without leaving the running app — the first phase of retiring `/chat`.

**Architecture:** The `/vibe` route owns a new `editorTab` state and renders a new `VibeEditorPanel` into the existing `UnifiedVibeCard` `body` slot (reusing its open/grow animation and bottom-nav). The panel is a tab row over four tab bodies that **reuse existing components**: a new lightweight read-only shiki code viewer (Code), `DataView` (Data), `ChatInterface` (Chat), and a scoped wrapper of `SettingsTab` (Settings). No URL change, no `/chat` teardown, no Monaco edit-and-save — those are Phases 2–3.

**Tech Stack:** React + React Router (`vibes.diy/pkg/app`), `@vibes.diy/base` (presentational card), shiki (already a dep via `setupMonacoEditor.ts`), vitest (`vibes.diy/pkg/test`), Storybook (`vibes.diy/stories`) for UI iteration. Per-repo convention: **logic → vitest unit tests; UI → Storybook stories** (there is no React-Testing-Library render harness in this repo — do not invent one).

**Spec:** `docs/superpowers/specs/2026-06-29-retire-chat-fold-into-vibe-design.md` (Phase 1). **Acceptance basis:** Charlie's Phase 1 checklist on PR #2847. **Non-goals (explicit):** no `/chat` teardown, no 301 redirect, no Monaco edit-and-save state machine.

**Verification commands (this repo):**

- Build/typecheck: `pnpm build`
- Lint: `pnpm lint`
- Unit tests: `cd vibes.diy/pkg && pnpm test -- <file>` (vitest; from repo root `pnpm test` runs the suite)
- Format gate (CI uses this): `pnpm exec prettier --check <files>`
- Storybook build: `cd vibes.diy/stories && pnpm exec storybook build -o sb-out`

---

## File structure (created / modified)

**Created**

- `vibes.diy/pkg/app/components/vibe-editor/VibeEditorPanel.tsx` — the tabbed surface (tab row + active tab body); composed into the card `body`.
- `vibes.diy/pkg/app/components/vibe-editor/editor-tab-state.ts` — pure helpers for tab selection / which tab the `💬` shortcut opens (unit-tested).
- `vibes.diy/pkg/app/components/vibe-editor/CodeViewPanel.tsx` — lightweight **read-only** shiki code viewer (no Monaco).
- `vibes.diy/pkg/app/components/vibe-editor/code-from-chat.ts` — pure resolver: persisted/hydrated chat → `{ files, activeCode }` for the read-only view (unit-tested).
- `vibes.diy/pkg/app/components/vibe-editor/SettingsTabScoped.tsx` — wraps `SettingsTab` to the #2850 subset (title/theme/icon/env vars; model-settings as a `/vibes/mine` link; account-level excluded).
- `vibes.diy/pkg/app/components/vibe-editor/settings-subset.ts` — pure config listing which Settings cards are in-vibe vs link-out (unit-tested).
- `vibes.diy/pkg/test/editor-tab-state.test.ts`, `vibes.diy/pkg/test/code-from-chat.test.ts`, `vibes.diy/pkg/test/settings-subset.test.ts` — vitest units.
- `vibes.diy/stories/sketches/VibeEditorPanel.stories.tsx` — Storybook stories (desktop + 390px mobile) for each tab.

**Modified**

- `vibes.diy/base/components/UnifiedVibeCard.tsx` — widen `selectedNav` union to include the editor tabs; add an editor entry-point nav affordance + `onOpenEditor`.
- `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — own `editorTab` state; wire the entry point, the `💬` shortcut, and render `VibeEditorPanel` as `body`.
- The ~11 files importing types from `routes/chat/chat.$ownerHandle.$appSlug.tsx` — repoint to `routes/chat/prompt-state.ts` (Task 1).

---

## Task 1: Repoint type imports off the chat route file (prereq 3a)

The shared types (`PromptState`, `PromptBlock`, `HydratedCodeViewFile`) are **already defined** in `routes/chat/prompt-state.ts`; `chat.$ownerHandle.$appSlug.tsx` only re-exports them (`:11-12`). Repoint every importer so the chat-route file has no remaining type-consumers (unblocks its Phase-3 deletion and lets the new editor components import without touching the doomed file).

**Files:**

- Modify (repoint `from ".../chat.$ownerHandle.$appSlug.js"` → `from ".../prompt-state.js"`):
  - `vibes.diy/pkg/app/types/ResultPreviewTypes.ts`
  - `vibes.diy/pkg/app/components/MessageList.tsx`
  - `vibes.diy/pkg/app/components/ChatInterface.tsx`
  - `vibes.diy/pkg/app/components/ResultPreview/get-code.ts`
  - `vibes.diy/pkg/app/components/ResultPreview/ResultPreview.tsx`
  - `vibes.diy/pkg/app/components/ResultPreview/CodeEditor.tsx`
  - `vibes.diy/pkg/app/components/ResultPreview/DataView.tsx`
  - `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx`
  - `vibes.diy/pkg/app/components/ResultPreview/ResultPreviewHeaderContent.tsx`
  - `vibes.diy/pkg/app/utils/ViewState.ts`
  - `vibes.diy/pkg/app/utils/freshFirstCodegen.ts`

- [ ] **Step 1: Find every importer** (authoritative list, don't trust the plan's copy)

Run: `grep -rln 'chat\.\$ownerHandle\.\$appSlug' vibes.diy/pkg/app --include=*.ts --include=*.tsx`
Expected: the files above (plus `routes/chat/prompt.tsx`, which imports the runtime `Chat` value — **leave that one**, it's Phase 3 / prereq 3b).

- [ ] **Step 2: Repoint each type import.** In each file, change the import source for the type-only symbols. Example (`CodeEditor.tsx`):

```ts
// before
import { PromptState, PromptBlock, HydratedCodeViewFile } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";
// after
import type { PromptState, PromptBlock, HydratedCodeViewFile } from "../../routes/chat/prompt-state.js";
```

Use the correct relative depth per file (e.g. `utils/ViewState.ts` → `../routes/chat/prompt-state.js`). Only move **type** symbols; if a file also imports a runtime value (e.g. `Chat`) from the chat route, keep that import line and add a separate `import type … from prompt-state`.

- [ ] **Step 3: Verify the chat route file has no remaining type importers**

Run: `grep -rln 'chat\.\$ownerHandle\.\$appSlug' vibes.diy/pkg/app --include=*.ts --include=*.tsx`
Expected: only `routes/chat/prompt.tsx` (the runtime `Chat` import, intentionally left).

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm build && pnpm lint`
Expected: PASS (no type errors; the re-export in the chat route is now unused but harmless — leave it for Phase 3).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: import prompt-state types from prompt-state.ts, not the chat route (#2518 Phase 1 prereq 3a)"
```

---

## Task 2: Editor tab-state helpers (pure logic, TDD)

A tiny pure module the route uses to manage which tab is open and what the `💬` shortcut selects. Keeping it pure makes it unit-testable without a render harness.

**Files:**

- Create: `vibes.diy/pkg/app/components/vibe-editor/editor-tab-state.ts`
- Test: `vibes.diy/pkg/test/editor-tab-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { EDITOR_TABS, isEditorTab, chatShortcutTab, type EditorTab } from "../app/components/vibe-editor/editor-tab-state.js";

describe("editor-tab-state", () => {
  it("lists the four Phase 1 tabs in order", () => {
    expect(EDITOR_TABS).toEqual(["code", "data", "chat", "settings"] satisfies EditorTab[]);
  });
  it("recognises editor tabs and rejects the bottom-nav values", () => {
    expect(isEditorTab("code")).toBe(true);
    expect(isEditorTab("chat")).toBe(true);
    expect(isEditorTab("share")).toBe(false);
    expect(isEditorTab(null)).toBe(false);
  });
  it("the chat shortcut opens the Chat tab", () => {
    expect(chatShortcutTab()).toBe("chat");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/pkg && pnpm test -- editor-tab-state`
Expected: FAIL ("Cannot find module …/editor-tab-state").

- [ ] **Step 3: Implement**

```ts
export type EditorTab = "code" | "data" | "chat" | "settings";
export const EDITOR_TABS: readonly EditorTab[] = ["code", "data", "chat", "settings"] as const;
export function isEditorTab(v: unknown): v is EditorTab {
  return typeof v === "string" && (EDITOR_TABS as readonly string[]).includes(v);
}
/** The tab the persistent `💬` shortcut opens. */
export function chatShortcutTab(): EditorTab {
  return "chat";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/pkg && pnpm test -- editor-tab-state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/vibe-editor/editor-tab-state.ts vibes.diy/pkg/test/editor-tab-state.test.ts
git commit -m "feat: editor tab-state helpers (#2518 Phase 1)"
```

---

## Task 3: Settings subset config (pure logic, TDD)

Decide — as data — which Settings cards render in-vibe vs link out, so `SettingsTabScoped` and its tests share one source of truth. Per #2850 / spec: fold **title, theme, icon, env vars**; **model settings** link to `/vibes/mine`; **account-level** excluded; **sharing** comes from #2680 (out of this wrapper).

**Files:**

- Create: `vibes.diy/pkg/app/components/vibe-editor/settings-subset.ts`
- Test: `vibes.diy/pkg/test/settings-subset.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { IN_VIBE_SETTINGS, isInVibeSetting, MANAGE_IN_MINE } from "../app/components/vibe-editor/settings-subset.js";

describe("settings-subset (#2850)", () => {
  it("folds title/theme/icon/env into the vibe surface", () => {
    expect(IN_VIBE_SETTINGS).toEqual(["title", "theme", "icon", "env"]);
  });
  it("routes model settings to /vibes/mine", () => {
    expect(MANAGE_IN_MINE).toContain("model");
  });
  it("excludes account-level settings from the vibe surface", () => {
    expect(isInVibeSetting("title")).toBe(true);
    expect(isInVibeSetting("model")).toBe(false);
    expect(isInVibeSetting("account")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/pkg && pnpm test -- settings-subset`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
export type SettingKey = "title" | "theme" | "icon" | "env" | "model" | "account";
export const IN_VIBE_SETTINGS: readonly SettingKey[] = ["title", "theme", "icon", "env"] as const;
export const MANAGE_IN_MINE: readonly SettingKey[] = ["model"] as const;
export function isInVibeSetting(k: SettingKey): boolean {
  return (IN_VIBE_SETTINGS as readonly string[]).includes(k);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/pkg && pnpm test -- settings-subset`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/vibe-editor/settings-subset.ts vibes.diy/pkg/test/settings-subset.test.ts
git commit -m "feat: in-vibe settings subset config (#2518 Phase 1, #2850)"
```

---

## Task 4: `code-from-chat` resolver (pure logic, TDD)

The read-only Code view needs files + code text without Monaco and without a chat session. The vibe's persisted code lives in its chat response (the same source `useLatestVibeChips`/`useChatHydration` read). This pure resolver turns a hydrated `PromptState` (or its `blocks`) into the data the viewer renders, reusing the existing `getCode` util.

**Files:**

- Create: `vibes.diy/pkg/app/components/vibe-editor/code-from-chat.ts`
- Test: `vibes.diy/pkg/test/code-from-chat.test.ts`
- Reference (do not modify): `vibes.diy/pkg/app/components/ResultPreview/get-code.ts` (`getCode(promptState)` → `{ code: string[] }`), `vibes.diy/pkg/app/components/ResultPreview/code-view-files.ts` (`sortCodeViewFiles`, `inferCodeViewLanguage`, `pickDefaultCodeViewFile`).

- [ ] **Step 1: Read the references** to confirm the exact shapes

Run: `sed -n '1,40p' vibes.diy/pkg/app/components/ResultPreview/get-code.ts vibes.diy/pkg/app/components/ResultPreview/code-view-files.ts`
Expected: confirm `getCode`'s return shape and the `HydratedCodeViewFile` fields before writing code against them.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveCodeView } from "../app/components/vibe-editor/code-from-chat.js";
import type { PromptState } from "../app/routes/chat/prompt-state.js";

function emptyState(): PromptState {
  return { blocks: [], hasCode: false } as unknown as PromptState;
}

describe("resolveCodeView", () => {
  it("returns no files for an un-generated vibe", () => {
    const r = resolveCodeView(emptyState());
    expect(r.files).toEqual([]);
    expect(r.activeFile).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd vibes.diy/pkg && pnpm test -- code-from-chat`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement** (compose the existing utils; do not re-derive parsing)

```ts
import type { PromptState, HydratedCodeViewFile } from "../../routes/chat/prompt-state.js";
import { getCode } from "../ResultPreview/get-code.js";
import { sortCodeViewFiles, pickDefaultCodeViewFile, inferCodeViewLanguage } from "../ResultPreview/code-view-files.js";

export interface CodeViewModel {
  readonly files: readonly HydratedCodeViewFile[];
  readonly activeFile: HydratedCodeViewFile | undefined;
  readonly activeCode: string;
  readonly language: string;
}

export function resolveCodeView(state: PromptState): CodeViewModel {
  const files = sortCodeViewFiles(state); // existing util reads hydrated files off state
  const activeFile = pickDefaultCodeViewFile(files); // existing default-pick
  const activeCode = activeFile ? activeFile.content : getCode(state).code.join("\n");
  const language = activeFile ? inferCodeViewLanguage(activeFile.path) : "jsx";
  return { files, activeFile, activeCode, language };
}
```

> If `sortCodeViewFiles`/`pickDefaultCodeViewFile` signatures differ from the above (Step 1 confirms), adapt the calls — keep the resolver a thin composition of the existing utils, not a re-implementation.

- [ ] **Step 5: Run to verify it passes**

Run: `cd vibes.diy/pkg && pnpm test -- code-from-chat`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/components/vibe-editor/code-from-chat.ts vibes.diy/pkg/test/code-from-chat.test.ts
git commit -m "feat: resolve read-only code view from persisted chat (#2518 Phase 1)"
```

---

## Task 5: `CodeViewPanel` — lightweight read-only shiki viewer (UI)

Render `resolveCodeView`'s output as syntax-highlighted, scrollable, **read-only** code with a file picker. No Monaco (keeps Phase 1 lean; Monaco edit-and-save is Phase 2). Reuse shiki the way `setupMonacoEditor.ts` already does (`createHighlighterCore` + the bundled langs/themes) — import shiki lazily so it's not in the `/vibe` first-paint bundle.

**Files:**

- Create: `vibes.diy/pkg/app/components/vibe-editor/CodeViewPanel.tsx`
- Reference: `vibes.diy/pkg/app/components/ResultPreview/setupMonacoEditor.ts` (how shiki is created here), `vibes.diy/pkg/app/components/ResultPreview/code-view-files.ts`.

- [ ] **Step 1: Implement the component**

```tsx
import React, { useEffect, useState } from "react";
import type { CodeViewModel } from "./code-from-chat.js";

// Lazy: shiki must not land in the /vibe first-paint bundle.
async function highlight(code: string, lang: string): Promise<string> {
  const { codeToHtml } = await import("shiki");
  return codeToHtml(code, { lang, theme: "github-dark" });
}

export function CodeViewPanel({ model, onPickFile }: { model: CodeViewModel; onPickFile: (path: string) => void }) {
  const [html, setHtml] = useState<string>("");
  useEffect(() => {
    let alive = true;
    if (!model.activeCode) {
      setHtml("");
      return;
    }
    void highlight(model.activeCode, model.language).then((h) => {
      if (alive) setHtml(h);
    });
    return () => {
      alive = false;
    };
  }, [model.activeCode, model.language]);

  if (model.files.length === 0) {
    return <div className="p-4 text-sm text-gray-500">No code yet — make an edit to generate this vibe’s source.</div>;
  }
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 px-2 py-1">
        {model.files.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => onPickFile(f.path)}
            className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${f.path === model.activeFile?.path ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "text-gray-500"}`}
          >
            {f.path}
          </button>
        ))}
      </div>
      {/* read-only: dangerouslySetInnerHTML is shiki's own escaped output */}
      <div className="flex-1 min-h-0 overflow-auto text-xs [&_pre]:p-3" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Confirm the shiki lazy boundary** (no static shiki in the route bundle)

Run: `grep -rn "from \"shiki\"" vibes.diy/pkg/app/components/vibe-editor/CodeViewPanel.tsx`
Expected: only the **dynamic** `import("shiki")` inside `highlight` — no top-level `import … from "shiki"`.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/app/components/vibe-editor/CodeViewPanel.tsx
git commit -m "feat: read-only shiki code viewer for /vibe (no Monaco) (#2518 Phase 1)"
```

---

## Task 6: `SettingsTabScoped` — the #2850 subset (UI)

Render the in-vibe Settings subset by reusing the existing cards from `mine/settings-tab` where they're already factored, and a `/vibes/mine` link for model settings. Simplest correct approach: render `SettingsTab` but pass a `hide` set derived from `settings-subset.ts`, plus a "manage advanced model settings in My Apps" link.

**Files:**

- Create: `vibes.diy/pkg/app/components/vibe-editor/SettingsTabScoped.tsx`
- Modify: `vibes.diy/pkg/app/components/mine/settings-tab/index.tsx` — add an optional `hide?: ReadonlySet<SettingKey>` prop that omits the matching `<Card>`s (default: hide nothing, so `/vibes/mine` is unchanged).

- [ ] **Step 1: Add the optional `hide` prop to `SettingsTab`** (non-breaking — default renders everything as today). Gate each card: e.g. wrap the Model settings block in `{!hide?.has("model") && <ModelSettingsCards … />}` and similarly for `title`/`theme`/`icon`/`env`. Keep `/vibes/mine`'s `MineDetailPanel` call site unchanged (no `hide` → identical behavior).

- [ ] **Step 2: Implement the scoped wrapper**

```tsx
import React from "react";
import { Link } from "react-router";
import { SettingsTab } from "../mine/settings-tab/index.js";
import { MANAGE_IN_MINE } from "./settings-subset.js";

export function SettingsTabScoped({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) {
  const hide = new Set(MANAGE_IN_MINE); // hide "model" in-vibe
  return (
    <div>
      <SettingsTab ownerHandle={ownerHandle} appSlug={appSlug} hide={hide} />
      <div className="mt-4 text-xs text-gray-500">
        <Link to={`/vibes/mine/${ownerHandle}/${appSlug}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          Manage model settings in My Apps →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify `/vibes/mine` is unchanged**

Run: `pnpm build && grep -n "SettingsTab" vibes.diy/pkg/app/components/mine/MineDetailPanel.tsx`
Expected: PASS; `MineDetailPanel` still calls `<SettingsTab … />` with no `hide` (full set).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/app/components/vibe-editor/SettingsTabScoped.tsx vibes.diy/pkg/app/components/mine/settings-tab/index.tsx
git commit -m "feat: scoped in-vibe Settings (#2850 subset) reusing SettingsTab (#2518 Phase 1)"
```

---

## Task 7: `VibeEditorPanel` — the tabbed surface (UI)

Compose the tab row + four bodies. Data tab reuses `DataView` (route-params only); Chat tab reuses `ChatInterface` fed by the route's generation/hydrated blocks; Code tab is `CodeViewPanel` + `resolveCodeView`; Settings is `SettingsTabScoped`.

**Files:**

- Create: `vibes.diy/pkg/app/components/vibe-editor/VibeEditorPanel.tsx`
- Reference: `vibes.diy/pkg/app/components/ResultPreview/DataView.tsx`, `vibes.diy/pkg/app/components/ChatInterface.tsx`.

- [ ] **Step 1: Implement**

```tsx
import React from "react";
import type { PromptState } from "../../routes/chat/prompt-state.js";
import { EDITOR_TABS, type EditorTab } from "./editor-tab-state.js";
import { resolveCodeView } from "./code-from-chat.js";
import { CodeViewPanel } from "./CodeViewPanel.js";
import { SettingsTabScoped } from "./SettingsTabScoped.js";
import { DataView } from "../ResultPreview/DataView.js";
import { ChatInterface } from "../ChatInterface.js";

const TAB_LABEL: Record<EditorTab, string> = { code: "Code", data: "Data", chat: "Chat", settings: "Settings" };

export interface VibeEditorPanelProps {
  tab: EditorTab;
  onTab: (t: EditorTab) => void;
  ownerHandle: string;
  appSlug: string;
  promptState: PromptState; // from useInVibeGeneration / useChatHydration
  onActivateChat: () => void; // open the chat composer / live session if needed
}

export function VibeEditorPanel(props: VibeEditorPanelProps) {
  const { tab, onTab, ownerHandle, appSlug, promptState } = props;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div role="tablist" className="flex gap-1 border-b border-gray-200 dark:border-gray-700 px-2">
        {EDITOR_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            aria-label={TAB_LABEL[t]}
            onClick={() => onTab(t)}
            className={`px-3 py-1.5 text-xs font-medium ${t === tab ? "border-b-2 border-blue-500 text-blue-700 dark:text-blue-300" : "text-gray-500"}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "code" && <CodeViewPanel model={resolveCodeView(promptState)} onPickFile={() => undefined} />}
        {tab === "data" && <DataView promptState={promptState} />}
        {tab === "chat" && <ChatInterface promptState={promptState} onClick={() => undefined} />}
        {tab === "settings" && <SettingsTabScoped ownerHandle={ownerHandle} appSlug={appSlug} />}
      </div>
    </div>
  );
}
```

> `CodeViewPanel`'s `onPickFile` is wired to local active-file state in a follow-up step if multi-file switching is needed; for Phase 1 the default file is sufficient. `ChatInterface`'s `onClick` (version-nav) is a no-op in the view-first surface (no navigation, per Q2).

- [ ] **Step 2: Typecheck**

Run: `pnpm build`
Expected: PASS (confirm `ChatInterface`/`DataView` props match; adjust optional callbacks if the real signatures differ — see explorer notes).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/vibe-editor/VibeEditorPanel.tsx
git commit -m "feat: VibeEditorPanel tabbed surface (Code/Data/Chat/Settings) (#2518 Phase 1)"
```

---

## Task 8: Card entry point — widen `selectedNav`, add `onOpenEditor` (base)

Extend `UnifiedVibeCard` so the route can open the editor surface and reflect the active tab, **without** introducing a second overlay controller (Charlie). Keep changes additive/back-compat.

**Files:**

- Modify: `vibes.diy/base/components/UnifiedVibeCard.tsx`

- [ ] **Step 1: Widen the `selectedNav` union** from `"edit" | "share"` to `"edit" | "share" | "code" | "data" | "chat" | "settings"`, and add optional props: `onOpenEditor?: () => void` and `editorActive?: boolean`. Add an editor entry affordance to the bottom-nav (a fourth button, e.g. a `</>` "Editor" icon) that calls `onOpenEditor`; mark it `selected` when `editorActive`. Reuse the existing nav-button styling (the `selected` shadow ring at the existing nav buttons).

- [ ] **Step 2: Typecheck base**

Run: `pnpm build`
Expected: PASS (existing call sites still compile — new props are optional).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/base/components/UnifiedVibeCard.tsx
git commit -m "feat(base): UnifiedVibeCard editor entry point + widened selectedNav (#2518 Phase 1)"
```

---

## Task 9: Wire the editor surface into the vibe route

Own `editorTab` state, render `VibeEditorPanel` into the card `body`, wire the entry point and the `💬` shortcut. Feed it the route's `promptState` (from `useInVibeGeneration`; for an already-built vibe with no session generation, hydrate the persisted chat via `useChatHydration` so Code/Chat have content).

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
- Reference: explorer-confirmed card render at `~:1157-1246` (`selectedNav={shareViewOpen ? "share" : "edit"}`, `body={shareViewOpen ? <SharePanelView/> : undefined}`).

- [ ] **Step 1: Add state + hydration.** Near the existing `shareViewOpen` state:

```tsx
import { VibeEditorPanel } from "../components/vibe-editor/VibeEditorPanel.js";
import { isEditorTab, chatShortcutTab, type EditorTab } from "../components/vibe-editor/editor-tab-state.js";
// existing: const [shareViewOpen, setShareViewOpen] = useState(false);
const [editorTab, setEditorTab] = useState<EditorTab | null>(null);
```

For Code/Chat content on a not-currently-generating vibe, reuse the existing hydration hook (the same persisted-chat source `useLatestVibeChips` reads). If `useChatHydration` exposes a `PromptState`, prefer the live `generation` state when generating, else the hydrated state:

```tsx
const editorPromptState = generation.isGenerating ? (generation.promptState ?? hydrated.promptState) : hydrated.promptState;
```

> Confirm the exact handle `useInVibeGeneration` / `useChatHydration` expose (the explorer noted `generation.blocks`; if the hook doesn't surface a full `promptState`, build a minimal `{ blocks, hasCode }` for the view-first panel — `resolveCodeView`/`ChatInterface`/`DataView` only read blocks + route params).

- [ ] **Step 2: Wire the card props.** Extend the existing conditional:

```tsx
selectedNav={editorTab ?? (shareViewOpen ? "share" : "edit")}
editorActive={editorTab !== null}
onOpenEditor={() => { setShareViewOpen(false); setEditorTab((t) => t ?? "code"); }}
onShare={() => { setEditorTab(null); setShareViewOpen(true); }}
onEdit={() => { setEditorTab(null); setShareViewOpen(false); }}
body={
  editorTab ? (
    <VibeEditorPanel
      tab={editorTab}
      onTab={setEditorTab}
      ownerHandle={ownerHandle ?? ""}
      appSlug={appSlug ?? ""}
      promptState={editorPromptState}
      onActivateChat={() => generation.activate?.()}
    />
  ) : shareViewOpen ? (
    <SharePanelView /* …existing props… */ />
  ) : undefined
}
```

- [ ] **Step 3: Wire the `💬` shortcut** to open the surface on the Chat tab. Find the existing `💬` chat-history toggle (#2677) handler and change it to:

```tsx
onClick={() => { setShareViewOpen(false); setEditorTab(chatShortcutTab()); }}
```

- [ ] **Step 4: Typecheck + lint + format**

Run: `pnpm build && pnpm lint && pnpm exec prettier --check "vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx"
git commit -m "feat: open the tabbed editor surface from the /vibe card (#2518 Phase 1)"
```

---

## Task 10: Storybook stories — desktop + mobile (always-mobile gate)

Per repo UI convention (and Charlie's mobile acceptance items), build stories for each tab at desktop and **390×844** to verify all tabs are reachable/usable on mobile with no gating.

**Files:**

- Create: `vibes.diy/stories/sketches/VibeEditorPanel.stories.tsx`
- Reference: `vibes.diy/stories/sketches/AgentInVibe.stories.tsx` (existing sketch pattern; Tailwind v4 is wired in Storybook).

- [ ] **Step 1: Write stories** that render `VibeEditorPanel` for each `tab` value with a hand-built `promptState` fixture (a couple of `blocks` with a code block so Code/Chat have content). Add a `Mobile` variant per tab using a 390-wide frame (mirror the AgentInVibe stories' viewport setup).

- [ ] **Step 2: Build Storybook**

Run: `cd vibes.diy/stories && pnpm exec storybook build -o sb-out 2>&1 | tail -5`
Expected: build succeeds; stories compile.

- [ ] **Step 3: Screenshot each tab at 390px** (Playwright, Chromium pre-installed — do NOT `playwright install`), confirm Code/Data/Chat/Settings render and scroll within the phone frame. Embed shots in the PR.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/stories/sketches/VibeEditorPanel.stories.tsx
git commit -m "test(storybook): VibeEditorPanel tabs at desktop + 390px (#2518 Phase 1)"
```

---

## Task 11: Analytics parity groundwork (no redirect)

Phase 1 doesn't redirect, but the parity gate must exist **before** the Phase 3 301. Land the groundwork now so Phase 3 is just flipping the redirect.

**Files:**

- Reference: find the pageview capture — `grep -rn "location.pathname\|posthog\|gtm\|capture(" vibes.diy/pkg/app | head`.

- [ ] **Step 1: Locate pageview capture** and confirm it's path-based (Charlie). Document the exact `/chat/:o/:s` → `/vibe/:o/:s` event/prop mapping needed (a short note appended to the spec's analytics section or a comment in the capture module). **Do not** change redirect behavior.

- [ ] **Step 2: Add a parity assertion** appropriate to the capture mechanism — e.g. a unit test that the funnel-defining prop is emitted from a path-independent source (so the eventual 301 can't drop the step). If the events are dashboard-only (no code), record the go/no-go criterion as a checklist item in the spec instead.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: analytics parity groundwork for /chat→/vibe (pre-Phase-3) (#2518 Phase 1)"
```

---

## Task 12: Full verification + PR

- [ ] **Step 1: Full build + lint + format**

Run: `pnpm build && pnpm lint && pnpm exec prettier --check $(git diff --name-only origin/main)`
Expected: PASS.

- [ ] **Step 2: Unit tests**

Run: `cd vibes.diy/pkg && pnpm test -- editor-tab-state settings-subset code-from-chat`
Expected: PASS.

- [ ] **Step 3: Acceptance pass** against Charlie's Phase 1 checklist (PR #2847): single entry point (no second overlay); `💬`→Chat tab; tab-switching never navigates; Code is view-first (no edit affordance); Settings = #2850 subset; all tabs usable at 390px; Monaco **not** in the `/vibe` bundle (shiki lazy); types repointed (Task 1). Non-goals respected (no teardown, no 301, no edit-and-save).

- [ ] **Step 4: Drop a blog seed** under `notes/blog-seeds/` and open the PR (label `agent-created`, @-mention `@CharlieHelps`, link #2518 / spec PR #2847). Verify on the preview deploy (authed) that the surface opens, all four tabs render, and `/vibe` still first-paints without Monaco.

---

## Self-review notes (gaps to confirm at execution time)

- **`promptState` handle on `/vibe`:** Tasks 7/9 assume the route can hand the panel a `PromptState` (live `generation` when generating, hydrated persisted chat otherwise). Step 1 of Task 9 says to confirm exactly what `useInVibeGeneration` / `useChatHydration` expose and build a minimal `{ blocks, hasCode }` if a full `PromptState` isn't surfaced — the view-first components only read `blocks` + route params, so this is bounded.
- **`code-view-files` util signatures** (Task 4) — confirmed by reading them in Step 1 before writing the resolver; adapt the thin composition if names differ.
- **`ChatInterface`/`DataView` optional callbacks** (Task 7) — pass no-ops for version-nav (`onClick`) since the surface doesn't navigate (Q2); confirm against the real prop types at typecheck.
- These are wiring confirmations, not design gaps — every component, hook, and util referenced exists today (verified by the two exploration passes).
