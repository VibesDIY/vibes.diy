import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --bg-start: oklch(0.18 0.10 300);
        --bg-end: oklch(0.12 0.09 300);
        --primary: oklch(0.38 0.17 295);
        --primary-light: oklch(0.47 0.18 295);
        --accent-green: oklch(0.70 0.15 155);
        --accent-gold: oklch(0.88 0.18 95);
        --danger: oklch(0.55 0.20 25);
        --text: oklch(1.00 0 0);
        --muted: oklch(1.00 0 0 / 0.65);
        --card-bg: oklch(0.38 0.17 295 / 0.4);
        --border: oklch(1.00 0 0 / 0.1);
        --accent: var(--accent-gold);
        --accent-text: oklch(0.25 0.16 295);
      }
      body { font-family: 'Nunito', sans-serif; color: var(--text); }
      h1, h2, h3 { font-family: 'Fredoka', sans-serif; }
    `}</style>
  );
}

function HabitsSection({ c }) {
  return (
    <section id="habits" className={c.card}>
      <h2 className={c.h2}>My Habits</h2>
      <p className={c.muted}>Sign in to add habits and check them off.</p>
      {/* habits list + check-in grid lands here */}
    </section>
  );
}

function computeStreak(days) {
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  // allow streak if today OR yesterday is checked
  const today = d.toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (!set.has(today) && !set.has(yest)) return 0;
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function StreakBoardSection({ c, viewer, database, habits, checkins, cheers, ViewerTag }) {
  const byOwner = {};
  for (const h of habits) {
    if (!byOwner[h.ownerHandle]) byOwner[h.ownerHandle] = [];
    byOwner[h.ownerHandle].push(h);
  }
  const today = new Date().toISOString().slice(0, 10);

  function sendCheer(toHandle, habitId) {
    if (!viewer) return;
    database.put({ type: "cheer", fromHandle: viewer.userHandle, toHandle, habitId, message: "🔥", createdAt: Date.now() });
  }

  const owners = Object.keys(byOwner);

  return (
    <section id="streak-board" className={c.card}>
      <h2 className={c.h2}>Group Streak Board</h2>
      {owners.length === 0 && <p className={c.muted}>No habits yet. Be the first!</p>}
      <ul className="space-y-3">
        {owners.map((handle) => (
          <li key={handle} className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ViewerTag userHandle={handle} />
            </div>
            <ul className="space-y-2">
              {byOwner[handle].map((h) => {
                const days = checkins.filter((ci) => ci.habitId === h._id).map((ci) => ci.day);
                const streak = computeStreak(days);
                const didToday = days.includes(today);
                const cheerCount = cheers.filter((c) => c.habitId === h._id).length;
                return (
                  <li key={h._id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{h.name}</div>
                      <div className={c.muted}>
                        {streak} day streak {didToday ? "✓ today" : ""} · {cheerCount} cheers
                      </div>
                    </div>
                    {viewer && viewer.userHandle !== handle && (
                      <button onClick={() => sendCheer(handle, h._id)} className={c.btnAlt}>
                        Cheer
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheersSection({ c, cheers, ViewerTag }) {
  return (
    <section id="cheers" className={c.card}>
      <h2 className={c.h2}>Recent Cheers</h2>
      {cheers.length === 0 && <p className={c.muted}>No cheers yet — be the first to encourage someone.</p>}
      <ul className="space-y-2">
        {cheers.slice(0, 12).map((ch) => (
          <li key={ch._id} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 p-2">
            <ViewerTag userHandle={ch.fromHandle} />
            <span className={c.muted}>cheered</span>
            <ViewerTag userHandle={ch.toHandle} />
            <span className="ml-auto">{ch.message || "🔥"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("hearthHabits");
  const { docs: habits } = useLiveQuery("type", { key: "habit" });
  const { docs: checkins } = useLiveQuery("type", { key: "checkin" });
  const { docs: cheers } = useLiveQuery("type", { key: "cheer", descending: true });

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)] text-white",
    shell: "max-w-2xl mx-auto px-4 pt-4 pb-24",
    header:
      "sticky top-0 z-10 backdrop-blur bg-[oklch(0.18_0.10_300/0.7)] border-b border-white/10 px-4 py-3 flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    card: "bg-[oklch(0.38_0.17_295/0.4)] border border-white/10 rounded-2xl p-4 mb-4 shadow-lg",
    h2: "text-lg font-semibold mb-2",
    muted: "text-white/65 text-sm",
    btn: "min-h-[44px] px-4 py-3 rounded-xl bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)] font-semibold",
    btnAlt: "min-h-[44px] px-4 py-3 rounded-xl bg-[oklch(0.47_0.18_295)] text-white font-medium",
    input: "w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/50",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <ThemeStyles />
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Hearth Habits</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.shell}>
        <HabitsSection c={c} viewer={viewer} database={database} habits={habits} />
        <StreakBoardSection
          c={c}
          viewer={viewer}
          database={database}
          habits={habits}
          checkins={checkins}
          cheers={cheers}
          ViewerTag={ViewerTag}
        />
        <CheersSection c={c} cheers={cheers} ViewerTag={ViewerTag} />
      </main>
    </div>
  );
}
