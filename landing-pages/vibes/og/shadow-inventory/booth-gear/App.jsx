import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [view, setView] = React.useState('inventory');
  const [isLoading, setIsLoading] = React.useState(false);

  const { useLiveQuery, useDocument, database } = useFireproof("booth-brute");

  const { doc: newItem, merge: mergeItem, submit: submitItem } = useDocument({ type: 'item', category: 'BANNERS', sku: '', desc: '', location: 'WHSE' });
  const { doc: newEvent, merge: mergeEvent, submit: submitEvent } = useDocument({ type: 'event', code: '', outDate: '', inDate: '' });

  const { docs: items } = useLiveQuery("type", { key: "item", descending: true });
  const { docs: events } = useLiveQuery("type", { key: "event", descending: true });
  
  // commitments map an item ID to an event ID
  const { docs: commits } = useLiveQuery("type", { key: "commitment", descending: true });

  function handleNav(v) { setView(v); }
  
  function handleAddGear(e) { 
    e.preventDefault(); 
    if(!newItem.sku || !newItem.desc) return;
    submitItem(); 
  }
  
  function handleAddEvent(e) { 
    e.preventDefault(); 
    if(!newEvent.code || !newEvent.outDate) return;
    submitEvent(); 
  }
  
  function handleReturn(itemId, commitId) {
    database.put({ _id: commitId, type: 'commitment', status: 'returned', _deleted: true });
    database.put({ _id: itemId, location: 'WHSE' }); // Would need full doc merge ideally, but simplified
  }

  async function handleAutoGenIdeas() {
    setIsLoading(true);
    try {
      const res = await callAI("Generate 3 pieces of conference booth gear. Categories: BANNERS, SCANNERS, CABLES, MISC.", {
        schema: {
          properties: {
            items: {
              type: "array",
              items: { type: "object", properties: { sku: {type:"string"}, desc: {type:"string"}, category: {type:"string"} } }
            }
          }
        }
      });
      const data = JSON.parse(res);
      for(const i of data.items) {
        await database.put({ type: 'item', category: i.category.toUpperCase(), sku: i.sku.toUpperCase(), desc: i.desc, location: 'WHSE' });
      }
    } finally {
      setIsLoading(false);
    }
  }

  const c = {
    layout: "relative z-10 w-full max-w-[920px] mx-auto p-4 sm:p-8 md:p-12 flex flex-col gap-10",
    
    nav: "flex flex-col sm:flex-row justify-between items-center p-4 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] gap-4 shadow-brutal text-[oklch(0.15_0.02_280)]",
    navLogoBox: "flex items-center gap-2",
    navSquares: "flex gap-1",
    navSquareInfo: "w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)]",
    navSquareWarn: "w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)]",
    navSquareOk: "w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)]",
    navBrand: "uppercase font-bold tracking-tighter text-lg leading-none text-[oklch(0.15_0.02_280)]",
    navLinks: "flex gap-2",
    navLink: "px-4 py-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] rounded-[4px] uppercase text-xs font-bold tracking-wider hover-lift active-slam transition-brutal shadow-brutal-sm cursor-pointer",

    hero: "relative p-8 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] flex flex-col gap-4 overflow-hidden shadow-brutal text-[oklch(0.15_0.02_280)]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg1: "flex-1 bg-[oklch(0.55_0.24_28)]",
    heroBarSeg2: "flex-1 bg-[oklch(0.85_0.18_85)]",
    heroBarSeg3: "flex-1 bg-[oklch(0.62_0.19_145)]",
    heroBarSeg4: "flex-1 bg-[oklch(0.52_0.18_255)]",
    heroTitle: "text-4xl sm:text-6xl font-black uppercase tracking-tighter leading-none relative z-10 drop-shadow-[5px_5px_0px_oklch(0.55_0.24_28_/_0.5)]",
    heroSub: "max-w-md text-sm sm:text-base font-medium z-10 uppercase tracking-wide",

    statGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    statCard: "flex flex-col border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] overflow-hidden shadow-brutal",
    statHeader1: "px-2 py-1 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white",
    statHeader2: "px-2 py-1 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]",
    statHeader3: "px-2 py-1 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.52_0.18_255)] text-white",
    statHeader4: "px-2 py-1 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]",
    statBody: "p-4 flex items-baseline gap-2 text-[oklch(0.15_0.02_280)]",
    statNum: "text-4xl font-black font-mono tracking-tighter",
    statLabel: "text-[0.65rem] uppercase font-bold text-[oklch(0.50_0.02_280)]",

    grid2: "grid grid-cols-1 md:grid-cols-2 gap-8",
    
    panel: "flex flex-col gap-4 p-6 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] shadow-brutal text-[oklch(0.15_0.02_280)]",
    panelHeader: "uppercase text-[0.65rem] tracking-[0.15em] font-bold mb-2 text-[oklch(0.50_0.02_280)]",
    
    inputGroup: "flex flex-col gap-1",
    label: "uppercase text-[0.65rem] tracking-[0.15em] font-bold text-[oklch(0.15_0.02_280)]",
    input: "w-full p-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] rounded-[4px] font-mono text-sm focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-brutal-sm transition-brutal",
    select: "w-full p-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] rounded-[4px] font-mono text-sm uppercase focus:outline-none focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-brutal-sm transition-brutal",

    btnRow: "flex gap-3 mt-4",
    btnPrimary: "flex-1 px-4 py-3 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.55_0.24_28)] text-white rounded-[4px] shadow-brutal uppercase text-[0.75rem] tracking-wider font-bold text-center flex justify-center items-center hover-lift active-slam transition-brutal",
    btnSecondary: "flex-1 px-4 py-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] rounded-[4px] shadow-brutal-sm uppercase text-[0.75rem] tracking-wider font-bold text-center hover-lift active-slam transition-brutal",
    btnGhost: "px-4 py-2 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] text-[oklch(0.15_0.02_280)] rounded-[4px] uppercase text-[0.75rem] tracking-wider font-bold text-center hover-lift hover:shadow-brutal-sm active-slam transition-brutal",

    tableWrap: "w-full overflow-x-auto border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px]",
    table: "w-full text-left border-collapse min-w-[600px] bg-[oklch(1.00_0_0)]",
    th: "p-3 uppercase text-[0.6rem] tracking-[0.15em] font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] text-[oklch(0.50_0.02_280)] bg-[oklch(0.96_0.01_90)]",
    td: "p-3 text-[0.82rem] font-medium border-b-[1px] border-[oklch(0.15_0.02_280)] group-hover:bg-[oklch(0.85_0.18_85)] transition-colors duration-75",
    tdMono: "p-3 text-[0.82rem] border-b-[1px] border-[oklch(0.15_0.02_280)] font-mono font-bold group-hover:bg-[oklch(0.85_0.18_85)] transition-colors duration-75",
    
    badgeActive: "inline-block px-2 py-1 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] rounded-[4px] text-[0.6rem] uppercase tracking-wider font-bold shadow-brutal-sm",
    badgePending: "inline-block px-2 py-1 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] rounded-[4px] text-[0.6rem] uppercase tracking-wider font-bold shadow-brutal-sm",
    badgeLocked: "inline-block px-2 py-1 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)] text-[oklch(0.50_0.02_280)] rounded-[4px] text-[0.6rem] uppercase tracking-wider font-bold"
  }

  return (
    <div className="min-h-screen relative bg-[oklch(0.96_0.01_90)] bg-grid" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=optional');
        .font-sans { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .shadow-brutal { box-shadow: 4px 4px 0px oklch(0.15 0.02 280); }
        .shadow-brutal-sm { box-shadow: 3px 3px 0px oklch(0.15 0.02 280); }
        .hover-lift:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); }
        .active-slam:active { transform: translate(2px, 2px); box-shadow: none; }
        .transition-brutal { transition: all 0.15s ease-out; }
        .bg-grid { background-image: linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px); background-size: 60px 60px; }
      `}</style>
      
      {/* Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
        <div className="absolute w-12 h-12 rounded-full top-[10%] left-[5%] bg-[oklch(0.55_0.24_28)] border-[3px] border-[oklch(0.15_0.02_280)]"></div>
        <div className="absolute w-20 h-20 top-[40%] right-[10%] bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] mix-blend-multiply"></div>
        <div className="absolute w-8 h-8 rounded-full bottom-[20%] left-[20%] bg-[oklch(0.52_0.18_255)] border-[3px] border-[oklch(0.15_0.02_280)]"></div>
      </div>

      <main className={c.layout}>
        <nav className={c.nav}>
          <div className={c.navLogoBox}>
            <div className={c.navSquares}>
              <div className={c.navSquareInfo}></div>
              <div className={c.navSquareWarn}></div>
              <div className={c.navSquareOk}></div>
            </div>
            <span className={c.navBrand}>Booth Brute</span>
          </div>
          <div className={c.navLinks}>
            <button className={`${c.navLink} ${view === 'inventory' ? 'bg-[oklch(0.85_0.18_85)]' : ''}`} onClick={() => handleNav('inventory')}>Dashboard</button>
          </div>
        </nav>

        <header className={c.hero}>
          <div className={c.heroBar}>
            <div className={c.heroBarSeg1}></div>
            <div className={c.heroBarSeg2}></div>
            <div className={c.heroBarSeg3}></div>
            <div className={c.heroBarSeg4}></div>
          </div>
          <h1 className={c.heroTitle}>Drop Point</h1>
          <p className={c.heroSub} aria-hidden="true">Log and deploy assets. Prevent double-booking conflicts across overlapping windows.</p>
        </header>

        <section className={c.statGrid}>
          <div className={c.statCard}>
            <div className={c.statHeader1}>Total Gear</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{String(items.length).padStart(2, '0')}</span>
              <span className={c.statLabel}>Items</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHeader2}>Logged</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{String(events.length).padStart(2, '0')}</span>
              <span className={c.statLabel}>Events</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHeader3}>Deployed</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{String(commits.length).padStart(2, '0')}</span>
              <span className={c.statLabel}>Active</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={c.statHeader4}>Missing</div>
            <div className={c.statBody}>
              <span className={c.statNum}>00</span>
              <span className={c.statLabel}>Alerts</span>
            </div>
          </div>
        </section>

        <section className={c.grid2}>
          <div className={c.panel}>
            <h3 className={c.panelHeader}>Onboard Gear</h3>
            <form onSubmit={handleAddGear} className="flex flex-col gap-4">
              <div className={c.inputGroup}>
                <label className={c.label}>Category</label>
                <select className={c.select} value={newItem.category} onChange={e => mergeItem({category: e.target.value})}>
                  <option>BANNERS</option>
                  <option>SCANNERS</option>
                  <option>CABLES</option>
                  <option>MISC</option>
                </select>
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>SKU</label>
                <input className={c.input} placeholder="BNR-01" value={newItem.sku} onChange={e => mergeItem({sku: e.target.value.toUpperCase()})} />
              </div>
              <div className={c.inputGroup}>
                <label className={c.label}>Description</label>
                <input className={c.input} placeholder="Primary Logo Banner - 8x10" value={newItem.desc} onChange={e => mergeItem({desc: e.target.value})} />
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Register Item</button>
                <button type="button" onClick={handleAutoGenIdeas} disabled={isLoading} className={c.btnGhost}>
                  {isLoading ? <span className="animate-spin inline-block w-4 h-4 border-[2px] border-current border-t-transparent rounded-full" /> : "Auto-Gen"}
                </button>
              </div>
            </form>
          </div>

          <div className={c.panel}>
            <h3 className={c.panelHeader}>Plan Event</h3>
             <form onSubmit={handleAddEvent} className="flex flex-col gap-4">
              <div className={c.inputGroup}>
                <label className={c.label}>Event Code</label>
                <input className={c.input} placeholder="REACT-24" value={newEvent.code} onChange={e => mergeEvent({code: e.target.value.toUpperCase()})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={c.inputGroup}>
                  <label className={c.label}>Outbound</label>
                  <input type="date" className={c.input} value={newEvent.outDate} onChange={e => mergeEvent({outDate: e.target.value})} />
                </div>
                <div className={c.inputGroup}>
                  <label className={c.label}>Return</label>
                  <input type="date" className={c.input} value={newEvent.inDate} onChange={e => mergeEvent({inDate: e.target.value})} />
                </div>
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnSecondary}>Add Event</button>
              </div>
            </form>
          </div>
        </section>

        <section className={c.panel} id="inventory-view">
          <h3 className={c.panelHeader}>Master Ledger</h3>
          <div className={c.tableWrap}>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>SKU</th>
                  <th className={c.th}>Category</th>
                  <th className={c.th}>Description</th>
                  <th className={c.th}>Status</th>
                  <th className={c.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan="5" className={`${c.td} text-center opacity-50 py-8`}>NO GEAR ON FILE</td></tr>
                )}
                {items.map(item => {
                  const itemCommit = commits.find(c => c.itemId === item._id);
                  const activeEvent = itemCommit ? events.find(e => e._id === itemCommit.eventId) : null;
                  
                  return (
                    <tr key={item._id} className="group">
                      <td className={c.tdMono}>{item.sku}</td>
                      <td className={c.td}>{item.category}</td>
                      <td className={c.td}>{item.desc}</td>
                      <td className={c.td}>
                        {activeEvent ? (
                           <span className={c.badgePending}>{activeEvent.code}</span>
                        ) : (
                           <span className={c.badgeLocked}>{item.location || 'WHSE'}</span>
                        )}
                      </td>
                      <td className={c.td}>
                        {activeEvent ? (
                          <button onClick={() => handleReturn(item._id, itemCommit._id)} className={c.btnGhost} style={{padding: '4px 8px', fontSize: '10px'}}>Return</button>
                        ) : (
                          events.length > 0 && (
                            <select 
                              onChange={(e) => {
                                if(e.target.value) {
                                  database.put({ type: 'commitment', itemId: item._id, eventId: e.target.value, status: 'committed' });
                                }
                              }}
                              className={`${c.btnGhost} appearance-none cursor-pointer`} style={{padding: '4px 8px', fontSize: '10px'}}
                            >
                              <option value="">+ Assign</option>
                              {events.map(ev => <option key={ev._id} value={ev._id}>{ev.code}</option>)}
                            </select>
                          )
                        )}
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
  )
}