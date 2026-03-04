import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useImperativeHandle,
  useRef,
} from "react";
import { S } from "../lib/styles.js";
import { EditCtx } from "../lib/EditCtx.js";
import { FieldNode } from "./FieldNode.js";
import { useMobile } from "./MobileProvider.js";

export interface LiveDocTreeHandle {
  undo: () => void;
  discard: () => void;
}

interface LiveDocTreeProps {
  doc: Record<string, unknown>;
  expandDepth: number;
  onTableJump?: (data: unknown[], label: string) => void;
  onDocChange: (doc: Record<string, unknown>) => void;
  onStateChange?: (state: { isDirty: boolean; canUndo: boolean }) => void;
}

export const LiveDocTree = React.forwardRef<
  LiveDocTreeHandle,
  LiveDocTreeProps
>(function LiveDocTree(
  { doc, expandDepth, onTableJump, onDocChange, onStateChange },
  ref
) {
  const mob = useMobile();
  const [history, setHistory] = useState<string[]>([]);
  const [original] = useState(() => JSON.stringify(doc));
  const isDirty = JSON.stringify(doc) !== original;
  const canUndo = history.length > 0;

  const push = useCallback(
    () => setHistory((h) => [JSON.stringify(doc), ...h.slice(0, 30)]),
    [doc]
  );
  const change = useCallback(
    (newDoc: Record<string, unknown>) => {
      push();
      onDocChange(newDoc);
    },
    [push, onDocChange]
  );
  const undo = useCallback(() => {
    if (!history.length) return;
    onDocChange(JSON.parse(history[0]));
    setHistory((h) => h.slice(1));
  }, [history, onDocChange]);
  const discard = useCallback(() => {
    onDocChange(JSON.parse(original));
    setHistory([]);
  }, [original, onDocChange]);

  useImperativeHandle(ref, () => ({ undo, discard }), [undo, discard]);
  const prevStateRef = useRef({ isDirty, canUndo });
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev.isDirty !== isDirty || prev.canUndo !== canUndo) {
      prevStateRef.current = { isDirty, canUndo };
      onStateChange?.({ isDirty, canUndo });
    }
  }, [isDirty, canUndo, onStateChange]);

  const [focusKey, setFocusKey] = useState<string | null>(null);

  const ctx = useMemo(
    () => ({ doc, change, onTableJump, expandDepth, mob, focusKey, setFocusKey }),
    [doc, change, onTableJump, expandDepth, mob, focusKey]
  );

  return (
    <EditCtx.Provider value={ctx}>
      <div>
        <div
          style={{
            fontSize: 9,
            color: S.textMuted,
            fontFamily: S.mono,
            marginBottom: 8,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span>tap value to edit</span>
          {!mob && <span>double-click key to rename</span>}
          <span>tap type to convert</span>
        </div>
        <div>
          {Object.entries(doc).map(([k, v], idx, arr) => (
            <FieldNode
              key={k}
              keyName={k}
              value={v}
              path={[k]}
              parentIsArray={false}
              depth={0}
              isFirst={idx === 0}
              isLast={idx === arr.length - 1}
            />
          ))}
          <div
            style={{ padding: "4px 5px", marginLeft: 14, marginTop: 4 }}
          >
            <span
              onClick={() => {
                let nk = "newField";
                let i = 1;
                while (Object.prototype.hasOwnProperty.call(doc, nk))
                  nk = `newField_${i++}`;
                setFocusKey(nk);
                change({ ...doc, [nk]: "" });
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                padding: mob ? "8px 14px" : "3px 10px",
                borderRadius: 4,
                border: `1px dashed ${S.border}`,
                color: S.textDim,
                fontSize: mob ? 12 : 10,
                fontFamily: S.mono,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = S.accent;
                e.currentTarget.style.color = S.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = S.border;
                e.currentTarget.style.color = S.textDim;
              }}
            >
              + Add field
            </span>
          </div>
        </div>
      </div>
    </EditCtx.Provider>
  );
});
