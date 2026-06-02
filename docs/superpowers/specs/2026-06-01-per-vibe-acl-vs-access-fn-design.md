# Per-Vibe ACL vs Access Functions: How They Interact

## The Two Systems

**Per-vibe ACL** (app-level membership) — stored in AppSettings:

- Roles: `owner | editor | viewer | submitter | none`
- Owner gets `access: "editor"` by default; `access: "owner"` when admin mode is toggled on
- `isOwner` flag sent on the wire alongside `access` — lets apps distinguish owner-as-editor from granted-editor
- Public access toggle (`publicAccess.enable`)
- Request access with optional auto-approve (`request.enable` + `autoAcceptRole`)
- Email invites with per-invite role
- Per-database ACLs (`dbAcls`) using subject groups (members/editors/submitters/readers)
- Comments toggle (dbAcl on the well-known `comments` database)

**Access functions** (`/access.js`) — per-database, per-document policy code:

- Named exports map to database names
- Channels for read isolation
- Grants (`grant.users`, `grant.roles`, `grant.public`) reduced additively from document outputs
- Roles materialized from `members` reduce across documents
- `ctx.requireAccess(channelId)` / `ctx.requireRole(roleName)` helpers
- `allowAnonymous` for anonymous writes
- `throw { forbidden }` to reject writes
- Owner is implicitly in every role (first admin bootstrap)

---

## Principle: The Door and the Room

Per-vibe ACL is **the door** — who can see the app at all. Access functions are **the room** — they govern what members can do with data once inside.

### Membership = editor

When someone requests access (or gets invited, or auto-approved), the default grant is **editor** (read+write). This is the one role the door hands out, because the access function manages fine-grained permissions inside the trust boundary.

Viewer (read-only) and submitter (write-only) exist for edge cases but are not highlighted as defaults in the sharing UI.

### Owner access model

The owner operates as `access: "editor"` with `isOwner: true` by default. This is deliberate — the owner is a member like everyone else, with the same data permissions. The `isOwner` flag lets apps show owner-specific UI (settings, sharing controls) without granting elevated data access.

When the owner toggles **admin mode**, `access` elevates to `"owner"`:

- ACL checks pass unconditionally (owner is in every subject group)
- Access function enforcement is suppressed (`requireAccess`/`requireRole` become no-ops, `{ forbidden }` results are treated as `{}`)
- Access function still **executes** — channels, grants, and members declarations are preserved
- Admin mode is stored per-connection on the server and in localStorage on the client

---

## Implemented State (as of 2026-06-02)

### Wire Protocol

```typescript
viewerEnv: {
  viewer: ViewerPayload | null,
  access: DocAccessLevel,              // "owner" | "editor" | "viewer" | "submitter" | "none"
  isOwner?: boolean,                   // true for app owner regardless of access level
  dbAcls?: Record<string, DbAcl>,      // per-database subject-group gates
  grants?: Record<string, {            // resolved access fn permissions per database
    channels: string[],
    publicChannels: string[],
    roles: string[],
  }>
}
```

Both `dbAcls` and `grants` can coexist for the same database — they answer different questions. dbAcls gate membership (who can reach the database), grants describe what the access function resolved (channels and roles).

### Client APIs

**`useViewer()` — The Door**

```typescript
const { viewer, access, isOwner, dbAcls, can, isViewerPending, ViewerTag } = useViewer();

can("write"); // app-level: can this role write?
can("write", "comments"); // per-db: does this role pass the dbAcl for comments?
can("read"); // app-level: can this role read?
```

**`useFireproof().access` — The Room**

```typescript
const { database, useLiveQuery, access } = useFireproof("comments");

access.roles; // ReadonlySet<string> — roles from members reduce
access.channels; // ReadonlySet<string> — channels from grant reduce

access.hasRole("moderator"); // boolean convenience
access.hasChannel("general"); // boolean convenience
```

For databases without an access function export, `access` has empty roles and channels — the app uses `can("write")` for UI gating.

**Decision rule for app code:**

- "Can this user interact at all?" → `can("write")`
- "Can this user do X in this database?" → `access.hasRole()` / `access.hasChannel()`
- "Is this the app owner?" → `isOwner`

---

## Feature-by-Feature

### 1. Public Access Toggle

"Public" means the app is visible to non-members. When an access fn exists for a database, the public toggle does not affect that database's read access — `grant.public` channels control member-visible reads.

| Scenario                    | Behavior                                                                |
| --------------------------- | ----------------------------------------------------------------------- |
| Public ON, no access fn     | Anyone reads all databases                                              |
| Public ON, access fn exists | Access fn governs reads; `grant.public` channels readable by any member |
| Public OFF, no access fn    | Only approved members can read                                          |

### 2. Request Access / Auto-Approve

Default approval role is **editor**. The sharing UI presents editor as the primary option. Viewer and submitter are reachable but not highlighted.

### 3. Email Invites

Same as request/auto-approve — default grant is editor.

### 4. dbAcls (Per-Database ACLs)

dbAcls and access functions layer correctly. The dbAcl gate runs first (membership), then the access function (data policy). For databases with access functions, the sensible dbAcl is the default: editors get read+write.

### 5. Comments Toggle

A convenience dbAcl on the well-known `comments` database. Superseded if `export function comments(...)` exists in `/access.js`.

### 6. The Door (Landing Card)

Purely app-level: can you see the app at all? Access functions have no opinion here. Unchanged.

### 7. Admin Mode (Owner Toggle)

Owner can toggle admin mode via the chrome UI. Effects:

- `checkDocAccess` returns `access: "owner"` instead of `"editor"` (passes all ACL checks)
- Access function enforcement suppressed (guards no-op, `{ forbidden }` suppressed)
- Access function still executes for declarative effects (channels, grants, members)
- Stored per-connection on server (`WSSendProvider.adminMode`), in `localStorage` on client
- Bootstrap reads stored admin mode on page reload

### 8. Clone / Remix

App-level operations on source code. Access functions don't control this. Unchanged.

---

## Summary Table

| Per-vibe ACL feature    | Without access fn                     | With access fn for that database                               |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Public access toggle    | Controls read access to all DBs       | Ignored — `grant.public` channels control member-visible reads |
| Request/auto-approve    | Grants editor (read+write) by default | Same — editor through the door; access fn governs data         |
| Email invite            | Same — editor by default              | Same — editor through the door; access fn governs data         |
| Viewer/submitter roles  | Available, not highlighted            | Reserved for edge cases                                        |
| dbAcls                  | Per-DB subject-group gate             | Membership gate — layers with access fn (both run)             |
| Comments toggle         | Convenience dbAcl                     | Superseded if `export function comments` exists                |
| The door (landing card) | Controls app visibility               | Unchanged                                                      |
| Admin mode              | Owner → `access: "owner"`             | Same + access fn enforcement suppressed                        |
| Clone / remix           | Controls code copying                 | Unchanged                                                      |

---

## Open Questions

1. **What does the sharing UI show when access functions exist?** Today the sharing page is about per-vibe ACL. With access functions, it could simplify to: list of members + "data access is controlled by /access.js." Fine-grained per-database permissions are materialized from document state, not from AppSettings.

2. **Should simple vibes (no /access.js) keep working exactly as today?** Yes — "databases without a matching export use the default app-level permissions." The per-vibe ACL system is the correct default for vibes that don't need per-document policy.
