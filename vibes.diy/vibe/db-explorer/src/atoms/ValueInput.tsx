import { useState } from "react";
import { S, TC } from "../lib/styles";

interface ValueInputProps {
  value: unknown;
  type: string;
  onCommit: (v: unknown) => void;
  onCancel?: () => void;
}

export function ValueInput({ value, type, onCommit, onCancel }: ValueInputProps) {
  const [draft, setDraft] = useState(
    type === "number" ? String(value) : (value as string)
  );
  const is: React.CSSProperties = {
    background: S.bgDeep,
    border: `1px solid ${S.accent}50`,
    borderRadius: 3,
    color: TC[type] || S.text,
    padding: "3px 7px",
    fontSize: 12,
    fontFamily: S.mono,
    outline: "none",
    lineHeight: 1.4,
  };
  const commit = () => {
    onCommit(type === "number" ? (draft === "" ? 0 : Number(draft)) : draft);
  };
  const cancel = () => onCancel?.();

  if (type === "boolean")
    return (
      <button
        onClick={() => onCommit(!(value as boolean))}
        style={{
          ...is,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          border: `1px solid ${TC.boolean}40`,
          padding: "3px 10px",
        }}
      >
        <span
          style={{
            width: 28,
            height: 14,
            borderRadius: 7,
            background: value ? TC.boolean + "50" : S.border,
            position: "relative",
            display: "inline-block",
            transition: "background 0.15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: value ? 14 : 2,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: value ? TC.boolean : S.textDim,
              transition: "left 0.15s",
            }}
          />
        </span>
        <span style={{ color: TC.boolean, fontSize: 11 }}>
          {(value as boolean).toString()}
        </span>
      </button>
    );

  if (type === "null")
    return (
      <span
        style={{
          fontFamily: S.mono,
          fontSize: 12,
          color: TC.null,
          fontStyle: "italic",
          padding: "3px 7px",
        }}
      >
        null
      </span>
    );

  if (type === "number")
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        style={{ ...is, width: 120 }}
      />
    );

  const isLong =
    typeof value === "string" && (value.length > 60 || value.includes("\n"));
  if (isLong)
    return (
      <textarea
        autoFocus
        value={draft as string}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        style={{
          ...is,
          width: "100%",
          minHeight: 60,
          maxHeight: 200,
          resize: "vertical",
        }}
      />
    );

  return (
    <input
      type="text"
      autoFocus
      value={draft as string}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
      style={{
        ...is,
        width: Math.max(120, Math.min(400, (String(draft).length + 2) * 7.5)),
      }}
    />
  );
}
