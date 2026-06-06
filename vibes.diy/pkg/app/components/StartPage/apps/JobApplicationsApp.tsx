import React, { useState, useRef, KeyboardEvent } from "react";

type Status = "Applied" | "Interview" | "Offer" | "Rejected";

interface JobApplication {
  id: number;
  company: string;
  role: string;
  status: Status;
}

const STATUSES: Status[] = ["Applied", "Interview", "Offer", "Rejected"];

const STATUS_COLORS: Record<Status, string> = {
  Applied: "var(--vibes-variant-blue, #3b82f6)",
  Interview: "var(--vibes-variant-yellow, #eab308)",
  Offer: "#22c55e",
  Rejected: "var(--vibes-variant-red, #ef4444)",
};

const STATUS_TEXT_COLORS: Record<Status, string> = {
  Applied: "#fff",
  Interview: "#1a1a1a",
  Offer: "#fff",
  Rejected: "#fff",
};

const INITIAL_APPS: JobApplication[] = [
  { id: 1, company: "Acme Corp", role: "Frontend Engineer", status: "Applied" },
  { id: 2, company: "Startup Labs", role: "Full Stack Dev", status: "Interview" },
  { id: 3, company: "Big Tech Co", role: "Senior Engineer", status: "Offer" },
];

export default function JobApplicationsApp() {
  const [apps, setApps] = useState<JobApplication[]>(INITIAL_APPS);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [nextId, setNextId] = useState(4);
  const [pressedBadge, setPressedBadge] = useState<number | null>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);

  const cycleStatus = (id: number) => {
    setApps((prev) =>
      prev.map((app) => {
        if (app.id !== id) return app;
        const idx = STATUSES.indexOf(app.status);
        return { ...app, status: STATUSES[(idx + 1) % STATUSES.length] };
      })
    );
  };

  const addApp = () => {
    const c = company.trim();
    const r = role.trim();
    if (!c || !r) return;
    setApps((prev) => [...prev, { id: nextId, company: c, role: r, status: "Applied" }]);
    setNextId((n) => n + 1);
    setCompany("");
    setRole("");
    companyRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.currentTarget === companyRef.current && company.trim()) {
        roleRef.current?.focus();
      } else {
        addApp();
      }
    }
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

  const addSectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
    flexShrink: 0,
  };

  const inputRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "10px 14px",
    border: "2px solid var(--vibes-near-black, #1a1a1a)",
    borderRadius: "12px",
    background: "var(--vibes-cream, #FFFEF0)",
    color: "var(--vibes-near-black, #1a1a1a)",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    transition: "box-shadow 0.15s ease",
  };

  const addButtonStyle: React.CSSProperties = {
    padding: "10px 18px",
    flexShrink: 0,
    border: "2px solid var(--vibes-near-black, #1a1a1a)",
    borderRadius: "12px",
    background: "var(--vibes-near-black, #1a1a1a)",
    color: "var(--vibes-cream, #FFFEF0)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.1s ease, transform 0.1s ease",
    userSelect: "none",
    whiteSpace: "nowrap",
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
      <div style={addSectionStyle}>
        <div style={inputRowStyle}>
          <input
            ref={companyRef}
            style={inputStyle}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Company"
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(26,26,26,0.15)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            }}
          />
          <input
            ref={roleRef}
            style={inputStyle}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Role"
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(26,26,26,0.15)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            }}
          />
          <button
            style={addButtonStyle}
            onClick={addApp}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
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
          >
            Add
          </button>
        </div>
      </div>

      <div style={listStyle}>
        {apps.map((app) => {
          const badgeColor = STATUS_COLORS[app.status];
          const badgeTextColor = STATUS_TEXT_COLORS[app.status];
          const isPressed = pressedBadge === app.id;

          const cardStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            border: "2px solid var(--vibes-near-black, #1a1a1a)",
            borderRadius: "999px",
            background: "transparent",
            gap: "12px",
          };

          const infoStyle: React.CSSProperties = {
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            flex: 1,
            minWidth: 0,
          };

          const companyStyle: React.CSSProperties = {
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--vibes-near-black, #1a1a1a)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          };

          const roleStyle: React.CSSProperties = {
            fontSize: "12px",
            fontWeight: 400,
            color: "var(--vibes-near-black, #1a1a1a)",
            opacity: 0.6,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          };

          const badgeStyle: React.CSSProperties = {
            padding: "5px 12px",
            borderRadius: "999px",
            background: badgeColor,
            color: badgeTextColor,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            userSelect: "none",
            flexShrink: 0,
            border: "none",
            fontFamily: "inherit",
            transition: "transform 0.1s ease, opacity 0.1s ease",
            transform: isPressed ? "scale(0.93)" : "scale(1)",
            opacity: isPressed ? 0.75 : 1,
            letterSpacing: "0.02em",
          };

          return (
            <div key={app.id} style={cardStyle}>
              <div style={infoStyle}>
                <span style={companyStyle}>{app.company}</span>
                <span style={roleStyle}>{app.role}</span>
              </div>
              <button
                style={badgeStyle}
                onClick={() => cycleStatus(app.id)}
                onPointerDown={() => setPressedBadge(app.id)}
                onPointerUp={() => setPressedBadge(null)}
                onPointerLeave={() => setPressedBadge(null)}
                title="Tap to cycle status"
              >
                {app.status}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
