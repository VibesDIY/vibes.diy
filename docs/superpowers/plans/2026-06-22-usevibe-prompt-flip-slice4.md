# Prompt Flip to `useVibe().can` (Slice 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the codegen guidance so new generations gate write surfaces on `useVibe(dbName).can.*` (render `reason` as fallback copy), instead of hand-combining `viewer`/`isOwner`/`access.hasRole()`. `useViewer()` stays for identity/display only.

**Architecture:** Prompt/guidance-only change across the `prompts/pkg` package — a new injected llms doc (`use-vibe.md`), a force-inject of `use-vibe` + `use-viewer` into every assembled prompt, and rewrites of the gating guidance in `system-prompt.md`, `system-prompt-initial.md`, `fireproof.md`, `use-viewer.md`, `prompts.ts`, and `notes/vibes-app-jsx.md`. No runtime/hook/wire changes. Deterministic prompt-assembly tests are the safety net.

**Tech Stack:** TypeScript, markdown prompt assets, arktype-free plain configs, vitest.

**Spec:** [`docs/superpowers/specs/2026-06-22-usevibe-prompt-flip-slice4-design.md`](../specs/2026-06-22-usevibe-prompt-flip-slice4-design.md)

**Test commands:** prompt tests live in `prompts/tests/`. Run a single file with `cd prompts && pnpm test -- <file>` (verify the exact invocation in Task 1 Step 2). CI-faithful full gate before the final push: from repo root `pnpm build && pnpm lint && pnpm format:check && pnpm test`. **Always run `pnpm format:check` — `pnpm check` does NOT include it and CI runs it separately.**

---

## Canonical artifacts (referenced by multiple tasks)

**THE RULE (hard-rule bullets)** — the single gating rule, used verbatim in Task 3:

```
- Access control is decided by the runtime, not your code. Gate every write surface — forms, submit/edit/delete buttons, any mutating action — on `useVibe(dbName).can`. `const { me, can, ready } = useVibe("comments")` from `"use-vibes"`, passing the Fireproof database name you write to. Show the editor when `can.create(draft).ok` (or `can.edit(doc)` / `can.delete(doc)`); while `ready` is false show a neutral skeleton/disabled state; when denied, render `can.create(draft).reason` as the fallback copy (the sign-in or join prompt). `can.*` runs the app's own `access.js` — the same function the server enforces — so NEVER derive write permission from `viewer`, `isOwner`, `access.hasRole()`/`access.hasChannel()`, or document fields. `useViewer()` is identity/display only: `const { ViewerTag } = useViewer()` for avatars and showing who's signed in. Owner-only management UI is gated on `can.*` too (the access.js encodes the owner rule). This applies to every app — the runtime decides sharing, not the prompt. Writes can still be rejected server-side even when `can.*` allows, so keep the optimistic-write + rollback handling. See use-vibe docs.
```

**RETIRED STRINGS** — must NOT appear anywhere in the assembled default prompt after this plan (Task 7 regression guard):

- `Gate write surfaces on `viewer`` (the literal phrase, system-prompt + initial)
- `useViewer().can('write')` (prompts.ts vocabulary)
- `Write surfaces are gated with `viewer`` (fireproof.md summary)

---

## Task 1: Add the `use-vibe` llms doc + config + catalog registration

**Files:**

- Create: `prompts/pkg/llms/use-vibe.md`
- Create: `prompts/pkg/llms/use-vibe.ts`
- Modify: `prompts/pkg/llms/index.ts`
- Test: `prompts/tests/prompt-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `prompts/tests/prompt-builder.test.ts` inside the `describe("prompt builder (real implementation)", …)` block:

```ts
it("use-vibe config is in the catalog with the right import metadata", async () => {
  const catalog = await getLlmCatalog();
  const useVibe = catalog.find((c) => c.name === "use-vibe");
  expect(useVibe).toBeDefined();
  expect(useVibe?.importModule).toBe("use-vibes");
  expect(useVibe?.importName).toBe("useVibe");
});
```

`getLlmCatalog` is already imported in this test file (it imports from the package index). If it is not, add it to the existing import from `"../pkg/prompts.js"` / `"../pkg/json-docs.js"` — match the path the other helpers in this file use (check the file's top imports).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: FAIL — no catalog entry named `use-vibe`. (Confirm this is the working invocation; if `pnpm test -- prompt-builder` runs the whole suite, that's fine — just confirm the new case fails.)

- [ ] **Step 3: Create the config**

Create `prompts/pkg/llms/use-vibe.ts`:

```ts
import type { LlmConfig } from "./types.js";

