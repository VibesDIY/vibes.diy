import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

// ── helpers ──────────────────────────────────────────────────────────────
function nextDue(lastGiven, frequency) {
  if (!lastGiven) return new Date();
  const d = new Date(lastGiven);
  if (frequency === "daily") d.setDate(d.getDate() + 1);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else return null; // as-needed
  return d;
}

function isDueToday(lastGiven, frequency) {
  if (frequency === "as-needed") return false;
  const due = nextDue(lastGiven, frequency);
  if (!due) return false;
  const now = new Date();
  return due <= now || due.toDateString() === now.toDateString();
}

function fmtDate(ts) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDateOnly(str) {
  if (!str) return "";
  return new Date(str + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// ── icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconPaw = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="4" cy="14" r="1.5"/><circle cx="20" cy="14" r="1.5"/>
    <path d="M12 18c-4 0-7-2-7-5s3-4 7-4 7 1 7 4-3 5-7 5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const Spinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}>
    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.3"/><path d="M22 12a10 10 0 0 1-10 10"/>
    <path d="M12 22a10 10 0 0 1-10-10"/><path d="M2 12a10 10 0 0 1 10-10" opacity="0.6"/>
  </svg>
);

// ── main app ──────────────────────────────────────────────────────────────
export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("pet-med-tracker-v1");

  // pets
  const { docs: pets } = useLiveQuery("type", { key: "pet" });
  const { doc: newPet, merge: mergePet, submit: submitPet } = useDocument({ type: "pet", name: "", species: "" });

  // meds
  const { docs: allMeds } = useLiveQuery("type", { key: "med" });
  const { doc: newMed, merge: mergeMed, submit: submitMed } = useDocument({ type: "med", petId: "", name: "", dose: "", frequency: "daily" });

  // vet visits
  const { docs: allVets } = useLiveQuery("type", { key: "vet" });
  const { doc: newVet, merge: mergeVet, submit: submitVet } = useDocument({ type: "vet", petId: "", visitDate: "", notes: "", visitType: "checkup" });

  // dose logs (for last-given lookup)
  const { docs: logs } = useLiveQuery("type", { key: "log" });

  // ui state
  const [tab, setTab] = useState("meds");
  const [activePetId, setActivePetId] = useState(null);
  const [loadingMedId, setLoadingMedId] = useState(null);
  const [showAddPet, setShowAddPet] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [showAddVet, setShowAddVet] = useState(false);

  // derived
  const activePet = pets.find(p => p._id === activePetId) || pets[0] || null;
  const petId = activePet?._id;

  const petMeds = allMeds.filter(m => m.petId === petId);
  const petVets = allVets.filter(v => v.petId === petId);

  // last log per med
  function lastLog(medId) {
    return logs.filter(l => l.medId === medId).sort((a, b) => b.ts - a.ts)[0];
  }

  // due today across ALL pets for banner
  const dueTodayItems = allMeds.filter(m => {
    const ll = lastLog(m._id);
    return isDueToday(ll?.ts, m.frequency);
  });

  async function markGiven(med) {
    setLoadingMedId(med._id);
    try {
      await database.put({ type: "log", medId: med._id, petId: med.petId, ts: Date.now() });
    } finally {
      setLoadingMedId(null);
    }
  }

  function handleSubmitPet(e) {
    e.preventDefault();
    if (!newPet.name.trim()) return;
    submitPet();
    setShowAddPet(false);
  }

  function handleSubmitMed(e) {
    e.preventDefault();
    if (!newMed.name.trim() || !petId) return;
    database.put({ ...newMed, petId });
    submitMed();
    setShowAddMed(false);
  }

  function handleSubmitVet(e) {
    e.preventDefault();
    if (!newVet.visitDate || !petId) return;
    database.put({ ...newVet, petId });
    submitVet();
    setShowAddVet(false);
  }

  const c = {
    page: "min-h-screen font-[Space_Grotesk,sans-serif]",
    pageBg: "bg-[oklch(0.96_0.01_90)]",
    card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px]",
    shadow: "shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    shadowSm: "shadow-[3px_3px_0px_oklch(0.15_0.02_280)]",
    ink: "text-[oklch(0.15_0.02_280)]",
    muted: "text-[oklch(0.50_0.02_280)]",
    red: "bg-[oklch(0.55_0.24_28)]",
    redText: "text-[oklch(0.55_0.24_28)]",
    yellow: "bg-[oklch(0.85_0.18_85)]",
    green: "bg-[oklch(0.62_0.19_145)]",
    greenText: "text-[oklch(0.62_0.19_145)]",
    blue: "bg-[oklch(0.52_0.18_255)]",
    btnPrimary: "bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] px-4 py-2 text-xs font-bold uppercase tracking-wide cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all",
    btnYellow: "bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all",
    btnGhost: "bg-white text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-1.5 text-xs font-bold uppercase tracking-wide cursor-pointer hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all",
    input: "w-full bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 text-sm font-[Space_Grotesk,sans-serif] focus:outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all",
    label: "block text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-1",
    sectionHead: "text-xs font-bold uppercase tracking-[0.08em] text-[oklch(0.50_0.02_280)]",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional');
        @keyframes spin { to { transform: rotate(360deg); } }
        body { margin: 0; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ambient bg */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }}/>
      <div className="fixed top-10 left-4 w-10 h-10 rounded-full opacity-20 bg-[oklch(0.55_0.24_28)] pointer-events-none"/>
      <div className="fixed top-1/3 right-6 w-14 h-14 opacity-15 bg-[oklch(0.85_0.18_85)] pointer-events-none"/>
      <div className="fixed bottom-20 left-8 w-8 h-8 opacity-20 bg-[oklch(0.62_0.19_145)] pointer-events-none"/>
      <div className="fixed bottom-10 right-10 w-12 h-12 rounded-full opacity-15 bg-[oklch(0.52_0.18_255)] pointer-events-none"/>

      <div className={`${c.page} ${c.pageBg} relative z-10`}>
        <div className="max-w-[920px] mx-auto px-4 py-6">

          {/* NAV */}
          <nav className={`${c.card} ${c.shadow} flex items-center justify-between px-4 py-3 mb-5`}>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-[oklch(0.55_0.24_28)] border-2 border-[oklch(0.15_0.02_280)]"/>
                <div className="w-3 h-3 bg-[oklch(0.85_0.18_85)] border-2 border-[oklch(0.15_0.02_280)]"/>
                <div className="w-3 h-3 bg-[oklch(0.62_0.19_145)] border-2 border-[oklch(0.15_0.02_280)]"/>
              </div>
              <span className={`font-bold uppercase tracking-tight text-sm ${c.ink}`}>Pet Med Tracker</span>
            </div>
            <button className={c.btnPrimary} onClick={() => setShowAddPet(true)}>
              <span className="flex items-center gap-1"><IconPlus/> Add Pet</span>
            </button>
          </nav>

          {/* DUE TODAY BANNER */}
          {dueTodayItems.length > 0 && (
            <div className={`${c.card} mb-5 overflow-hidden`} style={{boxShadow:"4px 4px 0px oklch(0.15 0.02 280)"}}>
              <div className="bg-[oklch(0.55_0.24_28)] px-4 py-2 flex items-center gap-2">
                <IconBell/>
                <span className="text-white text-xs font-bold uppercase tracking-wide">Due Today — {dueTodayItems.length} med{dueTodayItems.length > 1 ? "s" : ""}</span>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {dueTodayItems.map(m => {
                  const pet = pets.find(p => p._id === m.petId);
                  return (
                    <span key={m._id} className="bg-[oklch(0.85_0.18_85)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-2 py-1 text-xs font-bold uppercase">
                      {pet?.name || "?"} — {m.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* PET SELECTOR */}
          {pets.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {pets.map(p => (
                <button key={p._id}
                  onClick={() => setActivePetId(p._id)}
                  className={`flex items-center gap-1.5 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all
                    ${(activePet?._id === p._id) ? "bg-[oklch(0.15_0.02_280)] text-white shadow-none translate-x-0.5 translate-y-0.5" : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)]"}`}>
                  <IconPaw/>{p.name}{p.species ? ` (${p.species})` : ""}
                </button>
              ))}
            </div>
          )}

          {!activePet && (
            <div className={`${c.card} ${c.shadow} p-8 text-center mb-5`}>
              <p className={`${c.muted} text-sm font-medium uppercase tracking-wide mb-3`}>No pets yet. Add your first pet to get started.</p>
              <button className={c.btnPrimary} onClick={() => setShowAddPet(true)}>
                <span className="flex items-center gap-1 justify-center"><IconPlus/> Add Pet</span>
              </button>
            </div>
          )}

          {activePet && (
            <>
              {/* TABS */}
              <div className="flex gap-0 mb-5 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden w-fit shadow-[4px_4px_0px_oklch(0.15_0.02_280)]">
                {["meds","vets"].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-5 py-2 text-xs font-bold uppercase tracking-wide border-0 cursor-pointer transition-all
                      ${tab === t ? "bg-[oklch(0.15_0.02_280)] text-white" : "bg-white text-[oklch(0.15_0.02_280)] hover:bg-[oklch(0.85_0.18_85)]"}
                      ${t === "vets" ? "border-l-[3px] border-[oklch(0.15_0.02_280)]" : ""}`}>
                    {t === "meds" ? "Medications" : "Vet & Vaccines"}
                  </button>
                ))}
              </div>

              {/* MEDS TAB */}
              {tab === "meds" && (
                <section id="meds">
                  <div className="flex items-center justify-between mb-3">
                    <span className={c.sectionHead}>{activePet.name}'s Medications</span>
                    <button className={c.btnYellow} onClick={() => setShowAddMed(true)}>
                      <span className="flex items-center gap-1"><IconPlus/> Add Med</span>
                    </button>
                  </div>

                  {petMeds.length === 0 && (
                    <div className={`${c.card} p-6 text-center ${c.muted} text-sm uppercase tracking-wide`}>
                      No medications added yet.
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {petMeds.map(med => {
                      const ll = lastLog(med._id);
                      const due = isDueToday(ll?.ts, med.frequency);
                      const nd = nextDue(ll?.ts, med.frequency);
                      const isLoading = loadingMedId === med._id;
                      return (
                        <div key={med._id} className={`${c.card} overflow-hidden`} style={{boxShadow:"4px 4px 0px oklch(0.15 0.02 280)"}}>
                          <div className={`px-4 py-2 flex items-center justify-between ${due ? "bg-[oklch(0.55_0.24_28)]" : "bg-[oklch(0.52_0.18_255)]"}`}>
                            <span className="text-white text-xs font-bold uppercase tracking-wide">{med.name}</span>
                            <span className="text-white text-[0.6rem] uppercase tracking-wider opacity-80">{med.frequency}</span>
                          </div>
                          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <div className="font-['JetBrains_Mono',monospace] text-sm font-bold">{med.dose || "—"}</div>
                              <div className={`${c.muted} text-[0.65rem] uppercase tracking-wide mt-0.5`}>
                                Last: {fmtDate(ll?.ts)}
                              </div>
                              {med.frequency !== "as-needed" && nd && (
                                <div className={`text-[0.65rem] uppercase tracking-wide mt-0.5 font-bold ${due ? "text-[oklch(0.55_0.24_28)]" : c.muted}`}>
                                  {due ? "DUE NOW" : `Next: ${nd.toLocaleDateString([], {month:"short",day:"numeric"})}`}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button className={c.btnPrimary} disabled={isLoading} onClick={() => markGiven(med)}>
                                {isLoading ? <Spinner/> : <span className="flex items-center gap-1"><IconCheck/> Mark Given</span>}
                              </button>
                              <button className={`${c.btnGhost} !px-2`} onClick={() => database.del(med._id)}>
                                <IconTrash/>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* VETS TAB */}
              {tab === "vets" && (
                <section id="vets">
                  <div className="flex items-center justify-between mb-3">
                    <span className={c.sectionHead}>{activePet.name}'s Vet &amp; Vaccine Records</span>
                    <button className={c.btnYellow} onClick={() => setShowAddVet(true)}>
                      <span className="flex items-center gap-1"><IconPlus/> Add Record</span>
                    </button>
                  </div>

                  {petVets.length === 0 && (
                    <div className={`${c.card} p-6 text-center ${c.muted} text-sm uppercase tracking-wide`}>
                      No vet records added yet.
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {petVets.sort((a,b) => (b.visitDate > a.visitDate ? 1 : -1)).map(v => (
                      <div key={v._id} className={`${c.card} overflow-hidden`} style={{boxShadow:"4px 4px 0px oklch(0.15 0.02 280)"}}>
                        <div className={`px-4 py-2 flex items-center justify-between ${v.visitType === "vaccine" ? "bg-[oklch(0.62_0.19_145)]" : "bg-[oklch(0.52_0.18_255)]"}`}>
                          <span className="text-white text-xs font-bold uppercase tracking-wide">
                            {v.visitType === "vaccine" ? "Vaccination" : v.visitType === "checkup" ? "Checkup" : "Visit"}
                          </span>
                          <span className="text-white font-['JetBrains_Mono',monospace] text-xs">{fmtDateOnly(v.visitDate)}</span>
                        </div>
                        <div className="px-4 py-3 flex items-start justify-between gap-3">
                          <p className="text-sm">{v.notes || <span className="text-[oklch(0.50_0.02_280)] italic text-xs">No notes</span>}</p>
                          <button className={`${c.btnGhost} !px-2 shrink-0`} onClick={() => database.del(v._id)}>
                            <IconTrash/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* ADD PET MODAL */}
      {showAddPet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.15_0.02_280/0.6)] px-4">
          <div className={`${c.card} w-full max-w-sm`} style={{boxShadow:"8px 8px 0px oklch(0.15 0.02 280)"}}>
            <div className="bg-[oklch(0.52_0.18_255)] px-4 py-3">
              <span className="text-white font-bold uppercase tracking-wide text-sm">Add Pet</span>
            </div>
            <form onSubmit={handleSubmitPet} className="p-4 flex flex-col gap-3">
              <div>
                <label className={c.label}>Pet Name</label>
                <input className={c.input} value={newPet.name} onChange={e => mergePet({name: e.target.value})} placeholder="e.g. Mochi" autoFocus/>
              </div>
              <div>
                <label className={c.label}>Species / Breed</label>
                <input className={c.input} value={newPet.species} onChange={e => mergePet({species: e.target.value})} placeholder="e.g. Cat, Golden Retriever"/>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className={c.btnGhost} onClick={() => setShowAddPet(false)}>Cancel</button>
                <button type="submit" className={c.btnPrimary}>Save Pet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MED MODAL */}
      {showAddMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.15_0.02_280/0.6)] px-4">
          <div className={`${c.card} w-full max-w-sm`} style={{boxShadow:"8px 8px 0px oklch(0.15 0.02 280)"}}>
            <div className="bg-[oklch(0.55_0.24_28)] px-4 py-3">
              <span className="text-white font-bold uppercase tracking-wide text-sm">Add Medication — {activePet?.name}</span>
            </div>
            <form onSubmit={handleSubmitMed} className="p-4 flex flex-col gap-3">
              <div>
                <label className={c.label}>Medication Name</label>
                <input className={c.input} value={newMed.name} onChange={e => mergeMed({name: e.target.value})} placeholder="e.g. Metacam" autoFocus/>
              </div>
              <div>
                <label className={c.label}>Dose</label>
                <input className={c.input} value={newMed.dose} onChange={e => mergeMed({dose: e.target.value})} placeholder="e.g. 0.5ml, 1 tablet"/>
              </div>
              <div>
                <label className={c.label}>Frequency</label>
                <select className={c.input} value={newMed.frequency} onChange={e => mergeMed({frequency: e.target.value})}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="as-needed">As Needed</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className={c.btnGhost} onClick={() => setShowAddMed(false)}>Cancel</button>
                <button type="submit" className={c.btnPrimary}>Save Med</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD VET MODAL */}
      {showAddVet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.15_0.02_280/0.6)] px-4">
          <div className={`${c.card} w-full max-w-sm`} style={{boxShadow:"8px 8px 0px oklch(0.15 0.02 280)"}}>
            <div className="bg-[oklch(0.62_0.19_145)] px-4 py-3">
              <span className="text-white font-bold uppercase tracking-wide text-sm">Add Vet Record — {activePet?.name}</span>
            </div>
            <form onSubmit={handleSubmitVet} className="p-4 flex flex-col gap-3">
              <div>
                <label className={c.label}>Visit Type</label>
                <select className={c.input} value={newVet.visitType} onChange={e => mergeVet({visitType: e.target.value})}>
                  <option value="checkup">Checkup</option>
                  <option value="vaccine">Vaccination</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={c.label}>Date</label>
                <input type="date" className={c.input} value={newVet.visitDate} onChange={e => mergeVet({visitDate: e.target.value})}/>
              </div>
              <div>
                <label className={c.label}>Notes</label>
                <textarea className={`${c.input} resize-none`} rows={3} value={newVet.notes} onChange={e => mergeVet({notes: e.target.value})} placeholder="Vaccine name, vet name, next appt..."/>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className={c.btnGhost} onClick={() => setShowAddVet(false)}>Cancel</button>
                <button type="submit" className={c.btnPrimary}>Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}