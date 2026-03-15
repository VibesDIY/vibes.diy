# Web MVP — Visibility + Request Write Access

Simplest path to collaborative apps, web only. No CLI, no mobile, no admin UI. Groups are private by default; owners opt in to public mode. Writers request access, owners approve.

---

## The Flow

### Read access (private by default, public is opt-in)

1. Owner publishes a vibe (gets a URL) — group is private by default
2. Owner enables `group.public = true` if they want unauthenticated reads
3. If public: visitor opens URL → sees app and data, read-only. If private: visitor must sign in and have `membership.read`.

### Write access

4. Visitor wants to write → clicks "Request Access"
5. Clerk sign-in → visitor's active handle sends access request to owning handle
6. Owner sees request (showing requesting handle's slug) in live approval panel → approves
7. Requesting handle gets a Membership with write access and synced data

---

## Task Chain

### 1. P2 — Run D1 migrations
Create invite/access tables in production.
- `pnpm run drizzle:d1-remote`
- No code changes, just a migration run
- **Unlocks**: everything below

### 2. A1 — Expose `requestAccess` handler
New EventoHandler for visitors to request write access. Stores the request with visitor's Clerk identity and target group.
- **Unlocks**: visitors can request access from the app

### 3. A2 — Expose `approveAccess` handler
New EventoHandler for owners to approve/deny pending requests. Creates membership on approval.
- **Unlocks**: owners can grant write access

### 4. A3 — Expose `getFPToken`
New EventoHandler wrapping `invite-system.ts:311-392`. Returns ledger/tenant/roles for shared access.
- **Unlocks**: approved members get Fireproof cloud tokens for synced data

### 5. F4 — Request access UI + owner approval panel
- Visitor side: "Request Access" button appears when trying to write without membership
- Owner side: live panel showing incoming requests, approve/deny buttons
- The `invite.tsx-off` route becomes the approval panel
- **Unlocks**: the full loop works in the browser

### 6. P3 — Deploy
Tag for staging, verify, tag for production.
- Only needs A1-A3 handlers (skip admin handlers for now)
- **Unlocks**: live access requests

### 7. P1 — Configure FPCLOUD_URL
Set `FPCLOUD_URL` + `DASHBOARD_URL` so synced data actually flows.
- Without this, approved members see the app but data doesn't sync
- Can be done in parallel with steps 2-5

---

## What's NOT in this path

- **F0 sidebar reconciliation** — approval panel can live anywhere for now (route, modal, wherever it fits fastest)
- **F1 publish button** — publishing already works enough to have apps with URLs
- **A5 revocation** — no member removal yet
- **CLI** — all web
- **Mobile** — desktop only
- **Custom permissions** — collaborative default (writer + inviteWriter) for all approvals. No Collaborator vs Viewer toggle yet
- **Pre-approved tokens** — future convenience, not needed for MVP

---

## Permissions for this path

Every approval uses the collaborative default (per-handle membership):
- `write: true` — approved handle can read and write data
- `inviteWriter: true` — approved handle can invite others (same permissions)

No permission picker in the UI. The owner just clicks "Approve" and the requesting handle gets full write access. Locking down to reader-only comes later with CR-03.

---

## Next Layer: CR Features

After the minimal task chain ships, these three features complete the web invite experience.

### CR-01. Progressive unauthenticated onboarding (read-first)

When a group is public, unauthenticated users can see apps and data. This CR is about making the transition to write smooth.

**Frontend changes:**
- On first mutating action (data write), show auth gate modal instead of failing
- After successful login, automatically trigger the access request flow
- After approval, continue the blocked write action automatically

**Backend/API changes:**
- Ensure write paths return a clear `require-login` or `require-membership` error shape for UX handoff

**Acceptance criteria:**
- Unauthenticated user can open any public vibe and read data
- First write triggers login → request access flow
- After approval, intended write succeeds without redoing flow

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

### CR-03. Approval governance toggle

Expose simple permission control when approving access (Collaborator vs Viewer), using existing backend reader flag support.

**Frontend changes:**
- Add toggle in approval panel:
  - `Collaborator` (default) — write + inviteWriter
  - `Viewer` — read only
- Show permission summary next to each approved member

**Backend/API changes:**
- Reuse current membership creation path with reader flag
- Persist/display selected mode in member list

**Acceptance criteria:**
- Owner can approve as either collaborator or viewer
- Approved member permissions match selected mode
- Existing default behavior (collaborative) remains unchanged when toggle not used

### CR-04. Pre-approved instant access tokens (future)

For quick sharing (e.g., in a meeting), generate a time-limited token appended to the app URL.

**Frontend changes:**
- "Generate instant link" button in approval panel → creates URL with `?invite=TOKEN`
- Show TTL countdown on generated link

**Backend/API changes:**
- `createInviteToken` API with TTL and permission config
- Auto-approve any access request that arrives with a valid, non-expired token

**Acceptance criteria:**
- Token auto-approves within TTL window
- After TTL, if group is public the URL still works for reading, write falls back to request-access
- No public write — Clerk sign-in always required
