import React, { useState, useRef, KeyboardEvent } from "react";

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

const INITIAL_ITEMS: TodoItem[] = [
  { id: 1, text: "Ship the feature", done: false },
  { id: 2, text: "Call mom", done: false },
  { id: 3, text: "Buy groceries", done: false },
];

export default function TodoApp() {
  const [items, setItems] = useState<TodoItem[]>(INITIAL_ITEMS);
  const [input, setInput] = useState("");
  const [nextId, setNextId] = useState(4);
  const [pressed, setPressed] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    const text = input.trim();
    if (!text) return;
    setItems((prev) => [...prev, { id: nextId, text, done: false }]);
    setNextId((n) => n + 1);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleItem = (id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addItem();
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--vibes-cream, #FFFEF0)",
    color: "var(--vibes-near-black, #1a1a1a)",
    fontFamily: "inherit",
    padding: "20px 16px 16px",
    boxSizing: "border-box",
  };

  const inputRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    flexShrink: 0,
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "10px 14px",
    border: "2px solid var(--vibes-near-black, #1a1a1a)",
    borderRadius: "12px",
    background: "var(--vibes-cream, #FFFEF0)",
    color: "var(--vibes-near-black, #1a1a1a)",
    fontSize: "15px",
    fontFamily: "inherit",
    outline: "none",
    transition: "box-shadow 0.15s ease",
  };

  const addButtonStyle: React.CSSProperties = {
    width: "42px",
    height: "42px",
    flexShrink: 0,
    border: "2px solid var(--vibes-near-black, #1a1a1a)",
    borderRadius: "12px",
    background: "var(--vibes-near-black, #1a1a1a)",
    color: "var(--vibes-cream, #FFFEF0)",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.1s ease, transform 0.1s ease",
    userSelect: "none",
  };

  const listStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
    flex: 1,
  };

  return (
    <div style={containerStyle}>
      <div style={inputRowStyle}>
        <input
          ref={inputRef}
          style={inputStyle}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task..."
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(26,26,26,0.15)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
          }}
        />
        <button
          style={addButtonStyle}
          onClick={addItem}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)";
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.75";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
          aria-label="Add task"
        >
          +
        </button>
      </div>

      <div style={listStyle}>
        {items.map((item) => {
          const isPressed = pressed === item.id;
          const rowStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            padding: "11px 16px",
            border: "2px solid var(--vibes-near-black, #1a1a1a)",
            borderRadius: "24px",
            cursor: "pointer",
            userSelect: "none",
            transition: "opacity 0.15s ease, transform 0.1s ease",
            opacity: item.done ? 0.45 : isPressed ? 0.7 : 1,
            transform: isPressed ? "scale(0.98)" : "scale(1)",
            background: item.done ? "rgba(26,26,26,0.04)" : "transparent",
          };

          const textStyle: React.CSSProperties = {
            fontSize: "15px",
            fontWeight: 500,
            textDecoration: item.done ? "line-through" : "none",
            color: "var(--vibes-near-black, #1a1a1a)",
            flex: 1,
            lineHeight: 1.3,
          };

          const checkStyle: React.CSSProperties = {
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            border: "2px solid var(--vibes-near-black, #1a1a1a)",
            marginRight: "12px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: item.done ? "var(--vibes-near-black, #1a1a1a)" : "transparent",
            transition: "background 0.15s ease",
            fontSize: "10px",
            color: "var(--vibes-cream, #FFFEF0)",
          };

          return (
            <div
              key={item.id}
              style={rowStyle}
              onClick={() => toggleItem(item.id)}
              onPointerDown={() => setPressed(item.id)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              role="checkbox"
              aria-checked={item.done}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") toggleItem(item.id);
              }}
            >
              <div style={checkStyle}>{item.done ? "✓" : ""}</div>
              <span style={textStyle}>{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
