# Vibes Sharing & Access Reference

> **For the docs team:** This document is a reference map of the current sharing system derived directly from the source code. It is not a how-to guide — it is raw material for building one. Each section describes what exists, what each control does, and what users see. Add layout screenshots and step-by-step walkthroughs on top of this content.

---

## How access works

Every Vibe has an **access state** that determines what a visitor sees when they open the `/vibe/$user/$app` URL. The server resolves this state and calls it a **grant**. The entire landing page experience — whether a visitor sees the app directly, a login prompt, a pending message, or an error — flows from the grant value.

The grant is resolved by calling the API with the visitor's auth token (or no token for logged-out users) plus an optional email invite token from the URL.

---

## Grant states

The full set of grant values and what they mean:

| Grant value | Meaning | Landing page result |
|---|---|---|
| `owner` | Visitor owns this Vibe | App loads. Full controls (Edit, Share, Update). |
| `granted-access.editor` | Request or invite approved as editor | App loads. Can comment. |
| `granted-access.viewer` | Request or invite approved as viewer | App loads. Read-only. |
| `granted-access.submitter` | Approved as submitter | App loads. Submitter-level interaction. |
| `public-access` | Vibe is public; visitor has no personal grant | App loads as anonymous public viewer. |
| `accepted-email-invite` | Visitor redeemed an email invite token | App loads. Treated as editor grant. |
| `req-login.request` | Vibe is not public; visitor is logged out | Landing card shown. Two CTAs: **Fresh Install** and **Request access**. |
| `req-login.invite` | Visitor has a pending email invite but is not logged in | Landing card shown. Two CTAs: **Fresh Install** and **Join collab**. |
| `req-login.auto-join` | Vibe is set to auto-approve requests; visitor is not logged in | Landing card shown. Same UI as invite (Join collab). |
| `pending-request` | Visitor submitted an access request; still waiting | Landing card shown. Join button is disabled, reads **Requested**. |
| `revoked-access` | Visitor previously had access; it was revoked | Landing card shown. Join button is disabled, reads **Revoked**. |
| `not-found` | Vibe does not exist, or visitor has no grant and the app is private | "App not available" message. |
| `not-grant` | App exists but this visitor has no grant | Same as not-found for the visitor. |

### Which grants show the landing card

The landing card is shown when the grant is: `req-login.request`, `req-login.invite`, `req-login.auto-join`, `pending-request`, or `revoked-access`.

For all "access granted" grants (`owner`, `granted-access.*`, `public-access`, `accepted-email-invite`), the app loads directly in an iframe with no landing card.

---

## The landing card (visitor onramp)

When access has not been granted, visitors see a centered card over a grid background. The card always shows:

- **App title** (or app slug if no title is set)
- **Screenshot** of the app (if one has been generated)
- **Two action buttons**, side by side

### Action buttons

**Left button — Fresh Install** (blue)
- Always present.
- If logged in: navigates to `/remix/$user/$app?skipChat=true`, which clones the Vibe and redirects to the visitor's own copy.
- If logged out: adds `?intent=install` to the URL and shows a Clerk login modal. After login, the install fires automatically.
- Subtext: "Run a new copy with your own data."

**Right button — Join / Request access / Requested / Revoked** (yellow)
- Label and behavior depend on the grant:

| Grant | Button label | What it does |
|---|---|---|
| `req-login.request` | **Request access** | If logged in: sends an access request API call. If logged out: adds `?intent=join` and shows login modal. |
| `req-login.invite` or `req-login.auto-join` | **Join collab** | Same as Request access path above. |
| `pending-request` | **Requested** (disabled) | No action. Subtext: "The owner has your request. Let them know to approve at this URL." |
| `revoked-access` | **Revoked** (disabled) | No action. Subtext: "Your access was revoked." |

- Subtext for active states: "Ask to join the collaboration." or "You've been granted access." (invite variant)

### Intent routing

