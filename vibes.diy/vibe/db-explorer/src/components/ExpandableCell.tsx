import React, { useState } from "react";
import { S } from "../lib/styles.js";
import { getType, isTabular, smartPreview } from "../lib/utils.js";
import { TypeBadge } from "./TypeBadge.js";
import { Val } from "./Val.js";
import { NestedTable } from "./NestedTable.js";

interface ExpandableCellProps {
  value: unknown;
  colKey: string;
  onDrawer: (value: unknown, path: string) => void;
}

export function ExpandableCell({
  value,
  colKey,
  onDrawer,
}: ExpandableCellProps) {
  const t = getType(value);
  const isC = t === "object" || t === "array";
  const [exp, setExp] = useState(false);

  if (!isC) return <Val value={value} truncate={60} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setExp(!exp);
          }}
          style={{
            color: S.textDim,
            fontSize: 8,
            cursor: "pointer",
            width: 10,
            textAlign: "center",
            transform: exp ? "rotate(90deg)" : "rotate(0)",
            display: "inline-block",
            transition: "transform 0.1s",
            flexShrink: 0,
          }}
        >
          {"\u25B6"}
        </span>
        <TypeBadge type={t} />
        <span
          style={{
            fontSize: 11,
            fontFamily: S.mono,
            color: S.textDim,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {smartPreview(value)}
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onDrawer(value, colKey);
          }}
          style={{
            fontSize: 9,
            color: S.accent,
            opacity: 0.4,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: S.mono,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
        >
          {"\u2197"}
        </span>
      </div>
      {exp && (
        <div
          style={{
            marginTop: 4,
            padding: "6px 0 4px 14px",
            borderLeft: `1px solid ${S.border}`,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {isTabular(value) ? (
            <NestedTable data={value} />
          ) : (
            <pre
              style={{
                fontSize: 11,
                fontFamily: S.mono,
                color: S.textDim,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
