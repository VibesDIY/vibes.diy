# PR-B: Seamless non-owner fork on `/vibe` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a **signed-in non-owner** uses the edit affordance on `/vibe`, fork the vibe to their handle **in place** (make-it-yours) and generate their change in the new copy — no hop to `/chat`/`/remix`. The card stays mounted; the URL becomes `/vibe/$yourHandle/$forkSlug`; the iframe de-blurs into the fork as the generation streams.

**Architecture:** Reuse the existing `chatApi.forkApp` server action (the make-it-yours operation; no new backend). On a signed-in non-owner's first write, call `forkApp` inline, then `navigate(dest, {replace:true})` to the forked vibe's `/vibe` URL carrying the typed prompt as `?prompt64` (+ `yours=1`). On that forked page the viewer is now the owner, so PR-A's `useInVibeGeneration` is enabled; a small effect decodes `prompt64` and auto-fires `generation.sendPrompt` once. **Logged-out** non-owners keep the existing `/remix` hop (it already does login→fork→prompt). Owners are unchanged (PR-A in-place).

**Tech Stack:** React Router (`useNavigate`/`useSearchParams`), the `forkApp` RPC (`ResForkApp`), PR-A's `useInVibeGeneration`, `react-hot-toast`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-28-first-generation-in-place-design.md` §4 PR-B + the "Implementation guardrails (Charlie review)".

---

## Hard constraint (respect it)

A non-owner **cannot** write the owner's chat — the server rejects on `userId` mismatch (`api/svc/public/prompt-chat-section.ts`). So the fork must complete and the URL must point at the **fork** before any codegen opens. **Never** call `generation.sendPrompt` while the route still points at the owner's vibe for a non-owner.

## Charlie's guardrails (from the spec)

- **Do not open codegen until the fork returns** and its identifiers are applied. (Here: we navigate to the fork first; the auto-fire only runs once the page is the fork and `isOwner` is true.)
- **Anchor by the returned `ResForkApp` fields** (`ownerHandle`/`appSlug`/`srcFsId`), not the pre-fork route params.
- **Prefer router `navigate(dest, {replace:true})`** over raw `window.history.replaceState` for the fork navigation.

## Reference reading

- `vibes.diy/pkg/app/routes/remix.$ownerHandle.$appSlug.tsx` — the current fork flow: `chatApi.forkApp({ srcUserSlug, srcAppSlug, srcFsId, skipChat })` → navigate to `/chat/.../{srcFsId}?prompt64&yours=1`. PR-B does the fork inline and lands on `/vibe` instead.
- `vibes.diy/api/types/app.ts:280-312` — `ReqForkApp` / `ResForkApp` shapes (the contract).
- `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — `handleEditPrompt` (the non-owner branch to replace), the `generation = useInVibeGeneration({... enabled: isOwner})` instance, `isOwner`, `authSignedIn` (`useAuth().isSignedIn`), `vctx.sthis.txt.base64`, the `[searchParam] = useSearchParams()`, and `useYoursNowToast()` (already wired; fires on `yours=1`).
- `vibes.diy/pkg/app/routes/chat/prompt.tsx:34` — `sthis.txt.base64.decode(prompt64)` (the symmetric decode).

**Run tests:** `cd vibes.diy/tests/app && pnpm test <file>` (vitest run; from `tests/app`, NOT `tests`). Full gate: `pnpm check` from repo root.

---

## File Structure

- **Create** `vibes.diy/pkg/app/routes/vibe-fork.ts` — pure helper: build the forked-vibe `/vibe` destination URL from `ResForkApp` + the carried `prompt64`. One responsibility, unit-tested.
- **Modify** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — (a) `handleEditPrompt`: signed-in non-owner forks inline + navigates; logged-out keeps `/remix`; owner unchanged; (b) a new auto-fire effect that consumes `prompt64` on the forked page.
- **Create test** `vibes.diy/tests/app/vibe-fork.test.ts`.

---

## Task 1: `forkDestination` URL helper

**Files:**

- Create: `vibes.diy/pkg/app/routes/vibe-fork.ts`
- Test: `vibes.diy/tests/app/vibe-fork.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/tests/app/vibe-fork.test.ts
import { describe, it, expect } from "vitest";
import { forkDestination } from "~/vibes.diy/app/routes/vibe-fork.js";

const res = { ownerHandle: "alex", appSlug: "bloom", srcFsId: "FS-9" };

