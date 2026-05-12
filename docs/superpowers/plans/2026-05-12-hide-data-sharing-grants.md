# Hide Data Sharing Grants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the "Data Sharing Grants" section from `/settings` by commenting out the rendering code, the helper function, and the unused imports — without deleting anything — so the section can be restored later.

**Architecture:** Single-file edit in [`vibes.diy/pkg/app/routes/settings.tsx`](../../../vibes.diy/pkg/app/routes/settings.tsx). Wrap the relevant JSX in a JSX comment, wrap the `GrantsList` function definition in a block comment, remove two now-unused imports (leaving a reminder comment), and update the layout subtitle to drop the "and data sharing" phrase.

**Tech Stack:** TypeScript, React, React Router, project lint/format/test pipeline run via `pnpm check`.

**Spec:** [docs/superpowers/specs/2026-05-12-hide-data-sharing-grants-design.md](../specs/2026-05-12-hide-data-sharing-grants-design.md)

---

## File Structure

Only one file is touched. No new files, no test files.

| File | Status | Responsibility |
|------|--------|----------------|
| [`vibes.diy/pkg/app/routes/settings.tsx`](../../../vibes.diy/pkg/app/routes/settings.tsx) | Modify | Renders the `/settings` route. After this plan: hides the Data Sharing Grants card and updates the subtitle. |

There are no test files to modify — confirmed via `grep -rn "GrantsList\|Data Sharing Grants" vibes.diy` that no test references the symbol or heading. We will verify the absence of the section by running the existing checks (`pnpm check`) and manually loading `/settings` in the dev server.

---

## Task 1: Hide the Data Sharing Grants card in the rendered output

**Files:**
- Modify: `vibes.diy/pkg/app/routes/settings.tsx` (the `<BrutalistCard>` block currently around lines 603-609 inside `SettingsContent`)

- [ ] **Step 1: Confirm current state**

Run: `grep -n "Data Sharing Grants" vibes.diy/pkg/app/routes/settings.tsx`

Expected: exactly one match, on the `<h3>` line inside `SettingsContent`. If the grep returns zero matches, stop — the file has already been edited and this plan does not apply.

- [ ] **Step 2: Wrap the Data Sharing Grants `<BrutalistCard>` in a JSX comment**

In `vibes.diy/pkg/app/routes/settings.tsx`, locate this exact block inside the `SettingsContent` function:

```tsx
      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Data Sharing Grants</h3>
        <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
          Apps that have been allowed or denied access to share your data
        </p>
        <GrantsList />
      </BrutalistCard>
```

Replace it with this JSX comment wrapping the identical content (every original line preserved verbatim inside the comment):

```tsx
      {/* Hidden per VibesDIY/vibes.diy#1692 — restore by uncommenting and reinstating the GrantsList function and imports.
      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Data Sharing Grants</h3>
        <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
          Apps that have been allowed or denied access to share your data
        </p>
        <GrantsList />
      </BrutalistCard>
      */}
```

Notes:
- The `{/* ... */}` wrapper is a JSX expression containing a JS block comment — required because plain HTML comments (`<!-- -->`) are not valid JSX.
- Do not touch the surrounding cards (`UserSlugsCard`, `ProfileCard`, `ModelDefaultsCard`, Security, Account).
- Surrounding indentation must remain consistent with the other cards (6 spaces matching the existing block).

- [ ] **Step 3: Update the BrutalistLayout subtitle**

In the same file, locate this line inside `SettingsContent`:

```tsx
    <BrutalistLayout title="Settings" subtitle="Manage your account and data sharing">
```

Replace with:

```tsx
    <BrutalistLayout title="Settings" subtitle="Manage your account">
```

Do not add a comment — the old wording is preserved in git history.

- [ ] **Step 4: Verify build still type-checks (expect a known-failing state for unused symbols)**

