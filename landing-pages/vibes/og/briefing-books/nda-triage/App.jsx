App.jsx
import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const neobrutalistTheme = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
  
  :root {
    --bg: oklch(0.96 0.01 90);
    --card-bg: oklch(1.00 0 0);
    --text: oklch(0.15 0.02 280);
    --border: oklch(0.15 0.02 280);
    --muted: oklch(0.50 0.02 280);
    --red: oklch(0.55 0.24 28);
    --yellow: oklch(0.85 0.18 85);
    --yellow-dark: oklch(0.75 0.16 85);
    --green: oklch(0.62 0.19 145);
    --blue: oklch(0.52 0.18 255);
    --shadow: 4px 4px 0px var(--border);
    --shadow-sm: 3px 3px 0px var(--border);
    --radius: 4px;
    --font-sans: 'Space Grotesk', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  body {
    background-color: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    background-image: 
      linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    background-attachment: fixed;
  }

  .font-mono { font-family: var(--font-mono); }
  
  /* Neobrutalist Interactions */
  .neo-elevated {
    background: var(--card-bg);
    border: 3px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  
  .neo-sm {
    background: var(--card-bg);
    border: 3px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }

  .neo-hover:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px var(--border);
  }

  .neo-hover:active {
    transform: translate(2px, 2px);
    box-shadow: none;
    transition: all 0.05s;
  }

  .neo-input:focus {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-sm);
  }
