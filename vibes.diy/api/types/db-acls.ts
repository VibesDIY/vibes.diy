import { type } from "arktype";

// ── Per-(userSlug, appSlug, dbName) access control list ────────────
//
// Each db can carry an ACL granting capabilities to subjects, where
// subjects are built-in groups projected from the existing role grants:
//
//   members    = owner ∪ editor ∪ viewer ∪ submitter (anyone with a grant)
//   editors    = owner ∪ editor                       (actively co-editing)
//   submitters = owner ∪ submitter                    (write-only contributors)
//   readers    = owner ∪ editor ∪ viewer              (today's canRead set)
//
// Owner is implicitly in every group. Capabilities not listed in the ACL
// fall back to the per-action role gate (canRead / canWrite).
//
// Stored as ActiveDbAcl entries inside the existing AppSettings JSON
// blob (one entry per dbName). No new SQL table; reads happen via the
// regular ensureAppSettings flow.

export const dbAclSubject = type("'members' | 'editors' | 'submitters' | 'readers'");
export type DbAclSubject = typeof dbAclSubject.infer;

export const dbAcl = type({
  "read?": dbAclSubject.array(),
  "write?": dbAclSubject.array(),
  "delete?": dbAclSubject.array(),
});
export type DbAcl = typeof dbAcl.infer;
export function isDbAcl(obj: unknown): obj is DbAcl {
  return !(dbAcl(obj) instanceof type.errors);
}

export const COMMENTS_DB_NAME = "comments";

// Lazy default returned by the resolver when no entry is stored for the
// well-known `comments` dbName. `read` is intentionally absent — falls
// back to `canRead || isPublicReadable` so authenticated members read
// comments and public-read visitors read them on public vibes.
export const COMMENTS_DEFAULT_ACL: DbAcl = {
  write: ["members"],
  delete: ["members"],
};

// ── ActiveEntry variant — one row per (dbName) inside AppSettings ──

export const ActiveDbAcl = type({
  type: "'active.db-acl'",
  dbName: "string",
  acl: dbAcl,
});
export type ActiveDbAcl = typeof ActiveDbAcl.infer;
export function isActiveDbAcl(obj: unknown): obj is ActiveDbAcl {
  return !(ActiveDbAcl(obj) instanceof type.errors);
}
