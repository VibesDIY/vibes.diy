import React, { ButtonHTMLAttributes } from "react";
import { S } from "../lib/styles.js";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string;
  bg?: string;
}

export function Btn({ children, onClick, color = S.text, bg, style: sx, ...rest }: BtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: bg || "transparent",
        border: `2px solid ${S.border}`,
        color,
        borderRadius: 5,
        padding: "6px 14px",
        fontSize: 13,
        cursor: "pointer",
        fontFamily: S.sans,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        boxShadow: `3px 3px 0px 0px ${S.border}`,
        whiteSpace: "nowrap" as const,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