export const useVibeConfig: LlmConfig = {
  name: "use-vibe",
  label: "Vibe Write Gating",
  description: "Gate write surfaces on the app's own access.js via useVibe().can",
  importModule: "use-vibes",
  importName: "useVibe",
};
```

- [ ] **Step 4: Register it in the catalog**

In `prompts/pkg/llms/index.ts`: add the import, the re-export, and the `allConfigs` entry (place it next to `useViewerConfig`):

```ts
import { useVibeConfig } from "./use-vibe.js";
```

```ts
export { useVibeConfig } from "./use-vibe.js";
```

and inside the `allConfigs` array, after `useViewerConfig,`:

```ts
  useVibeConfig,
```

- [ ] **Step 5: Create the doc content**

Create `prompts/pkg/llms/use-vibe.md` with this exact content:

````markdown
# useVibe Hook — write gating

`useVibe(dbName)` is how you gate write surfaces. It runs the app's own `access.js` — the **same function the server enforces** — against a candidate document, so the UI's enabled/disabled state matches what the server will actually allow. You never re-implement permissions; you ask the access function.

```jsx
const { me, can, ready } = useVibe("comments");
```

Pass the Fireproof database name you are writing to. You get:

- `can.create(draft)` / `can.edit(doc)` / `can.delete(doc)` → `{ ok: boolean, reason?: string }`. Gate the write surface on `.ok`; when `!ok`, render `.reason` as the fallback copy (e.g. "authentication required", "not in channel: team").
- `ready` — `false` until identity and the access function have resolved. While `false`, show a neutral skeleton or disabled control; gating on it avoids a flash of the wrong state.
- `me` — `{ userHandle, displayName?, isOwner } | null` (null = anonymous). For display only.

## The rule

Gate every write affordance on `can.*`. Render `reason` when denied. Never branch write permission on `viewer`, `isOwner`, `access.hasRole()`/`access.hasChannel()`, or document fields — those drift from what `access.js` actually does. Identity display (avatars, "signed in as") comes from `useViewer()`'s `ViewerTag`, not from `useVibe`.

```jsx
import { useVibe, useViewer } from "use-vibes";

function PromptBar({ database }) {
  const { can, ready } = useVibe("aestheticBoard");
  const { ViewerTag } = useViewer();
  if (!ready) return <div className="skeleton" />;
  const v = can.create({ type: "tile" });
  if (!v.ok) return <p className="muted">{v.reason}</p>; // e.g. "authentication required"
  return (
    <form onSubmit={/* … */}>
      <ViewerTag />
      <input placeholder="Add a tile…" />
      <button type="submit">Post</button>
    </form>
  );
}
```

## Owner-only and role-gated surfaces

Don't gate management UI on `isOwner` directly. Encode the rule in `access.js` (e.g. `if (!user.isOwner) throw { forbidden: "owner only" }`) and gate the UI on `can.*` for that database — the verdict reflects the same rule. Per-row edit/delete affordances: `{can.edit(doc).ok && <EditButton doc={doc} />}`.

## The server is still the authority

`can.*` is a fast, faithful preview, not the final word. A write can still be rejected server-side (the source may be stale, async, or unevaluable — in which case `can.*` optimistically returns `ok` and defers to the server). Keep the optimistic-write + rollback pattern: apply the change immediately, revert and surface an error if the `put` rejects.
````

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS (the new `use-vibe config…` test, plus the existing suite still green — the catalog now has one more entry; if any existing test hard-codes a catalog length, update it to include `use-vibe`).

- [ ] **Step 7: Commit**

```bash
git add prompts/pkg/llms/use-vibe.md prompts/pkg/llms/use-vibe.ts prompts/pkg/llms/index.ts prompts/tests/prompt-builder.test.ts
git commit -m "feat(prompts): add use-vibe llms doc + config for write-gating guidance"
```

---

## Task 2: Force-inject `use-vibe` + `use-viewer` into every assembled prompt

**Files:**

- Modify: `prompts/pkg/prompts.ts` (`getDefaultSkills` ~line 37-39; `makeBaseSystemPrompt` selection ~line 214-220)
- Test: `prompts/tests/prompt-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe("prompt builder (real implementation)", …)` block. It mirrors the existing `makeBaseSystemPrompt` test (see the one around "non-override path includes all catalog imports") — reuse its option shape (model string + the test-mode options object incl. the mock fetch). Use a `skills` list that deliberately omits both `use-vibe` and `use-viewer`:

```ts
it("makeBaseSystemPrompt force-injects use-vibe and use-viewer even when a skills list omits them", async () => {
  const result = await makeBaseSystemPrompt("test-model", {
    // Reuse the same test-mode options the sibling makeBaseSystemPrompt test
    // uses (mock fetch / pkgBaseUrl). Provide an explicit skills list that
    // omits use-vibe and use-viewer:
    skills: ["fireproof"],
    fetch: mockFetch, // the same mock the other makeBaseSystemPrompt test passes
  } as never);
  // Both docs are injected (label-docs blocks present):
  expect(result.systemPrompt).toContain("Vibe Write Gating-docs>");
  expect(result.systemPrompt).toContain("Viewer Identity-docs>");
  // And their imports are emitted:
  expect(result.systemPrompt).toContain('import { useVibe } from "use-vibes"');
  expect(result.systemPrompt).toContain('import { useViewer } from "use-vibes"');
});
```

If `mockFetch` isn't already a shared symbol in the file, copy the exact mock-construction the existing `makeBaseSystemPrompt` test uses (it builds one via `createMockFetchFromPkgFiles`). The label strings `Vibe Write Gating` / `Viewer Identity` come from the configs' `label` fields (Task 1 + `use-viewer.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: FAIL — with `skills: ["fireproof"]`, only fireproof is chosen, so the use-vibe/use-viewer docs and imports are absent.

