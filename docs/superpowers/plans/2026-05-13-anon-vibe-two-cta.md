# Anon Vibe page two-CTA landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Edit/Clone/Remix on `/vibe/:userHandle/:appSlug` for non-public viewers with two CTAs — **Install your own copy** (clone API) and **Join** / **Request access** (request-grant API). Strip Remix from the running-app pill on this route, stop the sidebar and Clerk modal from auto-opening on shared-link landings, and route both CTAs through the existing Clerk overlay with an `?intent=` round-trip.

**Architecture:** Reuse the existing Mac-classic landing card already in `vibe.$userHandle.$appSlug.tsx`. Drive helper copy + button row from a `cardVariant` derived from a new `cardGrant` state (the raw grant string from `getAppByFsId`). Two pure helpers — `vibe-intent.ts` (URL param r/w) and `vibe-card-variant.ts` (grant → variant) — keep the testable logic out of the React tree. The Clerk overlay itself is unchanged: CTAs set the intent param and flip `reqLogin=true`; the existing `forceRedirectUrl` carries the param across sign-up; a new effect reads it on return and fires the action.

**Tech Stack:** React Router 7, Clerk (`@clerk/react`), `@vibes.diy/base` `VibesButton`, vitest, `vctx.vibeDiyApi.requestAccess()`.

---

## Spec

