# QR Code Restore in Vibe Switch Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a QR button to the `ExpandedVibesPill` sub-menu that pre-draws a QR code for the current `/vibe/` URL when the sub-menu opens, then displays it when the user clicks the QR button.

**Architecture:** The `ExpandedVibesPill` in `vibes.diy/base/components/ExpandedVibesPill.tsx` already has a "Vibe" button that opens a vertical sub-menu (`subMode === "change"`) with Edit and Clone. We add a QR button there. When `subMode` flips to `"change"`, a `useEffect` generates the QR data URI client-side using `qrcode` and stores it in state. Clicking the QR button toggles a `showQr` state that replaces the button list with the QR image.

**Tech Stack:** React 19, TypeScript, `qrcode` npm package (MIT, browser-compatible `toDataURL()` API).

---

## File map

| File | Change |
|------|--------|
| `vibes.diy/base/package.json` | Add `qrcode` + `@types/qrcode` deps |
| `vibes.diy/base/components/ExpandedVibesPill.tsx` | Add `qrDataUri`/`showQr` state, QR generation effect, QR button, QR display |

---

### Task 1: Set up worktree on a topic branch

- [ ] **Step 1: Create topic branch and worktree**

  ```bash
  git worktree add .worktrees/qr-restore-1765 -b jchris/qr-restore-1765
  cd .worktrees/qr-restore-1765
  ```

- [ ] **Step 2: Verify you're on the right branch**

  ```bash
  git branch --show-current
  ```
  Expected output: `jchris/qr-restore-1765`

---

### Task 2: Add `qrcode` dependency

**Files:**
- Modify: `vibes.diy/base/package.json`

- [ ] **Step 1: Add deps to `vibes.diy/base/package.json`**

  In the `"dependencies"` object add:
  ```json
  "qrcode": "^1.5.4"
  ```
  In the `"devDependencies"` object add:
  ```json
  "@types/qrcode": "^1.5.5"
  ```

- [ ] **Step 2: Install from repo root**

  ```bash
  pnpm install
  ```
  Expected: installs without errors, `pnpm-lock.yaml` updated.

---

### Task 3: Add QR state and generation to `ExpandedVibesPill`

**Files:**
- Modify: `vibes.diy/base/components/ExpandedVibesPill.tsx`

- [ ] **Step 1: Add the `qrcode` import at the top of the file**

  After the existing imports, add:
  ```ts
  import QRCode from "qrcode";
  ```

- [ ] **Step 2: Add `qrDataUri` and `showQr` state inside `ExpandedVibesPill`**

  After the existing state declarations (after `const [isWide, setIsWide] = useState(true);`), add:
  ```ts
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  ```

- [ ] **Step 3: Add QR generation effect**

  After the `isWide` useEffect block, add:
  ```ts
  useEffect(() => {
    if (subMode !== "change" || typeof window === "undefined") return;
    QRCode.toDataURL(window.location.href, { width: 200, margin: 2 }).then(setQrDataUri);
  }, [subMode]);
  ```

- [ ] **Step 4: Reset `showQr` when sub-menu closes**

  In the existing `useEffect` that watches `phase` (the one with `if (phase === "idle") setSubMode("default")`), add the reset:
  ```ts
  if (phase === "idle") {
    setSubMode("default");
    setShowQr(false);
  }
  ```

  The existing line reads:
  ```ts
  if (phase === "idle") setSubMode("default");
  ```
  Change it to:
  ```ts
  if (phase === "idle") { setSubMode("default"); setShowQr(false); }
  ```

- [ ] **Step 5: Add QR button and display in the vertical sub-menu**

  The vertical sub-menu `<div>` ends after the `remixHref &&` block (around line 710). Inside the sub-menu `<div>` (after the last `VerticalActionButton`), replace the closing `</div>` of the sub-menu with:

  ```tsx
        {/* QR code button — always shown when sub-menu is open */}
        <VerticalActionButton
          height={height}
          label="QR Code"
          bgColor="var(--vibes-cream, #FFFEF0)"
          labelColor="var(--vibes-near-black, #1a1a1a)"
          onClick={() => setShowQr((v) => !v)}
          icon={
            <svg
              width="13"
              height="13"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h.01M14 17h.01M17 14h.01M17 17h.01M20 14h.01M20 17h.01M20 20h.01M17 20h.01M14 20h.01" />
            </svg>
          }
        />
        {showQr && qrDataUri && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "4px 0",
            }}
          >
            <img
              src={qrDataUri}
              alt="QR code for this vibe"
              width={180}
              height={180}
              style={{ borderRadius: 4, border: "1px solid var(--vibes-near-black, #1a1a1a)" }}
            />
          </div>
        )}
      </div>
  ```

  (This replaces the final `</div>` that closes the vertical sub-menu.)

