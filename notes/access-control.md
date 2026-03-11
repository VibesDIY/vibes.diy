# Access Control Model

Single source of truth for the vibes.diy permission system. Other docs ([mvp-invites.md](mvp-invites.md), [cli-design.md](cli-design.md), [url-structure.md](url-structure.md)) reference this model.

> **Code vs. docs:** The current code uses `userId` for membership/ownership and `RoleType` (`'admin' | 'editor' | 'viewer'`) for permissions. This doc describes the target model: `handleId`-keyed membership with capability flags. The database is empty, so we implement the target model directly.

---

## Core Concepts

- **Handle** — the identity principal. A user can own multiple handles (e.g., `@jchris`, `@jchris-bot`). Each handle acts independently — inviting one does not grant access to another.
- **Group** — the unit of access control. Each group has one owning handle and zero or more members. **Private by default.**
- **Membership** — a per-handle, per-group record carrying permission flags.
- **Owner** — the handle that owns the Group. Implicitly has all permissions. Not stored as a Membership — derived from the Group → Handle chain.
- **Public mode** — opt-in flag (`group.public = true`). When enabled, unauthenticated users can read both app code (filesystem) and data (StatePartition). When disabled (default), only members with `read` can access.

---

## Handles as Identity Principals

A handle is the principal for invitations, membership, and access control — not the user behind it.

- `handleId` is an immutable identifier (auto-generated UUID). `handleSlug` is the human-readable display name (can be renamed).
- Inviting `@jchris` to a group does NOT grant access to `@jchris-bot`, even though the same user owns both.
- The user behind the handles manages them all, but each handle acts independently in the access control system.
- Membership records, ACLs, invite tokens, and invite acceptances all key on `handleId`, never `userId` directly.
- `userId` (Clerk's immutable user identifier) lives only on the Handle record itself. The `userId` → `handleId` resolution happens at auth time: "authenticate user, resolve their active handle, then act as that handle."

---

## Active Handle Selection

No server-side primary handle exists. Handle choice is an agent-local UX concern unless explicitly provided via `--as`. Selection precedence:

1. **`--as @handle-slug`** — explicit flag wins (CLI); handle picker wins (web UI)
2. **Last-used handle** — agent-local state: CLI reads from `vibes.json` or local config; web reads from browser state (localStorage). Updated on each successful handle-scoped action.
3. **Single-handle shortcut** — if the user has exactly one handle, use it (no ambiguity)
4. **Fail** — "Multiple handles found; pass `--as @handle`" (TTY environments may prompt interactively; non-interactive/CI must fail deterministically)

This preserves deterministic behavior now and remains compatible with future per-handle access keys.

- **Validation:** the acting handle must belong to the authenticated user (`userId` owns `handleId`)
- **Error states:**
  - No handles at all → "No handle. Run: use-vibes login" (login flow should ensure at least one handle exists)
  - `--as @slug` doesn't belong to user → "Handle @slug not found for your account"
  - `--as @slug` exists but is another user's → same error (don't leak existence)
  - Multiple handles, no `--as`, no last-used → "Multiple handles found; pass `--as @handle`"

---

## Handle Transfer

A handle can be transferred from one user to another (e.g., `@company-bot` moves from employee A to employee B).

Because Membership, invites, and group ownership all key on `handleId` (not `userId`), transfer is a single-field update: change `Handle.userId` to the new owner. All memberships, pending invites, and group ownership follow the handle automatically — no records need updating.

- The old user loses access to everything that handle was part of
- The new user inherits it all
- This is correct: the handle is what was invited, not the person behind it

Contrast with a `userId`-keyed model: transfer would require updating every membership, invite, and group ownership record — error-prone and non-atomic.

---

## No `userId` on Membership or Invites

- `Membership` has `handleId` + `groupId` — no `userId`
- `InviteToken` targets a handle (via `handleId` or `handleSlug` for display) — the token creator is identified by `ownerHandleId`
- `AcceptInvite` records which handle accepted — `acceptHandleId`
- The `userId` → `handleId` resolution happens at auth time only
- This means queries like "what groups is user X in?" require a join through Handle — intentional, because the answer depends on which handles they own *right now*

