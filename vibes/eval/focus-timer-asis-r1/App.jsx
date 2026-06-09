import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Header({ ViewerTag }) {
  const c = {
    wrap: "flex items-center justify-between px-4 py-3 border-b border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)]",
    title: "text-lg font-semibold tracking-wider uppercase text-[oklch(0.93_0.005_264)]",
    sub: "text-xs text-[oklch(0.63_0.008_264)]",
  };
  return (
    <header id="app-header" className={c.wrap}>
      <div>
        <h1 className={c.title}>Focus Forge</h1>
        <p className={c.sub}>multi-timer pomodoro</p>
      </div>
      <ViewerTag />
    </header>
  );
}

function TimersSection() {
  return (
    <section id="timers" className="p-4 space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-[oklch(0.63_0.008_264)]">Active Timers</h2>
      {/* timer cards land here */}
    </section>
  );
}

function CreateSection({ isOwner, database }) {
  const [label, setLabel] = React.useState("");
  const [workMin, setWorkMin] = React.useState(25);
  const [breakMin, setBreakMin] = React.useState(5);
  if (!isOwner) return null;
  async function create(e) {
    e.preventDefault();
    if (!label.trim()) return;
    await database.put({
      type: "timer",
      label: label.trim(),
      workMin: Number(workMin) || 25,
      breakMin: Number(breakMin) || 5,
      phase: "work",
      running: false,
      phaseStart: Date.now(),
      pausedElapsed: 0,
      completedRounds: 0,
      totalFocusSec: 0,
      createdAt: Date.now(),
    });
    setLabel("");
  }
  const inp =
    "min-h-[44px] px-3 rounded bg-[oklch(0.20_0.005_264)] border border-[oklch(0.24_0.003_264)] text-[oklch(0.93_0.005_264)] w-full";
  return (
    <section id="create" className="p-4 border-t border-[oklch(0.24_0.003_264)]">
      <h2 className="text-sm uppercase tracking-widest text-[oklch(0.63_0.008_264)] mb-2">New Timer</h2>
      <form onSubmit={create} className="space-y-2">
        <input className={inp} placeholder="Label (e.g. Deep work)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-[oklch(0.63_0.008_264)]">
            Work min
            <input type="number" min="1" className={inp} value={workMin} onChange={(e) => setWorkMin(e.target.value)} />
          </label>
          <label className="flex-1 text-xs text-[oklch(0.63_0.008_264)]">
            Break min
            <input type="number" min="1" className={inp} value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />
          </label>
        </div>
        <button
          type="submit"
          className="min-h-[44px] w-full rounded bg-[oklch(0.53_0.22_25)] text-[oklch(0.93_0.005_264)] uppercase tracking-wider font-semibold"
        >
          Create Timer
        </button>
      </form>
    </section>
  );
}

function StatsSection({ timers }) {
  const totalRounds = timers.reduce((s, t) => s + (t.completedRounds || 0), 0);
  const totalFocus = timers.reduce((s, t) => s + (t.totalFocusSec || 0), 0);
  const running = timers.filter((t) => t.running).length;
  const hrs = Math.floor(totalFocus / 3600),
    mins = Math.floor((totalFocus % 3600) / 60);
  const cell = "flex-1 p-3 rounded bg-[oklch(0.16_0.003_264)] border border-[oklch(0.24_0.003_264)]";
  return (
    <section id="stats" className="p-4 border-t border-[oklch(0.24_0.003_264)]">
      <h2 className="text-sm uppercase tracking-widest text-[oklch(0.63_0.008_264)] mb-2">Stats</h2>
      <div className="flex gap-2">
        <div className={cell}>
          <div className="text-xs text-[oklch(0.63_0.008_264)] uppercase">Rounds</div>
          <div className="text-2xl font-bold tabular-nums">{totalRounds}</div>
        </div>
        <div className={cell}>
          <div className="text-xs text-[oklch(0.63_0.008_264)] uppercase">Focus</div>
          <div className="text-2xl font-bold tabular-nums">
            {hrs}h {mins}m
          </div>
        </div>
        <div className={cell}>
          <div className="text-xs text-[oklch(0.63_0.008_264)] uppercase">Active</div>
          <div className="text-2xl font-bold tabular-nums text-[oklch(0.53_0.22_25)]">{running}</div>
        </div>
      </div>
    </section>
  );
}

function CoachSection({ tips }) {
  const coachTips = (tips || []).filter((d) => d.type === "tip");
  return (
    <section id="coach" className="p-4 border-t border-[oklch(0.24_0.003_264)] pb-24">
      <h2 className="text-sm uppercase tracking-widest text-[oklch(0.63_0.008_264)] mb-2">Coach Tips</h2>
      {coachTips.length === 0 && (
        <p className="text-sm text-[oklch(0.63_0.008_264)] italic">Tips appear after each work session completes.</p>
      )}
      <ul className="space-y-2">
        {coachTips.map((d) => (
          <li key={d._id} className="p-3 rounded border border-[oklch(0.24_0.003_264)] bg-[oklch(0.16_0.003_264)]">
            <div className="text-xs text-[oklch(0.53_0.22_25)] uppercase tracking-widest mb-1">{d.timerLabel}</div>
            <p className="text-sm">{d.tip}</p>
            <p className="text-xs text-[oklch(0.63_0.008_264)] mt-1">Try: {d.activity}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  if (isViewerPending) return null;
  return (
    <div className="min-h-screen bg-[oklch(0.10_0.003_264)] text-[oklch(0.93_0.005_264)] font-mono">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Rajdhani:wght@500;700&display=optional');`}</style>
      <Header ViewerTag={ViewerTag} />
      <main id="app">
        <TimersSection />
        <CreateSection />
        <StatsSection />
        <CoachSection />
      </main>
    </div>
  );
}