describe("forkDestination", () => {
  it("builds the forked /vibe URL with prompt64 + yours=1", () => {
    const url = forkDestination(res, "bWFrZSBpdCBibHVl");
    expect(url).toContain("/vibe/alex/bloom/FS-9");
    expect(url).toContain("prompt64=bWFrZSBpdCBibHVl");
    expect(url).toContain("yours=1");
  });

  it("omits prompt64 when none is carried", () => {
    const url = forkDestination(res, null);
    expect(url).toBe("/vibe/alex/bloom/FS-9?yours=1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm test vibe-fork`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// vibes.diy/pkg/app/routes/vibe-fork.ts
import type { ResForkApp } from "@vibes.diy/api-types";

/** Build the `/vibe` URL for a freshly-forked copy. The fork lands fsId-pinned at
 *  the source content anchor (`srcFsId`); `yours=1` triggers the one-time "it's
 *  yours now" message (#1856) on landing, and `prompt64` (when present) carries
 *  the non-owner's typed change so the forked page can auto-fire it. */
export function forkDestination(res: Pick<ResForkApp, "ownerHandle" | "appSlug" | "srcFsId">, prompt64: string | null): string {
  const params = new URLSearchParams({ yours: "1" });
  if (prompt64) params.set("prompt64", prompt64);
  return `/vibe/${res.ownerHandle}/${res.appSlug}/${res.srcFsId}?${params.toString()}`;
}
```

> If `ResForkApp` isn't exported from `@vibes.diy/api-types`, import it from where the remix route / app types expose it (`vibes.diy/api/types/app.ts` re-exported through `@vibes.diy/api-types`); or type the param structurally as `{ ownerHandle: string; appSlug: string; srcFsId: string }`. Prefer the structural type if the import is awkward.

- [ ] **Step 4: Run to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm test vibe-fork`
Expected: 2 PASS.

- [ ] **Step 5: prettier + commit**

```bash
cd /home/user/vibes.diy && npx prettier --write vibes.diy/pkg/app/routes/vibe-fork.ts vibes.diy/tests/app/vibe-fork.test.ts
git add vibes.diy/pkg/app/routes/vibe-fork.ts vibes.diy/tests/app/vibe-fork.test.ts
git commit -m "feat(vibe): forkDestination helper for the seamless non-owner fork"
```

(Authorship is configured; if a commit is flagged Unverified, `git commit --amend --no-edit --reset-author`.)

---

## Task 2: Wire the seamless inline fork + auto-fire into the `/vibe` route

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

Read the route first; the anchors below may have shifted — locate by content.

- [ ] **Step 1: Import the helper + ensure the search-param setter is available**

Add the import:

```tsx
import { forkDestination } from "./vibe-fork.js";
```

Find `const [searchParam] = useSearchParams();` and add the setter:

```tsx
const [searchParam, setSearchParam] = useSearchParams();
```

- [ ] **Step 2: Branch `handleEditPrompt` — owner in-place; signed-in non-owner forks inline; logged-out keeps `/remix`**

Replace the current `handleEditPrompt` body (owner → `generation.sendPrompt`; non-owner → `/remix`) with:

```tsx
const handleEditPrompt = useCallback(
  (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !ownerHandle || !appSlug) return;
    // Owner: generate in place (PR-A).
    if (isOwner) {
      generation.sendPrompt(trimmed);
      return;
    }
    const prompt64 = vctx.sthis.txt.base64.encode(trimmed);
    // Logged-out non-owner: keep the existing /remix hop (it handles
    // login → fork → prompt). Seamless inline fork needs a signed-in user.
    if (!authSignedIn) {
      void navigate(`/remix/${ownerHandle}/${appSlug}?${new URLSearchParams({ prompt64 }).toString()}`);
      return;
    }
    // Signed-in non-owner: make-it-yours INLINE, then land on the fork's /vibe
    // page carrying the prompt. The fork must complete (and the URL must point
    // at the fork) before any codegen opens — a non-owner can't write the
    // owner's chat. Anchor the destination on the returned ResForkApp fields.
    const tid = toast.loading("Making it yours…");
    void (async () => {
      const rFork = await vctx.chatApi.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: fsId });
      if (rFork.isErr()) {
        toast.error(`Couldn't make it yours: ${rFork.Err().message}`, { id: tid });
        return;
      }
      toast.dismiss(tid);
      notifyRecentVibesChanged();
      void navigate(forkDestination(rFork.Ok(), prompt64), { replace: true });
    })();
  },
  [isOwner, authSignedIn, ownerHandle, appSlug, fsId, navigate, vctx.sthis, vctx.chatApi, generation.sendPrompt]
);
```

Add the import for `notifyRecentVibesChanged` if not present:

```tsx
import { notifyRecentVibesChanged } from "../hooks/useRecentVibes.js";
```

(Check the route's existing imports first — `toast` from `react-hot-toast` is already imported.)

- [ ] **Step 3: Auto-fire the carried prompt on the forked page**

After `generation` is instantiated and `isOwner` is known, add an effect that fires the carried prompt exactly once — only once the page is the user's fork (`isOwner` true) so we never send against the owner's session:

```tsx
// On the forked /vibe page (?prompt64 carried from a seamless non-owner fork),
// auto-fire the generation once ownership resolves to us. Guarded by a ref +
// scrubbed from the URL so a refresh or re-render doesn't re-fire. (#2677 PR-B)
const autoFiredRef = useRef(false);
useEffect(() => {
  if (autoFiredRef.current) return;
  const p64 = searchParam.get("prompt64");
  if (!p64 || !isOwner) return;
  autoFiredRef.current = true;
  generation.sendPrompt(vctx.sthis.txt.base64.decode(p64));
  const next = new URLSearchParams(searchParam);
  next.delete("prompt64");
  setSearchParam(next, { replace: true });
}, [isOwner, searchParam, setSearchParam, generation.sendPrompt, vctx.sthis]);
```

> Why this is safe against the owner's session: `generation` is `enabled: isOwner`, and this effect only fires when `isOwner` is true — i.e. the page is already the user's own fork. On the source (owner's) vibe a non-owner has `isOwner === false`, so this never fires there. The hook's slug-keyed reset (PR-A) already cleared the prior vibe's state on the navigation.

- [ ] **Step 4: Typecheck + run the route tests**

1. Typecheck: `cd vibes.diy/pkg && npx tsc --noEmit -p tsconfig.json` (or the package's `build`/`typecheck` script — check `vibes.diy/pkg/package.json`). Fix any type errors (e.g. `forkApp`'s arg/return names, the `Result` `.isErr()`/`.Ok()`/`.Err()` API as used in the remix route).
2. `cd vibes.diy/tests/app && pnpm test vibe` — confirm the existing vibe-route suite stays green.
3. prettier: `cd /home/user/vibes.diy && npx prettier --write` on the route file.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx
git commit -m "feat(vibe): seamless non-owner fork — make-it-yours in place, auto-fire on the copy"
```

