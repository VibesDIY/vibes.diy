import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Header({ ViewerTag, c }) {
  return (
    <header id="app-header" className={`${c.headerBg} border-b ${c.border} px-4 py-4 sticky top-0 z-10 backdrop-blur`}>
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div>
          <h1 className={`${c.brand} text-2xl tracking-widest font-bold`}>FOCUS FORGE</h1>
          <p className={`${c.muted} text-xs tracking-wider mt-0.5`}>// multi-timer focus dashboard</p>
        </div>
        <ViewerTag />
      </div>
    </header>
  );
}

function TimerCreator({ c }) {
  return (
    <section id="timer-creator" className={`${c.panel} border ${c.border} rounded-sm p-4`}>
      <h2 className={`${c.heading} text-sm tracking-widest mb-3`}>NEW TIMER</h2>
      {/* form lands in feature edit */}
      <p className={`${c.muted} text-xs`}>loading…</p>
    </section>
  );
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function TimerCard({ timer, c, database, isOwner }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer.running]);

  const elapsed = timer.running && timer.lastStartedAt ? now - timer.lastStartedAt : 0;
  const remaining = Math.max(0, timer.remainingMs - elapsed);
  const totalMs = (timer.phase === "focus" ? timer.focusMin : timer.breakMin) * 60000;
  const pct = totalMs > 0 ? Math.min(100, ((totalMs - remaining) / totalMs) * 100) : 0;

  React.useEffect(() => {
    if (!timer.running || !isOwner) return;
    if (remaining > 0) return;
    const nextPhase = timer.phase === "focus" ? "break" : "focus";
    const nextMs = (nextPhase === "focus" ? timer.focusMin : timer.breakMin) * 60000;
    if (timer.phase === "focus") {
      database.put({
        type: "session",
        timerId: timer._id,
        timerName: timer.name,
        phase: "focus",
        durationMs: timer.focusMin * 60000,
        completedAt: Date.now(),
      });
    }
    database.put({ ...timer, phase: nextPhase, remainingMs: nextMs, running: true, lastStartedAt: Date.now() });
  }, [remaining, timer.running, isOwner]);

  function start() {
    database.put({ ...timer, running: true, lastStartedAt: Date.now() });
  }
  function pause() {
    database.put({ ...timer, running: false, remainingMs: remaining, lastStartedAt: null });
  }
  function reset() {
    const ms = (timer.phase === "focus" ? timer.focusMin : timer.breakMin) * 60000;
    database.put({ ...timer, running: false, remainingMs: ms, lastStartedAt: null });
  }
  function del() {
    database.del(timer._id);
  }

  const phaseColor = timer.phase === "focus" ? c.brand : "text-[oklch(0.70_0.15_180)]";

  return (
    <div className={`${c.panelHi} border ${c.border} rounded-sm p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`${c.heading} text-sm font-semibold tracking-wider`}>{timer.name}</div>
          <div className={`${phaseColor} text-xs tracking-widest uppercase`}>{timer.phase}</div>
        </div>
        <div className={`${c.heading} text-3xl font-bold tabular-nums`}>{fmt(remaining)}</div>
      </div>
      <div className={`${c.barBg} h-1.5 rounded-sm overflow-hidden`}>
        <div className={`${c.accent} h-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {isOwner && (
        <div className="grid grid-cols-4 gap-2">
          {!timer.running ? (
            <button onClick={start} className={`${c.accent} text-xs tracking-widest py-2 rounded-sm min-h-[44px] col-span-2`}>
              START
            </button>
          ) : (
            <button
              onClick={pause}
              className={`${c.panel} border ${c.border} text-xs tracking-widest py-2 rounded-sm min-h-[44px] col-span-2`}
            >
              PAUSE
            </button>
          )}
          <button onClick={reset} className={`${c.panel} border ${c.border} text-xs tracking-widest py-2 rounded-sm min-h-[44px]`}>
            RESET
          </button>
          <button
            onClick={del}
            className={`${c.panel} border ${c.border} text-xs tracking-widest py-2 rounded-sm min-h-[44px] text-[oklch(0.53_0.22_25)]`}
          >
            DEL
          </button>
        </div>
      )}
    </div>
  );
}

function TimerGrid({ c, database, timers, isOwner }) {
  return (
    <section id="timer-grid" className={`${c.panel} border ${c.border} rounded-sm p-4`}>
      <h2 className={`${c.heading} text-sm tracking-widest mb-3`}>ACTIVE TIMERS</h2>
      {timers.length === 0 ? (
        <p className={`${c.muted} text-xs`}>no timers yet</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {timers.map((t) => (
            <TimerCard key={t._id} timer={t} c={c} database={database} isOwner={isOwner} />
          ))}
        </div>
      )}
    </section>
  );
}

