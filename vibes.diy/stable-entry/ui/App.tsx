import { useState, useEffect } from "react";

function getCookie(name: string): string {
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

function setCookie(key: string) {
  if (key) {
    document.cookie = `Vibes-Backend=${key}; Path=/; SameSite=Lax; Max-Age=86400`;
  } else {
    document.cookie = "Vibes-Backend=; Path=/; SameSite=Lax; Max-Age=0";
  }
  window.location.href = "/";
}

export function App() {
  const [keys, setKeys] = useState<string[]>([]);
  const current = getCookie("Vibes-Backend") || "(default)";

  useEffect(() => {
    fetch("/.stable-entry/config.json")
      .then((r) => r.json())
      .then((config: { keys: string[] }) => setKeys(config.keys));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: "400px", margin: "80px auto", padding: "20px" }}>
      <h2>stable-entry</h2>
      <p>Current backend: <strong>{current}</strong></p>
      <div>
        {keys.length > 0 ? (
          <div>
            <p>Select a backend:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {keys.map((key) => (
                <button
                  key={key}
                  onClick={() => setCookie(key)}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontWeight: current === key ? "bold" : "normal",
                    border: current === key ? "2px solid #333" : "1px solid #ccc",
                    borderRadius: "4px",
                    background: current === key ? "#f0f0f0" : "#fff",
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: "#888" }}>No alternate backends configured.</p>
        )}
        {current !== "(default)" && (
          <button
            onClick={() => setCookie("")}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: "4px",
              background: "#fff",
              marginTop: "8px",
            }}
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}
