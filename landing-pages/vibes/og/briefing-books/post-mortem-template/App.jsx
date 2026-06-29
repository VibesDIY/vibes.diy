import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  const [view, setView] = useState("list");
  const [activePmId, setActivePmId] = useState(null);
  
  const { database, useLiveQuery, useDocument } = useFireproof("outageops-v1");
  const { docs: postmortems } = useLiveQuery("type", { key: "pm", descending: true });
  
  const { doc: activePM, merge: mergePM, save: savePM } = useDocument({ 
    _id: activePmId || "placeholder",
    title: "", severity: "SEV-1", status: "DRAFT", downtime: "", commander: "", summary: "", rootCause: ""
  });
  
  const { docs: events } = useLiveQuery("pmId", { key: activePmId });
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEventTime || !newEventDesc) return;
    await database.put({ type: "timeline", pmId: activePmId, time: newEventTime, desc: newEventDesc });
    setNewEventTime(""); setNewEventDesc("");
  };

  const { docs: actions } = useLiveQuery(doc => doc.type === 'action' ? doc.pmId : null, { key: activePmId });
  const [newAction, setNewAction] = useState("");
  const [chatLog, setChatLog] = useState("");
  const [isProcessingLog, setIsProcessingLog] = useState(false);
  const [isSuggestingRemedies, setIsSuggestingRemedies] = useState(false);

  const handleAddAction = async (e) => {
    e.preventDefault();
    if (!newAction) return;
    await database.put({ type: "action", pmId: activePmId, desc: newAction, done: false });
    setNewAction("");
  };

  const handleSuggestRemedies = async () => {
    if (!activePM.summary && events.length === 0) return;
    setIsSuggestingRemedies(true);
    try {
      const context = `Summary: ${activePM.summary}\nEvents: ${events.map(e=>e.desc).join(", ")}`;
      const resp = await callAI(`Based on this incident context, suggest exactly 3 strict action items that engineering should execute this sprint to ensure this never happens ever again.\n\n${context}`, {
        schema: {
          properties: {
            tasks: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });
      const data = JSON.parse(resp);
      for (const t of (data.tasks || [])) {
        await database.put({ type: "action", pmId: activePmId, desc: t, done: false });
      }
    } finally {
      setIsSuggestingRemedies(false);
    }
  };

  const handleParseChat = async () => {
    if (!chatLog.trim()) return;
    setIsProcessingLog(true);
    try {
      const resp = await callAI(`Extract a clean chronological incident timeline from this raw developer chat log. Keep events terribly concise and strictly professional.\n\n${chatLog}`, {
        schema: {
          properties: {
            extractedEvents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "string", description: "HH:MM format military time" },
                  desc: { type: "string", description: "Very short factual summary of what happened" }
                }
              }
            }
          }
        }
      });
      const data = JSON.parse(resp);
      for (const ev of (data.extractedEvents || [])) {
        await database.put({ type: "timeline", pmId: activePmId, time: ev.time, desc: ev.desc });
      }
      setChatLog("");
    } finally {
      setIsProcessingLog(false);
    }
  };

  const handleOpenList = () => {
    setView("list");
    setActivePmId(null);
  };

  const handleCreateNew = async () => {
    const res = await database.put({ 
      type: "pm", 
      title: "Untitled Post-Mortem", 
      severity: "SEV-3", 
      status: "DRAFT", 
      createdAt: Date.now(),
      downtime: "",
      commander: "",
      summary: "",
      rootCause: ""
    });
    setActivePmId(res.id);
    setView("detail");
  };

  const c = {
    layout: "max-w-[920px] mx-auto p-4 md:p-[3rem_2rem] flex flex-col gap-8 relative z-10",
    nav: "flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] gap-4",
    navLogo: "flex gap-2 items-center text-[1.2rem] font-bold tracking-[-0.02em] uppercase cursor-pointer hover:opacity-80 transition-opacity",
    navLogoSquares: "flex gap-1",
    navSquare: "w-[12px] h-[12px] border-[2px] border-[oklch(0.15_0.02_280)]",
    navLink: "px-4 py-2 text-[0.8rem] uppercase tracking-wider font-bold cursor-pointer bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all",
    
    hero: "p-6 flex flex-col gap-4 relative mt-4 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden",
    heroRainbowBar: "absolute top-0 left-0 right-0 h-[6px] border-b-[3px] border-[oklch(0.15_0.02_280)] flex",
    heroRainbowSeg: "flex-1 h-full",
    heroTitleWrap: "relative mt-6 z-10",
    heroTitle: "w-full text-4xl md:text-5xl uppercase tracking-[-0.02em] font-bold outline-none font-sans bg-transparent text-[oklch(0.15_0.02_280)] relative z-10 focus:ring-0 placeholder-[oklch(0.50_0.02_280)]",
    heroTitleShadow: "absolute top-[5px] left-[5px] text-4xl md:text-5xl uppercase tracking-[-0.02em] font-bold pointer-events-none font-sans text-[oklch(0.55_0.24_28)] opacity-50 z-0",
    
    statGrid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4",
    statCard: "flex flex-col bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden",
    statHeader: "px-3 py-1 text-[0.65rem] uppercase tracking-[0.15em] font-bold border-b-[3px] border-[oklch(0.15_0.02_280)]",
    statBody: "px-3 py-4 flex items-center justify-center min-h-[80px] hover:bg-[oklch(0.85_0.18_85)] transition-colors focus-within:bg-[oklch(0.85_0.18_85)]",
    statInput: "w-full bg-transparent text-center text-xl font-mono font-bold uppercase outline-none focus:ring-0 cursor-text",
    
    grid2Col: "grid grid-cols-1 md:grid-cols-2 gap-6",
    cardBlock: "p-5 flex flex-col gap-3 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    cardLabel: "text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[oklch(0.50_0.02_280)]",
    inputLift: "w-full p-3 text-[0.9rem] font-mono resize-y min-h-[90px] outline-none border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] focus:bg-[oklch(1.00_0_0)] focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all",
    
    tableCard: "w-full overflow-hidden bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    table: "w-full text-left border-collapse font-sans",
    th: "p-3 text-[0.6rem] uppercase tracking-wider font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] text-[oklch(0.50_0.02_280)]",
    td: "p-3 text-[0.82rem] border-b-[1px] border-[oklch(0.15_0.02_280)] group-hover:bg-[oklch(0.85_0.18_85)] transition-colors",
    tdMono: "p-3 text-[0.82rem] font-mono whitespace-nowrap border-b-[1px] border-[oklch(0.15_0.02_280)] group-hover:bg-[oklch(0.85_0.18_85)] transition-colors w-[1%]",
    
    actionRow: "flex justify-end gap-3 mt-2 shrink-0 flex-wrap",
    btnPrimary: "px-5 py-3 text-[0.8rem] uppercase tracking-wider font-bold bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2",
    btnSecondary: "px-5 py-3 text-[0.8rem] uppercase tracking-wider font-bold bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_oklch(0.15_0.02_280)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2",
    btnGhost: "px-5 py-3 text-[0.8rem] uppercase tracking-wider font-bold bg-[oklch(0.96_0.01_90)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2",

    badgeOutline: "inline-flex px-2 py-1 text-[0.6rem] uppercase font-bold uppercase",
    
    timelineForm: "flex flex-col md:flex-row gap-3 items-stretch md:items-center",
    spinner: <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>,
    timelineInputTime: "w-full md:w-[120px] p-3 text-[0.82rem] font-mono outline-none border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] focus:bg-[oklch(1.00_0_0)] focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all",
    timelineInputDesc: "flex-1 p-3 text-[0.82rem] outline-none border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.96_0.01_90)] focus:bg-[oklch(1.00_0_0)] focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all"
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
        body { 
          margin: 0; min-height: 100vh; 
          font-family: 'Space Grotesk', sans-serif;
          background-color: oklch(0.96 0.01 90);
          color: oklch(0.15 0.02 280);
        }
        .font-sans { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        @keyframes spinSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-spin-slow { animation: spinSlow 12s linear infinite; }
      `}</style>

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex" style={{ 
        backgroundImage: 'linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }}>
         <div className="absolute top-[10%] left-[5%] w-16 h-16 rounded-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] opacity-20 animate-float"></div>
         <div className="absolute bottom-[20%] right-[10%] w-12 h-12 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] opacity-30 animate-spin-slow"></div>
         <div className="absolute top-[50%] right-[5%] w-8 h-8 rotate-45 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] opacity-25 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <main className={c.layout}>
        <nav className={c.nav}>
          <div className={c.navLogo} onClick={handleOpenList}>
            <div className={c.navLogoSquares}>
              <div className={`${c.navSquare} bg-[oklch(0.55_0.24_28)]`}></div>
              <div className={`${c.navSquare} bg-[oklch(0.85_0.18_85)]`}></div>
              <div className={`${c.navSquare} bg-[oklch(0.62_0.19_145)]`}></div>
            </div>
            <span>OutageOps</span>
          </div>
          <div>
            <button className={c.navLink} onClick={handleCreateNew}>+ New Post-Mortem</button>
          </div>
        </nav>

        {view === "list" && (
          <div className={`${c.tableCard} mt-4`}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>Severity</th>
                  <th className={c.th}>Report Title</th>
                  <th className={c.th}>Date</th>
                  <th className={c.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {postmortems.length === 0 && (
                  <tr><td colSpan="4" className={c.td}>No records found. Click '+ New Post-Mortem'.</td></tr>
                )}
                {postmortems.map(pm => (
                  <tr key={pm._id} className="group cursor-pointer" onClick={() => { setActivePmId(pm._id); setView("detail"); }}>
                    <td className={c.tdMono}>
                      <span className={`${c.badgeOutline} ${pm.severity === 'SEV-1' ? 'text-[oklch(0.55_0.24_28)]' : pm.severity === 'SEV-2' ? 'text-[oklch(0.85_0.18_85)]' : 'text-[oklch(0.52_0.18_255)]'} border-[2px] border-current`}>
                        {pm.severity}
                      </span>
                    </td>
                    <td className={c.td}><strong>{pm.title}</strong></td>
                    <td className={c.tdMono}>{new Date(pm.createdAt).toISOString().split('T')[0]}</td>
                    <td className={c.td}>{pm.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "detail" && (
          <>
            <section className={c.hero}>
              <div className={c.heroRainbowBar}>
                <div className={`${c.heroRainbowSeg} bg-[oklch(0.55_0.24_28)]`}></div>
                <div className={`${c.heroRainbowSeg} bg-[oklch(0.85_0.18_85)]`}></div>
                <div className={`${c.heroRainbowSeg} bg-[oklch(0.62_0.19_145)]`}></div>
                <div className={`${c.heroRainbowSeg} bg-[oklch(0.52_0.18_255)]`}></div>
              </div>
              
              <div className={c.heroTitleWrap}>
                <div className={c.heroTitleShadow} aria-hidden="true">
                  {activePM.title || "Untitled Incident"}
                </div>
                <input 
                  type="text" 
                  className={c.heroTitle} 
                  value={activePM.title} 
                  onChange={(e) => mergePM({ title: e.target.value })}
                  placeholder="Enter Title..."
                />
              </div>
            </section>

            <section className={c.statGrid}>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[oklch(0.55_0.24_28)] text-white`}>Severity</div>
                <div className={c.statBody}>
                  <select className={c.statInput} value={activePM.severity} onChange={(e) => mergePM({ severity: e.target.value })}>
                    <option>SEV-1</option>
                    <option>SEV-2</option>
                    <option>SEV-3</option>
                  </select>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]`}>Status</div>
                <div className={c.statBody}>
                  <select className={c.statInput} value={activePM.status} onChange={(e) => mergePM({ status: e.target.value })}>
                    <option>DRAFT</option>
                    <option>FINAL</option>
                  </select>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[oklch(0.52_0.18_255)] text-white`}>Down Time</div>
                <div className={c.statBody}>
                  <input type="text" className={c.statInput} placeholder="0 MINS" value={activePM.downtime} onChange={(e) => mergePM({ downtime: e.target.value })}/>
                </div>
              </div>
              <div className={c.statCard}>
                <div className={`${c.statHeader} bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]`}>Commander</div>
                <div className={c.statBody}>
                  <input type="text" className={c.statInput} placeholder="@SRE..." value={activePM.commander} onChange={(e) => mergePM({ commander: e.target.value })}/>
                </div>
              </div>
            </section>

            <section className={c.grid2Col}>
              <div className={c.cardBlock}>
                <label className={c.cardLabel}>Summary</label>
                <textarea className={c.inputLift} value={activePM.summary} onChange={(e) => mergePM({ summary: e.target.value })} placeholder="High-level incident description..."></textarea>
              </div>
              <div className={c.cardBlock}>
                <label className={c.cardLabel}>Root Cause</label>
                <textarea className={c.inputLift} value={activePM.rootCause} onChange={(e) => mergePM({ rootCause: e.target.value })} placeholder="The actual underlying fault..."></textarea>
              </div>
            </section>

            <section className={c.cardBlock}>
              <label className={c.cardLabel}>Timeline Exhibit</label>
              
              <form className={c.timelineForm} onSubmit={handleAddEvent}>
                <input type="text" className={c.timelineInputTime} placeholder="13:42" value={newEventTime} onChange={e=>setNewEventTime(e.target.value)} />
                <input type="text" className={c.timelineInputDesc} placeholder="Observer noticed latency spike..." value={newEventDesc} onChange={e=>setNewEventDesc(e.target.value)} />
                <button type="submit" className={c.btnSecondary} disabled={!newEventTime || !newEventDesc}>Add</button>
              </form>

              <div className={c.tableCard}>
                <table className={c.table}>
                  <thead>
                     <tr>
                       <th className={c.th}>Time</th>
                       <th className={c.th}>Event Record</th>
                     </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 && (
                      <tr><td colSpan="2" className={c.td}>No timeline entries. Add one above.</td></tr>
                    )}
                    {events.sort((a,b)=> a.time.localeCompare(b.time)).map(ev => (
                       <tr key={ev._id} className="group cursor-pointer" onClick={() => database.del(ev._id)}>
                         <td className={c.tdMono}>{ev.time}</td>
                         <td className={c.td}>{ev.desc}</td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={c.cardBlock}>
                 <label className={c.cardLabel}>Ingest Chat Log (AI)</label>
                 <textarea className={c.inputLift} rows={3} placeholder="Paste unformatted messy Slack/Discord incident transcripts..." value={chatLog} onChange={e=>setChatLog(e.target.value)}></textarea>
                 <div className={c.actionRow}>
                   <button className={c.btnSecondary} onClick={handleParseChat} disabled={isProcessingLog || !chatLog.trim()}>
                     {isProcessingLog ? c.spinner : null}
                     {isProcessingLog ? 'Scanning Transcript...' : 'Parse & Append'}
                   </button>
                 </div>
              </div>
            </section>

            <section className={c.cardBlock}>
              <label className={c.cardLabel}>Action Items</label>
              <div className="flex flex-col md:flex-row gap-3">
                <form className="flex-1 flex gap-3" onSubmit={handleAddAction}>
                  <input type="text" className={c.timelineInputDesc} placeholder="Fix the underlying bug..." value={newAction} onChange={e=>setNewAction(e.target.value)} />
                  <button type="submit" className={c.btnSecondary} disabled={!newAction}>Add</button>
                </form>
                <button className={c.btnGhost} onClick={handleSuggestRemedies} disabled={isSuggestingRemedies}>
                  {isSuggestingRemedies ? c.spinner : null}
                  {isSuggestingRemedies ? 'Synthesizing...' : 'AI Suggest'}
                </button>
              </div>

              <div className={c.tableCard}>
                 <table className={c.table}>
                   <thead>
                     <tr>
                       <th className={c.th w-[40px]}>✓</th>
                       <th className={c.th}>Remediation Task</th>
                       <th className={c.th w-[80px]}>Revoke</th>
                     </tr>
                   </thead>
                   <tbody>
                      {actions.length === 0 && (
                        <tr><td colSpan="3" className={c.td}>No required actions logged.</td></tr>
                      )}
                      {actions.map(act => (
                        <tr key={act._id} className="group">
                          <td className={c.td}><input type="checkbox" checked={act.done} onChange={() => database.put({ ...act, done: !act.done })} className="w-[18px] h-[18px] border-[2px] border-[oklch(0.15_0.02_280)] accent-[oklch(0.62_0.19_145)] cursor-pointer" /></td>
                          <td className={`${c.td} ${act.done ? 'line-through text-[oklch(0.50_0.02_280)]' : ''}`}>{act.desc}</td>
                          <td className={c.td}><button className="opacity-50 hover:opacity-100 font-bold text-[oklch(0.55_0.24_28)] uppercase text-[0.7rem]" onClick={() => database.del(act._id)}>Del</button></td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
              </div>
              <div className={c.actionRow}>
                <button className={c.btnPrimary} onClick={savePM}>Save Report Matrix</button>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}