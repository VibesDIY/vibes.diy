import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { useLiveQuery, useDocument, database } = useFireproof("asset-vault-brutal")
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [activeRenewId, setActiveRenewId] = useState(null)
  
  const { doc: newAsset, merge: mergeAsset, submit: submitAsset } = useDocument({
    type: "asset",
    sku: "",
    name: "",
    rightsHolder: "",
    licenseType: "TIME-BOXED",
    expiryDate: "",
    _files: {}
  })

  const { doc: renewalReq, merge: mergeRenewal, submit: submitRenewal } = useDocument({
    type: "renewal-request",
    assetId: "",
    notes: "",
    status: "PENDING",
    createdAt: Date.now()
  })

  const { docs: assets } = useLiveQuery("type", { key: "asset", descending: true })
  
  const suggestData = async () => {
    setIsAiLoading(true)
    try {
      const res = await callAI("Generate a single sample commercial brand asset right tracking record for an advertising campaign. Returns SKU, name, rightsHolder, licenseType (must be TIME-BOXED or EVENT-ONLY or UNLIMITED), and a future expiryDate (YYYY-MM-DD format).", {
        schema: {
          properties: {
            sku: { type: "string" },
            name: { type: "string" },
            rightsHolder: { type: "string" },
            licenseType: { type: "string" },
            expiryDate: { type: "string" }
          }
        }
      })
      const data = JSON.parse(res)
      mergeAsset({
        sku: data.sku, name: data.name, rightsHolder: data.rightsHolder, 
        licenseType: data.licenseType, expiryDate: data.expiryDate
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  const getStatus = (doc) => {
    if (doc.licenseType === 'UNLIMITED') return { label: 'UNLIMITED', bg: 'bg-[oklch(0.62_0.19_145)]', flag: 'valid' }
    if (!doc.expiryDate) return { label: 'UNKNOWN', bg: 'bg-[oklch(0.50_0.02_280)]', flag: 'valid' }
    
    const diff = new Date(doc.expiryDate) - new Date()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (days < 0) return { label: 'EXPIRED', bg: 'bg-[oklch(0.55_0.24_28)]', flag: 'expired' }
    if (days < 30) return { label: 'EXPIRING', bg: 'bg-[oklch(0.85_0.18_85)]', flag: 'soon' }
    return { label: 'ACTIVE', bg: 'bg-[oklch(0.62_0.19_145)]', flag: 'valid' }
  }

  const stats = {
    valid: assets.filter(a => getStatus(a).flag === 'valid').length,
    soon: assets.filter(a => getStatus(a).flag === 'soon').length,
    expired: assets.filter(a => getStatus(a).flag === 'expired').length,
  }

  const { docs: renewals } = useLiveQuery("type", { key: "renewal-request" })
  
  const handleAssetSubmit = (e) => {
    e.preventDefault()
    if (!newAsset.sku || !newAsset.name) return
    submitAsset()
  }

  const c = {
    global: "relative min-h-screen flex flex-col items-center bg-[oklch(0.96_0.01_90)] font-['Space_Grotesk'] text-[oklch(0.15_0.02_280)]",
    ambient: "fixed inset-0 pointer-events-none z-0",
    layout: "max-w-[920px] w-full p-4 md:p-12 z-10 flex flex-col gap-8",
    nav: "flex flex-col md:flex-row justify-between items-center p-4 gap-4 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow",
    logoGroup: "flex items-center gap-2",
    logoSquares: "flex gap-1",
    logoSq: "w-3 h-3 block border-[2px] border-[oklch(0.15_0.02_280)]",
    navLinks: "flex gap-2",
    navPill: "px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.05em] bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm neo-hover neo-active neo-transition cursor-pointer",
    
    hero: "flex flex-col p-6 mt-4 gap-4 relative bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex border-b-[3px] border-[oklch(0.15_0.02_280)]",
    heroTitle: "text-4xl md:text-6xl font-bold uppercase tracking-[-0.02em] relative z-10 pt-4",
    heroShadow: "absolute top-8 left-6 md:left-7 text-4xl md:text-6xl font-bold uppercase tracking-[-0.02em] text-[oklch(0.55_0.24_28)] opacity-50 z-0 select-none",
    
    statGrid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2",
    statCard: "flex flex-col bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm",
    statHead: "p-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)]",
    statBody: "p-4 flex items-baseline gap-2",
    statNum: "text-3xl font-bold font-['JetBrains_Mono']",
    
    formGrid: "grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 mt-4",
    formCard: "flex flex-col p-6 gap-4 bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow",
    fieldGroup: "flex flex-col gap-1 relative",
    label: "text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)]",
    input: "w-full p-3 bg-transparent border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-['JetBrains_Mono'] text-[0.82rem] focus:outline-none focus:bg-[oklch(0.85_0.18_85)] focus:neo-hover transition-transform",
    select: "w-full p-3 bg-transparent border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-['JetBrains_Mono'] text-[0.82rem] uppercase cursor-pointer focus:outline-none focus:bg-[oklch(0.85_0.18_85)]",
    fileInput: "w-full p-2 bg-transparent border-[3px] border-[oklch(0.15_0.02_280)] border-dashed rounded-[4px] font-['JetBrains_Mono'] text-[0.7rem] cursor-pointer hover:bg-[oklch(0.96_0.01_90)]",
    btnRow: "flex flex-col sm:flex-row gap-4 mt-4",
    btnPrimary: "px-4 py-3 font-bold uppercase tracking-[0.05em] text-[0.8rem] w-full flex justify-center items-center gap-2 bg-[oklch(0.62_0.19_145)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm neo-hover neo-active neo-transition",
    btnGhost: "px-4 py-3 font-bold uppercase tracking-[0.05em] text-[0.8rem] w-full bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] hover:neo-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] neo-transition",
    btnAi: "px-2 py-1 text-[0.65rem] uppercase font-bold tracking-[0.1em] bg-[oklch(0.52_0.18_255)] text-white border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm neo-hover neo-active neo-transition",
    
    tableCard: "flex flex-col overflow-x-auto bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow mt-4",
    table: "w-full text-left border-collapse min-w-[700px]",
    th: "p-3 text-[0.6rem] font-bold uppercase tracking-[0.15em] border-b-[3px] border-[oklch(0.15_0.02_280)] text-[oklch(0.50_0.02_280)] bg-[oklch(0.96_0.01_90)]",
    td: "p-3 text-[0.82rem] border-b border-[oklch(0.15_0.02_280)/.2] align-middle transition-colors hover:bg-[oklch(0.85_0.18_85)]",
    badge: "text-[0.65rem] px-2 py-[2px] uppercase inline-block font-bold border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm",
    imgCell: "w-12 h-12 object-cover border-[2px] border-[oklch(0.15_0.02_280)] bg-[oklch(0.96_0.01_90)]",
    rowAction: "px-3 py-1 text-[0.65rem] uppercase font-bold tracking-[0.05em] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm neo-hover neo-active neo-transition whitespace-nowrap",
    
    modalWrap: "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity",
    modalOverlay: "absolute inset-0 bg-[oklch(0.15_0.02_280)/.6]",
    modalCard: "relative w-full max-w-md flex flex-col bg-[oklch(1.00_0_0)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-lg",
    modalBar: "p-3 font-bold text-[0.8rem] tracking-wide uppercase bg-[oklch(0.52_0.18_255)] text-white border-b-[3px] border-[oklch(0.15_0.02_280)]",
    modalBody: "p-6 flex flex-col gap-4",
    modalTextArea: "w-full p-3 min-h-[120px] bg-transparent border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-['JetBrains_Mono'] text-[0.82rem] focus:outline-none focus:bg-[oklch(0.85_0.18_85)] focus:neo-hover transition-transform",
  }

  return (
    <div className={c.global}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        
        .bg-grid {
          background-image: 
            linear-gradient(to right, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .neo-shadow { box-shadow: 4px 4px 0px oklch(0.15 0.02 280); }
        .neo-shadow-sm { box-shadow: 3px 3px 0px oklch(0.15 0.02 280); }
        .neo-shadow-lg { box-shadow: 8px 8px 0px oklch(0.15 0.02 280); }
        .neo-hover:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); }
        .neo-active:active { transform: translate(2px, 2px); box-shadow: none; }
        .neo-transition { transition: all 0.15s ease; }
        
        @keyframes drift-spin-1 { 0% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(20px, 30px) rotate(180deg); } 100% { transform: translate(0,0) rotate(360deg); } }
        @keyframes modal-pop { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-pop { animation: modal-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
      <div className={`${c.ambient} bg-grid`}>
        <div className="absolute top-[10%] left-[5%] w-12 h-12 bg-[oklch(0.55_0.24_28)] opacity-20 border-[3px] border-[oklch(0.15_0.02_280)]" style={{animation: 'drift-spin-1 8s infinite ease-in-out'}}></div>
        <div className="absolute top-[30%] right-[10%] w-16 h-16 rounded-full bg-[oklch(0.85_0.18_85)] opacity-20 border-[3px] border-[oklch(0.15_0.02_280)]" style={{animation: 'drift-spin-1 12s infinite ease-in-out reverse'}}></div>
      </div>

      <main className={c.layout}>
        <nav className={c.nav}>
          <div className={c.logoGroup}>
            <div className={c.logoSquares}>
              <span className={`${c.logoSq} bg-[oklch(0.55_0.24_28)]`}></span>
              <span className={`${c.logoSq} bg-[oklch(0.85_0.18_85)]`}></span>
              <span className={`${c.logoSq} bg-[oklch(0.62_0.19_145)]`}></span>
            </div>
            <h1 className="font-bold uppercase tracking-tight">Access Control</h1>
          </div>
          <div className={c.navLinks}>
            <button className={c.navPill}>Dashboard</button>
            <button className={c.navPill}>Audit Log</button>
          </div>
        </nav>

        <section className={c.hero}>
          <div className={c.heroBar}>
            <div className="flex-1 bg-[oklch(0.55_0.24_28)] border-r-[3px] border-[oklch(0.15_0.02_280)]"></div>
            <div className="flex-1 bg-[oklch(0.85_0.18_85)] border-r-[3px] border-[oklch(0.15_0.02_280)]"></div>
            <div className="flex-1 bg-[oklch(0.62_0.19_145)] border-r-[3px] border-[oklch(0.15_0.02_280)]"></div>
            <div className="flex-1 bg-[oklch(0.52_0.18_255)]"></div>
          </div>
          <h2 className={c.heroTitle}>
            System Integrity
          </h2>
          <div className={c.heroShadow} aria-hidden="true">
            System Integrity
          </div>
        </section>

        <section className={c.statGrid}>
          <div className={c.statCard}>
            <div className={`${c.statHead} bg-[oklch(0.52_0.18_255)] text-white`}>Active Registry</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{assets.length}</span>
              <span className="font-['JetBrains_Mono'] text-[0.6rem] font-bold uppercase tracking-wider text-[oklch(0.50_0.02_280)]">LOGS</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHead} bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)]`}>Clear Usage</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{stats.valid}</span>
              <span className="font-['JetBrains_Mono'] text-[0.6rem] font-bold uppercase tracking-wider text-[oklch(0.50_0.02_280)]">VALID</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHead} bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)]`}>Approaching Expiry</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{stats.soon}</span>
              <span className="font-['JetBrains_Mono'] text-[0.6rem] font-bold uppercase tracking-wider text-[oklch(0.50_0.02_280)]">&lt;30 DAYS</span>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHead} bg-[oklch(0.55_0.24_28)] text-white`}>Terminated</div>
            <div className={c.statBody}>
              <span className={c.statNum}>{stats.expired}</span>
              <span className="font-['JetBrains_Mono'] text-[0.6rem] font-bold uppercase tracking-wider text-[oklch(0.50_0.02_280)]">EXPIRED</span>
            </div>
          </div>
        </section>

        <section className={c.formGrid}>
          <div className={c.formCard}>
            <div className="flex justify-between items-center border-b-[3px] border-[oklch(0.15_0.02_280)] pb-4">
              <h3 className="font-bold uppercase">Intake Manifest</h3>
              <button className={c.btnAi} onClick={suggestData} disabled={isAiLoading} type="button">
                {isAiLoading ? (
                  <svg className="animate-spin h-3 w-3 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : 'Generate Data'}
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleAssetSubmit}>
              <div className={c.fieldGroup}>
                <label className={c.label}>Identifier (SKU)</label>
                <input className={c.input} type="text" placeholder="e.g. IMG-2024-001" value={newAsset.sku} onChange={e => mergeAsset({sku: e.target.value})} required/>
              </div>
              <div className={c.fieldGroup}>
                <label className={c.label}>Asset Designation</label>
                <input className={c.input} type="text" placeholder="Title or Description" value={newAsset.name} onChange={e => mergeAsset({name: e.target.value})} required/>
              </div>
              <div className={c.fieldGroup}>
                <label className={c.label}>Payload</label>
                <input className={c.fileInput} type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0]
                  if(f) mergeAsset({ _files: { payload: f } })
                }} />
              </div>
              <div className={c.fieldGroup}>
                <label className={c.label}>Rights Authority</label>
                <input className={c.input} type="text" placeholder="Agency or Creator Name" value={newAsset.rightsHolder} onChange={e => mergeAsset({rightsHolder: e.target.value})} required/>
              </div>
              <div className={c.fieldGroup}>
                <label className={c.label}>License Parameters</label>
                <select className={c.select} value={newAsset.licenseType} onChange={e => mergeAsset({licenseType: e.target.value})}>
                  <option value="UNLIMITED">Unlimited</option>
                  <option value="TIME-BOXED">Time-Boxed</option>
                  <option value="EVENT-ONLY">Event-Only</option>
                </select>
              </div>
              <div className={c.fieldGroup}>
                <label className={c.label}>Termination Coordinate</label>
                <input className={c.input} type="date" value={newAsset.expiryDate} onChange={e => mergeAsset({expiryDate: e.target.value})} />
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>
                  Commit Record
                </button>
                <button type="button" className={c.btnGhost} onClick={() => mergeAsset({sku:"", name:"", rightsHolder:"", licenseType:"TIME-BOXED", expiryDate:"", _files:{}})}>
                  Clear
                </button>
              </div>
            </form>
          </div>

          <div className={c.formCard}>
            <h3 className="font-bold uppercase tracking-tight border-b-[3px] border-[oklch(0.15_0.02_280)] pb-4">Status Legend</h3>
            <ul className="flex flex-col gap-4 text-[0.82rem] mt-2 font-['JetBrains_Mono']">
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 block bg-[oklch(0.62_0.19_145)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm"></span>
                ACTIVE / UNLIMITED
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 block bg-[oklch(0.85_0.18_85)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm"></span>
                EXPIRING &lt;30 DAYS
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 block bg-[oklch(0.55_0.24_28)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] neo-shadow-sm"></span>
                EXPIRED / LOCKED
              </li>
            </ul>
          </div>
        </section>

        <section className={c.tableCard}>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Visual</th>
                <th className={c.th}>Identifier</th>
                <th className={c.th}>Authority / Terms</th>
                <th className={c.th}>Condition</th>
                <th className={c.th}>Directives</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr>
                  <td colSpan="5" className={`${c.td} text-center py-8 text-[oklch(0.50_0.02_280)] font-bold uppercase tracking-widest`}>
                    No records found
                  </td>
                </tr>
              )}
              {assets.map(d => {
                const status = getStatus(d)
                return (
                  <tr key={d._id}>
                    <td className={c.td}>
                      {d._files?.payload?.url ? (
                        <img src={d._files.payload.url} className={c.imgCell} alt="asset" />
                      ) : (
                         <div className={`${c.imgCell} bg-[oklch(0.96_0.01_90)] flex items-center justify-center text-[0.6rem] font-bold text-[oklch(0.50_0.02_280)] uppercase tracking-wide`}>NULL</div>
                      )}
                    </td>
                    <td className={`${c.td} font-['JetBrains_Mono'] font-bold`}>{d.sku}</td>
                    <td className={c.td}>
                      <div className="font-bold text-[0.85rem]">{d.name}</div>
                      <div className="text-[0.7rem] uppercase tracking-widest text-[oklch(0.50_0.02_280)] mt-1">{d.rightsHolder} · {d.licenseType}</div>
                    </td>
                    <td className={c.td}>
                      <span className={`${c.badge} ${status.bg} ${status.flag === 'soon' ? 'text-[oklch(0.15_0.02_280)]' : 'text-white'}`}>{status.label}</span>
                      {d.expiryDate && (
                        <div className="text-[0.7rem] font-['JetBrains_Mono'] mt-1 font-bold">Expires: {d.expiryDate}</div>
                      )}
                    </td>
                    <td className={c.td}>
                      <button className={`${c.rowAction} bg-[oklch(0.85_0.18_85)]`} onClick={() => setActiveRenewId(d._id)}>RENEW</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </main>

      {activeRenewId && (
        <div className={c.modalWrap}>
          <div className={c.modalOverlay} onClick={() => setActiveRenewId(null)}></div>
          <div className={`${c.modalCard} modal-pop`}>
            <div className={c.modalBar}>Extension Protocol</div>
            <form className={c.modalBody} onSubmit={(e) => {
              e.preventDefault()
              mergeRenewal({ assetId: activeRenewId, createdAt: Date.now() })
              submitRenewal()
              setActiveRenewId(null)
            }}>
              <div className={c.fieldGroup}>
                <label className={c.label}>Target ID Reference</label>
                <div className="font-['JetBrains_Mono'] text-[0.85rem] p-2 bg-[oklch(0.96_0.01_90)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] font-bold">
                  {assets.find(a => a._id === activeRenewId)?.sku || 'UNKNOWN'}
                </div>
              </div>
              <div className={c.fieldGroup}>
                <label className={c.label}>Justification Notes</label>
                <textarea className={c.modalTextArea} required placeholder="Reasoning for scope increase..." value={renewalReq.notes} onChange={e => mergeRenewal({notes: e.target.value})}></textarea>
              </div>
              <div className={c.btnRow}>
                <button type="submit" className={c.btnPrimary}>Transmit Request</button>
                <button type="button" className={c.btnGhost} onClick={() => setActiveRenewId(null)}>Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}