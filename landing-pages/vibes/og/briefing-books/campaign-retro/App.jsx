import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // HOOKS
  const [view, setView] = React.useState('list');
  const [currentId, setCurrentId] = React.useState(null);
  const [filter, setFilter] = React.useState('active');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const { useLiveQuery, useDocument, database } = useFireproof("campaign-retros");
  
  const { doc: retroDoc, merge: mergeRetro, submit: submitRetro, reset: resetRetro } = useDocument({
    type: 'retro',
    name: '',
    owner: '',
    goal: '',
    worked: '',
    didNtWork: '',
    createdAt: Date.now()
  });

  const { doc: noteDoc, merge: mergeNote, submit: submitNote, reset: resetNote } = useDocument({
    type: 'note',
    retroId: '',
    content: '',
    author: '',
    createdAt: Date.now()
  });

  const { docs: retros } = useLiveQuery('type', { key: 'retro', descending: true });
  const { docs: notes } = useLiveQuery('type', { key: 'note', descending: true });
  
  // HANDLERS
  function handleNav(dest, filterDest = 'active', id = null) {
    setView(dest);
    setFilter(filterDest);
    setCurrentId(id);
  }
  function handleCreate(e) { 
    e.preventDefault(); 
    if (!retroDoc.name.trim()) return;
    submitRetro();
    handleNav('list');
  }
  
  function handleAddNote(e) { 
    e.preventDefault(); 
    if (!noteDoc.content.trim()) return;
    mergeNote({ retroId: currentId, createdAt: Date.now() });
    submitNote();
    resetNote();
  }
  async function generateSuggestion() {
    setIsGenerating(true);
    try {
      const prompt = `Generate a realistic but brief marketing retrospective. Campaign name: ${retroDoc.name || 'Autumn Push'}. We need a short 'goal', 1 thing that 'worked', and 1 thing that 'did not work'. No markdown.`;
      const response = await callAI(prompt, {
        schema: {
          properties: {
            goal: { type: "string" },
            worked: { type: "string" },
            didNtWork: { type: "string" }
          }
        }
      });
      const data = JSON.parse(response);
      mergeRetro({ 
        goal: data.goal, 
        worked: data.worked, 
        didNtWork: data.didNtWork 
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }
  
  // CLASSNAMES
  const c = {
    app: "min-h-screen relative p-4 md:p-12 flex flex-col items-center bg-[var(--bg)] text-[var(--text)]",
    ambient: "fixed inset-0 pointer-events-none z-0",
    layout: "w-full max-w-[920px] mx-auto flex flex-col gap-8 z-10 relative",
    
    // Nav 
    nav: "flex flex-col md:flex-row justify-between items-center p-4 rounded bg-[var(--card-bg)] border-[3px] border-[var(--border)] shadow-[4px_4px_0px_var(--border)]",
    logo: "flex gap-2 items-center font-bold text-lg uppercase tracking-wider",
    logoBlocks: "flex gap-1",
    logoBlock: "w-3 h-3 block border-[3px] border-[var(--border)]",
    navLinks: "flex gap-2 mt-4 md:mt-0",
    navChip: "px-4 py-2 rounded text-[0.7rem] font-bold uppercase tracking-wider cursor-pointer border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[3px_3px_0px_var(--border)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_var(--border)] hover:bg-[var(--yellow)] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    
    // Hero
    hero: "flex flex-col p-8 md:p-12 rounded relative overflow-hidden border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[8px_8px_0px_var(--border)]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex border-b-[3px] border-[var(--border)]",
    heroBarSeg: "flex-1",
    title: "text-4xl md:text-5xl font-bold uppercase tracking-[-0.02em] relative",
    titleShadow: "absolute top-[5px] left-[5px] pointer-events-none text-[var(--red)] opacity-50 z-[-1]",
    
    // Sections
    section: "flex flex-col gap-4",
    sectionLabel: "text-[0.65rem] uppercase tracking-[0.15em] mb-2 text-[var(--muted)] font-bold",
    
    // Cards & Forms
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-6",
    card: "p-6 rounded border-[3px] border-[var(--border)] bg-[var(--card-bg)] flex flex-col gap-6 shadow-[4px_4px_0px_var(--border)]",
    cardHeader: "p-2 font-bold uppercase text-[0.65rem] tracking-wider mb-2 -mx-6 -mt-6 rounded-t border-b-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--text)] text-center",
    formRow: "flex flex-col gap-2",
    label: "text-[0.65rem] font-bold uppercase tracking-wider",
    input: "p-3 rounded text-[0.82rem] w-full border-[3px] border-[var(--border)] font-mono bg-[var(--card-bg)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_var(--border)] focus:outline-none focus:bg-[var(--yellow)] transition-all",
    textarea: "p-3 rounded text-[0.82rem] w-full min-h-[120px] border-[3px] border-[var(--border)] font-mono bg-[var(--card-bg)] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0px_var(--border)] focus:outline-none focus:bg-[var(--yellow)] transition-all",
    
    // Actions
    actions: "flex gap-4 items-center pt-4 flex-wrap",
    btnPrimary: "px-6 py-3 rounded font-bold uppercase text-[0.75rem] tracking-wider cursor-pointer border-[3px] border-[var(--border)] bg-[var(--red)] text-white shadow-[4px_4px_0px_var(--border)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_var(--border)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none",
    btnSecondary: "px-6 py-3 rounded font-bold uppercase text-[0.75rem] tracking-wider cursor-pointer border-[3px] border-[var(--border)] bg-[var(--yellow)] text-[var(--text)] shadow-[4px_4px_0px_var(--border)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_var(--border)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none",
    btnGhost: "px-6 py-3 rounded font-bold uppercase text-[0.75rem] tracking-wider cursor-pointer border-[3px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] shadow-none hover:shadow-[3px_3px_0px_var(--border)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[var(--bg)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none",
    btnAi: "px-3 py-1.5 rounded text-[0.65rem] uppercase font-bold tracking-wider cursor-pointer flex gap-1 items-center self-start border-[3px] border-[var(--border)] bg-[var(--blue)] text-white shadow-[3px_3px_0px_var(--border)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_var(--border)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none",
    
    // Lists
    list: "flex flex-col gap-4",
    listItem: "p-4 flex flex-col md:flex-row gap-4 border-[3px] border-[var(--border)] rounded md:items-center justify-between bg-[var(--card-bg)] shadow-[3px_3px_0px_var(--border)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_var(--border)] transition-all cursor-pointer",
    itemMono: "text-[1rem] font-bold uppercase font-mono",
    itemBadge: "px-2 py-1 rounded text-[0.6rem] uppercase tracking-wider border-[2px] border-[var(--border)] font-bold bg-[var(--card-bg)]",
    
    // Table
    tableCard: "rounded p-4 border-[3px] border-[var(--border)] bg-[var(--card-bg)] shadow-[4px_4px_0px_var(--border)] overflow-x-auto",
    table: "w-full text-left border-collapse",
    th: "text-[0.6rem] uppercase p-2 border-b-[3px] border-[var(--border)] font-bold tracking-wider text-[var(--muted)]",
    td: "text-[0.82rem] p-2 border-b-[2px] border-dashed border-[var(--muted)] font-mono hover:bg-[var(--yellow)] transition-colors cursor-pointer group-hover:bg-[var(--yellow)]",
    
    // Tags
    tagRow: "flex gap-2 flex-wrap mt-2",
    tag: "px-2 py-1 text-[0.6rem] rounded uppercase font-bold border",
  };

  return (
    <div className={c.app}>
      <style dangerouslySetInnerHTML={{__html: `
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
          --accent-light: oklch(0.55 0.24 28 / 0.1);
          --radius: 4px;
        }

        body {
          font-family: 'Space Grotesk', sans-serif;
          background-color: var(--bg);
          color: var(--text);
        }

        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }
      `}} />
      
      <div className={c.ambient}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.04
        }}></div>
      </div>

      <div className={c.layout}>
        {/* NAV */}
        <nav className={c.nav}>
          <div className={c.logo}>
            <div className={c.logoBlocks}>
              <span className={`${c.logoBlock} bg-[var(--red)]`}></span>
              <span className={`${c.logoBlock} bg-[var(--yellow)]`}></span>
              <span className={`${c.logoBlock} bg-[var(--green)]`}></span>
            </div>
            <span>CampRetro</span>
          </div>
          <div className={c.navLinks}>
            <button className={`${c.navChip} ${view === 'list' && filter === 'active' ? 'bg-[var(--yellow)] shadow-[5px_5px_0px_var(--border)] -translate-x-0.5 -translate-y-0.5' : ''}`} onClick={() => handleNav('list', 'active')}>Active View</button>
            <button className={`${c.navChip} ${view === 'list' && filter === 'archive' ? 'bg-[var(--yellow)] shadow-[5px_5px_0px_var(--border)] -translate-x-0.5 -translate-y-0.5' : ''}`} onClick={() => handleNav('list', 'archive')}>Archive Log</button>
            <button className={`${c.navChip} ${view === 'create' ? 'bg-[var(--yellow)] shadow-[5px_5px_0px_var(--border)] -translate-x-0.5 -translate-y-0.5' : ''}`} onClick={() => { resetRetro(); handleNav('create'); }}>New Retro</button>
          </div>
        </nav>

        {/* HERO */}
        <header className={c.hero}>
          <div className={c.heroBar}>
            <div className={`${c.heroBarSeg} bg-[var(--red)]`}></div>
            <div className={`${c.heroBarSeg} bg-[var(--yellow)]`}></div>
            <div className={`${c.heroBarSeg} bg-[var(--green)]`}></div>
            <div className={`${c.heroBarSeg} bg-[var(--blue)]`}></div>
          </div>
          <h1 className={c.title}>
            Campaign Dossier
            <span className={c.titleShadow} aria-hidden="true">Campaign Dossier</span>
          </h1>
        </header>

        {/* LIST VIEW */}
        {view === 'list' && (
          <section id="retro-list" className={c.section}>
             <h2 className={c.sectionLabel}>{filter === 'active' ? 'Exhibit 01: Active Dossiers' : 'Exhibit 02: Archive Log'}</h2>
             
             {retros.filter(r => {
                const daysOld = (Date.now() - r.createdAt) / (1000 * 60 * 60 * 24);
                return filter === 'active' ? daysOld <= 90 : daysOld > 90;
             }).length === 0 ? (
               <div className={c.card}>
                 <p className="font-mono text-sm text-[var(--muted)] text-center">No dossiers found in this sector.</p>
               </div>
             ) : (
               <div className={c.tableCard}>
                 <table className={c.table}>
                   <thead>
                     <tr>
                       <th className={c.th}>Campaign</th>
                       <th className={c.th}>Owner</th>
                       <th className={c.th}>Days Left</th>
                       <th className={c.th}>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {retros.map(retro => {
                       const daysOld = Math.floor((Date.now() - retro.createdAt) / (1000 * 60 * 60 * 24));
                       const daysLeft = 90 - daysOld;
                       const isActive = daysLeft >= 0;
                       
                       // Apply filter logic
                       if ((filter === 'active' && !isActive) || (filter === 'archive' && isActive)) return null;

                       return (
                         <tr key={retro._id} className="group" onClick={() => handleNav('detail', filter, retro._id)}>
                           <td className={c.td}>{retro.name}</td>
                           <td className={c.td}>{retro.owner || '—'}</td>
                           <td className={c.td}>{isActive ? daysLeft : '—'}</td>
                           <td className={c.td}>
                             <span className={`${c.itemBadge} ${isActive ? 'bg-[var(--green)] text-[var(--text)]' : 'bg-[var(--muted)] text-white'}`}>
                               {isActive ? 'Active' : 'Archived'}
                             </span>
                           </td>
                         </tr>
                       )
                     })}
                   </tbody>
                 </table>
               </div>
             )}
          </section>
        )}

        {/* FORM VIEW (create retro) */}
        {view === 'create' && (
          <section id="retro-create" className={c.section}>
            <h2 className={c.sectionLabel}>Exhibit 03: New Briefing</h2>
            <form className={c.card} onSubmit={handleCreate}>
               <div className={c.cardHeader}>Briefing Info</div>
               
               <div className={c.grid2}>
                  <div className={c.formRow}>
                    <label className={c.label}>Campaign Name *</label>
                    <input className={c.input} placeholder="Project Phoenix" value={retroDoc.name} onChange={e => mergeRetro({name: e.target.value})} required autoFocus />
                  </div>
                  <div className={c.formRow}>
                    <label className={c.label}>Owner</label>
                    <input className={c.input} placeholder="Leader Name" value={retroDoc.owner} onChange={e => mergeRetro({owner: e.target.value})} />
                  </div>
               </div>
               
               <div className={c.formRow}>
                 <label className={c.label}>Goal & Strategy</label>
                 <textarea className={c.textarea} placeholder="What was the intended outcome?" value={retroDoc.goal} onChange={e => mergeRetro({goal: e.target.value})}></textarea>
               </div>
               
               <div className={c.grid2}>
                 <div className={c.formRow}>
                   <label className={c.label}>What Worked</label>
                   <textarea className={c.textarea} placeholder="Wins and positive signals" value={retroDoc.worked} onChange={e => mergeRetro({worked: e.target.value})}></textarea>
                 </div>
                 <div className={c.formRow}>
                   <label className={c.label}>What Didn't Work</label>
                   <textarea className={c.textarea} placeholder="Misses and bottlenecks" value={retroDoc.didNtWork} onChange={e => mergeRetro({didNtWork: e.target.value})}></textarea>
                 </div>
               </div>

               <button type="button" className={c.btnAi} onClick={generateSuggestion} disabled={isGenerating}>
                 {isGenerating ? (
                   <svg className="animate-spin h-3 w-3 mr-1 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 ) : (
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                 )}
                 {isGenerating ? 'Drafting...' : 'Autofill Suggestion'}
               </button>
               
               <div className={c.actions}>
                 <button type="submit" className={c.btnPrimary}>Save Dossier</button>
                 <button type="button" className={c.btnGhost} onClick={() => handleNav('list')}>Cancel</button>
               </div>
            </form>
          </section>
        )}


        {/* DETAIL VIEW */}
        {view === 'detail' && currentId && (
          <section id="retro-detail" className={c.section}>
            <div className="flex justify-between items-center mb-2">
              <h2 className={c.sectionLabel}>Exhibit 04: Inspection</h2>
              <button className="text-[10px] uppercase font-bold tracking-wider hover:underline" onClick={() => handleNav('list', filter)}>← Back</button>
            </div>
            
            {retros.filter(r => r._id === currentId).map(retro => (
               <div key={retro._id} className={c.card}>
                  <div className={c.cardHeader} style={{backgroundColor: 'var(--blue)', color: 'white'}}>Dossier File: {retro.name}</div>
                  
                  <div className={c.grid2}>
                     <div className={c.formRow}>
                       <span className={c.label}>Owner</span>
                       <span className="font-mono text-sm">{retro.owner || "Unassigned"}</span>
                     </div>
                     <div className={c.formRow}>
                       <span className={c.label}>Filed Date</span>
                       <span className="font-mono text-sm">{new Date(retro.createdAt).toLocaleDateString()}</span>
                     </div>
                  </div>

                  {retro.goal && (
                    <div className={c.formRow}>
                      <span className={c.label}>Goal & Strategy</span>
                      <p className="font-mono text-sm p-4 border-[2px] border-dashed border-[var(--muted)] rounded whitespace-pre-wrap">{retro.goal}</p>
                    </div>
                  )}

                  <div className={c.grid2}>
                    {retro.worked && (
                      <div className={c.formRow}>
                        <span className={c.label}>What Worked (+)</span>
                        <p className="font-mono text-sm p-3 border-[2px] border-[var(--border)] bg-[var(--green)] text-white rounded whitespace-pre-wrap shadow-[3px_3px_0_var(--border)]">{retro.worked}</p>
                      </div>
                    )}
                    {retro.didNtWork && (
                      <div className={c.formRow}>
                        <span className={c.label}>What Didn't Work (-)</span>
                        <p className="font-mono text-sm p-3 border-[2px] border-[var(--border)] bg-[var(--red)] text-white rounded whitespace-pre-wrap shadow-[3px_3px_0_var(--border)]">{retro.didNtWork}</p>
                      </div>
                    )}
                  </div>
               </div>
            ))}

            <h2 className={c.sectionLabel} style={{marginTop: '2rem'}}>Exhibit 05: Field Notes</h2>
            <div className={c.list}>
              {notes.filter(n => n.retroId === currentId).map(n => (
                <div key={n._id} className={c.listItem}>
                  <div className="flex flex-col gap-2 w-full">
                    <p className="font-mono text-sm">{n.content}</p>
                    <div className="flex gap-2 items-center text-[0.6rem] uppercase tracking-wider text-[var(--muted)] font-bold mt-2">
                       <span>{n.author || 'Anonymous'}</span>
                       <span>•</span>
                       <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
              {notes.filter(n => n.retroId === currentId).length === 0 && (
                <p className="text-sm font-mono text-[var(--muted)] italic">No field notes appended yet.</p>
              )}
            </div>

            <form className={`${c.card} mt-4`} style={{backgroundColor: 'var(--bg)'}} onSubmit={handleAddNote}>
              <div className={c.formRow}>
                 <label className={c.label}>Append Note</label>
                 <textarea className={c.textarea} placeholder="Submit your observations..." value={noteDoc.content} onChange={e => mergeNote({content: e.target.value})} required></textarea>
              </div>
              <div className="flex gap-4 items-center">
                 <div className={`${c.formRow} flex-1`}>
                    <input className={`${c.input} py-2`} placeholder="Name/Handle (Optional)" value={noteDoc.author} onChange={e => mergeNote({author: e.target.value})} />
                 </div>
                 <button type="submit" className={`${c.btnSecondary} py-2 mt-0 self-end`}>Submit</button>
              </div>
            </form>
          </section>
        )}

      </div>
    </div>
  )
}