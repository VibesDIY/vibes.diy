# Per-Vibe ACL vs Access Functions: How They Ought to Interact

## The Two Systems

**Per-vibe ACL** (existing) — app-level settings stored in AppSettings:

- Fixed roles: owner, viewer, submitter (no "editor" role yet — only owner can edit source or see chats)
- Public access toggle (`publicAccess.enable`)
- Request access with optional auto-approve (`request.enable` + `autoAcceptRole`)
- Email invites with per-invite role
- Per-database ACLs (`dbAcls`) using subject groups (members/editors/submitters/readers)
- 13 access states governing "the door" (landing card)
- Comments toggle (dbAcl on the well-known `comments` database)

**Access functions** (`/access.js`) — per-database, per-document policy code:

- Named exports map to database names
- Channels for read isolation
- Grants (`grant.users`, `grant.roles`, `grant.public`) reduced additively from document outputs
- Roles materialized from `members` reduce across documents
- `ctx.requireAccess(channelId)` / `ctx.requireRole(roleName)` helpers
- `allowAnonymous` for anonymous writes
- `throw { forbidden }` to reject writes

fireproof.md states the relationship explicitly: "The `acl` option above is a coarse per-database gate. Access functions are a finer gate." And: "Databases without a matching export have no access function and use the default app-level permissions."

---

## Principle: The Door and the Room

Per-vibe ACL is **the door** — who can see the app at all. The only approval that matters is "member" (read+write access to the app). Once you're through the door, you're in the trusted group.

Access functions are **the room** — they govern what members can do with data once inside. Channels, grants, roles, anonymous writes — all of that is the access function's domain.

Today the door also tries to gate data (via canRead/canWrite role checks and dbAcls). When access functions exist, that overlap creates confusion. The fix: the door decides who's in, the access function decides what they can do.

### The "member" role is the only approval that matters

When someone requests access (or gets invited, or auto-approved), the meaningful grant is **member** — equivalent to the existing "editor" role (read+write). This is the one role the door needs to hand out, because the access function manages all the fine-grained permissions inside the trust boundary.

**Reader-only** is reserved for edge cases (remediation, restricted accounts, unusual situations). It doesn't need to be hidden, but it shouldn't be highlighted in the UI or docs. The normal path is: request access → approved as member → access function governs data.

---

## Feature-by-Feature: What Ought to Happen

### 1. Public Access Toggle

"Public" in the access function world means **any approved member** — anyone who's through the door. It does not mean anonymous/world-readable.

| Scenario                                 | Current behavior                                          | Least-surprise behavior                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public ON, no access fn                  | Anyone reads all databases                                | Same — no change                                                                                                                                                                  |
| Public ON, access fn exists              | Anyone reads all databases (access fn channels bypassed?) | Access fn governs reads: `grant.public` channels are readable by any member. The toggle should not punch through channel isolation.                                               |
| Public OFF, access fn has `grant.public` | Anonymous reads blocked at app level                      | `grant.public` makes channels readable by any member (not any logged-in user — membership is required). The per-vibe toggle only affects databases _without_ an access fn export. |

**Verdict:** When an access fn export exists for a database, the public toggle should not affect that database's read access. "Public" channels via `grant.public` are readable by all members (anyone through the door). The toggle remains meaningful for databases without access fn exports (including the default `data` database in simple vibes).

### 2. Request Access / Auto-Approve

The only approval role that matters is **member** (read+write, equivalent to the existing "editor" role). Approving someone means letting them through the door into the trusted group. The access function handles everything from there.

- **Can they see the app?** Yes (they passed the door).
- **Can they edit source code?** No — only the owner can edit source code or see chats today.
- **Can they read/write data?** Determined entirely by the access fn's grants/channels/members.

Auto-approve means "let them through the door automatically as a member." The viewer (reader-only) role exists but is reserved for edge cases like remediation — it shouldn't be the default option in the auto-approve UI.

**Verdict:** Approval = member. The access function is the authority for data permissions once inside.

### 3. Email Invites

Same as request/auto-approve. An invite gets you through the door as a member. The access fn decides what data you see once inside.

**Verdict:** Invite = member. Reader-only invites are possible but reserved for edge cases.

### 4. dbAcls (Per-Database ACLs)

dbAcls use subject groups (members/editors/submitters/readers) projected from per-vibe roles. Access functions use channels and their own role system. Having both active on the same database creates two overlapping authorities with no defined precedence.

