import { S } from "../lib/styles";

interface ScopeBadgeProps {
  label: string;
  color: string;
}

export function ScopeBadge({ label, color }: ScopeBadgeProps) {
  return (
    <span
      style={{
        fontSize: 8,
        fontFamily: S.mono,
        fontWeight: 700,
        color,
        background: color + "15",
        border: `1px solid ${color}30`,
        padding: "1px 5px",
        borderRadius: 2,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}
