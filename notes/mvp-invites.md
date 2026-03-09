# Public Read, Request Write & Permissions

How group sharing, access requests, and access control work.

---

## Public Read

Apps are readable by anyone. The filesystem is public — no auth needed to open an app URL and see it running. Most apps work fine as public read-only. No invite or request-access machinery is needed for this case.

This is the baseline: share a URL, people can see your app and its data. Done.

---

## Request Write Access

When a visitor wants to write data, they request access via the regular app URL. No special invite link needed.

1. Visitor opens the app URL → sees the app running (public read)
2. Visitor tries to write → prompted to sign in with Clerk
3. After sign-in, visitor sends an access request to the owner
4. Owner sees the request arrive in their live approval panel
5. Owner approves → visitor gets write membership with synced data

The request is scoped to a single target (`jchris/coffee-order/work-lunch`). Different groups of the same app can have completely different audiences. The owner's `dev` group might be private, `work-lunch` shared with coworkers, `family-reunion` shared with family — each with its own member list and approval queue.

---

## Ownership Chain

```
Clerk Identity → User → Handle → Vibe → Group
                                         ├── filesystemCID (which app version runs)
                                         ├── StatePartition (collaborative data)
                                         └── Memberships (who has access)
```

Everything is anchored to Clerk's identity provider. The handle owner controls their vibes, and each group owner controls who's in and what version runs.

---

## Enforcement Rules

| Action | Requires |
|---|---|
| Read group filesystem | Public (no auth) |
| Create remix under handle | `session.clerkId` → User → owns Handle |
| Delete remix | `session.clerkId` → User → owns Handle → owns Remix |
| Create/delete group | `session.clerkId` → User → owns Handle that owns Group |
| Update `group.filesystemCID` | `session.clerkId` → User → owns Handle that owns Group |
| Rename group slug | `session.clerkId` → User → owns Handle that owns Group |
| Read group StatePartition | Public (no auth) |
| Write group StatePartition | `membership.access` is `"write"` |
| Invite as reader | `membership.inviteReader = true` |
| Invite as writer | `membership.inviteWriter = true` |
| Remove member | `membership.removeMember = true` |
| Manage (set invite privileges) | `membership.manage = true` |

---

## Permission Flags

Each membership carries an **access level** plus capability flags:

| Field | Type | Description |
|---|---|---|
| `access` | `"read" \| "write"` | Base access level. `write` implies `read` — there is no write-without-read state |
| `inviteReader` | `boolean` | Can invite new members with read access |
| `inviteWriter` | `boolean` | Can invite new members with read+write access |
| `removeMember` | `boolean` | Can remove other members from the group |
| `manage` | `boolean` | Can modify other members' permission flags |

`access` is a single enum, not two booleans — this makes `write = true, read = false` unrepresentable at the type level. A "reader" has `access: "read"`. A "collaborator" has `access: "write"` + `inviteReader`. An "admin" has `access: "write"` + all capability flags. The group owner implicitly has everything.

### Current implementation vs. proposed model

The current API uses a **role-based** model: `RoleType` is `'admin' | 'editor' | 'viewer'` (see `invite.ts`). Invites carry a `roles` array. The capability-flag model above is the proposed replacement — more granular, composable, and avoids the ambiguity of what "editor" means across different app types.

**Discussion point:** migration path. Options include:
- Map roles to flags: `viewer` → `access: "read"`, `editor` → `access: "write"` + `inviteReader`, `admin` → all flags
- Expand the roles enum to cover new capabilities (less flexible)
- Run both side-by-side during transition (API accepts either)

---

## Why filesystemCID Gating Matters

The `filesystemCID` is an immutable content-addressed link. Updating it points the group to an entirely new filesystem snapshot. By gating this mutation behind `ownerClerkId` verification:

- **Only the group owner** can change which app version the group runs
- **Version flexibility**: Owner can switch to any published version without changing the URL
- **Integrity**: Readers get content-addressed guarantees from the CID
- **Identity anchor**: The ownership chain is cryptographically anchored to Clerk's identity provider

---

## Group Sharing Model

The group is the unit of collaboration. Code and data are independent:

- **Group owner** controls which app version runs via `group.filesystemCID`
- **Version flexibility**: Group owner can point `filesystemCID` to any published version's filesystem
- **Membership** grants access to a group with specific permission flags
- **Stable URLs**: Switching app versions doesn't change the group URL
- **Data is independent**: StatePartition (`vibeId + groupId → dataCID`) is separate from code

This means a group can run v1 of the code while another group runs v2 — same app, same data schema, different code versions, different audiences. The group owner decides when to upgrade by pointing `filesystemCID` at a new snapshot.

---

## Approval Defaults

When the owner approves an access request, the default permissions are collaborative: `access: "write"`, `inviteWriter: true` — everyone is a peer, everyone can bring more peers. The owner doesn't need to think about permissions in the happy path.

Each target in `vibes.json` can optionally carry an `invite` object that overrides the default permissions granted on approval:

```json
"work-lunch": {
  "fs": [...]
}
```

No `invite` field needed — the collaborative default just works. To lock down a group, the owner adds an explicit override:

```json
"work-lunch": {
  "invite": { "access": "read", "inviteReader": true },
  "fs": [...]
}
```

This means anyone the owner approves for `work-lunch` gets read-only access by default. The owner can override per-approval in the UI (future: Collaborator vs Viewer toggle).

---

## Future: Pre-Approved Instant Access

For quick sharing (e.g., in a meeting), the owner can generate a time-limited token that auto-approves requests:

- Optional URL param: `?invite=TOKEN` appended to the regular app URL
- Token has a TTL (e.g., 5 minutes)
- While valid: visitor who signs in is auto-approved with the token's permissions — no owner action needed
- After expiry: the URL still works for public read, but write access falls back to the normal request-access flow
- **No public write** — the token grants membership, not anonymous write. Clerk sign-in is always required

Generated via CLI (`use-vibes invite work-lunch`) or web UI (future). This is a convenience layer on top of request-access, not a replacement.

---

## Moderation & Recovery (Future)

All vibes start collaborative — approved writers can invite more writers. This works until it doesn't (griefers, scale). Because the owner approves every request (or delegates via pre-approved tokens with TTLs), there's a natural chokepoint. When the owner needs to lock things down further:

1. **Bulk downgrade** — demote all writers to readers in one action, then selectively re-authorize trusted collaborators
2. **Data rollback** — restore the StatePartition to a known-good state, ideally with tools to identify when a bad actor joined and roll back to just before that point

These aren't MVP — the approval flow handles the happy path. But the permission model is designed to support this transition: the owner can always change `access` and capability flags on any membership.

---

## CLI Integration

| Command | What it does with permissions |
|---|---|
| `use-vibes invite <group>` | (Future) Generates a pre-approved instant access token with TTL. Inviter must have `inviteReader` or `inviteWriter` flag |
| `use-vibes publish <group>` | Updates `filesystemCID` — requires group ownership |
| `use-vibes live <group>` | Continuously updates `filesystemCID` — requires group ownership |

The primary sharing flow needs no CLI command — just share the app URL. The `invite` command is a future convenience for generating pre-approved tokens.

(Future feature:) Cross-user deployment works through the full target path: `use-vibes publish jchris/foo-bar/amaze` works if the pusher has ownership of that group (or jchris has granted publish access).
