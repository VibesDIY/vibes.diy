# Visibility, Access Requests & Permissions

How group sharing, visibility, access requests, and access control work.

> **Code vs. docs:** The current code uses `userId` for invite ownership/acceptance and `RoleType` for permissions. This doc describes the target model: `handleId`-keyed membership and invite records with capability flags.
>
> **Implementation status (2026-03):** No invite/access-request handlers exist yet. The handle and target resolution model is stable. CLI auth will be reimplemented against `VibesDiyApiIface` before invite commands are built.

---

## Visibility

Groups are **private by default** — only handles with `membership.read` (or the owning handle) can access a group's code and data.

The owning handle can opt in to public mode by setting `group.public = true`. When public, anyone can open the URL and see the app running — no auth needed for reading. Write access still requires membership regardless of visibility mode.

See [access-control.md](access-control.md) for the full permission model.

---

## Request Write Access

When a visitor wants to write data, they request access via the regular app URL. No special invite link needed.

1. Visitor opens the app URL → if group is public, sees the app running; if private, prompted to sign in
2. Visitor tries to write → prompted to sign in with Clerk (if not already)
3. After sign-in, the visitor's active handle sends an access request to the owning handle
4. Owner sees the request (showing the requesting handle's slug) in their live approval panel
5. Owner approves → the requesting handle gets a Membership with collaborative defaults (`write` + `inviteWriter`)

A user with handles `@alice` and `@alice-work` can request access with either. Approving `@alice` does **not** approve `@alice-work` — each handle is an independent identity principal.

The request is scoped to a single target (`jchris/coffee-order/work-lunch`). Different groups of the same app can have completely different audiences. The owner's `dev` group might be private, `work-lunch` shared with coworkers, `family-reunion` shared with family — each with its own member list and approval queue.

---

## Ownership Chain

```
Clerk Identity → User → Handle(s)
                          ↓
                   Handle is invited to Group
                          ↓
                   Membership(handleId, groupId, flags)
```

Everything is anchored to Clerk's identity provider, but the **handle — not the user** — is the identity principal for group membership, invites, and ownership. See [access-control.md](access-control.md) for handle transfer semantics and why `userId` never appears on Membership or invite records.

---

## Enforcement Rules

| Action | Requires |
|---|---|
| Read group filesystem | `group.public = true` or `membership.read` |
| Create remix under handle | session → User → owns acting Handle |
| Delete remix | session → User → acting Handle → owns Remix |
| Create/delete group | session → User → acting Handle owns Group |
| Update `group.filesystemCID` | session → User → acting Handle owns Group |
| Rename group slug | session → User → acting Handle owns Group |
| Read group StatePartition | `group.public = true` or `membership.read` |
| Write group StatePartition | `membership.write = true` |
| Invite as reader | `membership.inviteReader = true` |
| Invite as writer | `membership.inviteWriter = true` |
| Remove member | `membership.removeMember = true` |
| Deploy code (`publish`, `live`) | `membership.deploy = true` (or acting handle owns group) |
| Manage (set invite privileges) | `membership.manage = true` |

---

## Permission Flags

Each membership carries individual capability flags:

| Field | Type | Description |
|---|---|---|
| `read` | `boolean` | Can read the group's StatePartition |
| `write` | `boolean` | Can write to the group's StatePartition (`write` implies `read`) |
| `inviteReader` | `boolean` | Can invite new members with read access |
| `inviteWriter` | `boolean` | Can invite new members with read+write access |
| `removeMember` | `boolean` | Can remove other members from the group |
| `deploy` | `boolean` | Can push code to the group (`publish`, `live`) |
| `manage` | `boolean` | Can modify other members' permission flags |

A "reader" has `read`. A "collaborator" has `read`, `write`, `inviteWriter`. A "deployer" has `read`, `write`, `deploy`. An "admin" has all flags. The owning handle implicitly has everything.

> **Code vs. docs:** The current code uses `RoleType` (`'admin' | 'editor' | 'viewer'`) with a `roles` array on invite tokens. The capability-flag model above is the target — more granular, composable, and avoids ambiguity.

---

## Why filesystemCID Gating Matters

The `filesystemCID` is an immutable content-addressed link. Updating it points the group to an entirely new filesystem snapshot. By gating this mutation behind handle ownership verification:

- **Only the owning handle** (or handles with `membership.deploy`) can change which app version the group runs
- **Version flexibility**: Owner can switch to any published version without changing the URL
- **Integrity**: Readers get content-addressed guarantees from the CID
- **Identity anchor**: The ownership chain is Clerk → User → Handle → Group

---

## Group Sharing Model

The group is the unit of collaboration. Code and data are independent:

- **Owning handle** controls which app version runs via `group.filesystemCID`
- **Version flexibility**: Owner can point `filesystemCID` to any published version's filesystem
- **Membership** grants a handle access to a group with specific permission flags
- **Stable URLs**: Switching app versions doesn't change the group URL
- **Data is independent**: StatePartition (`vibeId + groupId → dataCID`) is separate from code

This means a group can run v1 of the code while another group runs v2 — same app, same data schema, different code versions, different audiences. The owning handle decides when to upgrade by pointing `filesystemCID` at a new snapshot.

---

## Approval Defaults

When the owner approves an access request, the default permissions are collaborative: `write: true`, `inviteWriter: true` — everyone is a peer, everyone can bring more peers. The owner doesn't need to think about permissions in the happy path.

Each target in `vibes.json` can optionally carry an `invite` object that overrides the default permissions granted on approval:

```json
"work-lunch": {
  "fs": [...]
}
```

No `invite` field needed — the collaborative default just works. To lock down a group, the owner adds an explicit override:

```json
"work-lunch": {
  "invite": { "read": true, "inviteReader": true },
  "fs": [...]
}
```

This means any handle the owner approves for `work-lunch` gets read-only access by default. The owner can override per-approval in the UI (future: Collaborator vs Viewer toggle).

---

## Future: Pre-Approved Instant Access

For quick sharing (e.g., in a meeting), the owning handle can generate a time-limited token that auto-approves requests:

- Optional URL param: `?invite=TOKEN` appended to the regular app URL
- Token has a TTL (e.g., 5 minutes)
- While valid: visitor who signs in is auto-approved with the token's permissions — no owner action needed
- After expiry: if group is public the URL still works for reading, but write access falls back to the normal request-access flow
- **No public write** — the token grants membership to the requesting handle, not anonymous write. Clerk sign-in is always required

Generated via CLI (`use-vibes invite work-lunch`) or web UI (future). This is a convenience layer on top of request-access, not a replacement.

---

## Moderation & Recovery (Future)

All vibes start collaborative — approved handles with `write` can invite more writers. This works until it doesn't (griefers, scale). Because the owner approves every request (or delegates via pre-approved tokens with TTLs), there's a natural chokepoint. When the owner needs to lock things down further:

1. **Bulk downgrade** — demote all writers to readers in one action, then selectively re-authorize trusted handles
2. **Data rollback** — restore the StatePartition to a known-good state, ideally with tools to identify when a bad actor joined and roll back to just before that point

These aren't MVP — the approval flow handles the happy path. But the permission model is designed to support this transition: the owner can always change capability flags on any membership.

---

## CLI Integration

| Command | What it does with permissions |
|---|---|
| `use-vibes invite <group>` | (Future) Generates a pre-approved instant access token with TTL. Acting handle must have `inviteReader` or `inviteWriter` flag |
| `use-vibes publish <group>` | Updates `filesystemCID` — requires acting handle to own group or have `membership.deploy = true` |
| `use-vibes live <group>` | Continuously updates `filesystemCID` — requires acting handle to own group or have `membership.deploy = true` |

The primary sharing flow needs no CLI command — just share the app URL. The `invite` command is a future convenience for generating pre-approved tokens.

Cross-handle deployment works through the full target path: `use-vibes publish jchris/foo-bar/amaze` works if the acting handle has `membership.deploy = true` for that group (or is the owning handle). The `deploy` flag is granted by the owner like any other permission flag.
