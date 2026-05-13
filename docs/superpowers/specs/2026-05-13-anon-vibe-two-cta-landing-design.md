# Anon Vibe page: Install / Join two-CTA landing

Closes VibesDIY/vibes.diy#1741.

## Problem

An unauthenticated visitor landing on `/vibe/:userSlug/:appSlug` via a shared link sees Edit/Clone/Remix with no explanation (#1709), an auto-opening login sidebar that blocks the page (#1665), and no clear signal of what to do. The visitor's mental model is much simpler than what we surface: "Can I just have this?" or "Can I join my friend?"

## Goal

On the Vibe page, when the viewer is **not** the owner and the vibe is **not public**, present exactly two primary CTAs:

- **Install your own copy** — uses the existing **clone** API (same code, new state partition, new ACL). No fork language.
- **Join** / **Request access** — uses the existing **request-grant** flow. Copy depends on grant state.

Public vibes drop straight into reader mode (no landing card). Remix moves off this page entirely.

## Vocabulary

Source of truth for this spec:

- **Clone** = same code, new state partition, new ACL. The visitor gets their own usable instance.
- **Remix** = new chat seeded with the source code (code can change). Creator/developer affordance, **not** a first-impression affordance.
- No "fork" language anywhere in user-facing copy.

## Scope

**In scope** — the landing card on `/vibe/:userSlug/:appSlug` for:

1. Anon viewer (Clerk not signed in) — non-public vibe
2. Authed non-owner viewer — non-public vibe, no existing grant

**Out of scope (handled in follow-up issues)**:

- Inline edit + hot-swap chat on the `/vibe` route (the long-term vision where every vibe is editable inline)
- Where Remix relocates (creator menu / `/remix` entry / App Settings) — this spec only **removes** Remix from the Vibe page
- Public-vibe reader-mode in-page "request writer access" affordance
- Auto-join copy differentiation (treated visually identical to invite for now)
- Authed-non-owner viewer flow refinement after anon ships

## Design

### Landing card visuals

Reuse the existing Mac-classic card already present in [vibe.$userSlug.$appSlug.tsx](../../../vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx): `gridBackground` background, cream body with black borders, blue title bar, app title, screenshot, helper paragraph, button row. Style stays exactly as it is — only the helper paragraph and button row content change.

### Card variants (driven by `getAppByFsId` grant)

| Grant state                                            | Helper copy                                                                                                            | Buttons                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `req-login.request`                                    | "This is your friend's private app. Install your own copy to use it solo, or request access to collaborate with them." | **Install your own copy** · **Request access** |
| `req-login.invite`                                     | "This is your friend's private app. Install your own copy, or join the collaboration."                                 | **Install your own copy** · **Join**           |
| `pending-request`                                      | "The owner has your request. Let them know to click approve on this URL."                                              | **Install your own copy** (only)               |
| `revoked-access`                                       | "Your access was revoked. You can still install your own copy."                                                        | **Install your own copy** (only)               |
| `not-found`                                            | existing "App not available"                                                                                           | (none)                                         |
| `public-access` / `granted-*` / `accepted-*` / `owner` | (no card — render iframe)                                                                                              | —                                              |

Invite and (future) auto-join share the same visual branch ("Join"). Differentiation is a follow-up.

### Button behavior

**Anon visitor (Clerk not signed in)**:

1. Click `Install your own copy` or `Join`/`Request access`
2. Set `?intent=install` or `?intent=join` on the URL
3. Open the **existing** Clerk SignIn overlay (no new auth UI; #1508-style inline auth is **not** in this spec)
4. Clerk's `forceRedirectUrl` carries the intent param
5. On return, the page reads `intent`, fires the action, scrubs the param

**Authed non-owner visitor**:

- Click fires the action directly. No Clerk overlay.

**Install your own copy** → routes to the existing clone endpoint (today: `/remix/:user/:app?skipChat=true`). Lands the visitor in their new copy.

**Join** / **Request access** → call existing request-grant API. If the grant resolves immediately (invite / future auto-join), the page transitions to the iframe. If it's a pending request, the card transitions to the `pending-request` variant.

**Persistence across visits**: after a successful **Join**, the grant is granted/accepted — subsequent visits resolve straight into the iframe (no card). After **Request access**, the grant is `pending-request` — subsequent visits show the `pending-request` card (Install-only) until the owner approves, at which point the grant flips and the iframe renders.

### What gets removed

1. **Remix** button — removed from both the landing card and the running-app [ExpandedVibesPill](../../../vibes.diy/base/components/ExpandedVibesPill.tsx) on `/vibe/...` routes. Relocation is a separate decision (follow-up issue).
2. **Auto-opening login sidebar** on anon shared-link landings — the effect that today opens `SessionSidebar` when `!authSignedIn && fsId && userSlug && appSlug` is suppressed when the landing card is the focal point. The manual sidebar toggle still works. Closes #1665.
3. **The old Edit/Clone/Remix overlay confusion** (#1709) — obsolete; the landing card with two CTAs replaces it.

### Public-vibe handling

If grant resolves to `public-access`, no landing card. Iframe renders directly (today's behavior). The two CTAs and the request-access flow do not appear for public vibes.

## Implementation notes

- The card already exists in [vibe.$userSlug.$appSlug.tsx](../../../vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx) (see the `else` branch around the `gridBackground` block). Wiring is mostly copy + button-row swap + intent-param handling + sidebar effect adjustment.
- Intent param survives Clerk hash routing because it lives in `?` not `#`.
- `clone` URL today is `/remix/${vibeSlug}?skipChat=true` — keep using it. Renaming the underlying route is **out of scope**.
- Drop the `reqAccessOverlay` modal (today's three-button "Remix / Clone / Request access" overlay) — its job is now the landing card.

## Tests

1. Each grant state renders the correct card variant and button set.
2. Anon `Install` click → URL gets `?intent=install` → Clerk overlay opens → return with `intent=install` triggers clone redirect.
3. Anon `Join`/`Request access` click → same flow with `?intent=join` → return triggers grant request.
4. Authed non-owner click on either button → no Clerk overlay; action fires directly.
5. Public vibe (`grant === "public-access"`) → no card; iframe renders.
6. Sidebar does **not** auto-open on shared-link landing.
7. `pending-request` and `revoked-access` variants render with only the Install button.
8. After grant resolves immediately (invite path), iframe renders without a page reload.

## Risks

- The clone endpoint currently lives under `/remix/...?skipChat=true` — confusing internally but invisible to the user. We rename later if it bites.
- Removing Remix from `ExpandedVibesPill` affects all `/vibe/...` viewers (including owners). If owners rely on Remix from the pill, they lose it until the relocation lands. Mitigation: ship the relocation issue before, or simultaneously with, this change.
- `?intent=` is a new URL contract — make sure no other code already reads `intent` on this route.

## Follow-up issues to file on completion

1. Inline edit + hot-swap chat on `/vibe` route — the long-term vision
2. Where Remix relocates (creator menu / `/remix` route / App Settings)
3. Public-vibe reader mode with in-page "request writer access"
4. Auto-join copy differentiation on the landing card
5. Authed-non-owner viewer flow refinement after anon validation
