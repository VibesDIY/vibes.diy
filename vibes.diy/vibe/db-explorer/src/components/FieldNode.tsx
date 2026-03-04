import React, { useState } from "react";
import { S, TC } from "../lib/styles.js";
import { getType, isTabular, smartPreview } from "../lib/utils.js";
import { deepSet, deepDelete, deepRename, deepMove, convertType } from "../lib/deepOps.js";
import { EditCtx, META_KEYS } from "../lib/EditCtx.js";
import { TypeBadge } from "./TypeBadge.js";
import { TypePicker } from "./TypePicker.js";
import { Val } from "./Val.js";
import { ValueInput } from "./ValueInput.js";

interface FieldNodeProps {
  keyName: string | number;
  value: unknown;
  path: (string | number)[];
  parentIsArray: boolean;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
}

export function FieldNode({
  keyName,
  value,
  path,
  parentIsArray,
  depth,
  isFirst,
  isLast,
}: FieldNodeProps) {
  const ctx = React.useContext(EditCtx);
  if (!ctx) {
    throw new Error("EditCtx is missing");
  }
  const { doc, change, onTableJump, expandDepth, mob, focusKey, setFocusKey } = ctx;
  const t = getType(value);
  const isExp = t === "object" || t === "array";
  const [open, setOpen] = useState(depth < expandDepth);
  const [editing, setEditing] = useState(false);
  const shouldFocusKey = focusKey !== null && String(keyName) === focusKey;
  const [editingKey, setEditingKey] = useState(shouldFocusKey);
  const [keyDraft, setKeyDraft] = useState(String(keyName));

  if (shouldFocusKey) {
    setFocusKey(null);
  }
  const isMeta = path.length === 1 && META_KEYS.has(path[0] as string);
  const entries: [string | number, unknown][] = isExp
    ? t === "array"
      ? (value as unknown[]).map((v, i) => [i, v])
      : Object.entries(value as Record<string, unknown>)
    : [];

  const handleTypeChange = (newType: string) => {
    change(
      deepSet(doc, path, convertType(value, t, newType)) as Record<
        string,
        unknown
      >
    );
  };

  const addChild = () => {
    if (t === "array") {
      change(
        deepSet(doc, path, [...(value as unknown[]), ""]) as Record<
          string,
          unknown
        >
      );
    } else {
      const obj = value as Record<string, unknown>;
      let nk = "newField";
      let i = 1;
      while (Object.prototype.hasOwnProperty.call(obj, nk))
        nk = `newField_${i++}`;
      setFocusKey(nk);
      change(
        deepSet(doc, path, { ...obj, [nk]: "" }) as Record<string, unknown>
      );
    }
  };

  return (
    <div style={{ marginLeft: depth > 0 ? (mob ? 12 : 16) : 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: mob ? 6 : 5,
          padding: mob ? "6px 6px" : "3px 5px",
          borderRadius: 3,
          borderLeft: isExp
            ? `2px solid ${(t === "array" ? TC.array : TC.object)}20`
            : "2px solid transparent",
          background: "transparent",
          minHeight: mob ? 36 : 26,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--vibes-hover-tint)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {isExp ? (
          <span
            onClick={() => setOpen(!open)}
            style={{
              color: S.textDim,
              fontSize: mob ? 10 : 8,
              width: mob ? 24 : 12,
              height: mob ? 24 : "auto",
              paddingTop: mob ? 2 : 5,
              textAlign: "center",
              transform: open ? "rotate(90deg)" : "rotate(0)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.1s",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {"\u25B6"}
          </span>
        ) : (
          <span style={{ width: mob ? 24 : 12, flexShrink: 0 }} />
        )}

        {keyName != null && (
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            {editingKey ? (
              <input
                autoFocus
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onBlur={() => {
                  change(
                    deepRename(
                      doc,
                      path.slice(0, -1),
                      String(keyName),
                      keyDraft
                    ) as Record<string, unknown>
                  );
                  setEditingKey(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    change(
                      deepRename(
                        doc,
                        path.slice(0, -1),
                        String(keyName),
                        keyDraft
                      ) as Record<string, unknown>
                    );
                    setEditingKey(false);
                  }
                  if (e.key === "Escape") {
                    setKeyDraft(String(keyName));
                    setEditingKey(false);
                  }
                }}
                style={{
                  background: S.bgDeep,
                  border: `1px solid ${S.accent}50`,
                  borderRadius: 3,
                  color: TC.key,
                  padding: "2px 5px",
                  fontSize: 12,
                  fontFamily: S.mono,
                  outline: "none",
                  width: Math.max(50, keyDraft.length * 8),
                }}
              />
            ) : (
              <span
                onDoubleClick={() => {
                  if (!parentIsArray && !isMeta) {
                    setKeyDraft(String(keyName));
                    setEditingKey(true);
                  }
                }}
                style={{
                  fontFamily: S.mono,
                  fontSize: 12,
                  color: parentIsArray ? S.textDim : TC.key,
                  fontWeight: 500,
                  cursor:
                    !parentIsArray && !isMeta ? "text" : "default",
                }}
                title={
                  !parentIsArray && !isMeta
                    ? "Double-click to rename"
                    : undefined
                }
              >
                {parentIsArray ? (
                  <span style={{ opacity: 0.5 }}>[{keyName}]</span>
                ) : (
                  String(keyName)
                )}
                <span style={{ color: S.textMuted, marginLeft: 1 }}>
                  :
                </span>
              </span>
            )}
          </div>
        )}

        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          {isMeta ? (
            <TypeBadge type={t} />
          ) : (
            <TypePicker currentType={t} onChangeType={handleTypeChange} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          {!isExp && !editing && (
            <span
              onClick={() => {
                if (!isMeta || keyName === "_id") setEditing(true);
              }}
              style={{
                cursor:
                  isMeta && keyName !== "_id" ? "default" : "pointer",
                display: "inline-block",
                padding: "1px 4px",
                borderRadius: 3,
                border: "1px solid transparent",
                transition: "border 0.12s",
              }}
              onMouseEnter={(e) => {
                if (!isMeta || keyName === "_id")
                  e.currentTarget.style.border = `1px dashed ${S.border}`;
              }}
              onMouseLeave={(e) =>
                (e.currentTarget.style.border = "1px solid transparent")
              }
            >
              <Val value={value} truncate={100} />
            </span>
          )}
          {!isExp && editing && (
            <ValueInput
              value={value}
              type={t}
              onCommit={(v) => {
                change(
                  deepSet(doc, path, v) as Record<string, unknown>
                );
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          {isExp && !open && (
            <span
              style={{
                fontSize: 11,
                fontFamily: S.mono,
                color: S.textDim,
                opacity: 0.5,
              }}
            >
              {smartPreview(value) ||
                (t === "array"
                  ? `${(value as unknown[]).length} items`
                  : `${Object.keys(value as Record<string, unknown>).length} fields`)}
            </span>
          )}
          {isExp && open && isTabular(value) && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onTableJump?.(value as unknown[], String(keyName));
              }}
              style={{
                fontSize: 8,
                color: TC.array,
                background: TC.array + "12",
                padding: "0 4px",
                borderRadius: 2,
                cursor: "pointer",
                border: `1px solid ${TC.array}25`,
                fontFamily: S.mono,
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              TABLE
            </span>
          )}
        </div>

        <div
          className="row-actions"
          style={{
            display: "flex",
            gap: mob ? 4 : 1,
            flexShrink: 0,
            paddingTop: 2,
            opacity: 0,
            transition: "opacity 0.1s",
          }}
        >
          {parentIsArray && !isFirst && (
            <span
              onClick={() =>
                change(
                  deepMove(
                    doc,
                    path.slice(0, -1),
                    Number(keyName),
                    Number(keyName) - 1
                  ) as Record<string, unknown>
                )
              }
              style={{
                cursor: "pointer",
                fontSize: mob ? 14 : 10,
                color: S.textDim,
                padding: mob ? "2px 6px" : "0 3px",
                fontFamily: S.mono,
              }}
            >
              {"\u2191"}
            </span>
          )}
          {parentIsArray && !isLast && (
            <span
              onClick={() =>
                change(
                  deepMove(
                    doc,
                    path.slice(0, -1),
                    Number(keyName),
                    Number(keyName) + 1
                  ) as Record<string, unknown>
                )
              }
              style={{
                cursor: "pointer",
                fontSize: mob ? 14 : 10,
                color: S.textDim,
                padding: mob ? "2px 6px" : "0 3px",
                fontFamily: S.mono,
              }}
            >
              {"\u2193"}
            </span>
          )}
          {!isMeta && (
            <span
              onClick={() =>
                change(
                  deepDelete(doc, path) as Record<string, unknown>
                )
              }
              style={{
                cursor: "pointer",
                fontSize: mob ? 14 : 11,
                color: S.danger,
                padding: mob ? "2px 6px" : "0 3px",
                opacity: 0.7,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.opacity = "1")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = "0.7")
              }
            >
              {"\u2715"}
            </span>
          )}
        </div>
      </div>

      {isExp && open && (
        <div
          style={{
            borderLeft: `1px solid ${(t === "array" ? TC.array : TC.object)}12`,
            marginLeft: mob ? 8 : 11,
            paddingLeft: mob ? 2 : 3,
          }}
        >
          {entries.map(([k, v], idx) => (
            <FieldNode
              key={t === "array" ? `${idx}-${entries.length}` : String(k)}
              keyName={k}
              value={v}
              path={[...path, k]}
              parentIsArray={t === "array"}
              depth={depth + 1}
              isFirst={idx === 0}
              isLast={idx === entries.length - 1}
            />
          ))}
          <div
            style={{
              padding: mob ? "5px 6px" : "3px 5px",
              marginLeft: mob ? 8 : 14,
            }}
          >
            <span
              onClick={addChild}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                padding: mob ? "6px 12px" : "2px 8px",
                borderRadius: 4,
                border: `1px dashed ${S.border}`,
                color: S.textDim,
                fontSize: mob ? 12 : 9,
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
              + {t === "array" ? "item" : "field"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