When a logged-out visitor clicks either button, the URL gets a `?intent=install` or `?intent=join` parameter before the Clerk sign-in modal appears. After authentication, the page reads the intent and fires the correct action automatically, then scrubs the intent from the URL.

---

## Publishing

A Vibe starts in **dev** mode. Publishing sets the mode to **production** and makes the `/vibe/$user/$app` URL live.

### Publish flow (first publish)

1. Creator opens the Share panel via the community button in the ExpandedVibesPill.
2. The panel shows a **Publish** button and an **auto-approve** checkbox.
3. Creator optionally checks "Automatically approve new visitors as readers/editors."
4. Creator clicks **Publish**.
5. The server sets mode to `production` and stores the sharing settings.
6. The `/vibe/$user/$app` URL becomes publicly routable.
7. The newly published URL opens in a new tab automatically.

### Update (after first publish)

Once published, the panel shows:
- The live URL with a **Copy Link** button.
- An **Update** button that becomes active when the current `fsId` differs from the production `fsId`. (The dot badge on the Share button in the pill also shows when there are unpublished changes.)
- The **auto-approve** control (see below).

---

## Sharing controls (owner view)

After publishing, the Share panel contains three collapsible sections. The same three sections also appear in the **App Settings → Sharing tab** for full-page management.

### 1. Public Sharing

A single on/off toggle labeled **public sharing**.

- **Off (default before publish):** The Vibe requires a grant to view. Visitors without a grant see the landing card with the "Request access" path.
- **On:** Any visitor — logged in or not — receives the `public-access` grant and the app loads directly. No account or request needed.

When public sharing is on, the landing card is bypassed entirely for all visitors.

### 2. Requests

Controls whether visitors can submit access requests.

**Enable requests toggle**

- Off: visitors see the landing card but the "Request access" button is present (the toggle only controls whether requests are accepted server-side — the UI does not yet hide the button when requests are disabled).
- On: visitors can submit requests. The owner sees a badge count on the Share button in the pill when new requests arrive. Real-time updates via a WebSocket subscription.

**Auto-accept view requests** (visible when Requests is enabled)

A checkbox that, when checked, automatically approves every incoming request as a viewer without owner action.

