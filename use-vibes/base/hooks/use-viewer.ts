import { aclAllows, useVibeContext as useRuntimeVibeContext, type DbAcl, type ViewerEnv } from "@vibes.diy/vibe-runtime";

// Derived from ViewerEnv so we don't need a direct dep on @vibes.diy/vibe-types.
type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;
type DocAccessLevel = ViewerEnv["access"];

export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;
  readonly dbAcls: Record<string, DbAcl>;
  readonly can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
}

export function useViewer(): UseViewerResult {
  const { mountParams } = useRuntimeVibeContext();
  const env = mountParams.viewerEnv;
  const viewer = env?.viewer ?? null;
  const access: DocAccessLevel = env?.access ?? "none";
  const dbAcls: Record<string, DbAcl> = env?.dbAcls ?? {};

  function can(action: "read" | "write" | "delete", dbName?: string): boolean {
    if (dbName !== undefined) {
      return aclAllows(dbAcls[dbName], action, access);
    }
    // No dbName: true iff the action is allowed for *every* db this app
    // could have. The app-scoped fallback (no override) plus every
    // configured override must all allow it. For a 1-db vibe with no
    // custom ACL this collapses to the role check.
    if (!aclAllows(undefined, action, access)) return false;
    for (const acl of Object.values(dbAcls)) {
      if (!aclAllows(acl, action, access)) return false;
    }
    return true;
  }

  return { viewer, access, dbAcls, can };
}
