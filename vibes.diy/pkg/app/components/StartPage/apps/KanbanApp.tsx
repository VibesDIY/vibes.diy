import React, { useState } from "react";

type Column = "todo" | "doing" | "done";

interface Card {
  id: number;
  text: string;
  column: Column;
}

const COLUMNS: { key: Column; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

const NEXT_COLUMN: Record<Column, Column | null> = {
  todo: "doing",
  doing: "done",
  done: null,
};

const INITIAL_CARDS: Card[] = [
  { id: 1, text: "Design landing page", column: "todo" },
  { id: 2, text: "Write blog post", column: "todo" },
  { id: 3, text: "Build mobile app", column: "doing" },
  { id: 4, text: "Set up CI/CD", column: "done" },
];

const COLUMN_BG: Record<Column, string> = {
  todo: "rgba(26,26,26,0.03)",
  doing: "rgba(26,26,26,0.055)",
  done: "rgba(26,26,26,0.02)",
};

export default function KanbanApp() {
  const [cards, setCards] = useState<Card[]>(INITIAL_CARDS);
  const [pressed, setPressed] = useState<number | null>(null);

  const advanceCard = (id: number) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const next = NEXT_COLUMN[card.column];
        return next ? { ...card, column: next } : card;
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
        {COLUMNS.map(({ key, label }) => {
          const colCards = cards.filter((c) => c.column === key);
          return (
            <KanbanColumn
              key={key}
              colKey={key}
              label={label}
              cards={colCards}
              bg={COLUMN_BG[key]}
              pressed={pressed}
              onPress={setPressed}
              onAdvance={advanceCard}
            />
          );
        })}
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  colKey: Column;
  label: string;
  cards: Card[];
  bg: string;
  pressed: number | null;
  onPress: (id: number | null) => void;
  onAdvance: (id: number) => void;
}

function KanbanColumn({ colKey, label, cards, bg, pressed, onPress, onAdvance }: KanbanColumnProps) {
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
    gap: "6px",
    marginBottom: "6px",
    flexShrink: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--vibes-near-black, #1a1a1a)",
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1,
    padding: "2px 6px",
    borderRadius: "10px",
    border: "1.5px solid var(--vibes-near-black, #1a1a1a)",
    color: "var(--vibes-near-black, #1a1a1a)",
    opacity: 0.55,
    minWidth: "18px",
    textAlign: "center",
  };

  const isDone = colKey === "done";

  return (
    <div style={columnStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={badgeStyle}>{cards.length}</span>
      </div>
      {cards.map((card) => {
        const isPressed = pressed === card.id;
        const isAdvanceable = !isDone;

        const cardStyle: React.CSSProperties = {
          padding: "9px 12px",
          border: "2px solid var(--vibes-near-black, #1a1a1a)",
          borderRadius: "20px",
          background: "var(--vibes-cream, #FFFEF0)",
          cursor: isAdvanceable ? "pointer" : "default",
          userSelect: "none",
          fontSize: "13px",
          fontWeight: 500,
          lineHeight: 1.35,
          color: "var(--vibes-near-black, #1a1a1a)",
          opacity: isDone ? 0.5 : 1,
          transform: isPressed ? "scale(0.95)" : "scale(1)",
          transition: "transform 0.1s ease, opacity 0.15s ease",
          flexShrink: 0,
          textDecoration: isDone ? "line-through" : "none",
        };

        return (
          <div
            key={card.id}
            style={cardStyle}
            onClick={() => isAdvanceable && onAdvance(card.id)}
            onPointerDown={() => isAdvanceable && onPress(card.id)}
            onPointerUp={() => onPress(null)}
            onPointerLeave={() => onPress(null)}
            role={isAdvanceable ? "button" : undefined}
            tabIndex={isAdvanceable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isAdvanceable && (e.key === " " || e.key === "Enter")) onAdvance(card.id);
            }}
            aria-label={isAdvanceable ? `${card.text} — tap to advance` : card.text}
          >
            {card.text}
          </div>
        );
      })}
    </div>
  );
}
