import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg: oklch(0.88 0.01 90);
        --text: oklch(0.05 0.01 0);
        --border: oklch(0.05 0.01 0);
        --accent: oklch(0.90 0.20 110);
        --accent-text: oklch(0.05 0.01 0);
        --muted: oklch(0.40 0.01 0);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: oklch(0.18 0.01 90);
          --text: oklch(0.95 0.01 0);
          --border: oklch(0.70 0.01 0);
          --accent: oklch(0.90 0.20 110);
          --accent-text: oklch(0.05 0.01 0);
          --muted: oklch(0.65 0.01 0);
        }
      }
      body { font-family: 'Inter', sans-serif; }
      .mono { font-family: 'Space Mono', monospace; }
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Mono:wght@400;700&display=optional');
    `}</style>
  );
}

function RequestForm({ viewer }) {
  const { database } = useFireproof("buildingfix");
  const [unit, setUnit] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!viewer || !unit.trim() || !description.trim()) return;
    setIsLoading(true);
    try {
      let triage = { category: "general", urgency: 3, summary: description.slice(0, 80) };
      try {
        const resp = await callAI(`Triage this apartment maintenance request. Unit ${unit}. Problem: ${description}`, {
          schema: {
            properties: {
              category: { type: "string", description: "plumbing, electrical, hvac, appliance, structural, or general" },
              urgency: { type: "number", description: "1 (low) to 5 (emergency)" },
              summary: { type: "string", description: "one-line summary under 80 chars" },
            },
          },
        });
        triage = { ...triage, ...JSON.parse(resp) };
      } catch {}
      await database.put({
        type: "request",
        unit: unit.trim(),
        description: description.trim(),
        authorHandle: viewer.userHandle,
        status: "open",
        category: triage.category,
        urgency: triage.urgency,
        summary: triage.summary,
        createdAt: Date.now(),
      });
      setUnit("");
      setDescription("");
    } finally {
      setIsLoading(false);
    }
  }

  if (!viewer) {
    return (
      <section id="request-form" className="border-2 p-4" style={{ borderColor: "var(--border)" }}>
        <h2 className="mono text-lg font-bold mb-3">SUBMIT REQUEST</h2>
        <p style={{ color: "var(--muted)" }} className="text-sm">
          Sign in to submit a maintenance request.
        </p>
      </section>
    );
  }

  return (
    <section id="request-form" className="border-2 p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="mono text-lg font-bold mb-3">SUBMIT REQUEST</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mono text-xs block mb-1">UNIT NUMBER</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. 4B"
            className="w-full border-2 px-3 py-3 min-h-[44px] bg-transparent"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
        </div>
        <div>
          <label className="mono text-xs block mb-1">DESCRIBE THE PROBLEM</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Leaky faucet under the kitchen sink..."
            rows={4}
            className="w-full border-2 px-3 py-3 bg-transparent"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="mono font-bold border-2 px-4 py-3 min-h-[44px] w-full flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              TRIAGING...
            </>
          ) : (
            "SUBMIT"
          )}
        </button>
      </form>
    </section>
  );
}

function statusColor(status) {
  if (status === "done") return { bg: "oklch(0.85 0.10 150)", text: "oklch(0.15 0.01 0)" };
  if (status === "in-progress") return { bg: "oklch(0.90 0.20 110)", text: "oklch(0.05 0.01 0)" };
  return { bg: "transparent", text: "var(--text)" };
}

function urgencyDots(n) {
  const dots = [];
  for (let i = 1; i <= 5; i++) dots.push(i <= n ? "●" : "○");
  return dots.join("");
}

function MyRequests({ viewer }) {
  const { useLiveQuery } = useFireproof("buildingfix");
  const { docs } = useLiveQuery("authorHandle", { key: viewer?.userHandle, descending: true });

  if (!viewer) return null;

  const sorted = [...docs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <section id="my-requests" className="border-2 p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="mono text-lg font-bold mb-3">MY REQUESTS ({sorted.length})</h2>
      {sorted.length === 0 ? (
        <p style={{ color: "var(--muted)" }} className="text-sm">
          No requests yet. Submit one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => {
            const sc = statusColor(r.status);
            return (
              <li key={r._id} className="border-2 p-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="mono text-xs font-bold">UNIT {r.unit}</div>
                  <div
                    className="mono text-xs px-2 py-1 border"
                    style={{ background: sc.bg, color: sc.text, borderColor: "var(--border)" }}
                  >
                    {(r.status || "open").toUpperCase()}
                  </div>
                </div>
                <p className="text-sm mb-2">{r.description}</p>
                <div className="flex items-center justify-between text-xs mono" style={{ color: "var(--muted)" }}>
                  <span>{r.category || "general"}</span>
                  <span>{urgencyDots(r.urgency || 3)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ManagerDashboard({ ViewerTag }) {
  const { useLiveQuery, database } = useFireproof("buildingfix");
  const { docs } = useLiveQuery("type", { key: "request" });
  const [filter, setFilter] = React.useState("open");

  const sorted = [...docs].sort((a, b) => {
    if (filter !== "all" && a.status !== filter) return 1;
    if (filter !== "all" && b.status !== filter) return -1;
    return (b.urgency || 0) - (a.urgency || 0) || (b.createdAt || 0) - (a.createdAt || 0);
  });
  const visible = filter === "all" ? sorted : sorted.filter((r) => (r.status || "open") === filter);

  async function advance(r) {
    const next = r.status === "open" ? "in-progress" : r.status === "in-progress" ? "done" : "open";
    await database.put({ ...r, status: next });
  }

  const filters = ["open", "in-progress", "done", "all"];

  return (
    <section id="manager-dashboard" className="border-2 p-4" style={{ borderColor: "var(--border)" }}>
      <h2 className="mono text-lg font-bold mb-3">ALL REQUESTS ({docs.length})</h2>
      <div className="flex gap-1 mb-3 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="mono text-xs px-3 py-2 border-2 min-h-[36px]"
            style={{
              borderColor: "var(--border)",
              background: filter === f ? "var(--accent)" : "transparent",
              color: filter === f ? "var(--accent-text)" : "var(--text)",
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p style={{ color: "var(--muted)" }} className="text-sm">
          No requests in this view.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const sc = statusColor(r.status);
            return (
              <li key={r._id} className="border-2 p-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="mono text-xs font-bold">UNIT {r.unit}</div>
                    <div className="text-xs mt-1">
                      <ViewerTag userHandle={r.authorHandle} />
                    </div>
                  </div>
                  <div
                    className="mono text-xs px-2 py-1 border"
                    style={{ background: sc.bg, color: sc.text, borderColor: "var(--border)" }}
                  >
                    {(r.status || "open").toUpperCase()}
                  </div>
                </div>
                <p className="text-sm mb-2">{r.description}</p>
                <div className="flex items-center justify-between text-xs mono mb-3" style={{ color: "var(--muted)" }}>
                  <span>{r.category || "general"}</span>
                  <span>{urgencyDots(r.urgency || 3)}</span>
                </div>
                <button
                  onClick={() => advance(r)}
                  className="mono text-xs font-bold border-2 px-3 py-2 min-h-[36px] w-full"
                  style={{ borderColor: "var(--border)", background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  → {r.status === "open" ? "MARK IN-PROGRESS" : r.status === "in-progress" ? "MARK DONE" : "REOPEN"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen",
    header: "border-b-2 px-4 py-3 flex items-center justify-between sticky top-0 z-10",
    main: "max-w-2xl mx-auto p-4 space-y-4",
    title: "mono text-xl font-bold tracking-tight",
  };

  if (isViewerPending) return null;

  return (
    <div className={c.page} style={{ background: "var(--bg)", color: "var(--text)" }}>
      <ThemeStyles />
      <header id="app-header" className={c.header} style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div>
          <h1 className={c.title}>BUILDINGFIX</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {isOwner ? "Manager view" : viewer ? "Tenant view" : "Sign in to submit"}
          </p>
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {isOwner ? (
          <ManagerDashboard ViewerTag={ViewerTag} />
        ) : (
          <>
            <RequestForm viewer={viewer} />
            <MyRequests viewer={viewer} />
          </>
        )}
      </main>
    </div>
  );
}
