import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [view, setView] = useState("grid")
  const [activeId, setActiveId] = useState(null)
  const { useLiveQuery, useDocument, database } = useFireproof("neodorel-sales-db")

  // Generate some placeholder seed data purely on load if db empty
  const { docs: accounts } = useLiveQuery("type", { key: "account", descending: true })

  React.useEffect(() => {
    if (accounts.length === 0) {
      database.put({ type: "account", name: "Acme Corp", dealSize: 120000, stage: "Negotiation", threats: "Competitor dropping price.", opportunities: "Upsell Q3 hardware.", contacts: [] })
      database.put({ type: "account", name: "Globex Dynamics", dealSize: 50000, stage: "Discovery", threats: "Budget freeze likely.", opportunities: "New CTO wants wins.", contacts: [] })
    }
  }, [accounts.length])
  
  const c = {
    layout: "relative z-10 max-w-[920px] mx-auto px-4 md:px-8 py-12 flex flex-col gap-8 text-[var(--ink)]",
    nav: "flex flex-col md:flex-row items-center justify-between p-4 mb-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)]",
    navItem: "px-4 py-2 font-bold uppercase tracking-[0.08em] text-[0.7rem] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0px_var(--border)] bg-[var(--card-bg)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[5px_5px_0px_var(--border)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all cursor-pointer",
    hero: "p-8 mb-8 flex flex-col items-center text-center bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[8px_8px_0px_var(--border)]",
    grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6",
    card: "p-6 flex flex-col gap-4 relative bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)]",
    headerLabel: "text-[0.65rem] text-[var(--muted)] tracking-[0.15em] uppercase mb-1 flex justify-between font-bold",
    title: "text-3xl md:text-5xl font-bold uppercase tracking-[-0.02em] grid relative",
    titleOffset: "col-start-1 row-start-1 pointer-events-none absolute -top-1 -left-1 text-[var(--red)] opacity-50 drop-shadow-[5px_5px_0px_var(--red)]",
    titleMain: "col-start-1 row-start-1 relative z-10",
    subtitle: "text-xl font-bold uppercase",
    tableOuter: "w-full overflow-x-auto border-[3px] border-[var(--border)] rounded-[4px]",
    table: "w-full text-left border-collapse bg-white",
    th: "px-3 py-3 text-[0.65rem] uppercase tracking-widest text-left border-b-[3px] border-[var(--border)] bg-[var(--blue)] text-white",
    td: "px-3 py-3 text-[0.82rem] border-b border-[var(--border)] group-hover:bg-[var(--yellow)] transition-colors duration-75",
    btnRow: "mt-4 flex flex-wrap gap-4",
    btnPrimary: "px-6 py-3 text-[0.8rem] font-bold uppercase tracking-[0.05em] flex items-center justify-center gap-2 bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0px_var(--border)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all cursor-pointer",
    btnSecondary: "px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.05em] flex items-center justify-center bg-[var(--yellow)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0px_var(--border)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[5px_5px_0px_var(--border)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all cursor-pointer",
    btnGhost: "px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.05em] bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_var(--border)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all cursor-pointer inline-flex w-fit",
    input: "w-full p-3 font-mono text-[0.82rem] block mb-2 border-[3px] border-[var(--border)] rounded-[4px] focus:outline-none focus:-translate-y-0.5 focus:-translate-x-0.5 focus:shadow-[4px_4px_0px_var(--border)] transition-all bg-white",
    badge: "inline-block px-2 py-1 text-[0.65rem] uppercase font-bold tracking-widest leading-none bg-[var(--green)] border-[2px] border-[var(--border)] rounded-[4px] shadow-[2px_2px_0px_var(--border)]",
    ambient: "fixed inset-0 pointer-events-none z-0 bg-[var(--bg)] bg-[linear-gradient(to_right,oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] bg-[size:60px_60px]",
  }



  const { doc: activeAccount, merge: mergeAccount, submit: submitAccount } = useDocument({ _id: activeId || 'undefined' })
  const { docs: touches } = useLiveQuery((doc) => doc.type === "touch" ? doc.accountId : null, { key: activeId, descending: true })

  const [loadingAI, setLoadingAI] = useState(false)
  
  // Forms local states
  const [newContact, setNewContact] = useState({ name: '', role: '', rel: '' })
  const [newTouch, setNewTouch] = useState({ type: 'Meeting', notes: '' })

  return (
    <>
      {/* Structural Inject for variables/fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        
        body { font-family: 'Space Grotesk', sans-serif; }
        
        :root {
          --bg: oklch(0.96 0.01 90);
          --card-bg: oklch(1.00 0 0);
          --ink: oklch(0.15 0.02 280);
          --border: oklch(0.15 0.02 280);
          --muted: oklch(0.50 0.02 280);
          --red: oklch(0.55 0.24 28);
          --yellow: oklch(0.85 0.18 85);
          --green: oklch(0.62 0.19 145);
          --blue: oklch(0.52 0.18 255);
        }
      `}</style>

      {/* Ambient background anchor */}
      <div className={c.ambient}></div>

      <div className={c.layout}>
        {/* Nav */}
        <header className={c.nav}>
          <div className="flex gap-2 items-center">
              <div className="flex gap-1">
                  <span className="w-3 h-3 block bg-[var(--red)] border-[2px] border-[var(--border)]"></span>
                  <span className="w-3 h-3 block bg-[var(--yellow)] border-[2px] border-[var(--border)]"></span>
                  <span className="w-3 h-3 block bg-[var(--green)] border-[2px] border-[var(--border)]"></span>
              </div>
              <span className="font-bold uppercase tracking-[0.1em] pl-2 font-mono text-sm">Dashboard</span>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
              <span className={c.navItem}>Briefs</span>
              <span className={c.navItem}>Export</span>
          </div>
        </header>

        {/* Hero */}
        <section className={c.hero}>
           <div className="w-full max-w-[400px] h-[6px] flex mb-8 border-[1.5px] border-[var(--border)] overflow-hidden rounded-full">
               <div className="w-1/4 bg-[var(--red)]"></div>
               <div className="w-1/4 bg-[var(--yellow)]"></div>
               <div className="w-1/4 bg-[var(--green)]"></div>
               <div className="w-1/4 bg-[var(--blue)]"></div>
           </div>
           <h1 className={c.title}>
              <span className={c.titleOffset}>Active Dossiers</span>
              <span className={c.titleMain}>Active Dossiers</span>
           </h1>
        </section>

        {view === "grid" && (
          <section className={c.grid}>
              {accounts.map(acc => (
                  <div key={acc._id} className={c.card}>
                      <div className="flex flex-col">
                          <span className={c.headerLabel}>Account Profile</span>
                          <span className={c.subtitle}>{acc.name}</span>
                      </div>
                      <div className="text-3xl font-mono">${acc.dealSize.toLocaleString()}</div>
                      <div><span className={c.badge}>{acc.stage}</span></div>
                      
                      <div className={c.btnRow}>
                        <button className={c.btnSecondary} onClick={() => { setActiveId(acc._id); setView('account'); }}>
                          Access File
                        </button>
                      </div>
                  </div>
              ))}
          </section>
        )}

        {view === "account" && activeAccount.name && (
          <div className="flex flex-col gap-6">
              <div className="flex justify-start">
                 <button className={c.btnGhost} onClick={() => setView('grid')}>← Return to Grid</button>
              </div>

              <section className={c.card}>
                   <span className={c.headerLabel}>Exhibit 01 — Target Profile</span>
                   <h2 className={c.title}>
                     <span className={c.titleOffset}>{activeAccount.name}</span>
                     <span className={c.titleMain}>{activeAccount.name}</span>
                   </h2>
                   <div className="grid grid-cols-2 gap-4 mt-6">
                       <div>
                           <label className="text-[0.65rem] uppercase tracking-widest mb-2 block font-bold">Current Stage</label>
                           <span className={c.badge}>{activeAccount.stage}</span>
                       </div>
                       <div>
                           <label className="text-[0.65rem] uppercase tracking-widest mb-2 block font-bold">Deal Size</label>
                           <span className="font-mono text-2xl block border-[3px] border-[var(--border)] p-2 w-fit shadow-[3px_3px_0px_var(--border)]">${Number(activeAccount.dealSize).toLocaleString()}</span>
                       </div>
                   </div>
              </section>

              <section className={c.card}>
                  <span className={c.headerLabel}>Exhibit 02 — Key Contacts</span>
                  <div className={c.tableOuter}>
                    <table className={c.table}>
                        <thead>
                            <tr>
                                <th className={c.th}>Name</th>
                                <th className={c.th}>Role/Power</th>
                                <th className={c.th}>Rel</th>
                                <th className={c.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeAccount.contacts || []).map((contact, i) => (
                                <tr key={i} className="group cursor-default">
                                    <td className={c.td}>{contact.name}</td>
                                    <td className={`${c.td} font-mono`}>{contact.role}</td>
                                    <td className={c.td}><span className={`${c.badge} ${contact.rel === 'Weak' ? 'bg-[var(--red)] text-white' : ''}`}>{contact.rel}</span></td>
                                    <td className={c.td}>
                                        <button 
                                          className={c.btnGhost} 
                                          onClick={() => {
                                            const updated = activeAccount.contacts.filter((_, idx) => idx !== i)
                                            database.put({ ...activeAccount, contacts: updated })
                                          }}>X</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex flex-col md:flex-row gap-2 items-center">
                      <input className={c.input} placeholder="Contact Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                      <input className={c.input} placeholder="Role" value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value})} />
                      <select className={c.input} value={newContact.rel} onChange={e => setNewContact({...newContact, rel: e.target.value})}>
                          <option value="">Status...</option><option value="Strong">Strong</option><option value="Neutral">Neutral</option><option value="Weak">Weak</option>
                      </select>
                      <button className={c.btnSecondary} onClick={() => {
                          if (newContact.name) {
                              database.put({ ...activeAccount, contacts: [...(activeAccount.contacts || []), newContact] })
                              setNewContact({ name: '', role: '', rel: '' })
                          }
                      }}>Add</button>
                  </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className={c.card}>
                      <span className={c.headerLabel}>Exhibit 03 — Threats</span>
                      <p className="font-mono text-[0.82rem] leading-relaxed flex-grow whitespace-pre-line">{activeAccount.threats}</p>
                      <button 
                        className={c.btnSecondary} 
                        disabled={loadingAI}
                        onClick={async () => {
                            setLoadingAI(true);
                            try {
                                const resp = await callAI(`You are an aggressive B2B sales coach analyzing this account context: ${JSON.stringify(activeAccount)}. Give me 2 blunt, brutal bullet point threats causing risk to this deal. Keep them distinct under 15 words each.`, {
                                    schema: { properties: { threats: { type: 'string' } } }
                                });
                                const parsed = JSON.parse(resp);
                                await database.put({ ...activeAccount, threats: parsed.threats });
                            } finally { setLoadingAI(false); }
                        }}>
                          {loadingAI ? <span className="animate-spin w-4 h-4 rounded-full border-[3px] border-[var(--border)] border-t-transparent"></span> : 'AI Analyze Deficits'}
                      </button>
                  </section>
                  <section className={c.card}>
                      <span className={c.headerLabel}>Exhibit 04 — Opportunities</span>
                      <p className="font-mono text-[0.82rem] leading-relaxed flex-grow whitespace-pre-line">{activeAccount.opportunities}</p>
                      <button 
                        className={c.btnSecondary} 
                        disabled={loadingAI}
                        onClick={async () => {
                            setLoadingAI(true);
                            try {
                                const resp = await callAI(`You are a tactical B2B sales co-pilot looking at: ${JSON.stringify(activeAccount)}. Give me 2 actionable opportunity angles to pursue to advance the deal. Keep them short and punchy.`, {
                                    schema: { properties: { opportunities: { type: 'string' } } }
                                });
                                const parsed = JSON.parse(resp);
                                await database.put({ ...activeAccount, opportunities: parsed.opportunities });
                            } finally { setLoadingAI(false); }
                        }}>
                          {loadingAI ? <span className="animate-spin w-4 h-4 rounded-full border-[3px] border-[var(--border)] border-t-transparent"></span> : 'AI Suggest Tactics'}
                      </button>
                  </section>
              </div>

              <section className={c.card}>
                  <span className={c.headerLabel}>Exhibit 05 — Telemetry Log</span>
                  <div className="flex flex-col gap-0 border-t-[3px] border-[var(--border)] mt-2 bg-[oklch(0.98_0_0)]">
                      {touches.length === 0 && <div className="p-4 text-sm font-mono text-[var(--muted)]">No telemetry recorded yet.</div>}
                      {touches.map((t) => (
                          <div key={t._id} className="flex flex-wrap md:flex-nowrap gap-4 px-2 py-3 text-[0.82rem] font-mono border-b-[3px] border-[var(--border)] last:border-0 hover:bg-[var(--yellow)] transition-colors">
                              <span className="w-24 shrink-0 font-bold opacity-60">{new Date(t.date).toLocaleDateString()}</span>
                              <span className="font-bold w-20 shrink-0 uppercase tracking-widest text-[var(--blue)] drop-shadow-[1px_1px_0px_white]">{t.event_type}</span>
                              <span className="flex-grow">{t.notes}</span>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 flex flex-col md:flex-row gap-2">
                      <select className={`${c.input} md:w-1/4`} value={newTouch.type} onChange={e => setNewTouch({...newTouch, type: e.target.value})}>
                          <option>Meeting</option><option>Email</option><option>Call</option><option>Signal</option>
                      </select>
                      <input className={`${c.input} flex-grow`} placeholder="Field notes..." value={newTouch.notes} onChange={e => setNewTouch({...newTouch, notes: e.target.value})} />
                      <button 
                        className={c.btnPrimary} 
                        onClick={() => {
                            if (newTouch.notes) {
                                database.put({ type: 'touch', accountId: activeAccount._id, date: Date.now(), event_type: newTouch.type, notes: newTouch.notes });
                                setNewTouch({ type: 'Meeting', notes: '' });
                            }
                        }}>File Touch</button>
                  </div>
              </section>
          </div>
        )}
      </div>
    </>
  )
}