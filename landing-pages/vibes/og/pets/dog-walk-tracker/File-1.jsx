import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f3ee] font-['Space_Grotesk',sans-serif] pb-12",
  header: "border-b-[3px] border-[#1a1a2e] bg-white shadow-[4px_4px_0px_#1a1a2e] mb-6 p-4 flex items-center gap-3",
  dogRoster: "max-w-[920px] mx-auto px-4 mb-8",
  walkTimer: "max-w-[920px] mx-auto px-4 mb-8",
  history: "max-w-[920px] mx-auto px-4 mb-8",
};

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function streakFor(walks, dogId) {
  const days = [...new Set(walks.filter(w => w.dogId === dogId).map(w => w.date))].sort().reverse();
  if (!days.length) return 0;
  let streak = 0;
  let cursor = new Date();
  for (const day of days) {
    const d = new Date(day + "T12:00:00");
    const diff = Math.round((cursor - d) / 86400000);
    if (diff <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{animation:"spin 0.8s linear infinite"}} className="inline-block">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="8" cy="8" r="6" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeDasharray="28 8" strokeLinecap="round"/>
    </svg>
  );
}

// ── Add Dog Form ───────────────────────────────────────────────────────────────
function AddDogForm({ database }) {
  const { useFireproof: _unused, ..._ } = { useFireproof: null };
  const { doc, merge, submit } = useFireproof("dog-walk-tracker-v1").useDocument({ type: "dog", name: "", breed: "" });
  // can't call hooks in nested; will lift to App
  return null;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("dog-walk-tracker-v1");

  // Dogs
  const { docs: dogs } = useLiveQuery("type", { key: "dog" });
  // Walks
  const { docs: walks } = useLiveQuery("type", { key: "walk" });

  // New dog form
  const { doc: newDog, merge: mergeDog, submit: submitDog } = useDocument({ type: "dog", name: "", breed: "" });

  // Active walk state (stored in Fireproof so it survives refresh)
  const { doc: activeWalk, merge: mergeActive, save: saveActive, reset: resetActive } =
    useDocument({ _id: "active-walk", dogId: null, dogName: "", startedAt: null, walker: "", note: "", energy: "3", poops: "0" });

  const [now, setNow] = useState(Date.now());
  const [isLogging, setIsLogging] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────
  function handleStartWalk(dog) {
    mergeActive({ dogId: dog._id, dogName: dog.name, startedAt: Date.now(), walker: "", note: "", energy: "3", poops: "0" });
    saveActive();
  }

  async function handleStopWalk(e) {
    e.preventDefault();
    if (!activeWalk.walker.trim()) return;
    setIsLogging(true);
    try {
      const duration = Date.now() - activeWalk.startedAt;
      await database.put({
        type: "walk",
        dogId: activeWalk.dogId,
        dogName: activeWalk.dogName,
        walker: activeWalk.walker,
        duration,
        note: activeWalk.note,
        energy: Number(activeWalk.energy),
        poops: Number(activeWalk.poops),
        date: todayKey(),
        ts: Date.now(),
      });
      await database.put({ _id: "active-walk", dogId: null, dogName: "", startedAt: null, walker: "", note: "", energy: "3", poops: "0", type: "active-walk-state" });
    } finally {
      setIsLogging(false);
    }
  }

  async function handleDeleteDog(dog) {
    await database.del(dog._id);
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const todayWalks = walks.filter(w => w.date === todayKey());

  const c = {
    card: "bg-white border-[3px] border-[#1a1a2e] shadow-[4px_4px_0px_#1a1a2e] rounded-[4px] p-4 mb-4",
    label: "block text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b8a] mb-1 font-['Space_Grotesk',sans-serif]",
    input: "w-full border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-2 text-sm font-['Space_Grotesk',sans-serif] bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1a2e] transition-all duration-150",
    btnRed: "bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-2 text-[0.75rem] uppercase tracking-[0.05em] font-bold shadow-[4px_4px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 cursor-pointer",
    btnYellow: "bg-[oklch(0.85_0.18_85)] text-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-2 text-[0.75rem] uppercase tracking-[0.05em] font-bold shadow-[3px_3px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 cursor-pointer",
    btnGreen: "bg-[oklch(0.62_0.19_145)] text-white border-[3px] border-[#1a1a2e] rounded-[4px] px-4 py-2 text-[0.75rem] uppercase tracking-[0.05em] font-bold shadow-[4px_4px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 cursor-pointer",
    btnGhost: "bg-white text-[#1a1a2e] border-[3px] border-[#1a1a2e] rounded-[4px] px-3 py-1 text-[0.7rem] uppercase tracking-[0.05em] font-bold hover:shadow-[3px_3px_0px_#1a1a2e] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-150 cursor-pointer",
    sectionTitle: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b8a] font-bold mb-3",
    heading: "text-xl font-bold uppercase tracking-[-0.02em] text-[#1a1a2e]",
  };

  const isWalking = !!activeWalk.startedAt && !!activeWalk.dogId;
  const elapsed = isWalking ? now - activeWalk.startedAt : 0;

  return (
    <main id="app" className={classNames.page}>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional" rel="stylesheet" />

      {/* Header */}
      <header id="app-header" className={classNames.header} style={{boxShadow:"4px 4px 0px #1a1a2e"}}>
        <div className="flex gap-1 mr-2">
          <div className="w-3 h-3 bg-[oklch(0.55_0.24_28)] border border-[#1a1a2e]" />
          <div className="w-3 h-3 bg-[oklch(0.85_0.18_85)] border border-[#1a1a2e]" />
          <div className="w-3 h-3 bg-[oklch(0.62_0.19_145)] border border-[#1a1a2e]" />
        </div>
        <h1 className="text-[1rem] font-bold uppercase tracking-[-0.02em] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]">Dog Walk Tracker</h1>
      </header>

      <div className="max-w-[920px] mx-auto px-4">

        {/* ── Active Walk Timer ───────────────────────────────────────────── */}
        {isWalking && (
          <section id="walk-timer" className="mb-8">
            <div className={`${c.card} border-[oklch(0.55_0.24_28)]`} style={{borderColor:"oklch(0.55 0.24 28)"}}>
              <div className="h-[6px] -mx-4 -mt-4 mb-4 rounded-t-[1px] flex overflow-hidden">
                <div className="flex-1 bg-[oklch(0.55_0.24_28)]" />
                <div className="flex-1 bg-[oklch(0.85_0.18_85)]" />
                <div className="flex-1 bg-[oklch(0.62_0.19_145)]" />
                <div className="flex-1 bg-[oklch(0.52_0.18_255)]" />
              </div>
              <p className={c.sectionTitle}>Walk In Progress</p>
              <h2 className="text-2xl font-bold uppercase tracking-[-0.02em] text-[#1a1a2e] mb-1 font-['Space_Grotesk',sans-serif]">{activeWalk.dogName}</h2>
              <p className="font-['JetBrains_Mono',monospace] text-3xl font-bold text-[oklch(0.55_0.24_28)] mb-4">{fmtDuration(elapsed)}</p>
              <form onSubmit={handleStopWalk} className="grid grid-cols-1 gap-3">
                <div>
                  <label className={c.label}>Your Name *</label>
                  <input className={c.input} value={activeWalk.walker} onChange={e => mergeActive({ walker: e.target.value })} placeholder="Who's walking?" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={c.label}>Energy (1–5)</label>
                    <input className={c.input} type="number" min="1" max="5" value={activeWalk.energy} onChange={e => mergeActive({ energy: e.target.value })} />
                  </div>
                  <div>
                    <label className={c.label}>Poop Count</label>
                    <input className={c.input} type="number" min="0" value={activeWalk.poops} onChange={e => mergeActive({ poops: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={c.label}>Note (optional)</label>
                  <input className={c.input} value={activeWalk.note} onChange={e => mergeActive({ note: e.target.value })} placeholder="Anything to flag?" />
                </div>
                <button type="submit" className={c.btnRed} disabled={isLogging}>
                  {isLogging ? <Spinner /> : (
                    <span className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      Stop & Log Walk
                    </span>
                  )}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* ── Dog Roster ──────────────────────────────────────────────────── */}
        <section id="dog-roster" className={classNames.dogRoster}>
          <p className={c.sectionTitle}>Your Dogs</p>

          {dogs.length === 0 && (
            <div className={`${c.card} text-center text-[#6b6b8a] text-sm`}>
              No dogs yet — add one below.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 mb-4">
            {dogs.map(dog => {
              const streak = streakFor(walks, dog._id);
              const todayDog = todayWalks.filter(w => w.dogId === dog._id);
              const totalMs = todayDog.reduce((s, w) => s + (w.duration || 0), 0);
              const walkers = [...new Set(todayDog.map(w => w.walker))];
              const isThisDogWalking = isWalking && activeWalk.dogId === dog._id;
              return (
                <div key={dog._id} className={c.card}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-[1rem] font-bold uppercase tracking-[-0.01em] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]">{dog.name}</h3>
                      {dog.breed && <p className="text-[0.75rem] text-[#6b6b8a]">{dog.breed}</p>}
                      <div className="flex gap-3 mt-2 flex-wrap">
                        <span className="font-['JetBrains_Mono',monospace] text-[0.75rem] text-[#1a1a2e]">
                          Today: <strong>{totalMs ? fmtDuration(totalMs) : "0m"}</strong>
                        </span>
                        {walkers.length > 0 && <span className="text-[0.72rem] text-[#6b6b8a]">by {walkers.join(", ")}</span>}
                        <span className="font-['JetBrains_Mono',monospace] text-[0.75rem]" style={{color: streak > 2 ? "oklch(0.62 0.19 145)" : "#6b6b8a"}}>
                          🔥 {streak}d streak
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {!isWalking && (
                        <button className={c.btnGreen} onClick={() => handleStartWalk(dog)}>
                          <span className="flex items-center gap-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Start Walk
                          </span>
                        </button>
                      )}
                      {isThisDogWalking && (
                        <span className="text-[0.7rem] uppercase font-bold tracking-widest text-[oklch(0.55_0.24_28)] self-center">Walking...</span>
                      )}
                      <button className={c.btnGhost} onClick={() => handleDeleteDog(dog)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Dog */}
          <div className={c.card}>
            <p className={c.sectionTitle}>Add a Dog</p>
            <form onSubmit={e => { e.preventDefault(); if (newDog.name.trim()) submitDog(); }} className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={c.label}>Name *</label>
                  <input className={c.input} value={newDog.name} onChange={e => mergeDog({ name: e.target.value })} placeholder="Biscuit" required />
                </div>
                <div>
                  <label className={c.label}>Breed</label>
                  <input className={c.input} value={newDog.breed} onChange={e => mergeDog({ breed: e.target.value })} placeholder="Corgi" />
                </div>
              </div>
              <button type="submit" className={c.btnYellow}>
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Dog
                </span>
              </button>
            </form>
          </div>
        </section>

        {/* ── Today's Summary / History ───────────────────────────────────── */}
        <section id="history" className={classNames.history}>
          <p className={c.sectionTitle}>Today's Walk Log — {todayKey()}</p>
          {todayWalks.length === 0 ? (
            <div className={`${c.card} text-center text-sm text-[#6b6b8a]`}>No walks logged today yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {[...todayWalks].reverse().map(w => (
                <div key={w._id} className={c.card}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-bold uppercase text-[0.85rem] text-[#1a1a2e] font-['Space_Grotesk',sans-serif]">{w.dogName}</span>
                      <span className="ml-2 text-[0.72rem] text-[#6b6b8a]">by {w.walker}</span>
                    </div>
                    <span className="font-['JetBrains_Mono',monospace] text-[0.85rem] font-bold text-[#1a1a2e]">{fmtDuration(w.duration)}</span>
                  </div>
                  <div className="flex gap-4 mt-1 flex-wrap">
                    <span className="text-[0.7rem] text-[#6b6b8a]">Energy: <strong>{w.energy}/5</strong></span>
                    <span className="text-[0.7rem] text-[#6b6b8a]">Poops: <strong>{w.poops}</strong></span>
                    {w.note && <span className="text-[0.7rem] text-[#6b6b8a]">"{w.note}"</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}