[docs/superpowers/specs/2026-05-13-anon-vibe-two-cta-landing-design.md](../specs/2026-05-13-anon-vibe-two-cta-landing-design.md). Closes [#1741](https://github.com/VibesDIY/vibes.diy/issues/1741). Horizon follow-ups: [#1745](https://github.com/VibesDIY/vibes.diy/issues/1745) [#1746](https://github.com/VibesDIY/vibes.diy/issues/1746) [#1747](https://github.com/VibesDIY/vibes.diy/issues/1747) [#1748](https://github.com/VibesDIY/vibes.diy/issues/1748) [#1749](https://github.com/VibesDIY/vibes.diy/issues/1749).

## File structure

**New files:**

- `vibes.diy/pkg/app/routes/vibe-intent.ts` — pure: read/write/clear `?intent=install|join`.
- `vibes.diy/pkg/app/routes/vibe-card-variant.ts` — pure: grant → variant ("request" / "invite" / "pending" / "revoked" / "not-found" / "iframe").
- `vibes.diy/tests/app/vibe-intent.test.ts` — unit tests.
- `vibes.diy/tests/app/vibe-card-variant.test.ts` — unit tests.

**Modified:**

- `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx`:
  - Add `cardGrant` state; populate it from `applyResToUI`.
  - Stop the auto-opens: `setReqLogin(true)` from grant resolution (Clerk modal) and `setIsSidebarVisible(true)` (sidebar). Tighten `showLoginOverlay` so it depends only on `reqLogin`.
  - Replace the landing card's helper paragraph + button row with variant-driven content.
  - Add Install / Join / Request handlers (set intent param + flip `reqLogin` if anon; call `requestAccess` or navigate to clone URL if authed).
  - Add a one-shot `useEffect` that reads `intent` on auth flip and fires the queued action.
  - Drop the `reqAccessOverlay` modal + dead `reqAccess` state.
  - Drop `remixHref` from `<ExpandedVibesPill>` (and the now-unused `remixUrl`).

`ExpandedVibesPill.tsx` is **not** modified — remix is already conditional on `remixHref`.

## Glossary

- **Clone** — same code, new state partition, new ACL. The "Install your own copy" action. Routes to today's `/remix/${vibeSlug}?skipChat=true`.
- **Remix** — new chat seeded with the source code (code changes). Out of scope on this page; relocates elsewhere later.
- **Grant** — result of `vctx.vibeDiyApi.getAppByFsId(...)`. Drives the card variant.
- **`?intent=install|join`** — URL param set before opening Clerk; survives `forceRedirectUrl` and is consumed on return.

---

## Task 1: Intent param helper

**Files:**

- Create: `vibes.diy/pkg/app/routes/vibe-intent.ts`
- Test: `vibes.diy/tests/app/vibe-intent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/vibe-intent.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readIntent, withIntent, withoutIntent } from "../../pkg/app/routes/vibe-intent.js";

describe("readIntent", () => {
  it("returns 'install' when ?intent=install is present", () => {
    expect(readIntent(new URLSearchParams("intent=install"))).toBe("install");
  });
  it("returns 'join' when ?intent=join is present", () => {
    expect(readIntent(new URLSearchParams("intent=join"))).toBe("join");
  });
  it("returns undefined when intent is missing", () => {
    expect(readIntent(new URLSearchParams(""))).toBeUndefined();
  });
  it("returns undefined when intent has an unrecognized value", () => {
    expect(readIntent(new URLSearchParams("intent=bogus"))).toBeUndefined();
  });
});

describe("withIntent", () => {
  it("appends intent=install to a path with no query", () => {
    expect(withIntent("/vibe/og/app", "install")).toBe("/vibe/og/app?intent=install");
  });
  it("appends intent=join alongside existing params", () => {
    expect(withIntent("/vibe/og/app?token=abc", "join")).toBe("/vibe/og/app?token=abc&intent=join");
  });
  it("replaces any existing intent param", () => {
    expect(withIntent("/vibe/og/app?intent=install", "join")).toBe("/vibe/og/app?intent=join");
  });
});

describe("withoutIntent", () => {
  it("removes intent while preserving other params", () => {
    expect(withoutIntent("/vibe/og/app?token=abc&intent=join")).toBe("/vibe/og/app?token=abc");
  });
  it("is a no-op when intent isn't present", () => {
    expect(withoutIntent("/vibe/og/app?token=abc")).toBe("/vibe/og/app?token=abc");
  });
  it("strips trailing '?' when intent was the only param", () => {
    expect(withoutIntent("/vibe/og/app?intent=install")).toBe("/vibe/og/app");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm test -- vibe-intent`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `vibes.diy/pkg/app/routes/vibe-intent.ts`:

```typescript
export type VibeIntent = "install" | "join";

const VALID_INTENTS = new Set<VibeIntent>(["install", "join"]);

export function readIntent(params: URLSearchParams): VibeIntent | undefined {
  const raw = params.get("intent");
  return raw && VALID_INTENTS.has(raw as VibeIntent) ? (raw as VibeIntent) : undefined;
}

export function withIntent(pathAndQuery: string, intent: VibeIntent): string {
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("intent", intent);
  return `${path}?${params.toString()}`;
}

export function withoutIntent(pathAndQuery: string): string {
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  if (!params.has("intent")) return pathAndQuery;
  params.delete("intent");
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm test -- vibe-intent`
Expected: PASS (10 tests).

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/app/routes/vibe-intent.ts vibes.diy/tests/app/vibe-intent.test.ts
git add vibes.diy/pkg/app/routes/vibe-intent.ts vibes.diy/tests/app/vibe-intent.test.ts
git commit -m "feat(vibe-intent): URL param helper for two-CTA landing (#1741)"
```

---

## Task 2: Card variant resolver

**Files:**

- Create: `vibes.diy/pkg/app/routes/vibe-card-variant.ts`
- Test: `vibes.diy/tests/app/vibe-card-variant.test.ts`

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/vibe-card-variant.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeCardVariant } from "../../pkg/app/routes/vibe-card-variant.js";

describe("computeCardVariant", () => {
  it("returns 'request' for req-login.request", () => {
    expect(computeCardVariant("req-login.request")).toBe("request");
  });
  it("returns 'invite' for req-login.invite", () => {
    expect(computeCardVariant("req-login.invite")).toBe("invite");
  });
  it("returns 'pending' for pending-request", () => {
    expect(computeCardVariant("pending-request")).toBe("pending");
  });
  it("returns 'revoked' for revoked-access", () => {
    expect(computeCardVariant("revoked-access")).toBe("revoked");
  });
  it("returns 'not-found' for not-found and not-grant", () => {
    expect(computeCardVariant("not-found")).toBe("not-found");
    expect(computeCardVariant("not-grant")).toBe("not-found");
  });
  it("returns 'iframe' for any access-granted state", () => {
    expect(computeCardVariant("granted-access.editor")).toBe("iframe");
    expect(computeCardVariant("granted-access.viewer")).toBe("iframe");
    expect(computeCardVariant("granted-access.submitter")).toBe("iframe");
    expect(computeCardVariant("accepted-email-invite")).toBe("iframe");
    expect(computeCardVariant("public-access")).toBe("iframe");
    expect(computeCardVariant("owner")).toBe("iframe");
  });
  it("returns 'iframe' for undefined (no grant resolved yet)", () => {
    expect(computeCardVariant(undefined)).toBe("iframe");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm test -- vibe-card-variant`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the resolver**

Create `vibes.diy/pkg/app/routes/vibe-card-variant.ts`:

```typescript
import type { ResGetAppByFsId } from "@vibes.diy/api-types";

export type VibeCardVariant = "request" | "invite" | "pending" | "revoked" | "not-found" | "iframe";

export function computeCardVariant(grant: ResGetAppByFsId["grant"] | undefined): VibeCardVariant {
  switch (grant) {
    case "req-login.request":
      return "request";
    case "req-login.invite":
      return "invite";
    case "pending-request":
      return "pending";
    case "revoked-access":
      return "revoked";
    case "not-found":
    case "not-grant":
      return "not-found";
    case "accepted-email-invite":
    case "granted-access.editor":
    case "granted-access.viewer":
    case "granted-access.submitter":
    case "public-access":
    case "owner":
      return "iframe";
    default:
      return "iframe";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm test -- vibe-card-variant`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/app/routes/vibe-card-variant.ts vibes.diy/tests/app/vibe-card-variant.test.ts
git add vibes.diy/pkg/app/routes/vibe-card-variant.ts vibes.diy/tests/app/vibe-card-variant.test.ts
git commit -m "feat(vibe-card-variant): grant->variant resolver (#1741)"
```

---

## Task 3: State machine — `cardGrant` + stop auto-opens

This task wires the new state and **stops the existing automatic Clerk modal and sidebar opens**. UI swap happens in Task 4 so the file always compiles between commits.

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Add `cardGrant` state and populate it from `applyResToUI`**

Open `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx`.

Add an import near the top (alongside other route imports):

```typescript
import { computeCardVariant } from "./vibe-card-variant.js";
```

Add a state declaration alongside the existing flag states (right after the `revokedAccess` declaration, around line 114):

```typescript
const [cardGrant, setCardGrant] = useState<import("@vibes.diy/api-types").ResGetAppByFsId["grant"] | undefined>(undefined);
```

(If the file already imports `ResGetAppByFsId`, drop the inline `import(...)` form and reuse the named import.)

- [ ] **Step 2: Rewrite the `applyResToUI` switch**

Locate `applyResToUI` (around line 199). Replace the existing inner `switch (res.grant) { ... }` block with this version. The change: every card-driving grant sets `cardGrant`; **none** of them flip `reqLogin`, `reqAccess`, or `isSidebarVisible` anymore.

```typescript
switch (res.grant) {
  case "not-found":
  case "not-grant":
    setNotFound(true);
    setCardGrant(res.grant);
    toast.dismiss("vibe-access");
    break;
  case "req-login.request":
  case "req-login.invite":
  case "pending-request":
  case "revoked-access":
    setCardGrant(res.grant);
    toast.dismiss("vibe-access");
    break;
  case "accepted-email-invite":
  case "granted-access.editor":
  case "granted-access.viewer":
  case "granted-access.submitter":
  case "public-access":
  case "owner":
    setCardGrant(undefined);
    setMyGrant(
      res.grant === "owner"
        ? "owner"
        : res.grant === "granted-access.editor" || res.grant === "accepted-email-invite"
          ? "editor"
          : res.grant === "granted-access.viewer"
            ? "viewer"
            : res.grant === "granted-access.submitter"
              ? "submitter"
              : "public"
    );
    toast.dismiss("vibe-access");
    break;
  default:
    toast.error(`Unexpected grant: ${res.grant}`, { id: "vibe-access" });
}
```

`signedIn` is no longer referenced; remove the `signedIn` parameter from `applyResToUI`'s signature, the call sites at the bottom of the effect (`applyResToUI(cachedResRef.current, authSignedIn)` → `applyResToUI(cachedResRef.current)`; same for the post-fetch call), and drop `authSignedIn` from the effect's dependency array since it's no longer read there. (The new mount-effect added in Task 5 reads `authSignedIn` separately.)

- [ ] **Step 3: Tighten `showLoginOverlay`**

Find the `showLoginOverlay` line (around line 362). Replace:

```typescript
const showLoginOverlay = !authSignedIn && isLoaded && (!!(fsId && userHandle && appSlug) || reqLogin);
```

With:

```typescript
const showLoginOverlay = !authSignedIn && isLoaded && reqLogin;
```

Clerk now only opens when a CTA click sets `reqLogin = true` (wired in Task 5).

- [ ] **Step 4: Stop the URL-effect sidebar auto-open**

Locate the effect around line 178 that opens the sidebar based on URL params. Replace:

```typescript
useEffect(() => {
  if (isLoaded && !authSignedIn && fsId && userHandle && appSlug) {
    setIsSidebarVisible(true);
  }
  if (authSignedIn) {
    setIsSidebarVisible(false);
  }
}, [isLoaded, authSignedIn, fsId, userHandle, appSlug]);
```

With:

```typescript
useEffect(() => {
  if (authSignedIn) {
    setIsSidebarVisible(false);
  }
}, [authSignedIn]);
```

The sidebar now opens only via the manual `VibesSwitch` toggle.

- [ ] **Step 5: Verify it compiles**

Run: `pnpm fast-check`
Expected: PASS. (UI doesn't render the new card yet — the existing card render condition `showLoginOverlay || revokedAccess || pendingRequest` no longer fires for anon, so anon visitors see "Preparing…". Task 4 fixes that.)

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git add vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git commit -m "refactor(vibe-route): cardGrant state, stop auto-opens (#1665, #1741)"
```

---

## Task 4: Variant-driven card UI (with stub CTAs)

Render the existing card based on the new variant. Stub handlers so the file compiles — Task 5 wires them.

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Add variant + stub handlers right before the JSX return**

Add this block right above the existing `if (iframeUrl) { return (...)` (around line 372):

```typescript
const cardVariant = computeCardVariant(cardGrant);
const showCard = cardVariant === "request" || cardVariant === "invite" || cardVariant === "pending" || cardVariant === "revoked";

// Replaced in Task 5
const onClickInstall = () => window.location.assign(cloneUrl);
const onClickJoin = () => {
  // wired in Task 5
};
```

- [ ] **Step 2: Replace the landing-card body**

Locate the landing card render block (around line 439, inside the `return ( ... )` after the iframe branch). Replace:

```tsx
{showLoginOverlay || revokedAccess || pendingRequest ? (
  <div style={{ maxWidth: 500, ...
```

through the end of that block's outer `</div>`, with:

```tsx
{
  showCard ? (
    <div style={{ maxWidth: 500, width: "100%", margin: "0 16px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <div
        style={{
          height: 30,
          width: "100%",
          backgroundColor: "rgba(0, 154, 206, 0.4)",
          border: "1px solid black",
          marginBottom: 1,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.38)",
        }}
      />
      <div
        style={{
          backgroundColor: "rgb(255, 255, 240)",
          color: "rgb(34, 31, 32)",
          border: "1px solid black",
          boxShadow: "0 0 0 1px white",
          padding: "24px 24px",
        }}
      >
        <h2 style={{ fontWeight: "bold", fontSize: 32, lineHeight: "34px" }}>{appTitle ?? appSlug}</h2>
        <p style={{ marginTop: 10, fontSize: 15, opacity: 0.7 }}>
          {cardVariant === "pending"
            ? "The owner has your request. Let them know to click approve on this URL."
            : cardVariant === "revoked"
              ? "Your access was revoked. You can still install your own copy."
              : cardVariant === "invite"
                ? "This is your friend's private app. Install your own copy, or join the collaboration."
                : "This is your friend's private app. Install your own copy to use it solo, or request access to collaborate with them."}
        </p>
        {screenshotUrl && (
          <img
            src={screenshotUrl}
            alt={`Screenshot of ${appTitle ?? appSlug}`}
            style={{ width: "100%", marginTop: 16, border: "1px solid black" }}
          />
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
          <VibesButton variant={BLUE} icon="remix" onClick={onClickInstall}>
            Install your own copy
          </VibesButton>
          {cardVariant === "invite" && (
            <VibesButton variant={YELLOW} icon="remix" onClick={onClickJoin}>
              Join
            </VibesButton>
          )}
          {cardVariant === "request" && (
            <VibesButton variant={YELLOW} icon="remix" onClick={onClickJoin}>
              Request access
            </VibesButton>
          )}
        </div>
      </div>
    </div>
  ) : notFound ? (
    <div className="text-center text-lg font-semibold" style={{ color: "var(--vibes-text-primary)" }}>
      App not available
    </div>
  ) : (
    <div style={{ color: "var(--vibes-text-primary)" }}>Preparing…</div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm fast-check`
Expected: PASS.

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git add vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git commit -m "feat(vibe-route): variant-driven two-CTA landing card (#1741)"
```

---

## Task 5: Wire CTAs through intent + Clerk

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Add imports**

Add at the top of the file:

```typescript
import { readIntent, withIntent, withoutIntent } from "./vibe-intent.js";
```

- [ ] **Step 2: Replace `sendAccessRequest` and the stub handlers**

Delete the existing `sendAccessRequest` function (around line 308 — the `// TODO: call the real request-access API` block). Delete the stub `onClickInstall` / `onClickJoin` declarations added in Task 4 step 1.

Just above the `cardVariant` declaration, add the real handlers:

```typescript
function fireInstall() {
  window.location.assign(cloneUrl);
}

async function fireJoin() {
  if (!appSlug || !userHandle) return;
  const r = await vctx.vibeDiyApi.requestAccess({ appSlug, userHandle });
  if (r.isErr()) {
    toast.error(`Request failed: ${r.Err().message}`);
    return;
  }
  toast.success("Request sent");
  setRetryCount((c) => c + 1); // re-fetch grant; flips to pending-request
}

function onClickInstall() {
  if (authSignedIn) {
    fireInstall();
    return;
  }
  const here = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", withIntent(here, "install"));
  setReqLogin(true);
}

function onClickJoin() {
  if (authSignedIn) {
    void fireJoin();
    return;
  }
  const here = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", withIntent(here, "join"));
  setReqLogin(true);
}
```

- [ ] **Step 3: Add the intent-on-mount effect**

Place this effect near the bottom of the hooks block (after the grant-resolution effect, around line 290):

```typescript
useEffect(() => {
  if (!authSignedIn) return;
  const intent = readIntent(searchParam);
  if (!intent) return;
  // Scrub before firing so refresh / re-render doesn't repeat the action.
  window.history.replaceState(null, "", withoutIntent(window.location.pathname + window.location.search));
  if (intent === "install") {
    fireInstall();
  } else if (intent === "join") {
    void fireJoin();
  }
  // Only re-run on auth flip; searchParam read at effect time is fine.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authSignedIn]);
```

- [ ] **Step 4: Verify it compiles and check that the SSR test still passes**

```bash
pnpm fast-check
cd vibes.diy/tests/app && pnpm test -- vibe-route-ssr
```

Expected: both PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git add vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git commit -m "feat(vibe-route): wire Install/Join CTAs with intent round-trip (#1741)"
```

---

## Task 6: Drop dead code (modal + flags + Remix from pill)

After Tasks 3-5 the modal, the `reqAccess` flag, and the `pendingRequest`/`revokedAccess` redundant flags are all dead. Same task drops `remixHref` from the pill so removal lands in one commit.

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx`

- [ ] **Step 1: Delete `reqAccessOverlay`**

Locate the `const reqAccessOverlay = reqAccess ? createPortal(...) : null;` block (around line 319) and delete the entire declaration. Delete `{reqAccessOverlay}` from the JSX return (around line 501).

- [ ] **Step 2: Delete unused flag states**

Delete these state declarations (they're no longer read; `cardGrant` + `computeCardVariant` cover them):

```typescript
const [reqAccess, setReqAccess] = useState(false);
const [pendingRequest, setPendingRequest] = useState(false);
const [revokedAccess, setRevokedAccess] = useState(false);
```

Verify with `grep -n "reqAccess\|pendingRequest\|revokedAccess" vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx` — only `setReqAccess`/`setPendingRequest`/`setRevokedAccess` calls inside the old `applyResToUI` switch should remain, and Task 3's rewrite already deleted those. If grep returns any matches, delete them.

- [ ] **Step 3: Drop `remixHref` from the pill**

Locate `<ExpandedVibesPill` (around line 392). Delete the `remixHref={remixUrl}` line. Then delete the `const remixUrl = ...` declaration (around line 316). `cloneUrl` stays — Install uses it.

- [ ] **Step 4: Verify build/lint clean**

Run: `pnpm fast-check`
Expected: PASS, no unused-variable warnings.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git add vibes.diy/pkg/app/routes/vibe.\$userHandle.\$appSlug.tsx
git commit -m "refactor(vibe-route): drop modal + dead flags + Remix from pill (#1741)"
```

---

## Task 7: Full check + browser verification + PR

- [ ] **Step 1: Run `pnpm check`**

Run: `pnpm check 2>&1 | tee /tmp/check-1741.log`

If anything fails, grep `/tmp/check-1741.log` for the failure and fix. Per `agents/flaky-tests.md`: rerun once before treating a check failure as real; log to #1515 if it's a flake.

- [ ] **Step 2: Browser-test the anon flow**

Per CLAUDE.md: UI changes require a real browser test.

1. Start dev server: `pnpm dev`
2. In an incognito window, open a non-public vibe shared link (`/vibe/<other-user>/<app>`)
3. Confirm: title + screenshot + helper copy + **Install your own copy** + **Request access** buttons visible; sidebar does NOT auto-open; no Clerk modal
4. Click **Install your own copy** → URL gains `?intent=install` → Clerk overlay opens → complete sign-up → lands in the cloned app
5. Fresh incognito session: click **Request access** → URL gains `?intent=join` → Clerk overlay opens → complete sign-up → card flips to **pending** variant ("The owner has your request…") with only Install button
6. For an invited vibe (or backend-simulated `req-login.invite`): button reads **Join** instead of Request access
7. Visit a vibe you own → iframe + pill, **no Remix button** in the pill
8. Visit a public vibe → iframe, no card

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin jchris/1741-anon-vibe-two-cta
gh pr create --title "Anon Vibe page: Install/Join two-CTA landing (#1741)" --body "$(cat <<'EOF'
## Summary
- Replaces Edit/Clone/Remix on `/vibe/:userHandle/:appSlug` with **Install your own copy** + **Join** / **Request access** for anon and authed-non-owner viewers of non-public vibes
- Stops the sidebar and Clerk modal from auto-opening on shared-link landings (closes #1665)
- Removes Remix from the running-app pill on `/vibe/...` routes (relocation tracked in #1746)
- Wires both CTAs through the existing Clerk overlay with `?intent=` round-trip

Spec: [docs/superpowers/specs/2026-05-13-anon-vibe-two-cta-landing-design.md](docs/superpowers/specs/2026-05-13-anon-vibe-two-cta-landing-design.md)

Closes #1741. Horizon follow-ups filed: #1745 #1746 #1747 #1748 #1749.

## Test plan
- [x] `pnpm check` green
- [x] Anon viewer: card shows two CTAs, sidebar doesn't auto-open
- [x] Install → Clerk → cloned app
- [x] Request access → Clerk → pending-request card
- [x] Invite path → button reads "Join"
- [x] Owner view unchanged, no Remix in pill
- [x] Public vibe path → iframe, no card

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage:**

| Spec requirement                                                          | Task                                  |
| ------------------------------------------------------------------------- | ------------------------------------- |
| Two CTAs (Install / Join-Request) in landing card                         | 4                                     |
| Variant copy table (request/invite/pending/revoked/not-found/iframe)      | 2, 4                                  |
| Anon click → Clerk overlay with `?intent=` round-trip                     | 5                                     |
| Authed non-owner click → fires action directly                            | 5                                     |
| Install routes to existing clone endpoint                                 | 5                                     |
| Request access calls `vibeDiyApi.requestAccess`                           | 5                                     |
| Persistence: after Join → iframe on revisit; after Request → pending card | grant-driven via 2, 3                 |
| Remix removed from landing card                                           | 4 (new button row excludes it)        |
| Remix removed from ExpandedVibesPill                                      | 6                                     |
| Sidebar does NOT auto-open on shared-link landing                         | 3                                     |
| Clerk modal does NOT auto-open                                            | 3                                     |
| Public vibe → no card, iframe directly                                    | grant-driven via 2 ("iframe" variant) |
| `?intent=` survives Clerk hash routing (lives in `?`, not `#`)            | 1 (helper guarantees)                 |
| Drop `reqAccessOverlay` modal                                             | 6                                     |

**Type/name consistency:** `VibeIntent` ("install" | "join") used in Tasks 1 and 5. `VibeCardVariant` ("request" | "invite" | "pending" | "revoked" | "not-found" | "iframe") used in Tasks 2, 4. `fireInstall` / `fireJoin` / `onClickInstall` / `onClickJoin` introduced in Task 5; stubs in Task 4 are replaced (deleted) by Task 5. `cardGrant` state introduced in Task 3, read in Task 4.

**Placeholder scan:** Every code step shows full code. No "TBD", "TODO", or "fill in later". One non-code instruction in Task 6 step 2 ("Verify with grep") is a verification step, not a placeholder.

**Risks recap:** Remix removal affects owners (no Remix from pill until #1746 relocates it) — flagged in PR body and #1746. The `applyResToUI` signature change (`signedIn` parameter removed) is a local refactor with no external callers.
