import React from "react";
import { S } from "../lib/styles.js";

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string;
  bg?: string;
  border?: string;
}

export function Btn({
  children,
  onClick,
  color = S.textDim,
  bg,
  border,
  style: sx,
  ...rest
}: BtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: bg || "transparent",
        border: `1px solid ${border || "transparent"}`,
        color,
        borderRadius: 4,
        padding: "4px 10px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: S.mono,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "all 0.12s",
        ...sx,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
