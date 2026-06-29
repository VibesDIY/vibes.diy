import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  // 1. Hooks and document shapes
  const [repName, setRepName] = useState("")
  const [filterText, setFilterText] = useState("")
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [returnNotes, setReturnNotes] = useState("")
  const [isSeeding, setIsSeeding] = useState(false)
  const [isProcessingAI, setIsProcessingAI] = useState(false)

  const { database, useLiveQuery } = useFireproof("demo-pool-ledger")
  const { docs: devices } = useLiveQuery("type", { key: "device" })
  const { docs: logs } = useLiveQuery("type", { key: "log", descending: true, limit: 15 })

  // 2. Event handlers
  const handleSeed = async () => {
    setIsSeeding(true)
    try {
      const resp = await callAI(`Generate 5 demo tech devices. Valid status is strictly 'available'.`, {
        schema: {
          properties: { items: { type: "array", items: {
            type: "object", properties: { sku: { type: "string", description: "Short alphanumeric e.g. MBP-16" }, model: { type: "string" } }
          }}}
        }
      })
      const data = JSON.parse(resp)
      for (const item of data.items) {
        await database.put({ ...item, type: "device", status: "available", holder: null, checkedOutTs: null, notes: "" })
      }
      await database.put({ type: "log", msg: "SYSTEM Seeded Pool", ts: Date.now() })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleClaim = async (dev) => {
    if (!repName.trim()) return alert("Enter Rep Name in top bar first!")
    await database.put({ ...dev, status: "checked_out", holder: repName, checkedOutTs: Date.now() })
    await database.put({ type: "log", msg: `${repName} claimed ${dev.sku}`, ts: Date.now() })
  }

  const handlePromptReturn = (dev) => {
    setSelectedDevice(dev); setReturnNotes("");
  }

  const confirmReturn = async () => {
    await database.put({ ...selectedDevice, status: "available", holder: null, checkedOutTs: null })
    await database.put({ type: "log", msg: `${selectedDevice.holder} returned ${selectedDevice.sku}. Notes: ${returnNotes || 'None'}`, ts: Date.now() })
    setSelectedDevice(null)
  }

  const handleSuggestNotes = async () => {
    setIsProcessingAI(true)
    try {
      const resp = await callAI(`Suggest a 1-sentence return condition note for a used demo device.`, { schema: { properties: { note: {type: "string"}} }})
      setReturnNotes(JSON.parse(resp).note)
    } finally {
      setIsProcessingAI(false)
    }
  }

  // 3. ClassNames
  const c = {
    page: "relative min-h-screen px-4 py-8 md:p-12 z-10 flex flex-col items-center max-w-[920px] mx-auto text-ink uppercase",
    nav: "flex flex-col sm:flex-row justify-between items-center w-full mb-8 p-4 border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
    hero: "w-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] p-6 mb-8 relative shadow-[4px_4px_0px_oklch(0.15_0.02_280)] overflow-hidden",
    statGrid: "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8",
    statCard: "border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] flex flex-col hover:-translate-y-[2px] hover:-translate-x-[2px] transition-transform hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)]",
    statHead: "px-2 py-1 text-[0.65rem] uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] text-white",
    statNum: "p-4 text-3xl font-bold font-mono text-ink",
    controls: "w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-6",
    input: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 text-sm font-mono w-full outline-none bg-white focus:-translate-y-[2px] focus:-translate-x-[2px] focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] transition-all",
    tableCard: "w-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px] overflow-x-auto mb-8",
    th: "px-4 py-3 text-left text-[0.6rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)]",
    td: "px-4 py-3 text-[0.82rem] font-bold border-b-[2px] border-[oklch(0.15_0.02_280)] group-hover:bg-[oklch(0.85_0.18_85)] transition-colors duration-200",
    chip: "inline-flex items-center px-2 py-0.5 text-[0.7rem] uppercase border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-bold shadow-[2px_2px_0px_oklch(0.15_0.02_280)]",
    btnAct: "px-3 py-1 text-[0.7rem] uppercase font-bold border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(1.00_0_0)] shadow-[2px_2px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all disabled:opacity-50",
    auditCard: "w-full border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] rounded-[4px] p-4",
    btnPrimary: "px-4 py-2 text-[0.7rem] uppercase font-bold border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.55_0.24_28)] text-white shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:opacity-50",
    btnSecondary: "px-4 py-2 text-[0.7rem] uppercase font-bold border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-[oklch(0.85_0.18_85)] text-ink shadow-[4px_4px_0px_oklch(0.15_0.02_280)] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[6px_6px_0px_oklch(0.15_0.02_280)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:opacity-50",
    modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[oklch(0.15_0.02_280/0.6)] backdrop-blur-sm",
    modalCard: "border-[3px] border-[oklch(0.15_0.02_280)] bg-[oklch(1.00_0_0)] shadow-[8px_8px_0px_oklch(0.15_0.02_280)] rounded-[4px] w-full max-w-sm flex flex-col overflow-hidden animate-[modal-pop_0.2s_ease-out]",
    modalHead: "px-4 py-3 text-[0.7rem] font-bold uppercase tracking-[0.1em] border-b-[3px] border-[oklch(0.15_0.02_280)] bg-blue text-white",
    modalBody: "p-4 flex flex-col gap-4"
  }

  // 4. JSX return
  return (
    <React.Fragment>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        body { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .neo-bg {
          background-color: oklch(0.96 0.01 90);
          background-image:
            linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .text-shadow-hard { text-shadow: 4px 4px 0px oklch(0.55 0.24 28 / 0.5); }
        .bg-red { background-color: oklch(0.55 0.24 28); }
        .bg-yellow { background-color: oklch(0.85 0.18 85); }
        .bg-green { background-color: oklch(0.62 0.19 145); }
        .bg-blue { background-color: oklch(0.52 0.18 255); }
        .text-ink { color: oklch(0.15 0.02 280); }
      `}</style>
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none neo-bg">
        <div className="absolute top-10 left-10 w-16 h-16 bg-red rotate-12 opacity-20 border-[3px] border-black"></div>
        <div className="absolute top-40 right-20 w-12 h-12 bg-yellow rounded-full opacity-20 border-[3px] border-black"></div>
        <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-blue rounded-full opacity-15 border-[3px] border-black"></div>
      </div>

      <main id="app" className={c.page}>
        <header className={c.nav}>
          <div className="flex items-center gap-2">
             <div className="flex gap-1">
               <div className="w-3 h-3 bg-red border-2 border-black"></div>
               <div className="w-3 h-3 bg-yellow border-2 border-black"></div>
               <div className="w-3 h-3 bg-green border-2 border-black"></div>
             </div>
             <h1 className="font-bold text-lg leading-none">DEMO POOL</h1>
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
             <span className="text-xs uppercase font-bold tracking-widest">Rep:</span>
             <input type="text" value={repName} onChange={(e) => setRepName(e.target.value)} placeholder="YOUR NAME" className={c.input} />
          </div>
        </header>

        <section id="hero" className={c.hero}>
          <div className="absolute top-0 left-0 w-full h-[6px] flex border-b-[3px] border-[oklch(0.15_0.02_280)]">
             <div className="flex-1 bg-red"></div>
             <div className="flex-1 bg-yellow"></div>
             <div className="flex-1 bg-green"></div>
             <div className="flex-1 bg-blue"></div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mt-4 relative">
             <span className="relative z-10 text-shadow-hard">Inventory Status</span>
          </h2>
          <p className="mt-2 text-sm uppercase max-w-lg leading-relaxed font-bold">
            Check out units for upcoming events. Return promptly. Devices held &gt;14 days are visibly flagged in the system.
          </p>
        </section>

        <section id="stats" className={c.statGrid}>
           <div className={c.statCard}>
             <div className={`${c.statHead} bg-red`}>Total Devices</div>
             <div className={c.statNum}>{devices.length}</div>
           </div>
           <div className={c.statCard}>
             <div className={`${c.statHead} bg-yellow !text-ink`}>Available</div>
             <div className={c.statNum}>{devices.filter(d=>d.status==='available').length}</div>
           </div>
           <div className={c.statCard}>
             <div className={`${c.statHead} bg-blue`}>In Field</div>
             <div className={c.statNum}>{devices.filter(d=>d.status==='checked_out').length}</div>
           </div>
           <div className={c.statCard}>
             <div className={`${c.statHead} bg-green !text-ink`}>Overdue</div>
             <div className={c.statNum}>{devices.filter(d=>d.checkedOutTs && (Date.now() - d.checkedOutTs) > 1209600000).length}</div>
           </div>
        </section>

        <section id="controls" className={c.controls}>
           <input type="text" value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="FILTER BY MODEL OR SKU..." className={c.input} />
           <div className="flex gap-2 items-center justify-start md:justify-end">
              <button onClick={handleSeed} disabled={isSeeding || devices.length > 0} className={c.btnSecondary}>
                  {isSeeding ? (
                    <span className="flex items-center gap-2">
                       <svg className="animate-spin h-4 w-4 text-ink" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       Seeding...
                    </span>
                  ) : "Seed DB Data"}
              </button>
           </div>
        </section>

        <section id="ledger" className={c.tableCard}>
           <table className="w-full text-left border-collapse">
             <thead>
               <tr>
                 <th className={c.th}>Status</th>
                 <th className={c.th}>SKU</th>
                 <th className={c.th}>Model</th>
                 <th className={c.th}>Holder</th>
                 <th className={c.th}>Days</th>
                 <th className={c.th}>Action</th>
               </tr>
             </thead>
             <tbody>
                {devices.length === 0 && (
                  <tr><td colSpan="6" className={`${c.td} text-center py-6`}>NO DEVICES FOUND. SEED DB TO START.</td></tr>
                )}
                {devices
                  .filter(d => (d.sku+d.model).toLowerCase().includes(filterText.toLowerCase()))
                  .map(device => {
                    const daysHeld = device.checkedOutTs ? Math.floor((Date.now() - device.checkedOutTs) / 86400000) : 0;
                    const isOverdue = daysHeld > 14;
                    return (
                       <tr key={device._id} className="group cursor-default">
                         <td className={c.td}>
                           <span className={`${c.chip} ${device.status === 'available' ? 'bg-green !text-ink' : 'bg-yellow text-ink'}`}>
                             {device.status === 'available' ? 'Avail' : 'Out'}
                           </span>
                         </td>
                         <td className={`${c.td} font-mono`}>{device.sku}</td>
                         <td className={c.td}>{device.model}</td>
                         <td className={c.td}>{device.holder || '--'}</td>
                         <td className={`${c.td} font-mono`}>
                            {device.status === 'checked_out' ? (
                               <span className={isOverdue ? 'bg-red text-white font-bold px-1 py-0.5' : ''}>{daysHeld}d</span>
                            ) : '--'}
                         </td>
                         <td className={c.td}>
                           {device.status === 'available' ? (
                             <button onClick={() => handleClaim(device)} className={c.btnAct}>Claim</button>
                           ) : (
                             <button onClick={() => handlePromptReturn(device)} className={`${c.btnAct} bg-black !text-white`}>Return</button>
                           )}
                         </td>
                       </tr>
                    )
                })}
             </tbody>
           </table>
        </section>

        <section id="audit" className={c.auditCard}>
           <h3 className="text-[0.65rem] uppercase tracking-[0.15em] mb-4 font-bold border-b-[3px] border-[oklch(0.15_0.02_280)] pb-2 flex justify-between">
              Recent Audit Log
              <span className="bg-yellow text-ink px-2">LIVE</span>
           </h3>
           <ul className="space-y-3 mt-4">
             {logs.length === 0 && <li className="text-sm">Log completely clean...</li>}
             {logs.map(lg => (
               <li key={lg._id} className="text-sm flex gap-4 border-b-[2px] border-[oklch(0.15_0.02_280)/0.1] pb-2 last:border-0 font-mono">
                 <span className="opacity-50 min-w-[50px]">{new Date(lg.ts).getHours().toString().padStart(2, '0')}:{new Date(lg.ts).getMinutes().toString().padStart(2, '0')}</span>
                 <span className="font-bold">{lg.msg}</span>
               </li>
             ))}
           </ul>
        </section>

        {selectedDevice && (
          <div className={c.modalOverlay}>
            <div className={c.modalCard}>
              <div className={c.modalHead}>Return {selectedDevice.sku}</div>
              <div className={c.modalBody}>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold uppercase">Condition Notes:</p>
                  <button onClick={handleSuggestNotes} className={`${c.btnSecondary} !py-1 !text-[0.6rem]`}>
                     {isProcessingAI ? "Thinking..." : "AI Suggestion"}
                  </button>
                </div>
                <textarea value={returnNotes} onChange={e=>setReturnNotes(e.target.value)} className={c.input} rows="3" placeholder="Missing charger, scratch on lid..."></textarea>
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={()=>setSelectedDevice(null)} className={c.btnSecondary}>Cancel</button>
                  <button onClick={confirmReturn} className={c.btnPrimary}>Confirm Return</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </React.Fragment>
  )
}