| Scenario                                                                              | Surprise                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| dbAcl says `{ write: ["editors"] }`, access fn allows any authenticated user to write | Which wins?                                        |
| Access fn forbids a write via `throw { forbidden }`, dbAcl allows it                  | Does dbAcl override the access fn? (It shouldn't.) |
| dbAcl restricts reads to "readers", access fn grants a channel via `grant.users`      | User has channel access but dbAcl blocks the read. |

**Verdict:** Access functions supersede dbAcls for the same database. When `/access.js` exports a function named `foo`, any dbAcl entry for `foo` is ignored. They are two implementations of the same concept (per-database permission narrowing) at different granularities — running both is incoherent.

### 5. Comments Toggle

Today: a dbAcl on the well-known `comments` database. Default is `{ write: ["members"], delete: ["members"] }`, owner can restrict to `{ write: ["editors"], delete: ["editors"] }`.

If someone writes `export function comments(doc, oldDoc, user, ctx) { ... }` in `/access.js`, the access fn should take over.

**Verdict:** The comments toggle is a convenience shorthand for a dbAcl. It follows the same rule — superseded by an access fn export for `comments`. In practice, most vibes won't write an access fn for comments, so the toggle remains useful as a simple UI control for the common case.

### 6. The Door (Landing Card / 13 Access States)

The door is purely app-level: can you see the app at all? It controls what the visitor encounters before any database is opened. Access functions have no opinion here.

**Verdict:** The door stays as per-vibe ACL. No change needed.

### 7. Clone / Remix

App-level operations on source code. Access functions don't control this.

**Verdict:** Stays as per-vibe ACL.

---

## Summary Table

| Per-vibe ACL feature    | Without access fn                                  | With access fn for that database                               |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Public access toggle    | Controls read access to all DBs                    | Ignored — `grant.public` channels control member-visible reads |
| Request/auto-approve    | Grants member (read+write) access through the door | Same — member gets through the door; access fn governs data    |
| Email invite            | Same — invites grant member access                 | Same — member through the door; access fn governs data         |
| Reader-only role        | Available but not highlighted                      | Reserved for edge cases (remediation, restricted accounts)     |
| dbAcls                  | Per-DB subject-group gate                          | Superseded — access fn is the authority                        |
| Comments toggle         | Convenience dbAcl                                  | Superseded if `export function comments` exists                |
| The door (landing card) | Controls app visibility                            | Unchanged — still controls app visibility                      |
| Clone / remix           | Controls code copying                              | Unchanged                                                      |
| Source editing / chats  | Owner-only                                         | Unchanged                                                      |

---

## What This Implies About Simplification

When a vibe has `/access.js`, the per-vibe ACL simplifies to **just the door**:

**Becomes the access fn's job:**

1. **`publicAccess.enable`** — replaced by `grant.public` channels (visible to all members)
2. **All dbAcls** — strictly weaker than access fn, and conflicting when both are active
3. **The subject groups** (members/editors/submitters/readers) — these project from per-vibe roles, which aren't the access fn's role system

**Simplifies to one role:** 4. **`request.autoAcceptRole`** — the only meaningful approval is "member" (read+write); reader-only is reserved for edge cases 5. **Email invite role** — same; invite = member

**Stays with per-vibe ACL:**

- **The door** — who can see the app at all
- **Source editing / chats** — owner-only
- **Clone/remix** — app-level operations

The per-vibe ACL system was designed before access functions existed. It served double duty as both "app shell gate" and "data gate." Access functions now handle the data gate. The door's job is simple: are you in or out? The one approval role is member. Reader-only exists for edge cases but isn't the normal path.

---

## Client API Design: `useViewer()` + `useFireproof().access`

Two layers, matching the door/room metaphor.

### `useViewer()` — The Door (unchanged)

`useViewer()` is the app-level membership and per-database ACL check. The existing API stays as-is — `can("write", "comments")` keeps working, backed by the current dbAcls system.

```typescript
const { viewer, access, dbAcls, can, isViewerPending, ViewerTag } = useViewer();

can("write"); // app-level: can this role write?
can("write", "comments"); // per-db: can this role write to comments? (dbAcl check)
can("read"); // app-level: can this role read?
```

The full role hierarchy (owner/editor/viewer/submitter/none) and dbAcls infrastructure stay in place. Nothing is removed — the system works and `can("write", "comments")` is already in deployed vibes and prompt docs.

### Supply-Side Defaults: Sharing UI

The complexity reduction happens on the **supply side** — what the sharing UI defaults to — not by removing the ACL machinery:

| Sharing control          | Default             | Reachable options                                  |
| ------------------------ | ------------------- | -------------------------------------------------- |
| **Auto-approve role**    | Editor (read+write) | Editor, Viewer (read-only), Submitter (write-only) |
| **Access request grant** | Editor              | Editor, Viewer, Submitter                          |
| **Email invite role**    | Editor              | Editor, Viewer, Submitter                          |
| **Public toggle**        | Off                 | On/Off (controls app visibility)                   |
| **Comments toggle**      | Members can comment | Editors-only, Members                              |
| **Per-db ACLs**          | No overrides        | Available via settings API                         |

Member = editor (read+write). Every entry path defaults to granting full membership — auto-approve, access requests, and email invites all grant editor. The access function (if any) handles fine-grained data permissions from there.

Viewer (read-only) and submitter (write-only) are reachable for edge cases (remediation, restricted accounts, write-only submission flows) but aren't highlighted as the primary options in the sharing UI.

The normal path is: visitor requests access → auto-approved as editor → `can("write")` returns true → access function (if any) governs fine-grained data permissions.

### `useFireproof().access` — The Room (new)

For databases with access functions, the grant reduce already runs on every write. Running it once on page load gives the client the viewer's resolved permissions per database.

```typescript
const { database, useLiveQuery, access } = useFireproof("comments");

access.roles; // Set<string> — roles this user has (from members reduce)
access.channels; // Set<string> — channels this user can read (from grant reduce)

access.hasRole("moderator"); // boolean convenience
access.hasChannel("engineering"); // boolean convenience
```

No separate pending flag — grants arrive in the same `resolveWhoAmI` response as the viewer identity, so `useViewer().isViewerPending` covers both. When `isViewerPending` is false, grants are already populated.

The AI agent writes the access function (so it knows the role names) and writes the UI (so it knows which roles gate which components):

```jsx
function App() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery, access } = useFireproof("comments");

  if (isViewerPending) return null;

  return (
    <div>
      <ViewerTag />
      {access.hasRole("poster") && <CommentForm database={database} />}
      {access.hasRole("moderator") && <ModTools database={database} />}
      {access.hasChannel("announcements") && <Announcements />}
    </div>
  );
}
```

**For databases without an access function export**, `access` has empty roles and channels — the app uses `useViewer().can("write")` for UI gating, same as today.

### Wire Protocol

The server adds resolved grants alongside the existing viewer env fields. Precedence is **server-defined**: for databases that have an access function export, the server sends `grants` and omits that database from `dbAcls`. No client-side conflict resolution.

```typescript
viewerEnv: {
  viewer: ViewerPayload | null,
  access: DocAccessLevel,
  dbAcls?: Record<string, DbAcl>,          // databases WITHOUT access fn exports
  grants?: Record<string, {                  // databases WITH access fn exports
    channels: string[],
    roles: string[],
  }>
}
```

A database appears in **one or the other**, never both. The server decides which based on whether `/access.js` has a matching export for that database name.

Grants are computed during `resolveWhoAmI` by running the grant reduce once per access-function database for the authenticated user. Same work the server already does on writes — just cached for the client on page load.

---

## Open Questions

1. **Should "member" automatically feed into access fn context?** The access fn receives `user` — that already includes the user's handle. Knowing they're a member (through the door) is implicit: if the access fn is running, the user is authenticated. No bridge needed between the two role systems.

2. **What does the sharing UI show when access functions exist?** The current sharing page is entirely about per-vibe ACL. With access functions, the sharing page could simplify to: list of members (everyone who's through the door) + "data access is controlled by /access.js." The fine-grained per-database permissions are materialized from document state, not from AppSettings.

3. **Should simple vibes (no /access.js) keep working exactly as today?** Yes — "databases without a matching export use the default app-level permissions" (fireproof.md). The per-vibe ACL system is the correct default for vibes that don't need per-document policy.

4. ~~**Can we simplify the 13 access states?**~~ **Resolved:** No. The full role hierarchy (owner/editor/viewer/submitter/none) stays. The supply-side defaults handle the simplification — viewer for broad entry, editor for trusted collaborators. The distinction between roles still matters for `can("write")` / `can("read")` gating.
