import React, { useState } from "react";

type Column = "intake" | "processing" | "ready";

interface Order {
  id: number;
  name: string;
  detail: string;
  column: Column;
}

const COLUMNS: { key: Column; label: string; emoji: string }[] = [
  { key: "intake", label: "Intake", emoji: "📥" },
  { key: "processing", label: "Processing", emoji: "🔬" },
  { key: "ready", label: "Ready", emoji: "🖼️" },
];

const NEXT_COLUMN: Record<Column, Column | null> = {
  intake: "processing",
  processing: "ready",
  ready: null,
};

const INITIAL_ORDERS: Order[] = [
  { id: 1, name: "Wedding Portraits", detail: "24 prints • Gloss", column: "intake" },
  { id: 2, name: "Street Photography Set", detail: "12 prints • Matte", column: "intake" },
  { id: 3, name: "Family Reunion Album", detail: "36 prints • Satin", column: "processing" },
  { id: 4, name: "Headshots — Rush", detail: "8 prints • Matte", column: "ready" },
];

const COLUMN_BG: Record<Column, string> = {
  intake: "rgba(180, 140, 80, 0.08)",
  processing: "rgba(200, 100, 60, 0.08)",
  ready: "rgba(80, 160, 80, 0.06)",
};

export default function PhotoLabApp() {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [pressed, setPressed] = useState<number | null>(null);

  const advanceOrder = (id: number) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order;
        const next = NEXT_COLUMN[order.column];
        return next ? { ...order, column: next } : order;
      })
    );
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--vibes-cream, #FFFEF0)",
    color: "var(--vibes-near-black, #1a1a1a)",
    fontFamily: "inherit",
    padding: "16px 12px 12px",
    boxSizing: "border-box",
    gap: "10px",
  };

  const boardStyle: React.CSSProperties = {
    display: "flex",
    flex: 1,
    gap: "8px",
    minHeight: 0,
  };

  return (
    <div style={containerStyle}>
      <div style={boardStyle}>
        {COLUMNS.map(({ key, label, emoji }) => {
          const colOrders = orders.filter((o) => o.column === key);
          return (
            <PhotoLabColumn
              key={key}
              colKey={key}
              label={label}
              emoji={emoji}
              orders={colOrders}
              bg={COLUMN_BG[key]}
              pressed={pressed}
              onPress={setPressed}
              onAdvance={advanceOrder}
            />
          );
        })}
      </div>
    </div>
  );
}

interface PhotoLabColumnProps {
  colKey: Column;
  label: string;
  emoji: string;
  orders: Order[];
  bg: string;
  pressed: number | null;
  onPress: (id: number | null) => void;
  onAdvance: (id: number) => void;
}

function PhotoLabColumn({ colKey, label, emoji, orders, bg, pressed, onPress, onAdvance }: PhotoLabColumnProps) {
  const columnStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: bg,
    borderRadius: "14px",
    padding: "10px 8px 8px",
    minWidth: 0,
    gap: "6px",
    overflowY: "auto",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    marginBottom: "6px",
    flexShrink: 0,
    flexWrap: "wrap",
  };

  const emojiStyle: React.CSSProperties = {
    fontSize: "14px",
    lineHeight: 1,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--vibes-near-black, #1a1a1a)",
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 600,
    lineHeight: 1,
    padding: "2px 5px",
    borderRadius: "10px",
    border: "1.5px solid var(--vibes-near-black, #1a1a1a)",
    color: "var(--vibes-near-black, #1a1a1a)",
    opacity: 0.55,
    minWidth: "16px",
    textAlign: "center",
  };

  const isReady = colKey === "ready";

  return (
    <div style={columnStyle}>
      <div style={headerStyle}>
        <span style={emojiStyle}>{emoji}</span>
        <span style={labelStyle}>{label}</span>
        <span style={badgeStyle}>{orders.length}</span>
      </div>
      {orders.map((order) => {
        const isPressed = pressed === order.id;
        const isAdvanceable = !isReady;

        const cardStyle: React.CSSProperties = {
          padding: "9px 10px 9px 12px",
          border: "2px solid var(--vibes-near-black, #1a1a1a)",
          borderLeft: isReady ? "4px solid rgba(60, 160, 80, 0.65)" : "2px solid var(--vibes-near-black, #1a1a1a)",
          borderRadius: "12px",
          background: isReady ? "rgba(240, 252, 242, 0.85)" : "var(--vibes-cream, #FFFEF0)",
          cursor: isAdvanceable ? "pointer" : "default",
          userSelect: "none",
          lineHeight: 1.35,
          color: "var(--vibes-near-black, #1a1a1a)",
          transform: isPressed ? "scale(0.95)" : "scale(1)",
          transition: "transform 0.1s ease",
          flexShrink: 0,
        };

        const nameStyle: React.CSSProperties = {
          fontSize: "12px",
          fontWeight: 600,
          display: "block",
          marginBottom: "3px",
        };

        const detailStyle: React.CSSProperties = {
          fontSize: "10px",
          fontWeight: 400,
          opacity: 0.6,
          display: "block",
        };

        return (
          <div
            key={order.id}
            style={cardStyle}
            onClick={() => isAdvanceable && onAdvance(order.id)}
            onPointerDown={() => isAdvanceable && onPress(order.id)}
            onPointerUp={() => onPress(null)}
            onPointerLeave={() => onPress(null)}
            role={isAdvanceable ? "button" : undefined}
            tabIndex={isAdvanceable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isAdvanceable && (e.key === " " || e.key === "Enter")) onAdvance(order.id);
            }}
            aria-label={isAdvanceable ? `${order.name} — tap to advance` : order.name}
          >
            <span style={nameStyle}>{order.name}</span>
            <span style={detailStyle}>{order.detail}</span>
          </div>
        );
      })}
    </div>
  );
}
