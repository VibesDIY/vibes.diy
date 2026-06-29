import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // --- HOOKS & STATE ---
  const { useLiveQuery, database } = useFireproof("vault-ledger");
  
  const [entryForm, setEntryForm] = React.useState({ id: '', kind: 'K1', keeper: '', location: '' });
  const [transferForm, setTransferForm] = React.useState({ targetId: '', keeper: '', location: '', notes: '' });
  
  const [selectedEntry, setSelectedEntry] = React.useState(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Indexes 
  const { docs: entries } = useLiveQuery("type", { key: "entry", descending: true });
  // Transfers for selected entry
  const { docs: selectedTransfers } = useLiveQuery((doc) => doc.type === 'transfer' && doc.entryId === selectedEntry ? doc.ts : null, { descending: true });

  // Compute stats 
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const flaggedCount = entries.filter(e => (now - e.lastActivity) > ONE_WEEK).length;

  // --- HANDLERS ---
  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.id) return;
    const ts = Date.now();
    await database.put({
      _id: `entry-${entryForm.id}`,
      type: 'entry',
      entryId: entryForm.id,
      kind: entryForm.kind,
      initialKeeper: entryForm.keeper,
      initialLocation: entryForm.location,
      currentKeeper: entryForm.keeper,
      currentLocation: entryForm.location,
      lastActivity: ts,
      createdAt: ts
    });
    // Log genesis transfer
    await database.put({
      type: 'transfer',
      entryId: entryForm.id,
      fromKeeper: 'SYSTEM',
      toKeeper: entryForm.keeper,
      fromLoc: 'REGISTRY',
      toLoc: entryForm.location,
      notes: 'Initial Registration',
      ts: ts
    });
    setEntryForm({ id: '', kind: 'K1', keeper: '', location: '' });
  };

  const generateDummy = async () => {
    setIsGenerating(true);
    try {
      const resp = await callAI("Generate realism-driven dummy data for a physical security asset registry. Ensure short labels across fields.", {
        schema: {
          properties: {
            id: { type: 'string', description: 'Like V-882, TS-01' },
            kind: { type: 'string', enum: ['K1','K2','K3','K4'] },
            keeper: { type: 'string', description: 'Agent/Doc name, ex: Dr. Vance' },
            location: { type: 'string', description: 'Room, Sector, Box' }
          }
        }
      });
      const data = JSON.parse(resp);
      setEntryForm({ ...data });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.targetId) return;
    
    // Attempt lookup
    const idKey = `entry-${transferForm.targetId}`;
    let doc;
    try {
      doc = await database.get(idKey);
    } catch (err) {
      alert("Asset ID not found.");
      return;
    }
    
    const ts = Date.now();
    // Update main entry
    await database.put({
      ...doc,
      currentKeeper: transferForm.keeper,
      currentLocation: transferForm.location,
      lastActivity: ts
    });
    
    // Append log step
    await database.put({
      type: 'transfer',
      entryId: transferForm.targetId,
      fromKeeper: doc.currentKeeper,
      toKeeper: transferForm.keeper,
      fromLoc: doc.currentLocation,
      toLoc: transferForm.location,
      notes: transferForm.notes,
      ts: ts
    });
    
    setTransferForm({ targetId: '', keeper: '', location: '', notes: '' });
  };

  // --- CLASSNAMES ---
  const c = {
    page: "relative min-h-screen flex flex-col items-center bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)]",
    bgWrap: "fixed inset-0 pointer-events-none z-0 opacity-40",
    container: "w-full max-w-[920px] px-8 py-12 flex flex-col gap-8 z-10",
    nav: "flex justify-between items-center px-4 py-3 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    navLogoGrid: "flex gap-1",
    navPill: "px-4 py-1 uppercase font-bold text-xs bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[2px_2px_0px_oklch(0.15_0.02_280)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] transition-all duration-150 active:translate-y-0.5 active:translate-x-0.5 active:shadow-none",
    hero: "relative p-8 flex flex-col gap-4 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[6px_6px_0px_oklch(0.15_0.02_280)] mt-4 overflow-hidden",
    heroTitle: "text-4xl md:text-5xl uppercase font-bold tracking-tight z-10",
    statsGrid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4",
    statCard: "flex flex-col bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    statHeader: "px-3 py-1 text-[0.65rem] uppercase tracking-widest border-b-[3px] border-[oklch(0.15_0.02_280)]",
    statBody: "p-4 text-3xl font-mono font-bold",
    statLabel: "text-xs font-sans tracking-wide ml-2 text-[oklch(0.50_0.02_280)]",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-6",
    cardTop: "p-6 flex flex-col gap-4 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    inputGroup: "flex flex-col gap-1",
    label: "text-[0.65rem] uppercase tracking-widest text-[oklch(0.50_0.02_280)] font-bold",
    input: "w-full px-4 py-2 text-sm border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] focus:outline-none focus:-translate-y-0.5 focus:-translate-x-0.5 focus:shadow-[3px_3px_0px_oklch(0.15_0.02_280)] transition-all duration-150",
    btnRow: "flex gap-4 mt-4",
    btnPrimary: "px-6 py-3 uppercase text-sm font-bold flex items-center justify-center gap-2 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all duration-150 disabled:opacity-75",
    btnGhost: "px-4 py-2 uppercase text-xs font-bold bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all duration-150 disabled:opacity-75",
    tableWrap: "w-full overflow-x-auto bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] mt-4",
    table: "w-full text-left border-collapse whitespace-nowrap",
    th: "px-4 py-3 uppercase text-[0.6rem] tracking-widest border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] font-bold text-[oklch(0.50_0.02_280)]",
    td: "px-4 py-3 text-sm border-b-[2px] border-[oklch(0.15_0.02_280)/0.2] font-mono group-hover:bg-[oklch(0.85_0.18_85)] transition-colors cursor-pointer",
    modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[oklch(0.15_0.02_280)/0.6] backdrop-blur-sm",
    modalCard: "w-full max-w-lg flex flex-col bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[8px_8px_0px_oklch(0.15_0.02_280)] animate-pop",
    modalBar: "px-4 py-3 uppercase text-xs font-bold bg-[oklch(0.52_0.18_255)] text-white border-b-[3px] border-[oklch(0.15_0.02_280)] flex justify-between",
    modalBody: "p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto"
  };

  // --- RENDER ---
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional');
        body { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes modal-pop {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: modal-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
      
      <div className={c.page}>
        <div className={c.bgWrap} style={{
          backgroundImage: `linear-gradient(to right, oklch(0.15 0.02 280 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.08) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}>
          <div className="absolute top-10 left-10 w-16 h-16 rounded-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] opacity-20"></div>
          <div className="absolute bottom-20 right-20 w-20 h-20 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] opacity-20 transform rotate-12"></div>
          <div className="absolute top-1/3 right-10 w-10 h-10 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] opacity-30"></div>
        </div>
        
        <main className={c.container}>
          <header className={c.nav}>
            <div className="flex items-center gap-3">
              <div className={c.navLogoGrid}>
                <div className="w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)]"></div>
                <div className="w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)]"></div>
                <div className="w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)]"></div>
              </div>
              <span className="font-bold text-sm uppercase tracking-widest">Custody.Log</span>
            </div>
            <button className={c.navPill}>Action</button>
          </header>

          <section className={c.hero}>
            <div className="absolute top-0 left-0 right-0 h-[6px] flex">
              <div className="flex-1 bg-[oklch(0.55_0.24_28)]"></div>
              <div className="flex-1 bg-[oklch(0.85_0.18_85)]"></div>
              <div className="flex-1 bg-[oklch(0.62_0.19_145)]"></div>
              <div className="flex-1 bg-[oklch(0.52_0.18_255)]"></div>
            </div>
            <div className="relative">
              <h1 className={c.heroTitle}>Master Ledger</h1>
              <h1 className="absolute top-[5px] left-[5px] text-4xl md:text-5xl uppercase font-bold tracking-tight text-[oklch(0.55_0.24_28)] opacity-50 z-0 pointer-events-none" aria-hidden="true">Master Ledger</h1>
            </div>
            <p className="text-sm font-medium z-10 max-w-md">Immutable tracking for high-value physical assets. Log transfers, view complete chain of custody timelines, and monitor dormant objects.</p>
          </section>

          <section className={c.statsGrid}>
            <div className={c.statCard}>
              <div className={`${c.statHeader} bg-[oklch(0.55_0.24_28)] text-white`}>Active Assets</div>
              <div className={c.statBody}>{entries.length} <span className={c.statLabel}>total</span></div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHeader} bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]`}>Flagged > 7 Days</div>
              <div className={c.statBody}>{flaggedCount} <span className={c.statLabel}>dormant</span></div>
            </div>
          </section>

          <section className={c.formGrid}>
            <form className={c.cardTop} onSubmit={handleAddEntry}>
              <h2 className="uppercase font-bold text-lg mb-2">Register Asset</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className={c.inputGroup}>
                  <label className={c.label}>Asset ID</label>
                  <input className={c.input} value={entryForm.id} onChange={e=>setEntryForm({...entryForm, id: e.target.value})} placeholder="E.g. A-101" required />
                </div>
                <div className={c.inputGroup}>
                  <label className={c.label}>Classification</label>
                  <select className={c.input} value={entryForm.kind} onChange={e=>setEntryForm({...entryForm, kind: e.target.value})} required>
                    <option value="K1">K1 - Routine</option>
                    <option value="K2">K2 - Sensitive</option>
                    <option value="K3">K3 - Restricted</option>
                    <option value="K4">K4 - Critical</option>
                  </select>
                </div>
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>Initial Keeper</label>
                <input className={c.input} value={entryForm.keeper} onChange={e=>setEntryForm({...entryForm, keeper: e.target.value})} placeholder="Officer Name / ID" required />
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>Current Location</label>
                <input className={c.input} value={entryForm.location} onChange={e=>setEntryForm({...entryForm, location: e.target.value})} placeholder="Vault, Sector, etc." required />
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Save</button>
                <button type="button" onClick={generateDummy} disabled={isGenerating} className={c.btnGhost}>
                  {isGenerating ? (
                    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : "Suggest Sample"}
                </button>
              </div>
            </form>

            <form className={c.cardTop} onSubmit={handleAddTransfer}>
              <h2 className="uppercase font-bold text-lg mb-2">Log Transfer</h2>
              <div className={c.inputGroup}>
                <label className={c.label}>Target Asset ID</label>
                <input className={c.input} value={transferForm.targetId} onChange={e=>setTransferForm({...transferForm, targetId: e.target.value})} placeholder="E.g. A-101" required />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className={c.inputGroup}>
                  <label className={c.label}>New Keeper</label>
                  <input className={c.input} value={transferForm.keeper} onChange={e=>setTransferForm({...transferForm, keeper: e.target.value})} placeholder="Agent ID" required />
                </div>
                <div className={c.inputGroup}>
                  <label className={c.label}>New Location</label>
                  <input className={c.input} value={transferForm.location} onChange={e=>setTransferForm({...transferForm, location: e.target.value})} placeholder="Destination" required />
                </div>
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>Notes (Optional)</label>
                <input className={c.input} value={transferForm.notes} onChange={e=>setTransferForm({...transferForm, notes: e.target.value})} placeholder="Condition, reason..." />
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Execute</button>
              </div>
            </form>
          </section>

          <section className={c.tableWrap}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>ID</th>
                  <th className={c.th}>Cls</th>
                  <th className={c.th}>Last Activity</th>
                  <th className={c.th}>Keeper</th>
                  <th className={c.th}>Location</th>
                  <th className={c.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan="6" className="text-center p-6 text-sm text-[oklch(0.50_0.02_280)] font-bold uppercase">No Registry Data.</td></tr>
                )}
                {entries.map(entry => {
                  const isFlagged = (now - entry.lastActivity) > ONE_WEEK;
                  return (
                    <tr key={entry._id} className="group" onClick={() => setSelectedEntry(entry.entryId)}>
                      <td className={`${c.td} font-bold`}>{entry.entryId}</td>
                      <td className={c.td}>
                        <span className="bg-[oklch(0.96_0.01_90)] px-2 py-1 rounded border-[2px] border-[oklch(0.15_0.02_280)] text-[0.6rem]">{entry.kind}</span>
                      </td>
                      <td className={c.td}>{new Date(entry.lastActivity).toLocaleDateString()}</td>
                      <td className={c.td}>{entry.currentKeeper}</td>
                      <td className={c.td}>{entry.currentLocation}</td>
                      <td className={c.td}>
                        {isFlagged ? (
                           <span className="flex items-center gap-2 text-[oklch(0.85_0.18_85)] dark:text-[oklch(0.55_0.24_28)] font-sans font-bold text-xs uppercase tracking-wider">
                             <div className="w-2 h-2 rounded-full bg-[oklch(0.85_0.18_85)]"></div> Dormant
                           </span>
                        ) : (
                           <span className="flex items-center gap-2 text-[oklch(0.62_0.19_145)] font-sans font-bold text-xs uppercase tracking-wider">
                             <div className="w-2 h-2 rounded-full bg-[oklch(0.62_0.19_145)]"></div> Active
                           </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </main>
      </div>

      {selectedEntry && (
        <div className={c.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setSelectedEntry(null); }}>
          <div className={c.modalCard}>
            <div className={c.modalBar}>
              <span>Manifest: {selectedEntry}</span>
              <button onClick={() => setSelectedEntry(null)}>✕</button>
            </div>
            <div className={c.modalBody}>
              <div className="flex flex-col gap-5 relative border-l-[3px] border-[oklch(0.15_0.02_280)] ml-2 pl-6">
                {selectedTransfers.length === 0 && <p className="text-sm">No transfers found.</p>}
                {selectedTransfers.map((tx, idx) => (
                  <div key={tx._id} className="relative">
                    <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-none bg-[oklch(0.85_0.18_85)] border-[2px] border-[oklch(0.15_0.02_280)] lg:hover:scale-125 transition-transform"></div>
                    <div className="text-[0.65rem] font-bold text-[oklch(0.50_0.02_280)] uppercase tracking-widest mb-1.5">
                      {new Date(tx.ts).toLocaleString()}
                    </div>
                    <div className="font-bold border-[3px] border-[oklch(0.15_0.02_280)] px-4 py-3 rounded-[4px] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] transition-all">
                      <p className="text-sm leading-snug">
                        {tx.fromKeeper === 'SYSTEM' ? "Registered at" : `Transferred from ${tx.fromLoc} to`} <span className="text-[oklch(0.62_0.19_145)] bg-[oklch(0.62_0.19_145)/0.1] px-1">{tx.toLoc}</span>
                      </p>
                      <p className="text-sm leading-snug mt-1">Logged to <span className="font-mono bg-[oklch(0.96_0.01_90)] px-1">{tx.toKeeper}</span></p>
                      {tx.notes && <p className="text-xs text-[oklch(0.55_0.24_28)] mt-2 font-mono border-t-[2px] border-dashed border-[oklch(0.15_0.02_280)/0.2] pt-2">{tx.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}