import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // [STATE_ANCHOR]
  const [activeTab, setActiveTab] = useState("GL");
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const { useLiveQuery, useDocument, database } = useFireproof("finance-close-db");
  
  const { doc: newTask, merge: mergeTask, submit: submitTask } = useDocument({
    type: "task",
    ledger: activeTab,
    description: "",
    owner: "",
    status: "PENDING",
    month: "2023-11",
    createdAt: Date.now()
  });

  const { docs: tasks } = useLiveQuery(
    (doc) => { if (doc.type === "task" && doc.month === "2023-11") return doc.ledger; },
    { key: activeTab, descending: true }
  );

  const { docs: allTasks } = useLiveQuery(
    (doc) => { if (doc.type === "task" && doc.month === "2023-11") return doc.status; }
  );

  // [CLASSNAMES_ANCHOR]
  const c = {
    page: "min-h-screen py-12 px-6 flex flex-col items-center relative overflow-hidden neobrutal-font bg-[var(--bg)]",
    main: "w-full max-w-[920px] relative z-10 flex flex-col gap-8 text-[var(--text)]",
    nav: "flex flex-col sm:flex-row justify-between sm:items-center p-4 border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] gap-4 shadow-[4px_4px_0_var(--border)]",
    navLogoGroup: "flex items-center gap-3",
    navLogoBox: "w-3 h-3 flex-shrink-0 border-[3px] border-[var(--border)] rounded-[4px]",
    navTitle: "text-lg uppercase tracking-[-0.02em] font-bold",
    navLinks: "flex items-center gap-2",
    navPill: "px-3 py-1 text-[0.75rem] uppercase tracking-[0.05em] border-[3px] border-[var(--border)] bg-[var(--bg)] rounded-[4px] font-bold shadow-[3px_3px_0_var(--border)]",
    hero: "p-8 border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] relative flex flex-col gap-2 mt-4 shadow-[4px_4px_0_var(--border)]",
    heroTopBar: "absolute top-0 left-0 w-full h-[6px] flex border-b-[3px] border-[var(--border)]",
    heroTitle: "text-4xl sm:text-5xl uppercase tracking-[-0.02em] font-bold relative z-10",
    heroSubtitle: "text-[0.65rem] uppercase tracking-[0.15em] mt-2 text-[var(--muted)] font-bold",
    statRow: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    statCard: "flex flex-col border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] shadow-[4px_4px_0_var(--border)]",
    statHeader: "px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.15em] border-b-[3px] border-[var(--border)] font-bold",
    statBody: "p-4 flex items-baseline gap-2",
    statNum: "text-3xl neobrutal-mono font-bold leading-none",
    statLabel: "text-xs uppercase neobrutal-mono text-[var(--muted)] font-bold",
    contentGrid: "grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start",
    mainFeed: "flex flex-col gap-6",
    sidePanel: "flex flex-col gap-6",
    card: "p-5 border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] flex flex-col gap-4 shadow-[4px_4px_0_var(--border)]",
    cardTitle: "text-[0.65rem] uppercase tracking-[0.15em] text-[var(--muted)] font-bold mb-2",
    inputGroup: "flex flex-col gap-2 relative group",
    input: "w-full p-2 border-[3px] border-[var(--border)] rounded-[4px] neobrutal-mono text-sm outline-none bg-[var(--bg)] focus:bg-[var(--card-bg)] focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0_var(--border)] transition-all",
    select: "w-full p-2 border-[3px] border-[var(--border)] rounded-[4px] neobrutal-mono text-sm outline-none cursor-pointer bg-[var(--bg)] hover:bg-[var(--card-bg)] transition-colors",
    btnPrimary: "px-4 py-3 border-[3px] border-[var(--border)] bg-[var(--red)] text-white rounded-[4px] uppercase text-[0.8rem] tracking-[0.08em] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[4px_4px_0_var(--border)] hover-lift active-slam w-full disabled:opacity-70 disabled:cursor-not-allowed",
    btnSecondary: "px-4 py-3 border-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--text)] rounded-[4px] uppercase text-[0.8rem] tracking-[0.08em] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[4px_4px_0_var(--border)] hover-lift active-slam disabled:opacity-70 disabled:cursor-not-allowed",
    btnGhost: "px-4 py-3 border-[3px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] rounded-[4px] uppercase text-[0.8rem] tracking-[0.08em] font-bold flex items-center justify-center gap-2 cursor-pointer hover:shadow-[3px_3px_0_var(--border)] hover-lift active-slam disabled:opacity-70 disabled:cursor-not-allowed",
    btnAi: "absolute right-[3px] top-[3px] bottom-[3px] px-3 bg-[var(--yellow)] border-l-[3px] border-[var(--border)] flex items-center justify-center cursor-pointer hover:bg-[var(--yellow-dark)] transition-colors rounded-r-[2px] disabled:opacity-50",
    tableCard: "border-[3px] border-[var(--border)] bg-[var(--card-bg)] rounded-[4px] overflow-x-auto shadow-[4px_4px_0_var(--border)]",
    table: "w-full text-left border-collapse",
    th: "p-3 border-b-[2px] border-[var(--border)] bg-[var(--bg)] text-[0.65rem] uppercase tracking-[0.15em] font-bold",
    td: "p-3 border-b-[1px] border-[var(--border)] text-[0.82rem] group-hover:bg-[var(--yellow)] transition-colors",
    tdMono: "p-3 border-b-[1px] border-[var(--border)] text-[0.82rem] neobrutal-mono whitespace-nowrap group-hover:bg-[var(--yellow)] transition-colors",
    badge: "px-2 py-0.5 border-[3px] border-[var(--border)] rounded-[4px] text-[0.65rem] uppercase font-bold shadow-[2px_2px_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer",
    tabs: "flex gap-2 border-b-[3px] border-[var(--border)] pb-4 overflow-x-auto",
    tabBtn: "px-4 py-2 border-[3px] border-[var(--border)] rounded-[4px] text-[0.75rem] uppercase font-bold whitespace-nowrap shadow-[3px_3px_0_var(--border)] hover-lift active-slam bg-[var(--card-bg)]",
    tabBtnActive: "px-4 py-2 border-[3px] border-[var(--border)] rounded-[4px] text-[0.75rem] uppercase font-bold whitespace-nowrap bg-[var(--green)] translate-x-[2px] translate-y-[2px] shadow-none",
  };

  // [HANDLERS_ANCHOR]
  async function handleToggleStatus(e, task) {
    e.preventDefault();
    const nextStatus = task.status === "PENDING" ? "DONE" : 
                       task.status === "DONE" ? "BLOCKED" : "PENDING";
    
    await database.put({ ...task, status: nextStatus, updatedAt: Date.now() });
    await database.put({ type: "audit", taskId: task._id, oldStatus: task.status, newStatus: nextStatus, timestamp: Date.now() });
  }

  function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.description) return;
    submitTask();
  }
  
  async function handleAiSuggest(e) {
    e.preventDefault();
    setIsAiLoading(true);
    try {
      const response = await callAI(`Suggest 3 short month-end close tasks for the ${activeTab} ledger. Make them realistic finance tasks (e.g. "Reconcile Op Cash"). Include realistic initials for owners.`, {
        schema: {
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  owner: { type: "string" }
                }
              }
            }
          }
        }
      });
      const data = JSON.parse(response);
      for (const t of data.tasks) {
        await database.put({
          type: "task",
          ledger: activeTab,
          description: t.description,
          owner: t.owner,
          status: "PENDING",
          month: "2023-11",
          createdAt: Date.now()
        });
      }
    } finally {
      setIsAiLoading(false);
    }
  }

  return (
    <div className={c.page}>
      <style dangerouslySetInnerHTML={{__html: `
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
        }
        .neobrutal-font { font-family: 'Space Grotesk', sans-serif; color: var(--text); }
        .neobrutal-mono { font-family: 'JetBrains Mono', monospace; }
        .ambient-grid {
          background-image: linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
                            linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .hover-lift:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--border); }
        .active-slam:active { transform: translate(2px, 2px); box-shadow: none; }
      `}} />
      <div className="absolute inset-0 ambient-grid z-0"></div>

      <main className={c.main}>
        {/* NAV */}
        <nav className={c.nav}>
          <div className={c.navLogoGroup}>
            <div className="flex gap-1">
              <div className={`${c.navLogoBox} bg-[var(--red)]`}></div>
              <div className={`${c.navLogoBox} bg-[var(--yellow)]`}></div>
              <div className={`${c.navLogoBox} bg-[var(--green)]`}></div>
            </div>
            <span className={c.navTitle}>Month-End .SYS</span>
          </div>
          <div className={c.navLinks}>
            <div className={c.navPill}>OCT '23</div>
            <div className={c.navPill}>NOV '23 (ACTIVE)</div>
          </div>
        </nav>

        {/* HERO */}
        <header className={c.hero}>
          <div className={c.heroTopBar}>
            <div className="flex-1 bg-[var(--red)]"></div>
            <div className="flex-1 bg-[var(--yellow)]"></div>
            <div className="flex-1 bg-[var(--green)]"></div>
            <div className="flex-1 bg-[var(--blue)]"></div>
          </div>
          <div className={c.heroSubtitle}>Current Active Run</div>
          <h1 className={c.heroTitle}>
            November Close
            <span aria-hidden="true" className="absolute top-0 left-0 text-[var(--red)] opacity-50 flex" style={{ transform: 'translate(5px, 5px)', zIndex: -1 }}>
              November Close
            </span>
          </h1>
        </header>

        {/* STATS */}
        <section className={c.statRow}>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--red)] text-white`}>Total</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{allTasks.length}</span>
              <span className={c.statLabel}>Tasks</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--yellow)] text-[var(--text)]`}>Done</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{allTasks.filter(t => t.status === "DONE").length}</span>
              <span className={c.statLabel}>Tasks</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--blue)] text-white`}>Blocked</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{allTasks.filter(t => t.status === "BLOCKED").length}</span>
              <span className={c.statLabel}>Flags</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHeader} bg-[var(--green)] text-[var(--text)]`}>Status</div>
            <div className={c.statBody}>
              <span className={c.statNum}>
                 {allTasks.length > 0 ? Math.round((allTasks.filter(t => t.status === "DONE").length / allTasks.length) * 100) : 0}
              </span>
              <span className={c.statLabel}>%</span>
            </div>
          </div>
        </section>

        {/* MAIN LAYOUT */}
        <div className={c.contentGrid}>
          
          <div className={c.mainFeed}>
            {/* TABS */}
            <div className={c.tabs}>
              {["GL", "AP", "AR", "PAYROLL"].map(tab => (
                 <button 
                  key={tab}
                  className={activeTab === tab ? c.tabBtnActive : c.tabBtn} 
                  onClick={() => { setActiveTab(tab); mergeTask({ ledger: tab }); }}
                 >
                   {tab === "GL" ? "General Ledger" : tab === "AP" ? "Accts Payable" : tab === "AR" ? "Accts Receivable" : "Payroll"}
                 </button>
              ))}
            </div>

            {/* TABLE */}
            <div className={c.tableCard}>
              <table className={c.table}>
                <thead>
                  <tr>
                    <th className={c.th}>Ref</th>
                    <th className={c.th}>Task Description</th>
                    <th className={c.th}>Owner</th>
                    <th className={c.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 && (
                    <tr className="group">
                      <td colSpan="4" className={`${c.td} text-center text-[var(--muted)] py-8`}>No checklist items exist for this ledger. Use AI or add one manually.</td>
                    </tr>
                  )}
                  {tasks.map((task) => (
                    <tr key={task._id} className="group">
                      <td className={c.tdMono}>{task._id.slice(0, 5)}</td>
                      <td className={c.td}>{task.description}</td>
                      <td className={c.tdMono}>{task.owner || "UNASSIGNED"}</td>
                      <td className={c.td}>
                        <button 
                          className={`${c.badge} ${task.status === "DONE" ? "bg-[var(--green)] text-[var(--text)]" : task.status === "BLOCKED" ? "bg-[var(--red)] text-white" : "bg-[var(--bg)] text-[var(--text)]"}`} 
                          onClick={(e) => handleToggleStatus(e, task)}
                        >
                          {task.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CONTROLS */}
          <aside className={c.sidePanel}>
            <form className={c.card} onSubmit={handleAddTask}>
              <div className={c.cardTitle}>Add Checklist Item</div>
              <div className={c.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Task Description..." 
                  className={c.input} 
                  value={newTask.description} 
                  onChange={(e) => mergeTask({ description: e.target.value })} 
                />
                <button type="button" className={c.btnAi} onClick={handleAiSuggest} disabled={isAiLoading} title="AI Scaffold">
                   {isAiLoading ? (
                     <svg className="animate-spin h-4 w-4 text-[var(--text)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   ) : (
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                   )}
                </button>
              </div>
              <select className={c.select} value={newTask.ledger} onChange={(e) => mergeTask({ ledger: e.target.value })}>
                <option value="GL">General Ledger</option>
                <option value="AP">Accts Payable</option>
                <option value="AR">Accts Receivable</option>
                <option value="PAYROLL">Payroll</option>
              </select>
              <div className="flex gap-2 w-full mt-2">
                <input 
                  type="text" 
                  placeholder="Owner" 
                  className={c.input} 
                  value={newTask.owner} 
                  onChange={(e) => mergeTask({ owner: e.target.value })} 
                />
                <button type="submit" className={c.btnPrimary}>Add</button>
              </div>
            </form>

            <div className={c.card}>
              <div className={c.cardTitle}>Ledger Sign-Off</div>
              <p className="text-[0.82rem] font-bold">Lock this ledger when all items are marked done.</p>
              <button className={c.btnSecondary}>Sign & Close</button>
            </div>
          </aside>

        </div>
      </main>
    </div>
  )
}