---

## Task 3: Verify + blog seed + PR

- [ ] **Step 1: Full gate**

Run `pnpm check` from repo root (build + lint + test). Fix anything it surfaces. NOTE: `pnpm check` chains with `&&`; if you wrap it, capture the real exit (a trailing `; echo` masks failure). Rerun flaky suites per `agents/flaky-tests.md` before treating a failure as real.

- [ ] **Step 2: Blog seed**

Create `notes/blog-seeds/2026-06-28-nonowner-fork.md`: the seam (reuse `forkApp`, land on `/vibe` not `/chat`), the hard constraint (fork before codegen — the URL must be the fork first), the auto-fire-via-prompt64 mechanism, and the signed-in-only scoping (logged-out keeps `/remix`).

- [ ] **Step 3: Push + PR**

```bash
git push -u origin claude/in-vibe-nonowner-fork
```

Open a PR (ready, not draft) titled "Seamless non-owner fork on /vibe (#2677 PR-B)". Body: the inline make-it-yours, the auto-fire, the hard-constraint compliance, and the **signed-in-only scoping** (call it out for review — logged-out non-owners still use `/remix`; seamless logged-out fork is a possible follow-up). Label `agent-created`; comment @-mentioning `@CharlieHelps`; subscribe; apply feedback autonomously; `ready-to-merge` when CI green.

---

## Self-review notes (coverage)

- **Spec §4 PR-B (fork before codegen, replaceState, never the owner's chat):** Task 2 Steps 2-3 — fork completes + URL is the fork before the auto-fire, which is gated on `isOwner`.
- **Charlie's guardrails:** `navigate(replace:true)` (not raw history), anchor by `ResForkApp` fields (Task 1 helper consumes them), don't open codegen until fork returns (auto-fire gated on `isOwner` of the fork).
- **#1856 "it's yours now":** `yours=1` → existing `useYoursNowToast`. (An in-card "It's yours now" banner like sketch `16-non-owner-fork` is a nicer treatment — left as a polish follow-up; PR-B uses the existing toast.)
- **Out of scope:** logged-out seamless fork (keeps `/remix`); the cached lane (PR-C); the in-card fork banner.
- **Risk to watch:** the auto-fire timing — `isOwner` resolves async after navigation; the effect fires when it flips true and the hook (enabled on `isOwner`) has opened the chat. `useChatSession` queues `promptToSend` until the chat opens, so an early `sendPrompt` is safe. Verify on the preview that the forked page actually streams the change.
