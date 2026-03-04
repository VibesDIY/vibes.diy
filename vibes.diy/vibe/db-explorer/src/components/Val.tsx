import React from "react";
import { TC, S } from "../lib/styles.js";
import { getType } from "../lib/utils.js";

interface ValProps {
  value: unknown;
  truncate?: number | false;
}

export function Val({ value, truncate = 80 }: ValProps) {
  const t = getType(value);
  const m: React.CSSProperties = { fontFamily: S.mono, fontSize: 12 };

  if (t === "null")
    return (
      <span style={{ ...m, color: TC.null, fontStyle: "italic" }}>null</span>
    );
  if (t === "boolean")
    return (
      <span style={{ ...m, color: TC.boolean }}>
        {(value as boolean).toString()}
      </span>
    );
  if (t === "number")
    return (
      <span style={{ ...m, color: TC.number }}>
        {(value as number).toLocaleString()}
      </span>
    );
  if (t === "string") {
    const s = value as string;
    const d =
      truncate && s.length > truncate
        ? s.slice(0, (truncate as number) - 3) + "\u2026"
        : s;
    return <span style={{ ...m, color: TC.string }}>"{d}"</span>;
  }
  if (t === "array")
    return (
      <span style={{ ...m, color: TC.array, opacity: 0.6 }}>
        [ {(value as unknown[]).length} ]
      </span>
    );
  if (t === "object")
    return (
      <span style={{ ...m, color: TC.object, opacity: 0.6 }}>
        {"{ "}
        {Object.keys(value as Record<string, unknown>).length}
        {" }"}
      </span>
    );
  return null;
}
