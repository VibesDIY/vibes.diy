import { TC, TL, S } from "../lib/styles";

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        background: (TC[type] || TC.null) + "15",
        color: TC[type] || TC.null,
        fontSize: 9,
        fontWeight: 600,
        padding: "0 4px",
        borderRadius: 2,
        fontFamily: S.mono,
        letterSpacing: "0.06em",
        lineHeight: "16px",
        display: "inline-block",
        border: `1px solid ${(TC[type] || TC.null)}20`,
      }}
    >
      {TL[type] || type}
    </span>
  );
}
