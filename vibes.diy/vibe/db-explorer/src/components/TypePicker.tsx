import React, { useState, useEffect, useRef } from "react";
import { S } from "../lib/styles.js";
import { TypeBadge } from "./TypeBadge.js";
import { useMobile } from "../components/MobileProvider.js";

interface TypePickerProps {
  currentType: string;
  onChangeType: (type: string) => void;
}

const TYPES = ["string", "number", "boolean", "null", "object", "array"];

export function TypePicker({ currentType, onChangeType }: TypePickerProps) {
  const mob = useMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <span
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          padding: mob ? "4px 2px" : 0,
          display: "inline-block",
        }}
      >
        <TypeBadge type={currentType} />
      </span>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: mob ? -8 : 0,
            marginTop: 2,
            background: S.bgSurface,
            border: `1px solid ${S.border}`,
            borderRadius: 6,
            padding: 3,
            zIndex: 50,
            boxShadow: "0 8px 24px #00000060",
            minWidth: mob ? 110 : 80,
          }}
        >
          {TYPES.map((t) => (
            <div
              key={t}
              onClick={() => {
                onChangeType(t);
                setOpen(false);
              }}
              style={{
                padding: mob ? "10px 10px" : "4px 8px",
                cursor: "pointer",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background:
                  t === currentType ? S.accent + "10" : "transparent",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = S.bgHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  t === currentType ? S.accent + "10" : "transparent")
              }
            >
              <TypeBadge type={t} />
              <span
                style={{
                  fontSize: mob ? 12 : 10,
                  color: S.textDim,
                  fontFamily: S.mono,
                }}
              >
                {t}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
