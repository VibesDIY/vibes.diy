import React, { useState } from "react";
import { callAI } from "call-ai";
import { ImgVibes } from "img-vibes";
import { useFireproof } from "use-fireproof";

export default function App() {
  // --- HOOKS ---
  const { useLiveQuery, useDocument, database } = useFireproof("board-dossier");
  const { docs: exhibits } = useLiveQuery("type", { key: "exhibit", descending: false });
  const { doc: newExhibit, merge: mergeExhibit, submit: submitExhibit } = useDocument({
    type: "exhibit", title: "", duration: "15m", points: "", read: false, createdAt: Date.now()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // --- STATS DATA ---
  const meetingDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // --- HANDLERS ---
  const handleToggleForm = () => {
    setShowForm((prev) => !prev);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    submitExhibit();
    setShowForm(false);
  };

  const handleSuggest = async () => {
    setIsLoading(true);
    try {
      const resp = await callAI("Suggest 1 critical board meeting agenda item for an operational sync. It should be serious corporate tone.", {
        schema: {
          properties: {
            title: { type: "string", description: "Short punchy uppercase title" },
            duration: { type: "string", description: "Time e.g. 15m, 20m" },
            points: { type: "string", description: "2-3 short sentences on what to cover." }
          }
        }
      });
      const data = JSON.parse(resp);
      mergeExhibit(data);
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRead = (id) => {
    const doc = exhibits.find(d => d._id === id);
    if(doc) database.put({ ...doc, read: !doc.read });
  };

  // --- CLASSNAMES ---
  const c = {
    app: "min-h-screen p-4 md:p-12 flex flex-col items-center overflow-x-hidden text-[var(--text)]",
    ambient: "fixed inset-0 pointer-events-none z-[-1]",
    layout: "w-full max-w-[920px] relative z-10 flex flex-col gap-8",
    nav: "flex flex-col md:flex-row items-center justify-between p-4 bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[var(--shadow)]",
    logo: "flex items-center gap-2",
    navDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px] border-[var(--border)]",
    navBrand: "font-bold text-lg uppercase tracking-widest",
    navLinks: "flex gap-4 mt-4 md:mt-0",
    navLink: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] px-3 py-1 text-xs uppercase font-bold text-center shadow-[3px_3px_0px_var(--border)] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    hero: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] p-8 pb-12 relative flex flex-col items-center text-center shadow-[var(--shadow)]",
    heroAccentBar: "absolute top-0 left-0 right-0 flex h-[6px] border-b-[3px] border-[var(--border)]",
    accentRed: "flex-1 bg-[var(--red)] border-r-[3px] border-[var(--border)]",
    accentYellow: "flex-1 bg-[var(--yellow)] border-r-[3px] border-[var(--border)]",
    accentGreen: "flex-1 bg-[var(--green)] border-r-[3px] border-[var(--border)]",
    accentBlue: "flex-1 bg-[var(--blue)]",
    heroTitle: "text-4xl md:text-6xl font-bold uppercase mt-8 tracking-tighter relative z-10",
    heroDate: "mt-4 text-sm uppercase tracking-widest font-mono text-[var(--muted)]",
    statsList: "grid grid-cols-2 md:grid-cols-4 gap-4",
    statCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[var(--shadow-sm)] flex flex-col hover:-translate-y-1 transition-transform",
    statRed: "bg-[var(--red)] text-white border-b-[3px] border-[var(--border)] p-2 text-xs uppercase font-bold text-center",
    statYellow: "bg-[var(--yellow)] text-[var(--text)] border-b-[3px] border-[var(--border)] p-2 text-xs uppercase font-bold text-center",
    statBlue: "bg-[var(--blue)] text-white border-b-[3px] border-[var(--border)] p-2 text-xs uppercase font-bold text-center",
    statGreen: "bg-[var(--green)] text-[var(--text)] border-b-[3px] border-[var(--border)] p-2 text-xs uppercase font-bold text-center",
    statBody: "p-4 flex flex-col items-center justify-center",
    statNum: "text-3xl font-mono font-bold",
    statLabel: "text-[10px] uppercase font-bold tracking-widest mt-1 text-center text-[var(--muted)]",
    sectionHeader: "flex justify-between items-end mb-4 border-b-[3px] border-[var(--border)] pb-2",
    sectionTitle: "text-sm uppercase tracking-[0.15em] font-bold text-[var(--muted)]",
    formCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-4 mb-8 shadow-[var(--shadow)] relative z-20",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-4",
    field: "flex flex-col gap-2",
    labelBlock: "flex justify-between items-center",
    label: "text-[10px] uppercase font-bold tracking-widest text-[var(--muted)]",
    input: "bg-white border-[3px] border-[var(--border)] rounded-[4px] p-3 text-sm font-mono focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0px_var(--border)] transition-transform",
    textarea: "bg-white border-[3px] border-[var(--border)] rounded-[4px] p-3 text-sm font-mono min-h-[140px] focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0px_var(--border)] transition-transform",
    formActions: "flex items-center justify-end gap-4 mt-6",
    btnPrimary: "bg-[var(--red)] text-white border-[3px] border-[var(--border)] rounded-[4px] px-6 py-3 text-xs uppercase font-bold tracking-widest shadow-[var(--shadow-scale,4px_4px_0px_var(--border))] hover:shadow-[var(--shadow-hover)] hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnSecondary: "bg-[var(--yellow)] text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] px-4 py-3 text-xs uppercase font-bold tracking-widest shadow-[3px_3px_0px_var(--border)] hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnSuggest: "bg-[var(--card-bg)] text-[var(--blue)] border-[2px] border-dashed border-[var(--blue)] rounded-[4px] px-2 py-1 text-[10px] uppercase font-bold flex items-center gap-2 hover:bg-[var(--blue)] hover:text-white transition-colors",
    exhibitsList: "flex flex-col gap-8",
    exhibitCard: "bg-[var(--card-bg)] border-[3px] border-[var(--border)] rounded-[4px] shadow-[var(--shadow)] flex flex-col relative overflow-hidden group hover:shadow-[var(--shadow-hover)] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all",
    exhibitHeader: "bg-[var(--text)] text-white border-b-[3px] border-[var(--border)] px-4 py-3 flex justify-between items-center text-xs font-bold uppercase tracking-widest",
    exhibitBody: "p-6 md:p-8 flex flex-col gap-4",
    exhibitTitle: "text-2xl md:text-3xl font-bold uppercase tracking-tight relative",
    exhibitMeta: "flex gap-4 font-mono text-sm border-b-[3px] border-[var(--border)] pb-4 text-[var(--muted)]",
    exhibitPoints: "text-[15px] leading-relaxed whitespace-pre-wrap font-mono mt-2",
    exhibitFooter: "mt-6 pt-6 border-t-[3px] border-[var(--border)] flex justify-end items-center",
    btnCheck: "bg-white text-[var(--text)] border-[3px] border-[var(--border)] rounded-[4px] px-8 py-3 text-xs uppercase font-bold tracking-widest shadow-[3px_3px_0px_var(--border)] hover:-translate-x-[2px] hover:-translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer",
    btnChecked: "bg-[var(--green)] text-white border-[3px] border-[var(--border)] rounded-[4px] px-8 py-3 text-xs uppercase font-bold tracking-[0.05em] shadow-[inset_4px_4px_0px_rgba(0,0,0,0.1)] translate-x-[2px] translate-y-[2px] transition-all cursor-pointer"
  };

  // --- RENDER ---
  return (
    <div id="wrapper">
      {/* --- STYLE --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
        :root {
          --bg: oklch(0.96 0.01 90); --card-bg: oklch(1.00 0 0);
          --text: oklch(0.15 0.02 280); --border: oklch(0.15 0.02 280);
          --muted: oklch(0.50 0.02 280); --red: oklch(0.55 0.24 28);
          --yellow: oklch(0.85 0.18 85); --green: oklch(0.62 0.19 145);
          --blue: oklch(0.52 0.18 255);
          --shadow: 4px 4px 0px var(--border);
          --shadow-hover: 6px 6px 0px var(--border);
        }
        body { background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .bg-grid { background-image: linear-gradient(to right, oklch(0.15 0.02 280 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.05) 1px, transparent 1px); background-size: 60px 60px; }
        @keyframes drift { 0% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } 100% { transform: translateY(0px) rotate(0deg); } }
        .float-block { opacity: 0.2; animation: drift 8s ease-in-out infinite; border: 3px solid var(--border); }
        .shape-red { background: var(--red); box-shadow: 2px 2px 0px var(--border); }
        .shape-yellow { background: var(--yellow); box-shadow: 2px 2px 0px var(--border); }
        .shape-blue { background: var(--blue); box-shadow: 2px 2px 0px var(--border); animation-delay: 2s; }
      `}</style>
      <div className={c.ambient}>
        <div className="bg-grid absolute inset-0"></div>
        <div className="float-block shape-red float-1 w-12 h-12 rounded-full absolute top-10 left-[10%]"></div>
        <div className="float-block shape-yellow float-2 w-8 h-8 absolute top-[40%] right-[10%]"></div>
        <div className="float-block shape-blue float-3 w-16 h-16 rounded-full absolute bottom-20 left-[20%]"></div>
      </div>

      <div className={c.app}>
        <div className={c.layout}>
          <header className={c.nav}>
            <div className={c.logo}>
              <div className={c.navDots}>
                <div className={`${c.dot} bg-[var(--red)]`}></div>
                <div className={`${c.dot} bg-[var(--yellow)]`}></div>
                <div className={`${c.dot} bg-[var(--green)]`}></div>
              </div>
              <span className={c.navBrand}>BOARD DOSSIER</span>
            </div>
            <div className={c.navLinks}>
              <button className={c.navLink}>ARCHIVE</button>
              <button className={c.navLink}>SETTINGS</button>
            </div>
          </header>

          <main>
            <section className={c.hero}>
              <div className={c.heroAccentBar}>
                <div className={c.accentRed}></div>
                <div className={c.accentYellow}></div>
                <div className={c.accentGreen}></div>
                <div className={c.accentBlue}></div>
              </div>
              <h2 className={c.heroTitle}>
                <span className="relative z-10">Q3 BOARD SYNC</span>
                <span className="absolute top-[5px] left-[5px] text-[var(--red)] opacity-50 z-[-1]" aria-hidden="true">Q3 BOARD SYNC</span>
              </h2>
              <p className={c.heroDate}>{meetingDate}</p>
            </section>

            <section className="mt-8">
              <div className={c.statsList}>
                <div className={c.statCard}>
                  <div className={c.statRed}>STATUS</div>
                  <div className={c.statBody}>
                    <div className={c.statNum}>LIVE</div>
                    <div className={c.statLabel}>Session Active</div>
                  </div>
                </div>
                <div className={c.statCard}>
                  <div className={c.statYellow}>EXHIBITS</div>
                  <div className={c.statBody}>
                    <div className={c.statNum}>{exhibits.length}</div>
                    <div className={c.statLabel}>Prepared Items</div>
                  </div>
                </div>
                <div className={c.statCard}>
                  <div className={c.statBlue}>REMAINING</div>
                  <div className={c.statBody}>
                    <div className={c.statNum}>{exhibits.filter(e => !e.read).length}</div>
                    <div className={c.statLabel}>Pending Review</div>
                  </div>
                </div>
                <div className={c.statCard}>
                  <div className={c.statGreen}>COMPLETED</div>
                  <div className={c.statBody}>
                    <div className={c.statNum}>{exhibits.filter(e => e.read).length}</div>
                    <div className={c.statLabel}>Checked Off</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-12">
              <div className={c.sectionHeader}>
                <h3 className={c.sectionTitle}>AGENDA MATERIALS</h3>
                <button onClick={handleToggleForm} className={c.btnSecondary}>
                  {showForm ? 'CANCEL' : '+ ADD ITEM'}
                </button>
              </div>

              {showForm && (
                <form onSubmit={handleAddSubmit} className={c.formCard}>
                  <div className={c.formGrid}>
                    <div className={c.field}>
                      <label className={c.label}>Title</label>
                      <input type="text" className={c.input} placeholder="E.G. Q3 REVENUE" value={newExhibit.title} onChange={(e) => mergeExhibit({ title: e.target.value })} required />
                    </div>
                    <div className={c.field}>
                      <label className={c.label}>Duration</label>
                      <input type="text" className={c.input} placeholder="15m" value={newExhibit.duration} onChange={(e) => mergeExhibit({ duration: e.target.value })} />
                    </div>
                  </div>
                  <div className={c.field}>
                    <div className={c.labelBlock}>
                      <label className={c.label}>Talking Points</label>
                      <button type="button" onClick={handleSuggest} className={c.btnSuggest} disabled={isLoading}>
                        {isLoading ? (
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                             <circle cx="12" cy="12" r="10" stroke="currentColor" border="transparent" strokeWidth="3" className="opacity-80" strokeDasharray="16 16"/>
                          </svg>
                        ) : '✨ AI SUGGEST'}
                      </button>
                    </div>
                    <textarea className={c.textarea} placeholder="Key items to discuss..." value={newExhibit.points} onChange={(e) => mergeExhibit({ points: e.target.value })}></textarea>
                  </div>
                  <div className={c.formActions}>
                    <button type="submit" className={c.btnPrimary}>SAVE EXHIBIT</button>
                  </div>
                </form>
              )}

              <div className={c.exhibitsList}>
                {exhibits.length === 0 ? (
                  <div className="p-8 text-center text-sm font-mono uppercase opacity-50 border border-dashed rounded">No items added yet.</div>
                ) : (
                  exhibits.map((item, idx) => (
                    <article key={item._id} className={c.exhibitCard}>
                      <header className={c.exhibitHeader}>
                        <span>EXHIBIT 0{idx + 1}</span>
                        {item.read && <span>[ READ ]</span>}
                      </header>
                      <div className={c.exhibitBody}>
                        <h4 className={c.exhibitTitle}>{item.title}</h4>
                        <div className={c.exhibitMeta}>
                          <span>⏱ {item.duration}</span>
                        </div>
                        <p className={c.exhibitPoints}>{item.points}</p>
                        <footer className={c.exhibitFooter}>
                          <button onClick={() => handleToggleRead(item._id)} className={item.read ? c.btnChecked : c.btnCheck}>
                            {item.read ? 'MARK UNREAD' : 'MARK READ'}
                          </button>
                        </footer>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}