import React from "react";
import { S } from "../lib/styles.js";
import { Btn } from "./Btn.js";
import { useMobile } from "./MobileProvider.js";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  const mob = useMobile();

  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "#00000060",
          zIndex: 200,
          animation: "fade-in 0.15s ease-out",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          background: S.bgSurface,
          border: `1px solid ${S.border}`,
          borderRadius: 8,
          padding: mob ? 18 : 24,
          zIndex: 201,
          width: mob ? "calc(100% - 32px)" : 380,
          maxWidth: 380,
          boxShadow: "0 20px 60px #00000060",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: danger ? S.danger : S.text,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: S.textDim,
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn onClick={onCancel} color={S.textDim}>
            Cancel
          </Btn>
          <Btn
            onClick={onConfirm}
            bg={danger ? S.danger + "20" : S.accent + "20"}
            color={danger ? S.danger : S.accent}
            style={{ fontWeight: 600 }}
          >
            {danger ? "Delete" : "Confirm"}
          </Btn>
        </div>
      </div>
    </>
  );
}