- [ ] **Step 3: Add `use-vibe` to the default skills**

In `prompts/pkg/prompts.ts`, update `getDefaultSkills`:

```ts
export async function getDefaultSkills(): Promise<string[]> {
  return ["fireproof", "callai", "image-gen", "web-audio", "use-vibe"];
}
```

- [ ] **Step 4: Force-inject both docs after selection**

In `prompts/pkg/prompts.ts`, in `makeBaseSystemPrompt`, immediately AFTER the block that finalizes `selectedNames` (the `if (selectedNames.length === 0) { selectedNames = [...(await getDefaultSkills())]; }` at ~line 218-220), add:

```ts
// Gating + identity are universal, so both docs must reach EVERY assembled
// prompt — including when a caller supplies a skills list that omits them
// (a provided list bypasses the defaults above). Force-add and dedup.
for (const required of ["use-vibe", "use-viewer"]) {
  if (llmsCatalogNames.has(required) && !selectedNames.includes(required)) {
    selectedNames.push(required);
  }
}
```

(`llmsCatalogNames` is already in scope from earlier in the function.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS. Both docs and imports now appear regardless of the supplied skills list.

- [ ] **Step 6: Commit**

```bash
git add prompts/pkg/prompts.ts prompts/tests/prompt-builder.test.ts
git commit -m "feat(prompts): force-inject use-vibe + use-viewer into every assembled prompt"
```

---

## Task 3: Rewrite the main gating rule + scaffold guidance (`system-prompt.md` + `system-prompt-initial.md`)

**Files:**

- Modify: `prompts/pkg/system-prompt.md` (line 20 rule; lines 52-53, 56 scaffold)
- Modify: `prompts/pkg/system-prompt-initial.md` (line 20 rule; lines 44, 50 scaffold)
- Test: `prompts/tests/prompt-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the describe block (reuse the default-path `makeBaseSystemPrompt` call — no `skills`, just the test-mode options/mock the sibling test uses):

```ts
it("assembled default prompt teaches useVibe().can and drops the viewer gate", async () => {
  const result = await makeBaseSystemPrompt("test-model", { fetch: mockFetch } as never);
  expect(result.systemPrompt).toContain("useVibe(");
  expect(result.systemPrompt).toContain("can.create");
  expect(result.systemPrompt).not.toContain("Gate write surfaces on `viewer`");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: FAIL — the assembled prompt still contains "Gate write surfaces on `viewer`" and not the useVibe rule.

- [ ] **Step 3: Replace the main rule in `system-prompt.md`**

In `prompts/pkg/system-prompt.md`, replace the entire line-20 bullet (the one beginning "Access control is decided by the runtime…**Gate write surfaces on `viewer`**…See use-viewer docs.") with THE RULE block verbatim from the "Canonical artifacts" section above.

- [ ] **Step 4: Replace the same rule in `system-prompt-initial.md`**

`system-prompt-initial.md` line 20 is the identical bullet. Replace it with the same THE RULE block.

- [ ] **Step 5: Update the scaffold guidance**

In `system-prompt.md`:

- Line 52 (`- `useViewer`destructured at the top of`App()`when identity is needed —`const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();``) → keep `useViewer` for identity but reframe and add the gate hook:
  ```
  - When a write surface needs gating, destructure `useVibe` for the database it writes to — `const { can, ready } = useVibe("<dbName>");` — and `useViewer` for identity — `const { ViewerTag } = useViewer();`
  ```
- Line 53 (`- NO hooks beyond `useViewer`, NO data wiring …`) →
  ```
  - NO hooks beyond `useVibe`/`useViewer`, NO data wiring — those land in the feature edits
  ```
- Line 56 (`**If the app needs an `access.js`, emit it right after the shell.** … destructure `access`and gate with`access.hasRole()`/`access.hasChannel()` from the start.`) → replace the trailing gating clause:
  ```
  **If the app needs an `access.js`, emit it right after the shell.** Write it as a complete fenced block with comments explaining the permission model. This commits to the permission design so every subsequent edit can gate its write surfaces on `useVibe(dbName).can` — the same rules the access function enforces.
  ```

In `system-prompt-initial.md`:

- Line 44 (`- `useViewer`destructured at the top of`App()`—`const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();`) → same reframing as system-prompt.md line 52 above.
- Line 46 (`- NO hooks beyond `useViewer` …`) → `- NO hooks beyond `useVibe`/`useViewer` …` (same as line 53 above).
- Line 50 (`**Step 2 — Access function (if needed).** … gate with `access.hasRole()`/`access.hasChannel()` from the start.`) → replace the trailing gating clause with the `useVibe(dbName).can` phrasing (same shape as system-prompt.md line 56 above).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS — `useVibe(` and `can.create` present, "Gate write surfaces on `viewer`" gone.

- [ ] **Step 7: Commit**

```bash
git add prompts/pkg/system-prompt.md prompts/pkg/system-prompt-initial.md prompts/tests/prompt-builder.test.ts
git commit -m "feat(prompts): flip the main gating rule + scaffold guidance to useVibe().can"
```

---

## Task 4: Flip the worked example (`system-prompt.md` Crew Board)

**Files:**

- Modify: `prompts/pkg/system-prompt.md` (lines ~328, 342, 405-406, 418, 424, 431-433)

This task has no new test — Task 7's regression test + the spec reviewer enforce it. The goal: the streamed example demonstrates `useVibe().can`, not `if (!viewer)` / `access.hasChannel()`. Keep the `access.js` block (lines 380-395) unchanged — that is server-side authoring code, exactly what `can.*` runs.

- [ ] **Step 1: Update the App scaffold destructure (line 328)**

```jsx
const { ViewerTag } = useViewer();
```

(was `const { viewer, isOwner, ViewerTag } = useViewer();` — the example app no longer gates on `viewer`/`isOwner`.)

- [ ] **Step 2: Update the prose at line 342**

Replace:

```
Keep the `useViewer` destructure on `App`'s first line whenever `useViewer` is in the imports — later edits will reach for `viewer`, `isOwner`, and `ViewerTag` and need them already in scope.
```

with:

```
Keep `useViewer` (for `ViewerTag`) on `App`'s first line, and add `useVibe(dbName)` in the feature components that gate writes — `can`/`ready` are read where the write surface lives, not hoisted to `App`.
```

- [ ] **Step 3: Update the streamed-output Crew Board `App` block (lines 360-370)**

In the fenced example, change the `App` destructure line:

```jsx
>   const { ViewerTag } = useViewer()
```

(was `const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer()`.) Remove the `if (isViewerPending) return null` line (line 363) — identity-pending is handled per-surface via `useVibe`'s `ready` now. Keep the header `<ViewerTag />`.

- [ ] **Step 4: Update the Compose feature edit (lines 424, 431-433)**

Replace the prose line 424:

```
> Wire the compose box — gated on can.create for the posts db.
```

Replace the Compose component body (lines 431-434):

```jsx
> function Compose({ channel, database, c }) {
>   const { can, ready } = useVibe("crewBoard")
>   if (!ready) return <div className={c.skeleton} />
>   const v = can.create({ type: "post", channelId: channel })
>   if (!v.ok) return <p className={c.muted}>{v.reason}</p>
>   // ... compose form stamping authorHandle
> }
```

(`crewBoard` matches the access-fn export name in the example's `access.js`.)

- [ ] **Step 5: Update Channels/Feed signatures (lines 405-406, 418)**

- Line 405-406 (`function Channels({ channels, active, setActive, isOwner, database, c })` … `// ... channel list + owner add form, gated on isOwner`) → drop `isOwner` from the params and gate the add-form on `can`:
  ```jsx
  > function Channels({ channels, active, setActive, database, c }) {
  >   const { can } = useVibe("crewBoard")
  >   // ... channel list; show the add-channel form only when can.create({ type: "channel" }).ok
  > }
  ```
- Line 418 (`function Feed({ channel, useLiveQuery, isOwner, ViewerTag, database, c })`) → drop `isOwner` (the feed renders posts + `ViewerTag`, no gate):

  ```jsx
  > function Feed({ channel, useLiveQuery, ViewerTag, database, c }) {
  ```

- [ ] **Step 6: Verify the assembled prompt is still coherent**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS (existing assertions still hold; nothing in this task should regress them).

- [ ] **Step 7: Commit**

```bash
git add prompts/pkg/system-prompt.md
git commit -m "feat(prompts): flip the Crew Board worked example to useVibe().can gating"
```

---

## Task 5: Rewrite gating in `fireproof.md`, `use-viewer.md`, and `notes/vibes-app-jsx.md`

**Files:**

- Modify: `prompts/pkg/llms/fireproof.md` (lines ~336-338, 368-378, 384, 387)
- Modify: `prompts/pkg/llms/use-viewer.md` (lines 3, 5, 40, 157)
- Modify: `notes/vibes-app-jsx.md` (lines ~110-152)

- [ ] **Step 1: `fireproof.md` — flip the write-gating summary (line 387)**

Replace the line:

```
- **Write surfaces** are gated with `viewer` (signed in?), `access.hasChannel()` (channel access), or `isOwner` (management).
```

with:

```
- **Write surfaces** are gated with `useVibe(dbName).can.create/edit/delete` — it runs this same access function, so the UI verdict matches the server. Render `.reason` when denied. (See use-vibe docs.)
```

- [ ] **Step 2: `fireproof.md` — reframe the `access` object as available-but-not-the-gate (lines 336-338, 368-378)**

The `access` object docs (line 336: "`useFireproof()` returns an `access` property…") and the `Comments` example (lines 368-378 using `access.hasRole("poster")` etc.) currently teach `access.*` AS the UI write gate. Reframe so `access` is documented as an available read-only reflection but the **write gate is `useVibe().can`**:

- Keep the `access` object description (it's a real API), but change the example at 368-370 so write surfaces gate on `useVibe(...).can.*` and only non-gating reflection (e.g. showing a role badge) uses `access.hasRole`. Replace the lines 368-370 example:
  ```jsx
  {
    /* gate writes with useVibe().can, not access.* */
  }
  {
    useVibe("comments").can.create({ type: "comment" }).ok && <CommentForm database={database} />;
  }
  {
    access.hasRole("moderator") && <ModeratorBadge />;
  }
  ```
- In the summary lines 374-378 (the prose that says "gate with `access.hasChannel(name)` and `access.hasRole(name)`"), change "gate with" to "reflect roles/channels with" and add: "Gate write surfaces with `useVibe(dbName).can`, which runs this access function."
- Line 384 (`- **Owner bootstrap:** `user.isOwner` gates management operations…`) — this sentence is about the **access.js** `user.isOwner` (server-side), which is correct and stays. Leave it. (Do not confuse it with client UI gating.)

- [ ] **Step 2b: Run prompts test after the fireproof edits**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS — assembled prompt no longer contains "Write surfaces are gated with `viewer`".

- [ ] **Step 3: `use-viewer.md` — trim gating to identity-only**

- Line 3 (the "read-only window into runtime-managed access control" framing) — keep, but it's now about identity. Adjust the second sentence to remove the access-control gating implication; focus on identity/display.
- Line 5 (the contract: "**every write surface … must check `viewer`** … gate further with `access.hasRole()`…") → replace with:
  ```
  Use `useViewer()` for identity and display only — `ViewerTag`, avatars, and showing who's signed in. **Write surfaces are gated with `useVibe(dbName).can`** (see use-vibe docs), not with `viewer`/`isOwner`/`access.*`.
  ```
- Line 40 (`- `can(action, dbName?)`—`true`/`false`… In most apps`viewer`and`access.hasRole()`/`access.hasChannel()` are the right gates instead.`) → replace the trailing sentence:
  ```
  - `can(action, dbName?)` — legacy ACL boolean for `"read"`/`"write"`/`"delete"`. Prefer `useVibe(dbName).can.create/edit/delete` for write gating; it runs the app's access function and returns a `reason`.
  ```
- Line 157 (`- For per-database permissions (roles and channels), use `access`from`useFireproof()`…`) → reframe: `access` reflects roles/channels for display; write gating is `useVibe().can`.

- [ ] **Step 4: `notes/vibes-app-jsx.md` — flip the identity/capabilities section (lines 110-152)**

This author-facing guide's "Identity & capabilities (`useViewer`)" section teaches `useViewer().can(action)` and `access.hasChannel`. Update:

- Line 115 (`const { viewer, can } = useViewer();`) and line 119 (the `can(action, dbName?)` description) → present `useVibe(dbName).can.create/edit/delete` as the write gate; keep `useViewer` for `viewer`/`ViewerTag` identity.
- Lines 127-135 and 152 (the `access.hasChannel(name)` channel-filter example and `const { viewer, can } = useViewer()`) → gate write surfaces on `useVibe().can`; channel/role _reflection_ for display can still mention `access.hasChannel`, but it is not the write gate.

Preserve the `authorHandle` stamping guidance (line 121) verbatim — identity attribution is unchanged.

- [ ] **Step 5: Run prompts tests**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS. (`notes/vibes-app-jsx.md` is not assembled into the system prompt, so it won't show in these assertions — it's covered by the spec reviewer; `use-viewer.md` and `fireproof.md` ARE assembled and covered by Task 7's regression strings.)

- [ ] **Step 6: Commit**

```bash
git add prompts/pkg/llms/fireproof.md prompts/pkg/llms/use-viewer.md notes/vibes-app-jsx.md
git commit -m "feat(prompts): flip fireproof/use-viewer/notes gating guidance to useVibe().can"
```

---

## Task 6: Update the pre-allocation vocabulary in `prompts.ts`

**Files:**

- Modify: `prompts/pkg/prompts.ts` (PRE_ALLOC_PLATFORM_PARAGRAPH ~line 50; enrichment sentences ~line 125, ~141 comment)
- Test: `prompts/tests/prompt-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the describe block:

```ts
it("pre-allocation vocabulary no longer teaches useViewer().can('write')", async () => {
  const result = await makeBaseSystemPrompt("test-model", { fetch: mockFetch } as never);
  expect(result.systemPrompt).not.toContain("useViewer().can('write')");
});
```

(If `useViewer().can('write')` lives only in the pre-alloc paragraph / enrichment strings that don't flow into `makeBaseSystemPrompt`'s output, this assertion may already pass; in that case keep the assertion as a guard and verify the string is gone from the file directly — `grep -n "can('write')" prompts/pkg/prompts.ts` returns nothing after Step 3.)

- [ ] **Step 2: Run test to verify it fails (or confirm via grep)**

Run: `cd prompts && pnpm test -- prompt-builder` and `grep -n "can('write')" prompts/pkg/prompts.ts`
Expected: the grep currently shows the string at ~line 50 and ~141.

- [ ] **Step 3: Update the vocabulary**

In `prompts/pkg/prompts.ts`:

- Line ~50 (`PRE_ALLOC_PLATFORM_PARAGRAPH`), replace the `useViewer` clause:
  ```
  useViewer surfaces the signed-in viewer's identity for display (avatars, who's posting). Write surfaces are gated with `useVibe(dbName).can`, which runs the app's own access function and tells the UI whether a create/edit/delete is allowed — the app reflects that verdict, it never sets it.
  ```
- Line ~125 (the enrichment "Sentence 3" instruction naming write actions and "useViewer reflects that verdict") → change "useViewer reflects that verdict" to "useVibe().can reflects that verdict (and useViewer shows identity)".
- Line ~141 (the comment mentioning `useViewer` import and `can("write")` defaulting to false) → update the comment to reference `useVibe`/`use-vibe` skill injection (cosmetic; keep it accurate to the new force-inject behavior).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd prompts && pnpm test -- prompt-builder` and `grep -n "can('write')" prompts/pkg/prompts.ts`
Expected: test PASS; grep returns nothing.

- [ ] **Step 5: Commit**

```bash
git add prompts/pkg/prompts.ts prompts/tests/prompt-builder.test.ts
git commit -m "feat(prompts): replace useViewer().can('write') vocabulary with useVibe().can"
```

---

## Task 7: Regression guard + full gate + PR

**Files:**

- Test: `prompts/tests/prompt-builder.test.ts`

- [ ] **Step 1: Write the retired-strings regression test**

Append inside the describe block — one test asserting ALL retired strings are gone from the assembled default prompt (this is the cross-file safety net; `fireproof.md` and `use-viewer.md` are injected, so this catches any that slipped through):

```ts
it("assembled default prompt contains none of the retired gating phrasings", async () => {
  const result = await makeBaseSystemPrompt("test-model", { fetch: mockFetch } as never);
  for (const retired of ["Gate write surfaces on `viewer`", "useViewer().can('write')", "Write surfaces are gated with `viewer`"]) {
    expect(result.systemPrompt).not.toContain(retired);
  }
  // And the new surface is present:
  expect(result.systemPrompt).toContain("useVibe(");
  expect(result.systemPrompt).toContain(".reason");
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd prompts && pnpm test -- prompt-builder`
Expected: PASS (all prior tasks together satisfy it). If any retired string remains, fix the offending file (it points directly at the doc that still teaches the old gate).

- [ ] **Step 3: Full CI-faithful gate**

Run from repo root: `pnpm build && pnpm lint && pnpm format:check && pnpm test`
Expected: PASS. If `format:check` flags any edited `.md`/`.ts`, run `pnpm exec prettier --write <files>` and amend.

- [ ] **Step 4: Commit + push + PR**

```bash
git add prompts/tests/prompt-builder.test.ts
git commit -m "test(prompts): regression guard that retired gating phrasings are gone"
git push -u origin claude/usevibe-prompt-flip-slice4-impl
```

Open a ready-for-review PR titled "Plan A · slice 4 (impl): prompt flip to useVibe().can", label `agent-created`, @-mention `@CharlieHelps`, subscribe, and drive feedback → `ready-to-merge` per the repo's PR lifecycle.

---

## Self-Review

**Spec coverage:**

- New `use-vibe.md` doc + `use-vibe.ts` config + `allConfigs` registration → Task 1. ✅
- Force-inject `use-vibe` + `use-viewer` (since a provided skills list bypasses defaults) + `getDefaultSkills` → Task 2. ✅
- `fireproof.md` gating flip (always-injected; preserve access.js server code + `access` API) → Task 5. ✅
- `system-prompt.md` rule + scaffold + worked examples → Tasks 3, 4. ✅
- `system-prompt-initial.md` rule + scaffold → Task 3. ✅
- `prompts.ts` `useViewer().can('write')` vocabulary → Task 6. ✅
- `use-viewer.md` trim to identity + pointer → Task 5. ✅
- `notes/vibes-app-jsx.md` align → Task 5. ✅
- Test approach (assembled prompt: new rule present, both docs injected on default + provided-skills paths, retired strings gone; `useVibeConfig` in catalog) → Tasks 1, 2, 3, 6, 7. ✅
- `can.*` everywhere / `isOwner` display-only; reads ungated; unknown→optimistic invisible → encoded in THE RULE + use-vibe.md content. ✅
- Optional golden-generation check — explicitly deferred in spec; no task (correct). ✅

**Placeholder scan:** THE RULE and use-vibe.md are verbatim; existing-doc edits give exact old anchors + exact new text. The few "match the file's existing import" / "reuse the sibling test's mock" notes are concrete lookups with named targets, not placeholders. ✅

**Type/string consistency:** config name `use-vibe` and label `Vibe Write Gating` are used identically in Task 1 (config), Task 2 (force-inject list + `Vibe Write Gating-docs>` assertion), and Task 7. Import strings `import { useVibe } from "use-vibes"` consistent. Retired-string literals identical across Task 3/6/7 and the Canonical-artifacts list. ✅
