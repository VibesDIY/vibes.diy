<<<<<<< SEARCH
import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "",
  header: "",
  roster: "",
  feedLog: "",
  warnings: "",
};

function Warnings() {
  return (
    <section id="warnings" className={classNames.warnings}>
      <h2>Warnings</h2>
      {/* overdue alerts */}
    </section>
  );
}

function Roster() {
  return (
    <section id="roster" className={classNames.roster}>
      <h2>Pets</h2>
      {/* pet cards with feed button */}
    </section>
  );
}

function FeedLog() {
  return (
    <section id="feed-log" className={classNames.feedLog}>
      <h2>Today's Feedings</h2>
      {/* timeline */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Pet Feed Tracker</h1>
      </header>
      <Warnings />
      <Roster />
      <FeedLog />
    </main>
  );
}
=======
import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

/* ── Spinner ── */
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="8" cy="8" r="6" stroke="#0f172a" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="28" strokeDashoffset="10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

/* ── Feed Modal ── */
function FeedModal({ pet, onClose, database }) {
  const [caretaker, setCaretaker] = useState("");
  const [portion, setPortion] = useState(pet.portion || "");
  const [saving, setSaving] = useState(false);

  async function handleFeed(e) {
    e.preventDefault();
    if (!caretaker.trim()) return;
    setSaving(true);
    try {
      await database.put({
        type: "feeding",
        petId: pet._id,
        petName: pet.name,
        caretaker: caretaker.trim(),
        portion: portion || pet.portion,
        food: pet.food,
        timestamp: Date.now(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const c = {
    overlay: "fixed inset-0 flex items-center justify-center z-50",
    backdrop: "absolute inset-0 bg-[oklch(0.15_0.02_280/0.6)]",
    modal: "relative bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] w-[90vw] max-w-md z-10",
    bar: "bg-[oklch(0.52_0.18_255)] text-white uppercase text-xs font-bold tracking-widest px-4 py-3 rounded-t-[2px]",
    body: "p-5 flex flex-col gap-3",
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] font-semibold",
    input: "w-full border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 text-sm font-[Space_Grotesk] outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 transition-transform",
    btnRow: "flex gap-3 pt-1",
    btnFeed: "flex-1 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] py-2 font-bold uppercase text-sm tracking-wide shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2",
    btnCancel: "flex-1 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] py-2 font-bold uppercase text-sm tracking-wide hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150",
  };

  return (
    <div className={c.overlay} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className={c.backdrop} onClick={onClose} />
      <div className={c.modal} style={{ boxShadow: "8px 8px 0px oklch(0.15 0.02 280)" }}>
        <div className={c.bar}>Log Feeding — {pet.name}</div>
        <form onSubmit={handleFeed} className={c.body}>
          <div>
            <div className={c.label}>Your Name</div>
            <input className={c.input} value={caretaker} onChange={e => setCaretaker(e.target.value)}
              placeholder="e.g. Alex" autoFocus />
          </div>
          <div>
            <div className={c.label}>Portion</div>
            <input className={c.input} value={portion} onChange={e => setPortion(e.target.value)}
              placeholder={pet.portion || "e.g. 1 cup"} />
          </div>
          <div className={c.btnRow}>
            <button type="button" className={c.btnCancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={c.btnFeed} disabled={saving || !caretaker.trim()}>
              {saving ? <Spinner /> : null} {saving ? "Saving…" : "Log Feed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Add Pet Form ── */
function AddPetForm({ database }) {
  const { useDocument } = useFireproof("pet-feed-tracker");
  const { doc, merge, submit } = useDocument({ type: "pet", name: "", food: "", portion: "" });
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!doc.name.trim()) return;
    setIsLoading(true);
    try { await submit(); } finally { setIsLoading(false); }
  }

  const c = {
    form: "flex flex-col gap-3",
    row: "flex gap-2 flex-wrap",
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] font-semibold mb-1",
    input: "w-full border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 text-sm outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 transition-transform",
    field: "flex-1 min-w-[120px]",
    btn: "bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-5 py-2 font-bold uppercase text-sm tracking-wide shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-60 flex items-center gap-2",
  };

  return (
    <form onSubmit={handleSubmit} className={c.form}>
      <div className={c.row}>
        <div className={c.field}>
          <div className={c.label}>Pet Name</div>
          <input className={c.input} value={doc.name} onChange={e => merge({ name: e.target.value })} placeholder="e.g. Luna" />
        </div>
        <div className={c.field}>
          <div className={c.label}>Food Type</div>
          <input className={c.input} value={doc.food} onChange={e => merge({ food: e.target.value })} placeholder="e.g. Kibble" />
        </div>
        <div className={c.field}>
          <div className={c.label}>Default Portion</div>
          <input className={c.input} value={doc.portion} onChange={e => merge({ portion: e.target.value })} placeholder="e.g. 1 cup" />
        </div>
      </div>
      <div>
        <button type="submit" className={c.btn} disabled={isLoading || !doc.name.trim()}>
          {isLoading ? <Spinner /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
          Add Pet
        </button>
      </div>
    </form>
  );
}

/* ── Warnings ── */
function Warnings({ pets, lastFedMap }) {
  const now = Date.now();
  const overdue = pets.filter(p => {
    const last = lastFedMap[p._id];
    return !last || (now - last) >= 8 * 3600 * 1000;
  });
  if (!overdue.length) return null;
  const c = {
    section: "mb-4",
    card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden",
    bar: "bg-[oklch(0.55_0.24_28)] text-white uppercase text-xs font-bold tracking-widest px-4 py-2",
    list: "divide-y-[2px] divide-[oklch(0.15_0.02_280)]",
    row: "flex items-center gap-3 px-4 py-3",
    icon: "text-[oklch(0.55_0.24_28)]",
    name: "font-bold uppercase text-sm tracking-wide",
    time: "text-[0.75rem] font-[JetBrains_Mono] text-[oklch(0.50_0.02_280)] ml-auto",
  };
  return (
    <section className={c.section}>
      <div className={c.card}>
        <div className={c.bar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{display:'inline',marginRight:6,marginBottom:-2}}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Overdue — Not Fed in 8+ Hours
        </div>
        <ul className={c.list}>
          {overdue.map(p => {
            const last = lastFedMap[p._id];
            const hrs = last ? Math.floor((now - last) / 3600000) : null;
            return (
              <li key={p._id} className={c.row}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.55 0.24 28)" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className={c.name}>{p.name}</span>
                <span className={c.time}>{last ? `${hrs}h ago` : "Never fed"}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ── Roster ── */
function Roster({ pets, lastFedMap, onFeed, onDelete }) {
  const c = {
    section: "mb-6",
    grid: "flex flex-col gap-3",
    card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    cardBody: "flex items-center gap-3 px-4 py-3",
    info: "flex-1 min-w-0",
    name: "font-bold uppercase text-base tracking-wide leading-tight",
    meta: "text-[0.72rem] text-[oklch(0.50_0.02_280)] font-[JetBrains_Mono] truncate",
    badge: "text-[0.6rem] uppercase tracking-widest font-bold px-2 py-0.5 border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px]",
    btnFeed: "bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-4 py-2 font-bold uppercase text-sm tracking-wide shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 flex items-center gap-1.5",
    btnDel: "ml-1 border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-1.5 hover:bg-[oklch(0.96_0.01_90)] transition-all duration-150",
    empty: "text-center py-10 text-[oklch(0.50_0.02_280)] text-sm uppercase tracking-widest",
  };
  const now = Date.now();
  if (!pets.length) return (
    <div className={c.empty}>No pets yet — add one above</div>
  );
  return (
    <div className={c.grid}>
      {pets.map(pet => {
        const last = lastFedMap[pet._id];
        const hrs = last ? Math.floor((now - last) / 3600000) : null;
        const overdue = !last || (now - last) >= 8 * 3600 * 1000;
        return (
          <div key={pet._id} className={c.card}>
            <div className={c.cardBody}>
              <div className={c.info}>
                <div className={c.name}>{pet.name}</div>
                <div className={c.meta}>{pet.food} · {pet.portion}</div>
                <div className="mt-1">
                  <span className={c.badge} style={{ background: overdue ? "oklch(0.55 0.24 28 / 0.1)" : "oklch(0.62 0.19 145 / 0.15)", color: overdue ? "oklch(0.55 0.24 28)" : "oklch(0.62 0.19 145)" }}>
                    {last ? (hrs === 0 ? "Fed recently" : `${hrs}h ago`) : "Never fed"}
                  </span>
                </div>
              </div>
              <button className={c.btnFeed} onClick={() => onFeed(pet)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
                Feed
              </button>
              <button className={c.btnDel} onClick={() => onDelete(pet._id)} title="Remove pet">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Feed Log ── */
function FeedLog({ feedings }) {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const today = feedings.filter(f => f.timestamp >= todayStart.getTime()).sort((a,b) => b.timestamp - a.timestamp);
  const c = {
    section: "mb-6",
    card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden",
    bar: "bg-[oklch(0.15_0.02_280)] text-white uppercase text-xs font-bold tracking-widest px-4 py-2",
    list: "divide-y-[2px] divide-[oklch(0.15_0.02_280/0.15)]",
    row: "flex items-center gap-3 px-4 py-3 hover:bg-[oklch(0.85_0.18_85/0.3)] transition-colors",
    dot: "w-3 h-3 rounded-full border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] flex-shrink-0",
    info: "flex-1 min-w-0",
    petName: "font-bold text-sm uppercase tracking-wide",
    sub: "text-[0.7rem] text-[oklch(0.50_0.02_280)]",
    time: "text-[0.72rem] font-[JetBrains_Mono] text-[oklch(0.50_0.02_280)] flex-shrink-0",
    empty: "text-center py-8 text-[oklch(0.50_0.02_280)] text-xs uppercase tracking-widest",
  };
  return (
    <section className={c.section}>
      <div className={c.card}>
        <div className={c.bar}>Today's Feedings</div>
        {today.length === 0
          ? <div className={c.empty}>No feedings logged today</div>
          : <ul className={c.list}>
              {today.map(f => (
                <li key={f._id} className={c.row}>
                  <div className={c.dot} />
                  <div className={c.info}>
                    <div className={c.petName}>{f.petName}</div>
                    <div className={c.sub}>{f.food} · {f.portion} · by {f.caretaker}</div>
                  </div>
                  <div className={c.time}>{new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </li>
              ))}
            </ul>
        }
      </div>
    </section>
  );
}

/* ── App ── */
export default function App() {
  const { useLiveQuery, database } = useFireproof("pet-feed-tracker");
  const [feedingPet, setFeedingPet] = useState(null);

  const { docs: pets } = useLiveQuery("type", { key: "pet" });
  const { docs: feedings } = useLiveQuery("type", { key: "feeding" });

  // Map petId → most recent feeding timestamp
  const lastFedMap = {};
  feedings.forEach(f => {
    if (!lastFedMap[f.petId] || f.timestamp > lastFedMap[f.petId]) {
      lastFedMap[f.petId] = f.timestamp;
    }
  });

  function handleDelete(id) { database.del(id); }

  const c = {
    page: "min-h-screen bg-[oklch(0.96_0.01_90)] font-[Space_Grotesk,sans-serif] pb-16",
    inner: "max-w-[920px] mx-auto px-4 pt-6",
    header: "mb-6",
    headerCard: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden",
    accentBar: "h-[6px] flex",
    title: "flex items-center gap-3 px-5 py-4",
    squares: "flex gap-1.5",
    h1: "text-2xl font-bold uppercase tracking-tight text-[oklch(0.15_0.02_280)]",
    addCard: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] p-4 mb-5",
    addLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] font-semibold mb-3",
    rosterLabel: "text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] font-semibold mb-2",
  };

  return (
    <main className={c.page} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional" />

      {feedingPet && (
        <FeedModal pet={feedingPet} onClose={() => setFeedingPet(null)} database={database} />
      )}

      <div className={c.inner}>
        <header className={c.header}>
          <div className={c.headerCard}>
            <div className={c.accentBar}>
              <div style={{ flex: 1, background: "oklch(0.55 0.24 28)" }} />
              <div style={{ flex: 1, background: "oklch(0.85 0.18 85)" }} />
              <div style={{ flex: 1, background: "oklch(0.62 0.19 145)" }} />
              <div style={{ flex: 1, background: "oklch(0.52 0.18 255)" }} />
            </div>
            <div className={c.title}>
              <div className={c.squares}>
                <div style={{ width: 12, height: 12, background: "oklch(0.55 0.24 28)", border: "2px solid oklch(0.15 0.02 280)" }} />
                <div style={{ width: 12, height: 12, background: "oklch(0.85 0.18 85)", border: "2px solid oklch(0.15 0.02 280)" }} />
                <div style={{ width: 12, height: 12, background: "oklch(0.62 0.19 145)", border: "2px solid oklch(0.15 0.02 280)" }} />
              </div>
              <h1 className={c.h1}>Pet Feed Tracker</h1>
            </div>
          </div>
        </header>

        <Warnings pets={pets} lastFedMap={lastFedMap} />

        <div className={c.addCard}>
          <div className={c.addLabel}>Add a Pet</div>
          <AddPetForm database={database} />
        </div>

        <div className={c.rosterLabel}>Your Pets</div>
        <Roster pets={pets} lastFedMap={lastFedMap} onFeed={setFeedingPet} onDelete={handleDelete} />

        <FeedLog feedings={feedings} />
      </div>
    </main>
  );
}
>>>>>>> REPLACE