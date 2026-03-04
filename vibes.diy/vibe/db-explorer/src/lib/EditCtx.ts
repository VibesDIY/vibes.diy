import React from "react";

export interface EditCtxValue {
  doc: Record<string, unknown>;
  change: (newDoc: Record<string, unknown>) => void;
  onTableJump?: (data: unknown[], label: string) => void;
  expandDepth: number;
  mob: boolean;
  focusKey: string | null;
  setFocusKey: (key: string | null) => void;
}

export const EditCtx = React.createContext<EditCtxValue | null>(null);

export const META_KEYS = new Set(["_id", "_createdAt", "_updatedAt"]);
