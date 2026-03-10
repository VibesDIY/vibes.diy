# Access Control Model

Single source of truth for the vibes.diy permission system. Other docs ([mvp-invites.md](mvp-invites.md), [cli-design.md](cli-design.md), [url-structure.md](url-structure.md)) reference this model.

---

## Core Concepts

- **Group** — the unit of access control. Each group has one owner and zero or more members. **Private by default.**
- **Membership** — a per-user, per-group record carrying permission flags.
- **Owner** — the user whose Handle owns the Group. Implicitly has all permissions. Not stored as a Membership — derived from the Group → Handle → User chain.
- **Public mode** — opt-in flag (`group.public = true`). When enabled, unauthenticated users can read both app code (filesystem) and data (StatePartition). When disabled (default), only members with `read` can access.

---

## Visibility

Groups are **private by default**. Only members with `membership.read` (or the owner) can access the group's code and data.

The owner can set `group.public = true` to allow unauthenticated reads. When public:

- Anyone can open the URL and see the app running
- Anyone can read the group's StatePartition (data)
- Write access still requires membership — public mode never grants write

Public mode is a convenience for sharing — not the baseline. Most collaborative groups stay private; the owner shares access via the approval flow.

---

## Membership Record

```typescript
interface Membership {
  clerkId: string;     // who
  groupId: string;     // which group
  read: boolean;       // can read the group's StatePartition
  write: boolean;      // can write to the group's StatePartition (implies read)
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
3. Cross-user deployment (`use-vibes publish alice/app/group`) requires `deploy` on Alice's group

---

## Cross-User Deployment

The fully-qualified target path (`owner/app/group`) enables deploying to another user's group:

```
use-vibes publish alice/kanban/team
```

This works when:
- The pusher is the group owner (i.e., the pusher is alice), **or**
- The pusher has a Membership for that group with `deploy = true`

The `deploy` flag is granted by the group owner (or anyone with `manage = true`) like any other permission flag.

---

## Access Flow

1. Alice creates a vibe → she owns the Group (private by default)
2. If Alice wants public access, she sets `group.public = true`
3. Bob opens the URL → if public, sees app and data; if private, prompted to sign in
4. Bob requests access → Alice approves → Membership created with collaborative defaults (`write` + `inviteWriter`)
5. If Alice wants Bob to deploy code too, she grants `deploy = true` on Bob's membership

---

## Where Each Doc Covers This

| Doc | Focus |
|-----|-------|
| [mvp-invites.md](mvp-invites.md) | Request-access flow, invite tokens, permission flag table |
| [cli-design.md](cli-design.md) | Target resolution, cross-user deploy via fully-qualified paths |
| [url-structure.md](url-structure.md) | Data model (Mermaid class diagram), `filesystemCID` gating |
| [mvp-web.md](mvp-web.md) | Web-only approval UI, collaborative defaults |
