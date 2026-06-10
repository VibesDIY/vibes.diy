import React, { useState } from "react";

interface Topping {
  label: string;
  initialVotes: number;
  color: string;
}

const TOPPINGS: Topping[] = [
  { label: "Pepperoni", initialVotes: 8, color: "var(--vibes-variant-red, #ef4444)" },
  { label: "Mushrooms", initialVotes: 5, color: "var(--vibes-variant-blue, #3b82f6)" },
  { label: "Pineapple", initialVotes: 3, color: "var(--vibes-variant-yellow, #eab308)" },
  { label: "Extra Cheese", initialVotes: 7, color: "var(--vibes-variant-red, #ef4444)" },
  { label: "Jalapeños", initialVotes: 2, color: "var(--vibes-variant-blue, #3b82f6)" },
  { label: "Olives", initialVotes: 4, color: "var(--vibes-variant-yellow, #eab308)" },
];

const INITIAL_VOTES: Record<string, number> = Object.fromEntries(TOPPINGS.map((t) => [t.label, t.initialVotes]));

export default function PizzaVoteApp() {
  const [votes, setVotes] = useState<Record<string, number>>(INITIAL_VOTES);
  const [pressed, setPressed] = useState<string | null>(null);
  const [justVoted, setJustVoted] = useState<string | null>(null);

  const maxVotes = Math.max(...Object.values(votes));
  const leadingTopping = TOPPINGS.find((t) => votes[t.label] === maxVotes)?.label ?? "";

  const handleVote = (label: string) => {
    setVotes((prev) => ({ ...prev, [label]: prev[label] + 1 }));
    setJustVoted(label);
    setTimeout(() => setJustVoted(null), 400);
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--vibes-cream, #FFFEF0)",
    color: "var(--vibes-near-black, #1a1a1a)",
    fontFamily: "inherit",
    padding: "16px 14px 14px",
    boxSizing: "border-box",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 800,
    textAlign: "center",
    marginBottom: "14px",
    flexShrink: 0,
    letterSpacing: "-0.01em",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    flex: 1,
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>🍕 Best Pizza Topping?</div>
      <div style={gridStyle}>
        {TOPPINGS.map((topping) => {
          const { label, color } = topping;
          const count = votes[label];
          const pct = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
          const isLeading = label === leadingTopping;
          const isPressed = pressed === label;
          const isJustVoted = justVoted === label;

          const cardStyle: React.CSSProperties = {
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "12px 12px 10px",
            border: `2px solid ${isLeading ? color : "var(--vibes-near-black, #1a1a1a)"}`,
            borderRadius: "14px",
            cursor: "pointer",
            userSelect: "none",
            background: isPressed ? "rgba(0,0,0,0.04)" : "transparent",
            transform: isPressed ? "scale(0.96)" : isJustVoted ? "scale(1.03)" : "scale(1)",
            transition: "transform 0.12s ease, border-color 0.15s ease, background 0.1s ease",
            boxSizing: "border-box",
            gap: "8px",
          };

          const labelRowStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "4px",
          };

          const labelStyle: React.CSSProperties = {
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--vibes-near-black, #1a1a1a)",
            lineHeight: 1.2,
          };

          const countStyle: React.CSSProperties = {
            fontSize: "18px",
            fontWeight: 800,
            color,
            lineHeight: 1,
            flexShrink: 0,
          };

          const trackStyle: React.CSSProperties = {
            height: "8px",
            borderRadius: "999px",
            background: "rgba(0,0,0,0.1)",
            overflow: "hidden",
            flexShrink: 0,
          };

          const fillStyle: React.CSSProperties = {
            height: "100%",
            width: `${pct}%`,
            borderRadius: "999px",
            background: color,
            transition: "width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          };

          return (
            <div
              key={label}
              style={cardStyle}
              onClick={() => handleVote(label)}
              onPointerDown={() => setPressed(label)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              role="button"
              aria-label={`Vote for ${label} — ${count} votes`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") handleVote(label);
              }}
            >
              <div style={labelRowStyle}>
                <span style={labelStyle}>
                  {isLeading ? "🏆 " : ""}
                  {label}
                </span>
                <span style={countStyle}>{count}</span>
              </div>
              <div style={trackStyle}>
                <div style={fillStyle} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
