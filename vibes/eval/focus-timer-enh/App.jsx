import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg: #030303; --card-bg: #0a0a0a; --text: #eaeaea;
        --border: #1a1a1a; --accent: #ffffff; --muted: #666;
      }
      @media (prefers-color-scheme: light) {
        :root { --bg:#fafafa; --card-bg:#fff; --text:#0a0a0a; --border:#e5e5e5; --accent:#0a0a0a; --muted:#888; }
      }
      body { font-family: 'Inter', sans-serif; }
      .mono { font-family: 'Space Mono', monospace; }
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=optional');
    `}</style>
  );
}

const POMO_SECONDS = 25 * 60;

function MyTimerPanel({ viewer, database, sessions, ViewerTag }) {
  const [label, setLabel] = React.useState("");
  const [isStarting, setIsStarting] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mySession = viewer && sessions.find((s) => s.authorHandle === viewer.userHandle && s.status === "active");
  const remaining = mySession ? Math.max(0, Math.ceil((mySession.endsAt - now) / 1000)) : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  async function startPomo(e) {
    e.preventDefault();
    if (!viewer || !label.trim() || isStarting) return;
    setIsStarting(true);
    try {
      let category = "focus",
        nudge = "Stay sharp.";
      try {
        const res = await callAI(`Categorize this focus task and write a 6-word motivational nudge: "${label.trim()}"`, {
          schema: { properties: { category: { type: "string" }, nudge: { type: "string" } } },
        });
        const parsed = JSON.parse(res);
        category = parsed.category || category;
        nudge = parsed.nudge || nudge;
      } catch {}
      const startedAt = Date.now();
      await database.put({
        type: "session",
        status: "active",
        label: label.trim(),
        category,
        nudge,
        authorHandle: viewer.userHandle,
        startedAt,
        endsAt: startedAt + POMO_SECONDS * 1000,
      });
      setLabel("");
    } finally {
      setIsStarting(false);
    }
  }

  async function endSession(status) {
    if (!mySession) return;
    await database.put({ ...mySession, status, endedAt: Date.now() });
  }

  if (!viewer) {
    return (
      <section id="my-timer" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-bg)] p-5">
        <h2 className="mono text-xs uppercase tracking-widest text-[color:var(--muted)] mb-3">Your focus</h2>
        <p className="text-sm text-[color:var(--muted)] mb-3">Sign in to start a pomodoro.</p>
        <ViewerTag />
      </section>
    );
  }

  if (mySession) {
    return (
      <section id="my-timer" className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--card-bg)] p-5">
        <h2 className="mono text-xs uppercase tracking-widest text-[color:var(--muted)] mb-2">You're focused</h2>
        <div className="mono text-5xl font-bold tracking-tight tabular-nums">
          {mm}:{ss}
        </div>
        <p className="text-base font-medium mt-2">{mySession.label}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="mono text-[10px] uppercase tracking-widest text-[color:var(--muted)] border border-[color:var(--border)] px-2 py-1 rounded">
            {mySession.category}
          </span>
        </div>
        <p className="text-xs text-[color:var(--muted)] italic mt-3">"{mySession.nudge}"</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => endSession("done")}
            className="flex-1 min-h-[44px] rounded-xl bg-[color:var(--accent)] text-[color:var(--bg)] font-semibold"
          >
            Finish
          </button>
          <button
            onClick={() => endSession("cancelled")}
            className="flex-1 min-h-[44px] rounded-xl border border-[color:var(--border)] text-[color:var(--text)]"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="my-timer" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-bg)] p-5">
      <h2 className="mono text-xs uppercase tracking-widest text-[color:var(--muted)] mb-3">Start a pomodoro</h2>
      <form onSubmit={startPomo} className="space-y-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What are you working on?"
          className="w-full min-h-[44px] px-3 rounded-xl bg-[color:var(--bg)] border border-[color:var(--border)] text-[color:var(--text)] placeholder:text-[color:var(--muted)]"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!label.trim() || isStarting}
            className="flex-1 min-h-[44px] rounded-xl bg-[color:var(--accent)] text-[color:var(--bg)] font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            ) : null}
            {isStarting ? "Starting..." : "Start 25:00"}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await callAI("Suggest a short concrete focus task for a developer (5-8 words).", {
                  schema: { properties: { task: { type: "string" } } },
                });
                setLabel(JSON.parse(res).task || "");
              } catch {}
            }}
            className="min-h-[44px] px-3 rounded-xl border border-[color:var(--border)] text-xs text-[color:var(--muted)]"
          >
            Suggest
          </button>
        </div>
      </form>
    </section>
  );
}

function TeamBoard({ sessions, viewer, ViewerTag }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = sessions.filter((s) => s.status === "active" && s.endsAt > now);
  const recent = sessions.filter((s) => s.status !== "active" || s.endsAt <= now).slice(0, 8);

  return (
    <section id="team-board" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-bg)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="mono text-xs uppercase tracking-widest text-[color:var(--muted)]">Heads down now</h2>
        <span className="mono text-xs text-[color:var(--muted)]">{active.length} active</span>
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)] mb-4">Nobody's focused right now.</p>
      ) : (
        <ul className="space-y-2 mb-5">
          {active.map((s) => {
            const remaining = Math.max(0, Math.ceil((s.endsAt - now) / 1000));
            const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
            const ss = String(remaining % 60).padStart(2, "0");
            const isMe = viewer && s.authorHandle === viewer.userHandle;
            return (
              <li
                key={s._id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? "border-[color:var(--accent)]" : "border-[color:var(--border)]"} bg-[color:var(--bg)]`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--accent)] opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--accent)]"></span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ViewerTag userHandle={s.authorHandle} />
                  </div>
                  <p className="text-sm truncate">{s.label}</p>
                  <span className="mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">{s.category}</span>
                </div>
                <div className="mono text-xl tabular-nums">
                  {mm}:{ss}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mono text-xs uppercase tracking-widest text-[color:var(--muted)] mb-2">Recent</h3>
      {recent.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No completed sessions yet.</p>
      ) : (
        <ul className="space-y-1">
          {recent.map((s) => (
            <li key={s._id} className="flex items-center gap-3 py-2 text-sm border-b border-[color:var(--border)] last:border-0">
              <ViewerTag userHandle={s.authorHandle} />
              <span className="flex-1 truncate text-[color:var(--muted)]">{s.label}</span>
              <span className="mono text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                {s.status === "done" ? "done" : s.status === "cancelled" ? "stopped" : "expired"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("teamFocus");
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true });
  if (isViewerPending) return null;
  return (
    <main id="app" className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <ThemeStyles />
      <header
        id="app-header"
        className="sticky top-0 z-10 bg-[color:var(--bg)]/95 backdrop-blur border-b border-[color:var(--border)]"
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="mono text-lg font-bold tracking-tight">SIGNAL//FOCUS</h1>
            <p className="text-xs text-[color:var(--muted)]">Team pomodoro board</p>
          </div>
          <ViewerTag />
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4 pb-24">
        <MyTimerPanel viewer={viewer} database={database} sessions={sessions} ViewerTag={ViewerTag} />
        <TeamBoard sessions={sessions} viewer={viewer} ViewerTag={ViewerTag} />
      </div>
    </main>
  );
}
