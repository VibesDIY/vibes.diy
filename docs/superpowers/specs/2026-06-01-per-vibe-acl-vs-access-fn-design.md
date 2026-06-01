# Per-Vibe ACL vs Access Functions: How They Ought to Interact

## The Two Systems

**Per-vibe ACL** (existing) — app-level settings stored in AppSettings:
- Fixed roles: owner, editor, viewer, submitter
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

## Principle: Two Layers Gate Two Things

Per-vibe ACL gates the **app shell** — who can see the app, who can edit source code, who gets the editor vs viewer UI.

Access functions gate **data** — who can read/write specific documents in specific databases, routed to specific channels.

The trouble is that per-vibe ACL *also* gates data today (via canRead/canWrite role checks and dbAcls). When both systems are active on the same database, there are two overlapping authorities.

---

## Feature-by-Feature: What Ought to Happen

### 1. Public Access Toggle

| Scenario | Current behavior | Least-surprise behavior |
|---|---|---|
| Public ON, no access fn | Anyone reads all databases | Same — no change |
| Public ON, access fn exists | Anyone reads all databases (access fn channels bypassed?) | Access fn governs reads: only `grant.public` channels are world-readable. The toggle should not punch through channel isolation. |
| Public OFF, access fn has `grant.public` | Anonymous reads blocked at app level | `grant.public` should work — the access fn is the authority for that database. The per-vibe toggle should only affect databases *without* an access fn export. |

**Verdict:** When an access fn export exists for a database, the public toggle should not affect that database's read access. Public reads come from `grant.public` in the access fn output. The toggle remains meaningful for databases without access fn exports (including the default `data` database in simple vibes).

### 2. Request Access / Auto-Approve

The request flow grants a platform role (editor or viewer). But access function roles are a separate namespace — they come from `members` reduce across documents, not from platform grants.

| Scenario | Surprise |
|---|---|
| User auto-approved as "editor", access fn requires `ctx.requireRole("team-member")` | User has editor badge but can't write. Confusing. |
| User auto-approved as "viewer", access fn grants them channels via a document | User has viewer badge but can actually write to granted channels. Confusing in the other direction. |

**Verdict:** When access functions exist, the request/auto-approve role should mean *app shell access only*:
- **Can they see the app?** Yes (they passed the door).
- **Can they edit source code?** Only if role is editor.
- **Can they read/write data?** Determined entirely by the access fn's grants/channels/members — the platform role is irrelevant for data.

The auto-approve UI could be reframed: "auto-approve" means "let them in the door automatically" rather than "grant them data permissions." Data permissions come from the access fn's document-driven grants.

### 3. Email Invites

Same analysis as request/auto-approve. The invited role (editor/viewer) controls app-shell access. Data access comes from the access fn.

**Verdict:** Invite role = app shell role, not data role. The invite gets you through the door; the access fn decides what data you see.

### 4. dbAcls (Per-Database ACLs)

dbAcls use subject groups (members/editors/submitters/readers) projected from per-vibe roles. Access functions use channels and their own role system. Having both active on the same database creates two overlapping authorities with no defined precedence.

| Scenario | Surprise |
|---|---|
| dbAcl says `{ write: ["editors"] }`, access fn allows any authenticated user to write | Which wins? |
| Access fn forbids a write via `throw { forbidden }`, dbAcl allows it | Does dbAcl override the access fn? (It shouldn't.) |
| dbAcl restricts reads to "readers", access fn grants a channel via `grant.users` | User has channel access but dbAcl blocks the read. |

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

| Per-vibe ACL feature | Without access fn | With access fn for that database |
|---|---|---|
| Public access toggle | Controls read access to all DBs | Ignored — `grant.public` channels control public reads |
| Request/auto-approve role | Grants data read/write via canRead/canWrite | App-shell only — data access from access fn grants |
| Email invite role | Same as above | Same as above — app-shell only |
| dbAcls | Per-DB subject-group gate | Superseded — access fn is the authority |
| Comments toggle | Convenience dbAcl | Superseded if `export function comments` exists |
| The door (landing card) | Controls app visibility | Unchanged — still controls app visibility |
| Clone / remix | Controls code copying | Unchanged |
| Editor UI access | Controls who sees code editor | Unchanged |

---

## What This Implies About Redundancy

When a vibe has `/access.js`, the following per-vibe ACL features become **dead weight for data access**:

1. **`publicAccess.enable`** — replaced by `grant.public` channels
2. **`request.autoAcceptRole`** — the granted role has no data meaning; only the door-opening matters
3. **Email invite role** — same; the role is app-shell-only
4. **All dbAcls** — strictly weaker than access fn, and conflicting when both are active
5. **The subject groups** (members/editors/submitters/readers) — these project from per-vibe roles, which aren't the access fn's role system

What per-vibe ACL **cannot** be replaced:
- **The door** — who can see the app at all
- **Editor UI gate** — who can modify source code (`/App.jsx`, `/access.js`)
- **Clone/remix** — app-level operations

The per-vibe ACL system was designed before access functions existed. It served double duty as both "app shell gate" and "data gate." Access functions now handle the data gate with far more precision. The remaining per-vibe ACL role is as the app shell gate — and for that purpose, the current system (public toggle, request access, invites, the door) is overbuilt. "Can they see the app?" and "can they edit source?" are binary questions that don't need 13 access states.

---

## Open Questions

1. **Should per-vibe roles feed into access fn roles?** One possible bridge: a platform "editor" grant could automatically contribute to a well-known access fn role (e.g., `members: { "platform-editors": [userHandle] }`). This would make the two role systems composable rather than parallel. But it adds complexity and couples the systems.

2. **What does the sharing UI show when access functions exist?** The current sharing page (good.vibes.diy/sharing) is entirely about per-vibe ACL. If data access comes from access fn documents, the sharing UI can't show who has access to what — that's materialized from document state, not from AppSettings. The sharing page might need to say "data access is controlled by /access.js" and link to the access fn documentation.

3. **Should simple vibes (no /access.js) keep working exactly as today?** Yes — "databases without a matching export use the default app-level permissions" (fireproof.md). The per-vibe ACL system is the correct default for vibes that don't need per-document policy.

4. **Is the 13-state access model worth keeping for the door?** The door needs: owner, has-access, no-access, pending, public. That's 5 states, not 13. The fine distinctions (editor vs viewer vs submitter, invite vs request vs auto-join) mattered when the platform role determined data access. If it only determines app-shell access, fewer states are needed.