Run: `cd vibes.diy && pnpm tsc --noEmit -p tsconfig.json 2>&1 | head -40` (or whatever the project's typecheck entry point is — `pnpm check` will exercise the full pipeline in Task 4).

Expected: at this intermediate point, type-checking may pass even though `GrantsList`, `isUserSettingSharing`, and `SharingGrantItem` are now technically still referenced (the JSX comment text doesn't count as a reference because it's inside a comment). If lint flags `GrantsList`/the two imports as unused at this stage, that's expected — Task 2 and Task 3 remove the unused references. Proceed regardless.

If type-checking reports errors that are NOT about unused symbols and NOT about `GrantsList`/`isUserSettingSharing`/`SharingGrantItem`, stop and investigate — something else broke.

- [ ] **Step 5: Do NOT commit yet**

Leaving the file half-edited would leave unused-symbol warnings in the tree. The commit happens after Task 3 so a single coherent commit captures the whole hide.

---

## Task 2: Comment out the now-unused `GrantsList` function

**Files:**
- Modify: `vibes.diy/pkg/app/routes/settings.tsx` (the `function GrantsList()` definition currently around lines 25-112)

- [ ] **Step 1: Wrap the `GrantsList` function in a block comment**

In `vibes.diy/pkg/app/routes/settings.tsx`, locate the `function GrantsList()` declaration. The function spans from `function GrantsList() {` through the closing `}` of the function — currently lines 25 through 112. (Line numbers may have shifted by one or two after Task 1's edits; locate by name, not by number.)

Wrap the entire function (every line from `function GrantsList() {` through its matching closing brace `}` on the line by itself) in a JavaScript block comment so it looks like:

```tsx
/* Hidden per VibesDIY/vibes.diy#1692 — restore alongside the JSX block in SettingsContent and the imports below.
function GrantsList() {
  const { vibeDiyApi } = useVibesDiy();
  // ... entire original function body preserved verbatim ...
}
*/
```

Every line of the original function body must be preserved verbatim inside the comment. Do not edit, reformat, or trim any line of the function — only add the `/*` line before and `*/` line after.

The next function in the file (`function UserSlugsCard()`) must remain a top-level declaration and start on its own line right after the closing `*/`.

- [ ] **Step 2: Verify the file still parses**

Run: `cd vibes.diy && pnpm tsc --noEmit -p tsconfig.json 2>&1 | head -40`

Expected: no parse errors. There may still be unused-import warnings for `isUserSettingSharing` and `SharingGrantItem` — Task 3 fixes those.

- [ ] **Step 3: Do NOT commit yet**

---

## Task 3: Remove the two unused imports and the subtitle finalization

**Files:**
- Modify: `vibes.diy/pkg/app/routes/settings.tsx` (import statements at the top of the file, currently lines 8-17)

- [ ] **Step 1: Remove `isUserSettingSharing` from the named-value import**

Locate the named-value import from `@vibes.diy/api-types` near the top of the file:

```tsx
import {
  isUserSettingSharing,
  isUserSettingDefaultUserSlug,
  isUserSettingModelDefaults,
  isUserSettingProfile,
  isResAssetUploadGrant,
  parseArray,
  userSettingModelDefaults,
} from "@vibes.diy/api-types";
```

Remove the `isUserSettingSharing,` line so the import becomes:

```tsx
import {
  isUserSettingDefaultUserSlug,
  isUserSettingModelDefaults,
  isUserSettingProfile,
  isResAssetUploadGrant,
  parseArray,
  userSettingModelDefaults,
} from "@vibes.diy/api-types";
```

- [ ] **Step 2: Remove `SharingGrantItem` from the type-only import**

Locate this line just below:

```tsx
import type { SharingGrantItem, AIParams, UserSettingProfile } from "@vibes.diy/api-types";
```

Replace with:

```tsx
import type { AIParams, UserSettingProfile } from "@vibes.diy/api-types";
```

- [ ] **Step 3: Add a single-line reminder comment directly above the two import statements**

Insert this line directly above the `import {` line from Step 1 (so the comment sits above both `@vibes.diy/api-types` imports):

```tsx
// To restore GrantsList: re-add `isUserSettingSharing` to the named import and `SharingGrantItem` to the type import below.
```

The resulting top-of-file region should read:

```tsx
import { useVibesDiy } from "../vibes-diy-provider.js";
// To restore GrantsList: re-add `isUserSettingSharing` to the named import and `SharingGrantItem` to the type import below.
import {
  isUserSettingDefaultUserSlug,
  isUserSettingModelDefaults,
  isUserSettingProfile,
  isResAssetUploadGrant,
  parseArray,
  userSettingModelDefaults,
} from "@vibes.diy/api-types";
import type { AIParams, UserSettingProfile } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
```

- [ ] **Step 4: Run the full project check**

From the repo root (the worktree root), run:

```bash
pnpm check
```

Expected: pass. `pnpm check` runs format + build + test + lint per [CLAUDE.md](../../../CLAUDE.md) and [agents/code-quality.md](../../../agents/code-quality.md). If any test or lint failure appears:

- If it mentions `GrantsList`, `isUserSettingSharing`, `SharingGrantItem`, or "Data Sharing Grants" — revisit the previous tasks; you missed an unused-symbol cleanup or a reference somewhere else.
- If it's unrelated to this change, check [agents/flaky-tests.md](../../../agents/flaky-tests.md) — rerun the suite once before treating it as real.

- [ ] **Step 5: Manually verify the rendered UI**

Start the dev server (use whatever command the project README/[agents/environments.md](../../../agents/environments.md) describes — typically `pnpm dev` from the repo root or `cd vibes.diy && pnpm dev`). Sign in, visit `/settings`, and confirm:

- The "Data Sharing Grants" card does NOT render.
- The page subtitle reads "Manage your account" (no "and data sharing").
- The User Slugs, Profile, Default Models, Security, and Account cards all render and function normally.

If you cannot run the dev server (e.g., no local dev credentials), say so explicitly in the task report rather than claiming success — per [CLAUDE.md](../../../CLAUDE.md) the rule is "if you can't test the UI, say so explicitly rather than claiming success."

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/routes/settings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): hide data sharing grants section (#1692)

Comment out the Data Sharing Grants card, the GrantsList helper, and
the two imports it relied on, and drop "and data sharing" from the
settings page subtitle. The code remains in place as comments so the
section can be restored later by reversing the diff.
EOF
)"
```

Run `git status` afterward to confirm a clean tree.

---

## Self-Review Notes

- **Spec coverage:** All four spec changes (JSX block comment, `GrantsList` function comment, unused-import removal with reminder, subtitle update) are implemented across Tasks 1-3. The verification section of the spec (`pnpm check` + manual `/settings` check) is covered in Task 3 Steps 4-5. The "restoration path" of the spec is preserved through the reminder comment in Task 3 Step 3 and the inline `Hidden per ... — restore by ...` comments in Tasks 1 and 2.
- **Placeholder scan:** No TBDs, no "implement later", every code block contains the literal text to write. The single concrete commit happens at the end of Task 3, capturing the entire hide as one logical change.
- **Type/symbol consistency:** Symbol names used throughout — `GrantsList`, `isUserSettingSharing`, `SharingGrantItem`, `BrutalistLayout`, `BrutalistCard` — match the file exactly as read above.
