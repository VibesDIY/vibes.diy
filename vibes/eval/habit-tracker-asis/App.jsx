import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Header({ ViewerTag, c }) {
  return (
    <header
      id="app-header"
      className={`sticky top-0 z-10 ${c.headerBg} ${c.border} border-b backdrop-blur-md px-4 py-3 flex items-center justify-between`}
    >
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className={`w-7 h-7 ${c.flame}`} fill="currentColor">
          <path d="M12 2s4 5 4 9a4 4 0 01-8 0c0-1 .5-2 1-3-2 1-4 4-4 7a7 7 0 0014 0c0-6-7-13-7-13z" />
        </svg>
        <h1 className={`font-bold text-xl ${c.ink}`} style={{ fontFamily: "Fredoka, sans-serif" }}>
          Hearth Streaks
        </h1>
      </div>
      <ViewerTag />
    </header>
  );
}

function CoachCard({ nudge, c }) {
  return (
    <section id="coach" className={`mx-4 mt-4 ${c.coachBg} ${c.border} border rounded-2xl p-4`}>
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 24 24"
          className={`w-6 h-6 ${c.gold} shrink-0 mt-0.5`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a7 7 0 00-7 7c0 3 2 5 3 6v3a2 2 0 002 2h4a2 2 0 002-2v-3c1-1 3-3 3-6a7 7 0 00-7-7z" />
        </svg>
        {nudge ? (
          <div className="space-y-1.5">
            <div className={`text-xs uppercase tracking-wider ${c.gold} font-semibold`}>Coach · {nudge.habitName}</div>
            <div className={`text-sm ${c.ink}`}>{nudge.message}</div>
            <div className={`text-xs ${c.green} font-semibold mt-2`}>Try: {nudge.microGoal}</div>
          </div>
        ) : (
          <div className={`text-sm ${c.ink} opacity-70 italic`}>Coach messages appear here when you bounce back from a slip.</div>
        )}
      </div>
    </section>
  );
}

function HabitRow({ habit, checkinDays, onCheckIn, isOwner, c }) {
  const { streak, checkedToday } = computeStreak(checkinDays);
  return (
    <li className={`${c.cardBg} ${c.border} border rounded-2xl p-4 flex items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold ${c.ink} truncate`} style={{ fontFamily: "Fredoka, sans-serif" }}>
          {habit.name}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${streak > 0 ? c.flame : "text-white/30"}`} fill="currentColor">
            <path d="M12 2s4 5 4 9a4 4 0 01-8 0c0-1 .5-2 1-3-2 1-4 4-4 7a7 7 0 0014 0c0-6-7-13-7-13z" />
          </svg>
          <span className={`text-sm ${c.ink} opacity-80`}>
            {streak} day{streak === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      {isOwner && (
        <button
          onClick={() => onCheckIn(habit)}
          disabled={checkedToday}
          className={`min-h-[44px] min-w-[44px] px-4 rounded-xl font-semibold text-sm ${checkedToday ? "bg-[oklch(0.70_0.15_155/0.3)] text-[oklch(0.70_0.15_155)]" : `${c.primary} ${c.ink}`}`}
        >
          {checkedToday ? "✓ Done" : "Did it"}
        </button>
      )}
    </li>
  );
}

function HabitList({ habits, checkinsByHabit, onCheckIn, isOwner, c }) {
  return (
    <section id="habits" className="px-4 pt-4 pb-32 space-y-3">
      <h2 className={`text-sm uppercase tracking-wider ${c.ink} opacity-60 font-semibold`}>Today's habits</h2>
      {habits.length === 0 ? (
        <div className={`${c.cardBg} ${c.border} border rounded-2xl p-6 text-center ${c.ink} opacity-70`}>No habits yet.</div>
      ) : (
        <ul className="space-y-3">
          {habits.map((h) => (
            <HabitRow
              key={h._id}
              habit={h}
              checkinDays={checkinsByHabit[h._id] || []}
              onCheckIn={onCheckIn}
              isOwner={isOwner}
              c={c}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AddHabitBar({ database, c }) {
  const [name, setName] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function add(e) {
    e?.preventDefault();
    if (!name.trim()) return;
    await database.put({ type: "habit", name: name.trim(), createdAt: Date.now(), archived: false });
    setName("");
    setOpen(false);
  }

  async function suggest() {
    setLoading(true);
    try {
      const res = await callAI("Suggest one short, specific daily habit name (3-5 words, no emoji).", {
        schema: { properties: { habit: { type: "string" } } },
      });
      const { habit } = JSON.parse(res);
      setName(habit);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="add-habit" className={`fixed bottom-0 left-0 right-0 ${c.barBg} ${c.border} border-t px-4 py-3 backdrop-blur-md`}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={`w-full min-h-[52px] ${c.primary} ${c.ink} font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add habit
        </button>
      ) : (
        <form onSubmit={add} className="flex gap-2 items-center">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Stretch for 5 minutes"
            className={`flex-1 min-h-[48px] px-3 rounded-xl bg-white/10 ${c.ink} placeholder-white/40 ${c.border} border outline-none focus:border-white/30`}
          />
          <button
            type="button"
            onClick={suggest}
            disabled={loading}
            title="Suggest"
            className={`min-h-[48px] min-w-[48px] rounded-xl bg-white/10 ${c.ink} flex items-center justify-center`}
          >
            {loading ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
              </svg>
            )}
          </button>
          <button type="submit" className={`min-h-[48px] px-4 ${c.primary} ${c.ink} font-semibold rounded-xl`}>
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setName("");
            }}
            className={`min-h-[48px] min-w-[48px] ${c.ink} opacity-60`}
          >
            ✕
          </button>
        </form>
      )}
    </section>
  );
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(checkinDays) {
  if (checkinDays.length === 0) return { streak: 0, checkedToday: false, daysSince: null };
  const set = new Set(checkinDays);
  const today = dayKey(Date.now());
  const checkedToday = set.has(today);
  let cursor = new Date();
  if (!checkedToday) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  // days since last checkin
  const sorted = [...checkinDays].sort().reverse();
  const last = new Date(sorted[0]);
  const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);
  return { streak, checkedToday, daysSince };
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("hearthStreaks");
  const { docs: habits } = useLiveQuery("type", { key: "habit" });
  const { docs: checkins } = useLiveQuery("type", { key: "checkin" });
  const { docs: nudges } = useLiveQuery("type", { key: "nudge", descending: true, limit: 1 });

  const activeHabits = habits.filter((h) => !h.archived);
  const checkinsByHabit = {};
  for (const ci of checkins) {
    if (!checkinsByHabit[ci.habitId]) checkinsByHabit[ci.habitId] = [];
    checkinsByHabit[ci.habitId].push(ci.day);
  }

  async function checkIn(habit) {
    const today = dayKey(Date.now());
    const existing = checkins.find((ci) => ci.habitId === habit._id && ci.day === today);
    if (existing) return;
    await database.put({ type: "checkin", habitId: habit._id, day: today, createdAt: Date.now() });
  }

  // Auto-coach: when a habit has a broken streak (>1 day gap) and no recent nudge, generate one.
  const coachedRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!isOwner) return;
    for (const habit of activeHabits) {
      const days = checkinsByHabit[habit._id] || [];
      if (days.length === 0) continue;
      const { streak, daysSince } = computeStreak(days);
      if (streak === 0 && daysSince >= 2 && daysSince <= 30 && !coachedRef.current.has(habit._id)) {
        const recent = nudges[0];
        if (recent && recent.habitId === habit._id && Date.now() - recent.createdAt < 86400000) continue;
        coachedRef.current.add(habit._id);
        callAI(
          `A user's habit "${habit.name}" lost its streak. They missed ${daysSince} days. Write a warm, brief encouragement (1-2 sentences) and a tiny micro-goal to restart.`,
          {
            schema: { properties: { message: { type: "string" }, microGoal: { type: "string" } } },
          }
        )
          .then((res) => {
            const { message, microGoal } = JSON.parse(res);
            database.put({
              type: "nudge",
              habitId: habit._id,
              habitName: habit.name,
              message,
              microGoal,
              daysMissed: daysSince,
              createdAt: Date.now(),
            });
          })
          .catch(() => {});
      }
    }
  }, [activeHabits.length, checkins.length, isOwner]);

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)]",
    headerBg: "bg-[oklch(0.18_0.10_300/0.7)]",
    cardBg: "bg-[oklch(0.38_0.17_295/0.4)]",
    coachBg: "bg-[oklch(0.47_0.18_295/0.35)]",
    barBg: "bg-[oklch(0.18_0.10_300/0.85)]",
    primary: "bg-[oklch(0.47_0.18_295)] hover:bg-[oklch(0.38_0.17_295)] active:bg-[oklch(0.30_0.15_295)]",
    border: "border-white/10",
    ink: "text-white",
    flame: "text-[oklch(0.88_0.18_95)]",
    gold: "text-[oklch(0.88_0.18_95)]",
    green: "text-[oklch(0.70_0.15_155)]",
    danger: "text-[oklch(0.55_0.20_25)]",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page} style={{ fontFamily: "Nunito, sans-serif" }}>
      <Header ViewerTag={ViewerTag} c={c} />
      <main id="app">
        <CoachCard nudge={nudges[0]} c={c} />
        <HabitList habits={activeHabits} checkinsByHabit={checkinsByHabit} onCheckIn={checkIn} isOwner={isOwner} c={c} />
        {isOwner && <AddHabitBar database={database} c={c} />}
      </main>
    </div>
  );
}
