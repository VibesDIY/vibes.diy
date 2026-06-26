import React from "react";
import { canRead, canWrite } from "./db-acl-allows.js";
import { useVibeContext } from "./VibeContext.js";
import type { ViewerEnv } from "./vibe.js";
import { ViewerTagImpl, type ViewerTagProps } from "./use-viewer-tag.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;
type DocAccessLevel = ViewerEnv["access"];

export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;
  readonly isOwner: boolean;
  /** Membership check: is the viewer through the door for this action? Access
   *  functions enforce per-document and per-database rules server-side, so the
   *  client only needs the viewer's app-scoped membership role. */
  readonly can: (action: "read" | "write" | "delete") => boolean;
  /** True while viewer identity has not yet been resolved (e.g. preview mode
   *  before the parent pushes vibe.evt.viewerChanged). Gate access-gated UI
   *  on !isViewerPending rather than rendering the anonymous fallback. */
  readonly isViewerPending: boolean;
  /** Inline user pill. Renders the current viewer (editable) when called
   *  with no props. Pass `ownerHandle` to render another user read-only. */
  readonly ViewerTag: React.FC<ViewerTagProps>;
}

export function useViewer(): UseViewerResult {
  const { mountParams } = useVibeContext();
  const env = mountParams.viewerEnv;
  const isViewerPending = env === undefined;
  const viewer = env?.viewer ?? null;
  const access: DocAccessLevel = env?.access ?? "none";
  const isOwner = env?.isOwner ?? false;

  function can(action: "read" | "write" | "delete"): boolean {
    return action === "read" ? canRead(access) : canWrite(access);
  }

  const ViewerTag: React.FC<ViewerTagProps> = React.useCallback(
    (props: ViewerTagProps) => React.createElement(ViewerTagImpl, { ...props, _viewer: viewer }),
    [viewer]
  );

  return { viewer, access, isOwner, can, isViewerPending, ViewerTag };
}
