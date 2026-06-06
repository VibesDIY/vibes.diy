import React from "react";

interface PlaceholderAppProps {
  category: string;
}

export default function PlaceholderApp({ category }: PlaceholderAppProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "16px",
        padding: "24px",
        color: "var(--vibes-near-black)",
      }}
    >
      <div style={{ fontSize: "48px" }}>{category === "Creative" ? "🎨" : category === "Productive" ? "📋" : "🎮"}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, textAlign: "center" }}>{category} starter coming soon</div>
      <div style={{ fontSize: "14px", opacity: 0.6, textAlign: "center" }}>Try &ldquo;Other&rdquo; below to build your own</div>
    </div>
  );
}
