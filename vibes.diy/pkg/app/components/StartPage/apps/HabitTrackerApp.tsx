import React, { useState } from "react";

const HABITS = ["Exercise", "Read", "Meditate", "Hydrate", "Journal"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Pre-filled cells: [habitIndex][dayIndex]
const INITIAL_FILLED: Record<string, boolean> = {
  // Exercise: Mon, Wed, Fri
  "0-0": true,
  "0-2": true,
  "0-4": true,
  // Read: Mon, Tue, Wed, Thu
  "1-0": true,
  "1-1": true,
  "1-2": true,
  "1-3": true,
  // Meditate: Mon, Wed
  "2-0": true,
  "2-2": true,
  // Hydrate: Mon, Tue, Wed, Thu, Fri
  "3-0": true,
  "3-1": true,
  "3-2": true,
  "3-3": true,
  "3-4": true,
  // Journal: Tue, Thu
  "4-1": true,
  "4-3": true,
};

function cellKey(habitIdx: number, dayIdx: number) {
  return `${habitIdx}-${dayIdx}`;
}

export default function HabitTrackerApp() {
  const [filled, setFilled] = useState<Record<string, boolean>>(INITIAL_FILLED);
  const [pressed, setPressed] = useState<string | null>(null);

  const toggle = (key: string) => {
    setFilled((prev) => ({ ...prev, [key]: !prev[key] }));
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
    justifyContent: "center",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    // left column for habit names + 7 day columns
    gridTemplateColumns: "minmax(72px, auto) repeat(7, 1fr)",
    gap: "4px",
    alignItems: "center",
  };

  const dayHeaderStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--vibes-near-black, #1a1a1a)",
    opacity: 0.55,
    textAlign: "center",
    paddingBottom: "6px",
  };

  const habitLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--vibes-near-black, #1a1a1a)",
    paddingRight: "8px",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        {/* top-left corner: empty */}
        <div />
        {/* day headers */}
        {DAYS.map((day) => (
          <div key={day} style={dayHeaderStyle}>
            {day}
          </div>
        ))}

        {/* rows: one per habit */}
        {HABITS.map((habit, hIdx) => (
          <React.Fragment key={habit}>
            <div style={habitLabelStyle}>{habit}</div>
            {DAYS.map((_, dIdx) => {
              const key = cellKey(hIdx, dIdx);
              const isFilled = !!filled[key];
              const isPressed = pressed === key;

              const cellStyle: React.CSSProperties = {
                width: "100%",
                aspectRatio: "1",
                minWidth: "28px",
                maxWidth: "40px",
                margin: "0 auto",
                borderRadius: "8px",
                border: isFilled ? "2px solid transparent" : "2px solid var(--vibes-near-black, #1a1a1a)",
                background: isFilled ? "var(--vibes-variant-blue, #3B72FF)" : "var(--vibes-cream, #FFFEF0)",
                cursor: "pointer",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                color: "var(--vibes-cream, #FFFEF0)",
                fontWeight: 700,
                transform: isPressed ? "scale(0.88)" : "scale(1)",
                transition: "transform 0.1s ease, background 0.12s ease, border-color 0.12s ease",
                boxSizing: "border-box",
                opacity: isFilled ? 1 : 0.7,
              };

              return (
                <div
                  key={key}
                  style={cellStyle}
                  onClick={() => toggle(key)}
                  onPointerDown={() => setPressed(key)}
                  onPointerUp={() => setPressed(null)}
                  onPointerLeave={() => setPressed(null)}
                  role="checkbox"
                  aria-checked={isFilled}
                  aria-label={`${habit} ${DAYS[dIdx]}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") toggle(key);
                  }}
                >
                  {isFilled ? "✓" : ""}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