function StatsDashboard({ c, sessions }) {
  const focusSessions = sessions.filter((s) => s.phase === "focus");
  const totalFocusMs = focusSessions.reduce((a, s) => a + (s.durationMs || 0), 0);
  const totalMin = Math.round(totalFocusMs / 60000);
  return (
    <section id="stats-dashboard" className={`${c.panel} border ${c.border} rounded-sm p-4`}>
      <h2 className={`${c.heading} text-sm tracking-widest mb-3`}>SESSION STATS</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${c.panelHi} border ${c.border} p-3 rounded-sm`}>
          <div className={`${c.muted} text-xs tracking-widest`}>POMODOROS</div>
          <div className={`${c.heading} text-3xl font-bold tabular-nums`}>{focusSessions.length}</div>
        </div>
        <div className={`${c.panelHi} border ${c.border} p-3 rounded-sm`}>
          <div className={`${c.muted} text-xs tracking-widest`}>FOCUS MIN</div>
          <div className={`${c.heading} text-3xl font-bold tabular-nums`}>{totalMin}</div>
        </div>
      </div>
      {focusSessions.length > 0 && (
        <ul className={`${c.muted} text-xs mt-3 space-y-1 max-h-32 overflow-y-auto`}>
          {focusSessions.slice(0, 8).map((s) => (
            <li key={s._id} className="flex justify-between">
              <span>{s.timerName}</span>
              <span>{new Date(s.completedAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CoachPanel({ c, sessions, database, isOwner }) {
  const [loading, setLoading] = React.useState(false);
  const focusSessions = sessions.filter((s) => s.phase === "focus");
  const latestCoach = sessions.find((s) => s.type === "coach");

  async function getSuggestion() {
    setLoading(true);
    try {
      const summary = focusSessions
        .slice(0, 10)
        .map((s) => `${s.timerName}: ${Math.round(s.durationMs / 60000)}min`)
        .join("; ");
      const r = await callAI(
        `You are a productivity coach. Recent focus sessions: ${summary || "none yet"}. Total: ${focusSessions.length} pomodoros. Give a short motivational note, recommended next focus duration in minutes, and one concentration tip.`,
        { schema: { properties: { note: { type: "string" }, nextFocusMin: { type: "number" }, tip: { type: "string" } } } }
      );
      const parsed = JSON.parse(r);
      await database.put({ type: "coach", ...parsed, createdAt: Date.now() });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="coach-panel" className={`${c.panel} border ${c.border} rounded-sm p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`${c.heading} text-sm tracking-widest`}>AI COACH</h2>
        {isOwner && (
          <button
            onClick={getSuggestion}
            disabled={loading}
            className={`${c.accent} text-xs tracking-widest px-3 py-2 rounded-sm min-h-[44px] flex items-center gap-2 disabled:opacity-50`}
          >
            {loading && (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            )}
            {loading ? "THINKING" : "ASK COACH"}
          </button>
        )}
      </div>
      {latestCoach ? (
        <div className="space-y-2">
          <p className={`${c.heading} text-sm`}>{latestCoach.note}</p>
          <p className={`${c.muted} text-xs`}>
            Next focus: <span className={c.brand}>{latestCoach.nextFocusMin} min</span>
          </p>
          <p className={`${c.muted} text-xs italic`}>tip: {latestCoach.tip}</p>
        </div>
      ) : (
        <p className={`${c.muted} text-xs`}>complete a focus session to receive guidance</p>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("focusForge");
  const { docs: timers } = useLiveQuery("type", { key: "timer" });
  const { docs: sessions } = useLiveQuery("_id", { descending: true, limit: 100 });

  const c = {
    page: "bg-[oklch(0.10_0.003_264)] text-[oklch(0.93_0.005_264)] min-h-screen font-mono",
    headerBg: "bg-[oklch(0.10_0.003_264)]/90",
    panel: "bg-[oklch(0.16_0.003_264)]",
    panelHi: "bg-[oklch(0.19_0.003_264)]",
    border: "border-[oklch(0.24_0.003_264)]",
    brand: "text-[oklch(0.53_0.22_25)]",
    heading: "text-[oklch(0.93_0.005_264)]",
    muted: "text-[oklch(0.63_0.008_264)]",
    accent: "bg-[oklch(0.53_0.22_25)] hover:bg-[oklch(0.45_0.19_25)] text-[oklch(0.10_0.003_264)]",
    barBg: "bg-[oklch(0.20_0.005_264)]",
    input:
      "bg-[oklch(0.10_0.003_264)] border-[oklch(0.24_0.003_264)] text-[oklch(0.93_0.005_264)] placeholder:text-[oklch(0.63_0.008_264)]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Rajdhani:wght@600&display=optional');`}</style>
      <Header ViewerTag={ViewerTag} c={c} />
      <main id="app" className="max-w-5xl mx-auto p-4 grid gap-4 md:grid-cols-2">
        <TimerCreator c={c} database={database} isOwner={isOwner} viewer={viewer} />
        <StatsDashboard c={c} sessions={sessions} />
        <div className="md:col-span-2">
          <TimerGrid c={c} database={database} timers={timers} isOwner={isOwner} />
        </div>
        <div className="md:col-span-2">
          <CoachPanel c={c} sessions={sessions} database={database} isOwner={isOwner} />
        </div>
      </main>
    </div>
  );
}