> **Note:** This control appears in two places with slightly different labeling — in the Requests section here, and as a separate "Automatically approve new visitors as [readers/editors]" control in the main publish area of the Share modal. Both write to the same `enableRequest.autoAcceptRole` field. See [#1768](https://github.com/VibesDIY/vibes.diy/issues/1768) for the duplicate-checkbox cleanup issue.

**Auto-approve role**

The role granted to auto-approved visitors is controlled by the dropdown next to the auto-approve checkbox:

- **readers** — grants `granted-access.viewer`
- **editors** — grants `granted-access.editor`

**Request list**

Below the toggle, a table shows all incoming requests grouped into three sub-sections:

| Sub-section | What it shows | Owner actions |
|---|---|---|
| Pending | Requests waiting for decision | Approve as Editor, Approve as Viewer, Reject |
| Approved | Requests that were approved | Switch role (click to toggle), Revoke, Remove |
| Revoked | Requests that were rejected or revoked | Re-approve, Switch role, Remove |

Each row shows the requester's avatar, display name (or email/ID if no name is available), role, and date.

### 3. Email Invitations

Direct invite flow that bypasses the request queue.

**Sending an invite**

Owner enters an email address and clicks either **Editor** or **Viewer** to send the invite at that role. An email is sent with a unique one-time token link.

**Invite redemption**

When the recipient opens the invite link, the URL contains `?token=...`. The landing page calls `getAppByFsId` with the token. The server returns `req-login.invite` (if not logged in) or `accepted-email-invite` (if already logged in or after login). For the logged-in path, the token is redeemed and the app opens immediately.

**Invite list**

A table shows all sent invites grouped by state:

| State | Meaning |
|---|---|
| `pending` | Invite sent; recipient has not yet opened the link |
| `accepted` | Recipient opened the link and logged in |
| `revoked` | Access was manually revoked after acceptance |

Per-invite actions:
- **Role toggle** (click the role badge) — switches between editor and viewer
- **Revoke** (accepted invites only) — revokes access without deleting the invite record
- **Delete** (✕) — removes the invite record entirely

---

## Roles

Three roles exist in the system:

| Role | Internal value | What it means in practice |
|---|---|---|
| Editor | `editor` | Can interact with the app, use the app's Fireproof databases with write access. |
| Viewer | `viewer` | Read-only access. Can view and use the app, but writes to the app's databases may be restricted depending on the app's dbAcl settings. |
| Submitter | `submitter` | Latent role. Present in the type system (`Role = 'editor' | 'viewer' | 'submitter'`) and in the grant enum (`granted-access.submitter`), but not exposed in any current UI control. Intended for form-submission or write-limited workflows where a visitor can add data but cannot read existing records. |

The owner is always the owner — their access is not expressed through a role in the request/invite system.

---

## Comments policy

An optional toggle in the Share panel, visible to owners only:

**Only collaborators can comment**

- Off (default): anyone with access to the Vibe (including public viewers) can post comments.
- On: only editors and the owner can post comments. The comment composer is disabled client-side for viewers and public users as a UX prefetch; the server enforces the restriction.

This setting writes to the `dbAcls` field in app settings, specifically setting `write: ["editors"]` and `delete: ["editors"]` on the `comments` database. Toggling it off removes the entry and restores the default (members can write and delete).

---

## The ExpandedVibesPill

The pill is the floating action button fixed to the bottom-right of the screen on `/vibe/$user/$app` pages, visible only after access is granted and the page has hydrated.

It expands on click to show three horizontal buttons:

| Button | Icon | Action |
|---|---|---|
| Home | house | Opens `https://vibes.diy` in a new tab |
| Community | group icon | Opens/closes the Share modal |
| Vibe | star/vibe icon | Toggles a vertical submenu |

**Badge indicators**

- **Unpublished changes dot** (left of pill, owner only): shown when the current `fsId` differs from the production `fsId`. Indicates the open draft has not been published yet.
- **Pending request count** (on Community button, owner only): animated badge showing the number of pending access requests. Updates in real time via WebSocket.

### Vertical submenu (Vibe button)

Three options appear vertically when the Vibe button is clicked:

| Option | Label | Who sees it | What it does |
|---|---|---|---|
| Edit | Edit | Owner only | Navigates to `/chat/$user/$app` — the builder/chat editor. Owners only; non-owners do not see this button. |
| Clone | Clone | Everyone | Navigates to `/remix/$user/$app?skipChat=true` — creates a copy of the Vibe and lands on the copy's `/vibe/` URL, skipping the editor. |
| Remix | Remix | Everyone | Navigates to `/remix/$user/$app` — creates a copy and lands in the chat editor (`/chat/`) with `?view=code`, ready to edit. |

See [#1709](https://github.com/VibesDIY/vibes.diy/issues/1709) for the existing issue tracking the lack of explanatory copy on these three options.

---

## Clone vs Remix

Both routes call the same `forkApp` server API. The `skipChat` parameter controls the outcome:

| Path | `skipChat` | Mode set | Editor seeded | Landing destination |
|---|---|---|---|---|
| Clone (`/remix/...?skipChat=true`) | true | `production` | No | `/vibe/$fork/$app/$fsId` (published view) |
| Remix (`/remix/...`) | false | `dev` | Yes | `/chat/$fork/$app/$fsId?view=code` (editor) |

Both create a new app slug (the server assigns it, often appending a suffix to the source slug). Both store a `remixOf: "$srcUser/$srcApp"` marker in the local Fireproof VibeDocument for attribution display.

The Clone path is also used by the **Fresh Install** button on the landing card.

---

## Members section

The Share panel includes a **Members** section below the sharing controls, visible to anyone who has access. It lists the current members of the Vibe (users with approved grants). This is a read-only display for non-owners.

---

## OG / social metadata

Published Vibe URLs (`/vibe/$user/$app`) are server-rendered with Open Graph tags:

- `og:title` — app slug (or title if available)
- `og:description` — "$title - built on vibes.diy"
- `og:image` — screenshot URL at `https://$app--$user.$hostnameBase/screenshot.jpg`
- `twitter:card: summary_large_image`

The screenshot is generated asynchronously by a Cloudflare Browser Rendering worker after publish. The `/screenshot.jpg` endpoint is unauthenticated and public. If no screenshot is available yet, the OG image falls back to the screenshot URL pattern (which may 404 until the screenshot worker completes).

---

## App Settings vs Share Modal

The sharing controls appear in two places:

| Surface | Location | Who sees it |
|---|---|---|
| **Share modal** | Floating popover, bottom-right, on the ExpandedVibesPill Community button | Owner and non-owners (non-owners see a stripped version with just the link and a Request Access button) |
| **App Settings → Sharing tab** | Full-page settings view at `/settings/$user/$app` | Owner only |

Both surfaces use the same underlying `useSharingPanel` hook and write to the same API. They stay in sync; changes in one are reflected in the other on next open.

---

## Request access API flow (for reference)

1. Visitor clicks Request access → `requestAccess({ appSlug, userSlug })` API call.
2. Server creates a pending request record.
3. Grant re-resolves to `pending-request`. Landing card button changes to **Requested** (disabled).
4. Owner sees badge count increment on the Community button.
5. Owner opens Share modal → Requests section → Pending table.
6. Owner clicks **Editor** or **Viewer** to approve. Server sets grant to `granted-access.editor` or `granted-access.viewer` and sends an approval email.
7. On next page load (or if the owner approves while the visitor's page is open and auto-let-in is wired — see [#1766](https://github.com/VibesDIY/vibes.diy/issues/1766)), the visitor's grant resolves to the approved state and the app loads.

---

## Known issues and follow-up work

These related issues are open and affect the sharing UX:

| Issue | Summary |
|---|---|
| [#1857](https://github.com/VibesDIY/vibes.diy/issues/1857) | Epic: sharing onramp — end-user language and intent routing |
| [#1855](https://github.com/VibesDIY/vibes.diy/issues/1855) | Replace "Fresh Install" / "Request Access" with data-mode-first labels |
| [#1854](https://github.com/VibesDIY/vibes.diy/issues/1854) | Publish intent: let creators configure shared-space vs template vs read-only |
| [#1856](https://github.com/VibesDIY/vibes.diy/issues/1856) | Non-owner edit path: communicate "your edits create your own copy" |
| [#1768](https://github.com/VibesDIY/vibes.diy/issues/1768) | Duplicate auto-accept checkboxes in sharing UI |
| [#1709](https://github.com/VibesDIY/vibes.diy/issues/1709) | EDIT / CLONE / REMIX in pill popup have no explanatory copy |
| [#1748](https://github.com/VibesDIY/vibes.diy/issues/1748) | Auto-join copy variant on landing card (auto-approve UX) |
| [#1749](https://github.com/VibesDIY/vibes.diy/issues/1749) | Authed non-owner viewer flow refinement |
| [#1845](https://github.com/VibesDIY/vibes.diy/issues/1845) | Share panel has no close affordance |
| [#1772](https://github.com/VibesDIY/vibes.diy/issues/1772) | Share modal: restore Publish explainer copy |
| [#1790](https://github.com/VibesDIY/vibes.diy/issues/1790) | Invite token link says 'app unavailable' |
| [#1703](https://github.com/VibesDIY/vibes.diy/issues/1703) | Share button opens collaboration panel instead of producing a URL |
| [#1713](https://github.com/VibesDIY/vibes.diy/issues/1713) | Publishing with default visitor role 'editors' fails with generic error |