`;

export default function App() {
  const c = {
    page: "min-h-screen p-4 md:p-8 flex flex-col items-center relative overflow-x-hidden text-[var(--text)]",
    ambient: "fixed inset-0 z-0 pointer-events-none",
    container: "w-full max-w-[920px] relative z-10 flex flex-col gap-8",
    
    header: "flex flex-col md:flex-row justify-between items-start md:items-center p-4 gap-4 neo-elevated w-full",
    logoGroup: "flex items-center gap-2",
    logoBlocks: "flex gap-1",
    logoBlock: "w-3 h-3 rounded-[2px] border-[2px] border-[var(--border)]",
    brand: "text-xl font-[700] uppercase tracking-[-0.02em]",
    navPill: "px-4 py-2 text-[0.7rem] font-[700] uppercase tracking-[0.05em] neo-sm",
    
    heroCard: "p-6 md:p-8 flex flex-col gap-6 relative neo-elevated w-full pt-10",
    heroAccentBar: "absolute top-0 left-0 right-[-3px] h-[6px] flex overflow-hidden border-b-[3px] border-[var(--border)]",
    heroAccentSeg: "flex-1",
    heroTitleWrap: "relative mb-2",
    heroTitle: "text-3xl md:text-5xl font-[700] uppercase tracking-[-0.02em] relative z-10",
    heroShadow: "text-3xl md:text-5xl font-[700] uppercase tracking-[-0.02em] absolute top-[5px] left-[5px] z-0 pointer-events-none text-[var(--red)] opacity-50",
    
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-6",
    formCol: "flex flex-col gap-4",
    fieldGrp: "flex flex-col gap-1",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-[700] text-[var(--muted)]",
    input: "w-full p-3 text-[0.82rem] transition-all outline-none bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] neo-input font-mono",
    select: "w-full p-3 text-[0.82rem] transition-all outline-none appearance-none cursor-pointer bg-[var(--bg)] border-[3px] border-[var(--border)] rounded-[var(--radius)] neo-input font-bold",
    row: "flex gap-3",
    checkboxGrp: "flex items-center gap-2 cursor-pointer group mt-2",
    checkbox: "w-[22px] h-[22px] border-[3px] border-[var(--border)] rounded-[var(--radius)] flex items-center justify-center transition-all bg-[var(--card-bg)] group-hover:bg-[var(--yellow)]",
    
    btnPrimary: "flex-1 px-4 py-3 text-[0.8rem] font-[700] uppercase tracking-[0.08em] transition-all text-center flex items-center justify-center gap-2 neo-sm neo-hover bg-[var(--red)] text-[var(--card-bg)] min-h-[44px]",
    btnSecondary: "flex-1 px-4 py-3 text-[0.8rem] font-[700] uppercase tracking-[0.08em] transition-all text-center flex items-center justify-center gap-2 neo-sm neo-hover bg-[var(--yellow)] min-h-[44px]",
    btnGhost: "px-4 py-2 text-[0.8rem] font-[700] uppercase tracking-[0.08em] transition-all bg-[var(--card-bg)] hover:shadow-[3px_3px_0px_var(--border)] border-[3px] border-transparent hover:border-[var(--border)] rounded-[var(--radius)]",
    btnAi: "p-2 min-w-[46px] flex items-center justify-center transition-all aspect-square neo-sm neo-hover bg-[var(--blue)] text-[var(--card-bg)]",
    
    tableCard: "overflow-x-auto neo-elevated w-full",
    table: "w-full text-left border-collapse min-w-[600px] bg-[var(--card-bg)]",
    th: "p-3 text-[0.6rem] uppercase tracking-[0.15em] font-[700] border-b-[2px] border-[var(--border)] text-[var(--muted)]",
    td: "p-3 text-[0.82rem] border-b-[1px] border-black/10 transition-colors group-hover:bg-[var(--yellow)] font-mono",
    badge: "inline-block px-2 py-1 rounded-[2px] text-[0.65rem] uppercase font-[700] tracking-wider border-[2px] border-[var(--border)]",
    triageBtn: "px-3 py-1.5 text-[0.7rem] font-[700] uppercase tracking-[0.08em] transition-all whitespace-nowrap neo-sm neo-hover bg-[var(--green)]"
  }

  const { useLiveQuery, database } = useFireproof("nda-triage");
  const { docs } = useLiveQuery("type", { descending: true });
  const ndaQueue = docs.filter(d => d.recordType === 'nda');
  const pendingCount = ndaQueue.filter(d => d.status === 'pending').length;

  const [aiLoading, setAiLoading] = useState(false);
  const [ideaLoading, setIdeaLoading] = useState(false);
  
  const [doc, setDoc] = useState({
    counterparty: "",
    type: "MUTUAL",
    risk: "",
    redline: false
  })

  const hardcodedDocs = [
    { _id: '1', counterparty: 'MegaCorp Inc', type: 'MUTUAL', risk: 'HIGH', status: 'pending', date: Date.now() - 3600000 },
    { _id: '2', counterparty: 'Vendor LLC', type: 'ONE-WAY-OUT', risk: 'LOW', status: 'triaged', date: Date.now() - 86400000 }
  ]

  const handleSubmit = async (e) => { 
    e.preventDefault() 
    if (!doc.counterparty) return;
    await database.put({ ...doc, recordType: 'nda', status: 'pending', createdAt: Date.now() })
    setDoc({ counterparty: "", type: "MUTUAL", risk: "", redline: false })
  }

  return (
    <div className={c.page}>
      <style>{neobrutalistTheme}</style>
      <div className={c.ambient}>
        <div className="float-block-1"></div>
        <div className="float-block-2"></div>
      </div>

      <div className={c.container}>
        <header className={c.header}>
          <div className={c.logoGroup}>
            <div className={c.logoBlocks}>
              <div className={c.logoBlock} style={{ backgroundColor: 'var(--red)' }}></div>
              <div className={c.logoBlock} style={{ backgroundColor: 'var(--yellow)' }}></div>
              <div className={c.logoBlock} style={{ backgroundColor: 'var(--green)' }}></div>
            </div>
            <div className={c.brand}>Legal Triage</div>
          </div>
          <div className={c.navPill}>{pendingCount} pending</div>
        </header>

        <section className={c.heroCard}>
          <div className={c.heroAccentBar}>
            <div className={c.heroAccentSeg} style={{ background: 'var(--red)' }}></div>
            <div className={c.heroAccentSeg} style={{ background: 'var(--yellow)' }}></div>
            <div className={c.heroAccentSeg} style={{ background: 'var(--green)' }}></div>
            <div className={c.heroAccentSeg} style={{ background: 'var(--blue)' }}></div>
          </div>

          <div className={c.heroTitleWrap}>
            <h1 className={c.heroTitle} aria-label="Intake Dossier">Intake Dossier</h1>
            <h1 className={c.heroShadow} aria-hidden="true">Intake Dossier</h1>
          </div>

          <form onSubmit={handleSubmit} className={c.grid2}>
            <div className={c.formCol}>
              <div className={c.fieldGrp}>
                <label className={c.label}>Counterparty</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className={c.input} 
                    placeholder="Acme Corp" 
                    value={doc.counterparty}
                    onChange={e => setDoc({...doc, counterparty: e.target.value})}
                  />
                  <button type="button" className={c.btnAi} title="Suggest example" disabled={ideaLoading} onClick={async () => {
                    setIdeaLoading(true);
                    try {
                      const res = await callAI("Suggest a fake corporate counterparty name for an NDA", {
                        schema: { properties: { name: { type: "string" } } }
                      });
                      setDoc(d => ({ ...d, counterparty: JSON.parse(res).name }));
                    } finally { setIdeaLoading(false); }
                  }}>
                    {ideaLoading ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={c.fieldGrp}>
                <label className={c.label}>NDA Type</label>
                <select 
                  className={c.select}
                  value={doc.type}
                  onChange={e => setDoc({...doc, type: e.target.value})}
                >
                  <option value="MUTUAL">Mutual</option>
                  <option value="ONE-WAY-IN">One-Way In</option>
                  <option value="ONE-WAY-OUT">One-Way Out</option>
                </select>
              </div>
            </div>

            <div className={c.formCol}>
              <div className={c.fieldGrp}>
                <label className={c.label}>Risk Level</label>
                <div className="flex gap-2">
                  <select className={c.select} value={doc.risk} onChange={e => setDoc({...doc, risk: e.target.value})}>
                    <option value="">Unassessed</option>
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                  <button type="button" className={c.btnAi} title="AI Auto-Assess" disabled={aiLoading || !doc.counterparty} onClick={async () => {
                    setAiLoading(true);
                    try {
                      const res = await callAI(`Assess NDA risk level (LOW, MEDIUM, HIGH) for counterparty: ${doc.counterparty} and type: ${doc.type}.`, {
                        schema: { properties: { risk: { type: "string" } } }
                      });
                      setDoc(d => ({ ...d, risk: JSON.parse(res).risk.toUpperCase() }));
                    } catch {
                      setDoc(d => ({ ...d, risk: "MEDIUM" })); // fallback
                    } finally { setAiLoading(false); }
                  }}>
                    {aiLoading ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <label className={c.checkboxGrp}>
                <div className={c.checkbox} style={{ backgroundColor: doc.redline ? 'var(--green)' : '' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={doc.redline ? "opacity-100" : "opacity-0"}>
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
                <input type="checkbox" className="hidden" checked={doc.redline} autoFocus={false} onChange={e => setDoc({...doc, redline: e.target.checked})} />
                <span className={c.label}>Requires Redlining</span>
              </label>

              <div className={c.row + " mt-auto pt-4"}>
                <button type="button" className={c.btnSecondary} onClick={() => setDoc({ counterparty: "", type: "MUTUAL", risk: "", redline: false })}>Clear</button>
                <button type="submit" className={c.btnPrimary}>File Document</button>
              </div>
            </div>
          </form>
        </section>

        <section className={c.tableCard}>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Arrival</th>
                <th className={c.th}>Counterparty</th>
                <th className={c.th}>Type</th>
                <th className={c.th}>Risk</th>
                <th className={c.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {ndaQueue.sort((a,b) => b.createdAt - a.createdAt).map(queueDoc => (
                <tr key={queueDoc._id} className="group">
                  <td className={c.td}>
                    {Math.round((Date.now() - queueDoc.createdAt) / 60000)}m
                  </td>
                  <td className={c.td}><strong>{queueDoc.counterparty}</strong></td>
                  <td className={c.td}>{queueDoc.type}</td>
                  <td className={c.td}>
                    <span className={c.badge} style={{ 
                      backgroundColor: queueDoc.risk === 'HIGH' ? 'var(--red)' : queueDoc.risk === 'MEDIUM' ? 'var(--yellow)' : queueDoc.risk === 'LOW' ? 'var(--green)' : 'var(--bg)',
                      color: queueDoc.risk === 'HIGH' ? 'var(--card-bg)' : 'var(--text)'
                    }}>
                      {queueDoc.risk || 'NONE'}
                    </span>
                  </td>
                  <td className={c.td}>
                    {queueDoc.status === 'pending' ? (
                      <button className={c.triageBtn} onClick={() => database.put({...queueDoc, status: 'triaged'})}>Triage</button>
                    ) : (
                      <span className={c.label}>Triaged</span>
                    )}
                  </td>
                </tr>
              ))}
              {ndaQueue.length === 0 && (
                <tr>
                  <td colSpan="5" className={c.td + " text-center text-[var(--muted)] py-8"}>Queue is empty. File a document above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}