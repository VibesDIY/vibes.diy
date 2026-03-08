# Web MVP — Instant Join Links

Simplest path to working invite links, web only. No CLI, no mobile, no admin UI. Owner creates link → shares it → invitee opens it → they're in.

---

## The Flow

1. Owner publishes a vibe (gets a URL)
2. Owner clicks "Invite" → gets an instant join link
3. Owner pastes link in Slack/text/email
4. Invitee opens link → sees app immediately (read-only, filesystem is public)
5. On first write attempt → Clerk sign-in pops → invite auto-accepted → full synced access

---

## Task Chain

### 1. P2 — Run D1 migrations
Create `InviteTokens` + `AcceptInvites` tables in production.
- `pnpm run drizzle:d1-remote`
- No code changes, just a migration run
- **Unlocks**: everything below

### 2. A1 — Expose `createInviteToken`
New EventoHandler wrapping existing `invite-system.ts:40-122`. Register in `vibes-msg-evento.ts`.
- The logic already exists — this is wiring it up
- **Unlocks**: frontend can create invite links

### 3. A2 — Expose `acceptInvite`
New EventoHandler wrapping `invite-system.ts:146-234`. Register in `vibes-msg-evento.ts`.
- **Unlocks**: invitees can accept and join

### 4. A3 — Expose `getFPToken`
New EventoHandler wrapping `invite-system.ts:311-392`. Returns ledger/tenant/roles for shared access.
- **Unlocks**: invitees get Fireproof cloud tokens for synced data

### 5. F4 — Re-enable invite route
Rename `invite.tsx-off` → `invite.tsx`, fix imports, register in router. Wire "Invite" button to call `createInviteToken` API.
- Minimal UI: button that generates a link, copy-to-clipboard
- Accept page: route that calls `acceptInvite` on load, redirects to app
- **Unlocks**: the full loop works in the browser

### 6. P3 — Deploy
Tag for staging, verify, tag for production.
- Only needs A1-A3 handlers (skip A4/A5 admin handlers for now)
- **Unlocks**: live invite links

### 7. P1 — Configure FPCLOUD_URL
Set `FPCLOUD_URL` + `DASHBOARD_URL` so synced data actually flows.
- Without this, invitees see the app but data doesn't sync
- Can be done in parallel with steps 2-5

---

## What's NOT in this path

- **F0 sidebar reconciliation** — invite button can live anywhere for now (share modal, header, wherever it fits fastest)
- **F1 publish button** — publishing already works enough to have apps with URLs
- **F6 user list** — owner doesn't need to see who joined yet
- **A4/A5 list/delete invites** — no admin UI, no revocation yet
- **CLI** — all web
- **Mobile** — desktop only
- **Custom permissions** — collaborative default (writer + inviteWriter) for all invites, no `--reader` equivalent in the UI yet

---

## Permissions for this path

Every invite uses the collaborative default:
- `access: "write"` — invitee can read and write data
- `inviteWriter: true` — invitee can invite others (same permissions)

No permission picker in the UI. The owner just clicks "Invite" and gets a link. Locking down to reader-only comes later with CR-03.

---

## Next Layer: CR Features

After the minimal task chain ships, these three features complete the web invite experience.

### CR-01. Progressive unauthenticated onboarding (read-first)

Let new users open and use vibes in reader mode without Clerk login; require auth only at first write.

**Frontend changes:**
- Add `guest` session state in app shell
- Load Fireproof local state for guest readers using install-scoped local identity
- On first mutating action (edit/save/publish/data write), show auth gate modal instead of failing
- After successful login, continue the blocked write action automatically

**Backend/API changes:**
- No new auth requirement for read paths already public
- Ensure write paths return a clear `require-login` error shape for UX handoff

**Acceptance criteria:**
- Unauthenticated user can open shared vibe and read data
- First write triggers login modal
- After login, intended write succeeds without redoing flow

### CR-02. Remix branch flow with inherited read context

Prevent empty-state remix by giving users a branching choice and inherited read access to source data.

**Frontend changes:**
- Add remix prompt with options:
  - `Continue with source data (read-only)` (default)
  - `Branch with copied snapshot`
  - `Start empty`
- Show banner indicating current mode and source group

**Backend/API changes:**
- Add remix metadata: `sourceUserSlug/sourceAppSlug/sourceGroup`
- Support read-through binding to source group for inherited-read mode
- Keep writes isolated to remix target unless user chose "copied snapshot"

**Acceptance criteria:**
- Remix no longer opens empty by default
- User can see source data immediately in inherited-read mode
- New writes do not mutate original group data

### CR-03. Invite link governance toggle

Expose simple invite permission control in UI (Collaborator vs Viewer), using existing backend reader flag support.

**Frontend changes:**
- Add invite toggle in share/invite UI:
  - `Collaborator` (default)
  - `Viewer`
- Map Viewer to reader invite payload; Collaborator to writer payload
- Show permission summary in generated link card

**Backend/API changes:**
- Reuse current invite token creation path with reader flag
- Persist/display selected mode in invite list

**Acceptance criteria:**
- Owner can generate both collaborator and viewer links
- Invitee permissions match selected mode
- Existing default behavior remains unchanged when toggle not used