---

### Task 4: Run checks and fix any issues

**Files:** none new

- [ ] **Step 1: Type-check**

  From `vibes.diy/base/`:
  ```bash
  cd vibes.diy/base && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 2: Run full pnpm check**

  From repo root:
  ```bash
  pnpm check 2>&1 | tee /tmp/qr-check.log
  grep -E "error|FAIL|✗" /tmp/qr-check.log | head -30
  ```
  Expected: no errors. If flaky tests, check `agents/flaky-tests.md`.

- [ ] **Step 3: Format changed files**

  ```bash
  npx prettier --write vibes.diy/base/package.json vibes.diy/base/components/ExpandedVibesPill.tsx
  ```

---

### Task 5: Commit and push

- [ ] **Step 1: Stage and commit the spec/plan docs (on main worktree)**

  In the main worktree:
  ```bash
  git add docs/superpowers/specs/2026-05-16-qr-code-restore-design.md docs/superpowers/plans/2026-05-16-qr-code-restore.md
  git commit -m "docs: QR code restore spec and plan for #1765"
  ```

- [ ] **Step 2: Stage and commit the feature in the worktree**

  In `.worktrees/qr-restore-1765/`:
  ```bash
  git add vibes.diy/base/package.json vibes.diy/base/components/ExpandedVibesPill.tsx pnpm-lock.yaml
  git commit -m "feat(pill): add QR code button to vibe sub-menu (#1765)"
  ```

- [ ] **Step 3: Push branch**

  ```bash
  git push -u origin jchris/qr-restore-1765
  ```

---

### Task 6: Open pull request

- [ ] **Step 1: Create PR**

  ```bash
  gh pr create \
    --title "feat(pill): restore QR code in vibe switch panel (#1765)" \
    --body "$(cat <<'EOF'
  ## Summary
  - Adds a **QR Code** button to the Vibe sub-menu in `ExpandedVibesPill`
  - QR is pre-drawn when the sub-menu opens (on `subMode === "change"`) — no flicker on select
  - Clicking QR button toggles the QR image inline below the button list
  - Uses `qrcode` npm package (MIT), generates data URI client-side in a `useEffect`

  ## Test plan
  - [ ] Open any `/vibe/{user}/{app}` page
  - [ ] Click the VIBES/DIY pill → click the yellow Vibe button → sub-menu opens
  - [ ] Verify QR Code button is visible alongside Edit/Clone
  - [ ] Click QR Code — QR image appears immediately (no loading delay)
  - [ ] Scan QR with phone — should open the same `/vibe/` URL
  - [ ] Click QR Code again — QR image hides
  - [ ] Close and reopen the panel — QR is pre-drawn on reopen, still no flicker

  Closes #1765

  🤖 Generated with [Claude Code](https://claude.ai/claude-code)
  EOF
  )"
  ```

- [ ] **Step 2: Report PR URL to user**

---

## Slack vs. real: note for post-implementation

The `pkg/slack/` directory contains a legacy CF worker ("vibes-diy-serve") with its own `vibe-controls.tsx` panel template and `vibes-controls/scripts.ts`. These are **not** served by the main `vibes-diy-v2` worker at `vibes.diy`. The live `/vibe/` route is handled by the React Router SSR app in `pkg/`, which renders `ExpandedVibesPill` from `@vibes.diy/base`. The slack worker is a separate deployment that may have served older versions of the controls; the api `vibes-control.tsx` in `api/pkg/react/components/` is commented out in `vibe-page.tsx` (which itself is only used for iframe sub-domain rendering, not the `/vibe/` route). This plan only touches `@vibes.diy/base` which is where the live feature lives.
