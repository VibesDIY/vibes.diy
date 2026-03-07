# Instant Join Links & Permissions

How group sharing, invite links, and access control work.

---

## Instant Join Links

`use-vibes invite work-lunch` generates a URL. Anyone who opens it joins that group with the permissions the inviter is allowed to grant. No approval step — the link IS the access.

**Auth model:** the invitee can view the app immediately (filesystem is public). Clerk sign-in is triggered on first write attempt — the app works read-only until then. Once authenticated, the invite is auto-accepted and the invitee gets full membership. This "auth on first write" flow needs work to implement; the current API requires `dashAuth` on the accept call.

The invite is scoped to a single target (`jchris/coffee-order/work-lunch`). Different groups of the same app can have completely different audiences. The owner's `dev` group might be private, `work-lunch` shared with coworkers, `family-reunion` shared with family — each with its own invite link and member list.

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
| Read group StatePartition | `membership.access` is `"read"` or `"write"` |
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

## Invite Defaults

Each target in `vibes.json` can optionally carry an `invite` object that overrides the default permissions for new invite links. When omitted (the normal case), the default is collaborative: `access: "write"`, `inviteWriter: true` — everyone is a peer, everyone can bring more peers.

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

The owner can also override per-invite on the command line without changing vibes.json:

```bash
use-vibes invite work-lunch              # collaborative default (writer + inviteWriter)
use-vibes invite work-lunch --reader     # reader + inviteReader (readers bring more readers)
use-vibes invite work-lunch --no-invite  # writer, but can't invite anyone
```

The two presets have sensible invite defaults: bare `invite` grants writer + inviteWriter, `--reader` grants reader + inviteReader. Both create viral growth by default. `--no-invite` strips invite powers from either preset.

To grant selective invite powers, name the one you want — the other defaults to false:

```bash
use-vibes invite work-lunch --invite-reader            # writer, can invite readers (not writers)
use-vibes invite work-lunch --invite-writer            # writer, can invite writers (not readers)
use-vibes invite work-lunch --reader --no-invite       # reader, no invite powers
```

Specifying `--invite-reader` or `--invite-writer` explicitly sets just that flag; the other invite flag is set to false. Specifying both (`--invite-reader --invite-writer`) is the same as the collaborative default — it's a no-op but not an error.

---

## Moderation & Recovery (Future)

All vibes start collaborative — everyone is a writer, everyone can invite more writers. This works until it doesn't (griefers, scale). When the owner needs to lock things down:

1. **Bulk downgrade** — demote all writers to readers in one action, then selectively re-authorize trusted collaborators
2. **Data rollback** — restore the StatePartition to a known-good state, ideally with tools to identify when a bad actor joined and roll back to just before that point

These aren't MVP — the collaborative default handles the happy path. But the permission model is designed to support this transition: the owner can always change `access` and capability flags on any membership.

---

## CLI Integration

| Command | What it does with permissions |
|---|---|
| `use-vibes invite <group>` | Creates an instant join link for the target group. Inviter must have `inviteReader` or `inviteWriter` flag |
| `use-vibes publish <group>` | Updates `filesystemCID` — requires group ownership |
| `use-vibes live <group>` | Continuously updates `filesystemCID` — requires group ownership |

(Future feature:) Cross-user deployment works through the full target path: `use-vibes publish jchris/foo-bar/amaze` works if the pusher has ownership of that group (or jchris has granted publish access).
