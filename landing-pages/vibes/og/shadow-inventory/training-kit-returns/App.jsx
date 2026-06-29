import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

import { useState } from "react";

export default function App() {
  const [formKit, setFormKit] = useState("");
  const [formTrainer, setFormTrainer] = useState("");
  const [formDate, setFormDate] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { database, useLiveQuery } = useFireproof("kitcrash-db");
  const { docs: kits } = useLiveQuery("type", { key: "kit", descending: true });
  const { docs: events } = useLiveQuery("type", { key: "event", descending: true });
  
  const totalKits = kits.length;
  const activeKits = kits.filter(k => k.status === 'deployed').length;
  
  const now = new Date().toISOString().split('T')[0];
  const missingKits = kits.filter(k => k.status === 'deployed' && k.dueDate && k.dueDate < now).length;

  // Simple leaderboard calculation
  const trainerCounts = {};
  events.filter(e => e.action === 'return' && e.trainer).forEach(e => {
    trainerCounts[e.trainer] = (trainerCounts[e.trainer] || 0) + 1;
  });
  const topTrainer = Object.entries(trainerCounts).sort((a,b)=>b[1]-a[1])[0] || ["N/A", 0];

  const c = {
    appWrapper: "min-h-screen relative font-sans flex flex-col items-center bg-[var(--bg)] text-[var(--text)]",
    ambient: "fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(to_right,oklch(0.15_0.02_280/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.15_0.02_280/0.04)_1px,transparent_1px)] bg-[size:60px_60px]",
    page: "w-full max-w-[920px] p-6 md:p-12 flex flex-col gap-8 relative z-10",
    
    nav: "bg-[var(--card-bg)] flex justify-between items-center p-4 border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] uppercase text-[0.8rem] font-bold tracking-wider",
    navLogo: "flex items-center gap-2 text-xl font-black tracking-tighter text-[var(--text)]",
    navPill: "px-3 py-1 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--border)] transition-all",
    
    hero: "p-8 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] text-center flex flex-col gap-2 relative overflow-hidden",
    heroTitle: "text-4xl md:text-6xl font-black uppercase tracking-tight relative z-10",
    heroSub: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    
    statGrid: "grid grid-cols-2 md:grid-cols-4 gap-4",
    statCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] flex flex-col overflow-hidden",
    statHeader: "p-2 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px] border-[var(--border)]",
    statBody: "p-4 text-center font-mono text-3xl font-bold flex flex-col items-center text-[var(--text)]",
    statUnit: "text-[0.65rem] uppercase tracking-widest mt-1 text-[var(--muted)] font-sans",
    
    twoCol: "grid grid-cols-1 md:grid-cols-2 gap-8",
    card: "p-6 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)] flex flex-col gap-5 relative",
    cardTitle: "text-sm uppercase tracking-[0.1em] font-bold pb-2 border-b-[3px] border-[var(--border)]",
    
    formRow: "flex flex-col gap-2 relative",
    label: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    input: "w-full p-3 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] text-sm font-bold font-mono outline-none transition-all placeholder:text-[var(--muted)] focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0_var(--border)]",
    
    btnPrimary: "w-full p-4 bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] font-bold uppercase tracking-[0.08em] transition-all shadow-[4px_4px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-75 disabled:cursor-not-allowed",
    btnSecondary: "w-max px-4 p-2 bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[3px_3px_0_var(--border)] font-bold uppercase text-[0.7rem] tracking-[0.08em] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-75",
    btnGhost: "px-3 py-1 bg-[var(--card-bg)] font-bold uppercase text-[0.7rem] tracking-wider transition-all border-[3px] border-[var(--border)] rounded-[4px] hover:bg-[var(--yellow)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    btnSideAI: "absolute right-2 top-8 px-2 py-1 bg-[var(--blue)] text-white text-[0.6rem] uppercase tracking-wider border-[3px] border-[var(--border)] rounded-[4px] shadow-[2px_2px_0_var(--border)] hover:bg-[var(--yellow)] hover:text-[var(--text)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all disabled:opacity-50",
    
    tableContainer: "w-full overflow-x-auto bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    table: "w-full text-left border-collapse",
    th: "p-3 uppercase text-[0.6rem] tracking-[0.15em] text-[var(--muted)] border-b-[3px] border-[var(--border)] font-bold",
    td: "p-3 text-[0.82rem] border-b-[2px] border-[var(--border)] font-mono group-hover:bg-[var(--yellow)] transition-colors duration-75",
    
    logRow: "flex flex-col gap-1 p-3 border-b-[2px] border-[var(--border)] last:border-b-0 group hover:bg-[var(--yellow)] transition-colors duration-75",
    logHeader: "flex justify-between text-[0.65rem] uppercase tracking-[0.1em] text-[var(--muted)] group-hover:text-[var(--text)]",
    logBody: "text-sm font-mono font-bold"
  };

  const handleAI = async () => {
    setIsGenerating(true);
    try {
      const res = await callAI("Suggest a tough sounding scifi tactical equipment crate name (e.g. OMEGA-TAC-09) and a 1-2 word operator name (e.g. Sgt. Roit). Return structured JSON.", {
        schema: { properties: { kitName: { type: "string" }, operator: { type: "string" } }}
      });
      const data = JSON.parse(res);
      setFormKit(data.kitName);
      setFormTrainer(data.operator);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      setFormDate(tomorrow.toISOString().split('T')[0]);
    } catch(e) { console.error(e) }
    finally { setIsGenerating(false); }
  };

  const submitDeploy = async (e) => {
    e.preventDefault();
    if(!formKit || !formTrainer || !formDate) return;
    setIsDeploying(true);
    try {
      // Create or update Kit record to track it exists
      await database.put({ type: "kit", _id: `kit-${formKit}`, name: formKit, status: "deployed", trainer: formTrainer, dueDate: formDate });
      // Log the event
      await database.put({ type: "event", action: "deploy", kit: formKit, trainer: formTrainer, timestamp: Date.now() });
      setFormKit(""); setFormTrainer(""); setFormDate("");
    } finally { setIsDeploying(false); }
  };

  const returnKit = async (kitDoc) => {
    await database.put({ ...kitDoc, status: "home", trainer: null, dueDate: null });
    await database.put({ type: "event", action: "return", kit: kitDoc.name, trainer: kitDoc.trainer, timestamp: Date.now() });
  };

  return (
    <div className={c.appWrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
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
        }
        body { background-color: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .hero-text-shadow { text-shadow: 5px 5px 0 var(--red); opacity: 0.5; }
      `}</style>
      <div className={c.ambient}></div>
      
      <main className={c.page}>
        <nav className={c.nav}>
          <div className={c.navLogo}>
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-[var(--red)] border-[2px] border-[var(--border)]"></div>
              <div className="w-3 h-3 bg-[var(--yellow)] border-[2px] border-[var(--border)]"></div>
              <div className="w-3 h-3 bg-[var(--green)] border-[2px] border-[var(--border)]"></div>
            </div>
            KITCRASH
          </div>
          <div className="flex gap-2">
            <span className={c.navPill}>SYS.OP</span>
            <span className={c.navPill}>LOG</span>
          </div>
        </nav>

        <section id="hero" className={c.hero}>
          <div className="absolute top-0 left-0 right-0 h-[6px] flex">
            <div className="flex-1 bg-[var(--red)]"></div>
            <div className="flex-1 bg-[var(--yellow)]"></div>
            <div className="flex-1 bg-[var(--green)]"></div>
            <div className="flex-1 bg-[var(--blue)]"></div>
          </div>
          <p className={c.heroSub}>Tactical Asset Ops</p>
          <h1 className={c.heroTitle}>
            Equip. Deploy.
            <span className="absolute top-0 left-0 w-full h-full hero-text-shadow -z-10" aria-hidden="true">Equip. Deploy.</span>
          </h1>
        </section>

        <section id="stats" className={c.statGrid}>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--yellow)] text-[var(--text)]`}>Deployed</div>
            <div className={c.statBody}>{activeKits} <span className={c.statUnit}>Active</span></div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--red)] text-white`}>Overdue</div>
            <div className={c.statBody}>{missingKits} <span className={c.statUnit}>Missing</span></div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--blue)] text-white`}>Inventory</div>
            <div className={c.statBody}>{totalKits} <span className={c.statUnit}>Total Kits</span></div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--green)] text-[var(--text)]`}>Top Trainer</div>
            <div className={c.statBody}>{topTrainer[0].substring(0,8)} <span className={c.statUnit}>Score {topTrainer[1]}</span></div>
          </div>
        </section>

        <section id="deploy-and-log" className={c.twoCol}>
          <div className={c.card}>
            <h2 className={c.cardTitle}>Deploy Kit</h2>
            <form onSubmit={submitDeploy} className="flex flex-col gap-4">
              <div className={c.formRow}>
                <label className={c.label}>Kit Name / ID</label>
                <input className={c.input} value={formKit} onChange={e=>setFormKit(e.target.value)} placeholder="e.g. ALPHA-PROJ-01" required />
                <button type="button" onClick={handleAI} disabled={isGenerating} className={c.btnSideAI}>
                  {isGenerating ? <svg className="animate-spin h-3 w-3 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "AI"}
                </button>
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Assignee Trainer</label>
                <input className={c.input} value={formTrainer} onChange={e=>setFormTrainer(e.target.value)} placeholder="Last name, First initial" required />
              </div>
              <div className={c.formRow}>
                <label className={c.label}>Mission Due Date</label>
                <input type="date" value={formDate} onChange={e=>setFormDate(e.target.value)} className={c.input} required />
              </div>
              <button type="submit" disabled={isDeploying} className={c.btnPrimary}>
                {isDeploying ? <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Slam To Field"}
              </button>
            </form>
          </div>
          
          <div className={c.card}>
            <h2 className={c.cardTitle}>Recent Logs</h2>
            <div className="flex flex-col h-[280px] overflow-y-auto">
              {events.length === 0 && <div className="text-sm font-mono text-[var(--muted)] pt-4">No comms yet.</div>}
              {events.slice(0, 10).map(ev => (
                <div key={ev._id} className={c.logRow}>
                  <div className={c.logHeader}>
                    <span className={ev.action === 'return' ? 'text-[var(--green)]' : 'text-[var(--yellow)]'}>{ev.action}</span> 
                    <span>{new Date(ev.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className={c.logBody}>{ev.kit} // {ev.trainer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ledger" className="flex flex-col gap-4">
          <div className="flex justify-between items-end">
             <h2 className="text-sm uppercase tracking-[0.1em] font-bold">Global Inventory Ledger</h2>
             <button onClick={async () => {
                const res = await callAI("Return a JSON array of 3 sample tech kits (e.g. ECHO-DRONE, COMMS-PACK, etc.)", {
                  schema: { properties: { kits: { type: "array", items: { type: "string" } } } }
                });
                const names = JSON.parse(res).kits;
                names.forEach(n => database.put({ type: "kit", _id: `kit-${n}`, name: n, status: "home" }));
             }} className={c.btnSecondary}>Seed Inventory</button>
          </div>
          <div className={c.tableContainer}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>Status</th>
                  <th className={c.th}>Kit ID</th>
                  <th className={c.th}>Assigned To</th>
                  <th className={c.th}>Location / Action</th>
                </tr>
              </thead>
              <tbody>
                {kits.length === 0 && (
                  <tr><td colSpan="4" className={c.td}>No kits registered. Use the deploy form to bootstrap inventory.</td></tr>
                )}
                {kits.map(kit => {
                  const isOverdue = kit.status === 'deployed' && kit.dueDate && kit.dueDate < now;
                  return (
                    <tr key={kit._id} className="group">
                      <td className={c.td}>
                        {kit.status === 'deployed' ? 
                          isOverdue ? <span className="text-[var(--red)] font-black uppercase inline-flex items-center gap-1"><span className="w-2 h-2 bg-[var(--red)] inline-block"></span> Overdue</span>
                                    : <span className="text-[var(--yellow-dark)] font-bold inline-flex items-center gap-1"><span className="w-2 h-2 bg-[var(--yellow)] inline-block"></span> Field</span>
                          : <span className="text-[var(--muted)] inline-flex items-center gap-1"><span className="w-2 h-2 bg-[var(--muted)] inline-block"></span> Base</span>
                        }
                      </td>
                      <td className={c.td}>{kit.name} <div className="text-[0.6rem] text-[var(--muted)] font-sans">{kit.dueDate ? `Due ${kit.dueDate}` : ''}</div></td>
                      <td className={c.td}>{kit.trainer || '--'}</td>
                      <td className={c.td}>
                        {kit.status === 'deployed' ? 
                          <button onClick={() => returnKit(kit)} className={c.btnGhost}>Slam Return</button>
                        : <span className="text-[var(--muted)] text-[0.7rem] uppercase">Secure</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}