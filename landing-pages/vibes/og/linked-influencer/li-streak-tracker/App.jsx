import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#1a1625]",
  feature: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  featureTitle: "text-sm font-bold uppercase tracking-[0.15em] text-[#1a1625] mb-3",
};

function Header({ current = 0, longest = 0 }) {
  return (
    <header className={classNames.header}>
      <div className="h-[6px] flex -mx-4 -mt-4 mb-3">
        <div className="flex-1 bg-[#e63946]" />
        <div className="flex-1 bg-[#f4c430]" />
        <div className="flex-1 bg-[#3cb043]" />
        <div className="flex-1 bg-[#2d6cdf]" />
      </div>
      <h1 className={classNames.title}>Streak Deck</h1>
      <p className="text-xs uppercase tracking-[0.15em] text-[#6b6478] mt-1">Parody Post Tracker</p>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625]">
          <div className="bg-[#e63946] text-white text-[0.65rem] uppercase tracking-[0.15em] px-2 py-1 font-bold">Current</div>
          <div className="p-2 font-['JetBrains_Mono',monospace] text-3xl font-bold">{current}<span className="text-xs ml-1 text-[#6b6478]">DAYS</span></div>
        </div>
        <div className="border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625]">
          <div className="bg-[#f4c430] text-[#1a1625] text-[0.65rem] uppercase tracking-[0.15em] px-2 py-1 font-bold">Longest</div>
          <div className="p-2 font-['JetBrains_Mono',monospace] text-3xl font-bold">{longest}<span className="text-xs ml-1 text-[#6b6478]">DAYS</span></div>
        </div>
      </div>
    </header>
  );
}

const BADGES = [
  { days: 3, label: "Hustler", color: "#e63946", text: "white" },
  { days: 7, label: "Synergist", color: "#f4c430", text: "#1a1625" },
  { days: 14, label: "Visionary", color: "#3cb043", text: "#1a1625" },
  { days: 30, label: "Guru", color: "#2d6cdf", text: "white" },
];

function BadgeWall({ current = 0 }) {
  return (
    <section id="badge-wall" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Badge Wall</h2>
      <div className="grid grid-cols-4 gap-2">
        {BADGES.map((b) => {
          const earned = current >= b.days;
          return (
            <div
              key={b.days}
              className={`border-[3px] border-[#1a1625] rounded p-2 text-center ${earned ? "shadow-[3px_3px_0px_#1a1625]" : "opacity-40"}`}
              style={{ background: earned ? b.color : "#e8e4d8", color: earned ? b.text : "#6b6478" }}
            >
              <div className="font-['JetBrains_Mono',monospace] text-xl font-bold">{b.days}</div>
              <div className="text-[0.6rem] uppercase tracking-[0.1em] font-bold">{b.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DailyPrompt({ prompt, post, onPost, onSubmit, onNewPrompt, done, loading, genLoading }) {
  return (
    <section id="daily-prompt" className={classNames.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={classNames.featureTitle + " mb-0"}>Today's Prompt</h2>
        {done && <span className="bg-[#3cb043] text-[#1a1625] border-[3px] border-[#1a1625] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.15em] font-bold rounded">Done</span>}
      </div>
      <div className="border-[3px] border-[#1a1625] rounded bg-[#f4c430] p-3 mb-3 shadow-[3px_3px_0px_#1a1625]">
        <div className="text-[0.6rem] uppercase tracking-[0.15em] font-bold text-[#1a1625] mb-1">Cringe Drop</div>
        <div className="text-sm font-medium text-[#1a1625] leading-snug">{prompt || "Loading today's cringe..."}</div>
      </div>
      <textarea
        value={post}
        onChange={(e) => onPost(e.target.value)}
        placeholder="Agree? 👇 Drop your hot take below..."
        rows={5}
        className="w-full border-[3px] border-[#1a1625] rounded p-2 text-sm font-['Space_Grotesk',sans-serif] focus:outline-none focus:shadow-[3px_3px_0px_#1a1625] transition-all"
      />
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          onClick={onSubmit}
          disabled={loading || done || !post.trim()}
          className="bg-[#e63946] text-white border-[3px] border-[#1a1625] rounded px-4 py-2 text-xs uppercase tracking-[0.1em] font-bold shadow-[4px_4px_0px_#1a1625] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : done ? "Marked Done" : "Mark Today Done"}
        </button>
        <button
          onClick={onNewPrompt}
          disabled={genLoading}
          className="bg-white text-[#1a1625] border-[3px] border-[#1a1625] rounded px-3 py-2 text-xs uppercase tracking-[0.1em] font-bold hover:shadow-[3px_3px_0px_#1a1625] transition-all disabled:opacity-40"
        >
          {genLoading ? "..." : "Reroll"}
        </button>
      </div>
    </section>
  );
}

function dayKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function StreakCalendar({ completedSet = new Set() }) {
  const today = new Date();
  const todayKey = dayKey(today);
  const days = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return (
    <section id="streak-calendar" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Last 35 Days</h2>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const k = dayKey(d);
          const done = completedSet.has(k);
          const isToday = k === todayKey;
          return (
            <div
              key={k}
              className={`aspect-square border-[3px] border-[#1a1625] rounded flex items-center justify-center font-['JetBrains_Mono',monospace] text-xs font-bold ${done ? "bg-[#3cb043] text-[#1a1625]" : "bg-white text-[#6b6478]"} ${isToday ? "shadow-[3px_3px_0px_#e63946]" : ""}`}
              title={k}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[#6b6478]">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#3cb043] border-[2px] border-[#1a1625]" />Done</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-white border-[2px] border-[#1a1625]" />Empty</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-white border-[2px] border-[#e63946]" />Today</span>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className="h-[6px] flex -mx-4 -mt-4 mb-3">
          <div className="flex-1 bg-[#e63946]" />
          <div className="flex-1 bg-[#f4c430]" />
          <div className="flex-1 bg-[#3cb043]" />
          <div className="flex-1 bg-[#2d6cdf]" />
        </div>
        <h1 className={classNames.title}>Streak Deck</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-[#6b6478] mt-1">Parody Post Tracker</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625]">
            <div className="bg-[#e63946] text-white text-[0.65rem] uppercase tracking-[0.15em] px-2 py-1 font-bold">Current</div>
            <div className="p-2 font-['JetBrains_Mono',monospace] text-3xl font-bold" id="stat-current">0</div>
          </div>
          <div className="border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625]">
            <div className="bg-[#f4c430] text-[#1a1625] text-[0.65rem] uppercase tracking-[0.15em] px-2 py-1 font-bold">Longest</div>
            <div className="p-2 font-['JetBrains_Mono',monospace] text-3xl font-bold" id="stat-longest">0</div>
          </div>
        </div>
      </header>
      <Header />
      <BadgeWall />
      <DailyPrompt />
      <StreakCalendar />
    </main>
  );
}