---

## Membership Record

```typescript
interface Membership {
  handleId: string;      // immutable handle identifier (not the mutable slug)
  groupId: string;       // which group
  read: boolean;         // can read the group's StatePartition
  write: boolean;        // can write to the group's StatePartition (implies read)
  inviteReader: boolean;  // can invite new members with read access
  inviteWriter: boolean;  // can invite new members with read+write access
  removeMember: boolean;  // can remove other members from the group
  deploy: boolean;        // can push code to the group (publish, live)
  manage: boolean;        // can modify other members' permission flags
}
```

---

## Permission Matrix

| Action | Required |
|--------|----------|
| Read group (code + data) | `group.public = true` **or** `membership.read` |
| Write group data | `membership.write = true` |
| Invite as reader | `membership.inviteReader = true` |
| Invite as writer | `membership.inviteWriter = true` |
| Remove a member | `membership.removeMember = true` |
| Deploy code (`publish`, `live`) | Group owner **or** `membership.deploy = true` |
| Manage flags on other members | `membership.manage = true` |
| Update `filesystemCID` directly | Group owner **or** `membership.deploy = true` |

---

## Preset Roles

These are convenience labels, not stored values. The system stores flags.

| Role | Flags |
|------|-------|
| **Reader** | `read` |
| **Collaborator** | `read`, `write`, `inviteWriter` |
| **Deployer** | `read`, `write`, `deploy` |
| **Admin** | all flags `true` |
| **Owner** | implicit — all permissions, not a membership |

The collaborative default (granted on approval) is **Collaborator**: `write` + `inviteWriter`. Everyone is a peer, everyone can bring more peers.

---

## Data vs. Code Permissions

Data and code are independent concerns:

- **Data** (`write`) — can create/update/delete documents in the group's StatePartition
- **Code** (`deploy`) — can update `filesystemCID`, changing which app version the group runs

A collaborator can write data but not deploy new code. A deployer can push code but might also write data. The owner can do both. This separation matters because:

1. A team member might need to contribute data without being able to break the app
2. A CI bot might deploy code without needing write access to user data
3. Cross-handle deployment (`use-vibes publish alice/app/group`) requires `deploy` on Alice's group

---

## Cross-Handle Deployment

The fully-qualified target path (`owner/app/group`) enables deploying to another handle's group:

```
use-vibes publish alice/kanban/team
```

This works when:
- The acting handle is the group owner (i.e., the acting handle is `@alice`), **or**
- The acting handle has a Membership for that group with `deploy = true`

The `deploy` flag is granted by the group owner (or anyone with `manage = true`) like any other permission flag.

---

## Access Flow

1. Alice creates a vibe → her handle `@alice` owns the Group (private by default)
2. If Alice wants public access, she sets `group.public = true`
3. Bob opens the URL → if public, sees app and data; if private, prompted to sign in
4. Bob's active handle requests access → Alice approves → Membership created for Bob's handle with collaborative defaults (`write` + `inviteWriter`)
5. If Alice wants Bob's handle to deploy code too, she grants `deploy = true` on that handle's membership

---

## Future: Per-Handle Device Keys

**Today:** Auth is user-scoped. One device key per device, certified against the user's Clerk identity. The device key authenticates the user; handle selection happens after auth. This is intentional — it keeps the current implementation simple and doesn't block future evolution.

**Future:** Device keys scoped to a specific handle — a key for `@jchris` can't act as `@jchris-bot`. The user manages which handles a device key can act as. Enables: agent handles with their own device keys, delegated access without full user trust.

---

## Where Each Doc Covers This

| Doc | Focus |
|-----|-------|
| [mvp-invites.md](mvp-invites.md) | Request-access flow, invite tokens, permission flag table |
| [cli-design.md](cli-design.md) | Target resolution, cross-handle deploy via fully-qualified paths |
| [url-structure.md](url-structure.md) | Data model (Mermaid class diagram), `filesystemCID` gating |
| [mvp-web.md](mvp-web.md) | Web-only approval UI, collaborative defaults |
