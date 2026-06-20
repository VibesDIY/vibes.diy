import type { DocAccessLevel } from "./index.js";

// Single source of truth for db-ACL evaluation, shared by @vibes.diy/api-svc
// (host) and @vibes.diy/vibe-runtime (client). Lives in @vibes.diy/vibe-types
// because both packages already depend on it. LEAF MODULE: imports nothing from
// @vibes.diy/api-types, so api-types can re-export the structural DbAcl /
// DbAclSubject from here (via the vibe-types barrel) without adding a runtime
// edge — the DocAccessLevel import above is type-only and fully erased.
export type DbAclSubject = "members" | "editors" | "submitters" | "readers";
export interface DbAcl {
  read?: DbAclSubject[];
  write?: DbAclSubject[];
  delete?: DbAclSubject[];
}

export const canRead = (level: DocAccessLevel): boolean => level === "override" || level === "editor" || level === "viewer";

export const canWrite = (level: DocAccessLevel): boolean => level === "override" || level === "editor" || level === "submitter";

export function inGroup(level: DocAccessLevel, group: DbAclSubject): boolean {
  if (level === "override") return true;
  switch (group) {
    case "members":
      return level === "editor" || level === "viewer" || level === "submitter";
    case "editors":
      return level === "editor";
    case "submitters":
      return level === "submitter";
    case "readers":
      return level === "editor" || level === "viewer";
  }
}

export function aclAllows(acl: DbAcl | undefined, cap: "read" | "write" | "delete", access: DocAccessLevel): boolean {
  const subjects = acl?.[cap];
  if (subjects === undefined) {
    return cap === "read" ? canRead(access) : canWrite(access);
  }
  return subjects.some((g) => inGroup(access, g));
}
