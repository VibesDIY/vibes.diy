// db-ACL evaluation is defined once in @vibes.diy/vibe-types (db-acl-eval). This
// module re-exports it so the public @vibes.diy/vibe-runtime surface — DbAcl,
// DbAclSubject, canRead, canWrite, inGroup, aclAllows — stays stable for the
// parity test and other consumers.
export type { DbAcl, DbAclSubject } from "@vibes.diy/vibe-types";
export { canRead, canWrite, inGroup, aclAllows } from "@vibes.diy/vibe-types";
