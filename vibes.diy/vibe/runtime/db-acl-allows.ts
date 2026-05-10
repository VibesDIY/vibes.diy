import type { DocAccessLevel } from "@vibes.diy/vibe-types";

// Inline type aliases matching @vibes.diy/api-types — kept local so
// vibe-runtime doesn't need a dependency on the server-side api-types package.
export type DbAclSubject = "members" | "editors" | "submitters" | "readers";
export interface DbAcl {
  read?: DbAclSubject[];
  write?: DbAclSubject[];
  delete?: DbAclSubject[];
}

export const canRead = (level: DocAccessLevel): boolean => level === "owner" || level === "editor" || level === "viewer";

export const canWrite = (level: DocAccessLevel): boolean => level === "owner" || level === "editor" || level === "submitter";

export function inGroup(level: DocAccessLevel, group: DbAclSubject): boolean {
  if (level === "owner") return true;
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
