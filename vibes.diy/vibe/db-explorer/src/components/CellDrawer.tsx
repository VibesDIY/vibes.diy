import { useState } from "react";
import { S, TC } from "../lib/styles";
import { getType, isTabular } from "../lib/utils";
import { TypeBadge } from "./TypeBadge";
import { Val } from "./Val";
import { Btn } from "./Btn";
import { NestedTable } from "./NestedTable";
import { useMobile } from "./MobileProvider";

interface CellDrawerProps {
  value: unknown;
  path: string;
  onClose: () => void;
}

function MiniTree({
  value: v,
  depth = 0,
  maxD = 5,
}: {
  value: unknown;
  depth?: number;
  maxD?: number;
}) {
  const t2 = getType(v);
  const [op, setOp] = useState(depth < 2);
  const isE = t2 === "object" || t2 === "array";
  const ent: [string | number, unknown][] = isE
    ? t2 === "array"
      ? (v as unknown[]).map((x, i) => [i, x])
      : Object.entries(v as Record<string, unknown>)
    : [];

  if (!isE) return <Val value={v} truncate={120} />;
  if (depth >= maxD) return <Val value={v} />;

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <div
        onClick={() => setOp(!op)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
          padding: "1px 0",
        }}
      >
        <span
          style={{
            color: S.textDim,
            fontSize: 8,
            width: 10,
            textAlign: "center",
            transform: op ? "rotate(90deg)" : "rotate(0)",
            display: "inline-block",
            transition: "transform 0.1s",
          }}
        >
          {"\u25B6"}
        </span>
        <TypeBadge type={t2} />
        <span
          style={{ fontSize: 10, color: S.textDim, fontFamily: S.mono }}
        >
          {t2 === "array"
            ? `${(v as unknown[]).length} items`
            : `${Object.keys(v as Record<string, unknown>).length} keys`}
        </span>
      </div>
      {op && (
        <div
          style={{
            borderLeft: `1px solid ${S.border}`,
            marginLeft: 5,
            paddingLeft: 8,
          }}
        >
          {ent.map(([k, c]) => (
            <div
              key={String(k)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 4,
                padding: "1px 0",
              }}
            >
              <span
                style={{
                  fontFamily: S.mono,
                  fontSize: 11,
                  color: typeof k === "number" ? S.textDim : TC.key,
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {String(k)}
                <span style={{ color: S.textMuted }}>:</span>
              </span>
              <MiniTree value={c} depth={depth + 1} maxD={maxD} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CellDrawer({ value, path, onClose }: CellDrawerProps) {
  const mob = useMobile();
  const [copied, setCopied] = useState(false);
  const t = getType(value);
  const json = JSON.stringify(value, null, 2);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: mob ? "100%" : 420,
        background: S.bgSurface,
        borderLeft: mob ? "none" : `1px solid ${S.border}`,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 30px #00000060",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 14px",
          borderBottom: `1px solid ${S.border}`,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <TypeBadge type={t} />
        <span
          style={{
            fontFamily: S.mono,
            fontSize: 12,
            color: S.accent,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {path}
        </span>
        <Btn
          onClick={() => {
            navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          bg={S.bgDeep}
          border={S.border}
        >
          {copied ? "\u2713" : "copy"}
        </Btn>
        <span
          onClick={onClose}
          style={{
            color: S.textDim,
            cursor: "pointer",
            fontSize: 16,
            padding: "0 4px",
          }}
        >
          {"\u2715"}
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
        {t === "object" || t === "array" ? (
          <div>
            <MiniTree value={value} />
            {isTabular(value) && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: S.textMuted,
                    fontFamily: S.mono,
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Table
                </div>
                <NestedTable data={value} />
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  color: S.textMuted,
                  fontFamily: S.mono,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Raw
              </div>
              <pre
                style={{
                  background: S.bgDeep,
                  borderRadius: 4,
                  padding: 10,
                  margin: 0,
                  overflow: "auto",
                  maxHeight: 300,
                  fontSize: 11,
                  fontFamily: S.mono,
                  color: S.textDim,
                  lineHeight: 1.5,
                  border: `1px solid ${S.border}`,
                }}
              >
                {json}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ padding: 8 }}>
            <Val value={value} truncate={false} />
          </div>
        )}
      </div>
    </div>
  );
}
