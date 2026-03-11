import React, { useEffect } from "react";
import { S } from "../lib/styles.js";
import { useMobile } from "./MobileProvider.js";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onDone: () => void;
}

export function Toast({ message, type, onDone }: ToastProps) {
  const mob = useMobile();

  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  const color = type === "success" ? S.success : type === "error" ? S.danger : S.accent;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: mob ? 16 : "auto",
        right: mob ? 16 : 20,
        background: S.bgSurface,
        border: `1px solid ${color}40`,
        borderRadius: 6,
        padding: mob ? "12px 16px" : "10px 16px",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 8px 30px #00000040",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, fontFamily: S.mono, color: S.text }}>{message}</span>
    </div>
  );
}
