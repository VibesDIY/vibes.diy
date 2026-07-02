# Signing out shouldn't teleport you home

**Hook:** The handle picker's Log out row worked perfectly — and then threw you
off the page you were standing on.

**Source:** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — the
`onLogout` wiring for the vibe switch card's handle picker.

**Why:** A plain `clerk.signOut()` falls back to Clerk's default post-sign-out
redirect (`/`, no `afterSignOutUrl` is configured). But logging out from a
vibe page is a statement about *who you are*, not *where you want to go* — the
natural result is the same page as a visitor. Passing
`redirectUrl: window.location.href` keeps you there, and the full-URL reload
it triggers doubles as a clean reset of all the ownership-gated route state
(draft pins, fast-path maps, admin mode).

**Gotcha:** Private vibes are the edge worth checking: staying put after
sign-out lands the now-anonymous viewer on the vibe's login overlay — which is
exactly the right surface, not a broken state. The SessionSidebar and Settings
logouts intentionally keep the old go-home behavior; they're navigation
surfaces, not content you were standing on.
