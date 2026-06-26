# Fireproof Channels — Per-Database Access Control

> **Status (since #2134): legacy substrate, not the client-facing story.** Per-database ACLs
> (`dbAcls`) are still **stored** in AppSettings and **enforced server-side** on every document
> operation (`db-acl-resolver.ts`) — nothing here was removed. What changed is that they are no
> longer surfaced to vibe code: `useViewer().can()` is now a plain membership check and takes no
> `dbName`, and `dbAcls` no longer ride the `whoAmI` / `viewerChanged` wire to the client. In
> practice this mechanism now exists mainly to make the built-in **`comments`** feature work (the
> `comments` lazy default below) and as a low-level knob for power users / the owner sharing UI
> (the ShareModal comments toggle writes `dbAcls` via app settings). For client-side per-document
> or per-database gating, use **access functions** (`useVibe(dbName).can.*`) instead — they run
> the same logic the server enforces, return a `reason`, and **supersede `dbAcls`** when present
> (the access function is the authority). Treat `dbAcls` as the legacy layer; reach for access
> functions first.

## What are Channels?

A **channel** is a per-database access control override layered on top of the existing role-based
access system. Every Fireproof database in a vibe can have its own channel configuration that
tightens (or opens) who can read, write, or delete documents, independently of the app-level
roles.

The default behavior (no channel configured) falls through to the existing role gates
(`canRead` / `canWrite`). A channel is an **opt-in narrowing or widening** of those gates for
a specific `dbName`.

## Subject Groups

Channels express permissions in terms of four built-in groups projected from existing role grants:

| Group        | Who it includes                                             |
| ------------ | ----------------------------------------------------------- |
| `members`    | owner ∪ editor ∪ viewer ∪ submitter (anyone with any grant) |
| `editors`    | owner ∪ editor                                              |
| `submitters` | owner ∪ submitter                                           |
| `readers`    | owner ∪ editor ∪ viewer                                     |

Owner is implicitly in every group — you never need to list owner explicitly in an ACL.

## Channel Shape

```
DbAcl = {
  read?:   DbAclSubject[]   // which groups may read
  write?:  DbAclSubject[]   // which groups may write
  delete?: DbAclSubject[]   // which groups may delete
}
```

Each capability is **independently optional**. Omitting a capability falls back to the role gate
for that operation; listing it pins the check to exactly the named groups.

## Well-Known Default: `comments`

The `comments` dbName has a lazy default channel applied when no explicit entry is stored:

```
{ write: ["members"], delete: ["members"] }
```

`read` is intentionally absent — falls through to `canRead || isPublicReadable` so authenticated
members and public-read visitors can both see comments. All other dbNames return `undefined`
(pure role-gate fallback) when no channel is stored.

## How Channels Are Stored

Channels live as `ActiveDbAcl` entries inside the app's AppSettings JSON blob — one entry per
`dbName`. No dedicated SQL table; reads go through the same `ensureAppSettings` flow used for
every other app config.

Setting a channel:

```
ReqEnsureAppSettingsDbAcl  → { dbAcl: { dbName, acl } }
```

Removing a channel (reverts to lazy default):

```
ReqEnsureAppSettingsDbAclRemove → { dbAclRemove: { dbName } }
```

Only the app **owner** can mutate channel settings; non-owner calls are silently read-only.

## Enforcement Points

The channel is resolved and checked at every document operation:

| Operation              | Check                              |
| ---------------------- | ---------------------------------- |
| `putDoc`               | `aclAllows(acl, "write", access)`  |
| `getDoc` / `queryDocs` | `aclAllows(acl, "read", access)`   |
| `deleteDoc`            | `aclAllows(acl, "delete", access)` |

`resolveDbAcl` returns `Result<DbAcl | undefined>` so callers can **fail closed** on settings-read
errors — a transient failure must never silently revert a tightened channel back to the open default.

## Key Design Properties

- **Fail-closed**: settings errors block access, never open it
- **Per-capability fallback**: omitting `read` from a channel still lets role gates decide reads
- **Owner-only writes**: non-owners cannot configure channels
- **Dual implementation**: the same `aclAllows` / `inGroup` logic exists server-side
  (`db-acl-resolver.ts`) and client-side (`vibe/runtime/db-acl-allows.ts`) for vibe-local evaluation
- **No constructor config**: channels are applied at operation time by the API, not when a database
  is opened; `useFireproof(name)` requires no ACL arguments

## Example: Restrict a Database to Editors Only

To lock the `drafts` database so only editors (not viewers or submitters) can write:

```
dbAcl: { dbName: "drafts", acl: { write: ["editors"], delete: ["editors"] } }
```

Viewers can still read (read falls back to canRead which includes viewers) unless you also
pin read:

```
dbAcl: { dbName: "drafts", acl: { read: ["editors"], write: ["editors"], delete: ["editors"] } }
```

## Relevant Files

- `vibes.diy/api/types/db-acls.ts` — DbAcl type, subject groups, COMMENTS_DEFAULT_ACL
- `vibes.diy/api/svc/public/db-acl-resolver.ts` — `resolveDbAcl`, `aclAllows`, `inGroup`
- `vibes.diy/vibe/runtime/db-acl-allows.ts` — client-side mirror of the same logic
- `vibes.diy/api/svc/public/app-documents.ts` — enforcement in putDoc/getDoc/queryDocs/deleteDoc
- `vibes.diy/api/svc/public/ensure-app-settings.ts` — channel upsert/remove handlers
- `vibes.diy/api/tests/comments-acl.test.ts` — integration tests for channel behavior
- `vibes.diy/api/tests/db-acl-allows.test.ts` — unit tests for aclAllows/inGroup
- `vibes.diy/api/tests/db-acl-allows-parity.test.ts` — server/client parity tests
