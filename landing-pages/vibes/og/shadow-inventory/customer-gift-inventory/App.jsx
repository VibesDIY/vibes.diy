import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [isInitializing, setIsInitializing] = useState(false)
  const { database, useLiveQuery } = useFireproof("vault-gift-inventory-v1")
  
  const [formData, setFormData] = useState({ rep: "", customer: "", countryId: "", giftId: "" })
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
  
  const { docs: configs } = useLiveQuery("type")
  const countries = configs.filter(c => c.type === "country")
  const gifts = configs.filter(c => c.type === "gift")
  
  const { docs: requests } = useLiveQuery("type", { key: "request", descending: true })
  
  const pendingRequests = requests.filter(r => r.status === "pending_legal")
  const approvedRequests = requests.filter(r => r.status === "approved")

  // On-the-fly computed ledger matching DB state
  const ledger = countries.map(country => {
    const totalSpend = approvedRequests
      .filter(r => r.countryId === country._id)
      .reduce((sum, r) => sum + r.cost, 0)
    return { ...country, spend: totalSpend }
  }).sort((a,b) => b.spend - a.spend)

  useEffect(() => {
    const seed = async () => {
      const res = await database.query("type")
      if (res.docs.length === 0) {
        setIsInitializing(true)
        try {
          // Pre-populate countries
          await Promise.all([
            { _id: "country:US", type: "country", code: "US", name: "United States", cap: 50 },
            { _id: "country:JP", type: "country", code: "JP", name: "Japan", cap: 0 },
            { _id: "country:DE", type: "country", code: "DE", name: "Germany", cap: 30 },
            { _id: "country:UK", type: "country", code: "UK", name: "United Kingdom", cap: 25 }
          ].map(d => database.put(d)))
          // Pre-populate gifts
          await Promise.all([
            { _id: "gift:MUG", type: "gift", sku: "MUG-01", name: "Corporate Mug", cost: 15 },
            { _id: "gift:WINE", type: "gift", sku: "WINE-01", name: "Reserve Wine", cost: 85 },
            { _id: "gift:BOOK", type: "gift", sku: "BOOK-01", name: "Industry Book", cost: 25 }
          ].map(d => database.put(d)))
        } finally {
          setIsInitializing(false)
        }
      }
    }
    seed()
  }, [database])

  const handleFormChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.rep || !formData.customer || !formData.countryId || !formData.giftId) return

    const country = countries.find(c => c._id === formData.countryId)
    const gift = gifts.find(g => g._id === formData.giftId)
    if (!country || !gift) return

    const isFlagged = gift.cost > country.cap
    
    await database.put({
      type: "request",
      createdAt: Date.now(),
      repName: formData.rep,
      customerName: formData.customer,
      countryId: country._id,
      countryName: country.name,
      countryCap: country.cap,
      giftId: gift._id,
      giftName: gift.name,
      cost: gift.cost,
      status: isFlagged ? "pending_legal" : "approved"
    })

    setFormData({ rep: "", customer: "", countryId: "", giftId: "" })
  }

  const handleSuggest = async () => {
    setIsLoadingSuggestion(true)
    try {
      const res = await callAI("Generate a single fictional corporate salesperson name, and a fictional multinational corp name.", {
         schema: { properties: { repName: { type: "string" }, customerName: { type: "string" } } }
      })
      const obj = JSON.parse(res)
      if (countries.length && gifts.length) {
        setFormData({
          rep: obj.repName,
          customer: obj.customerName,
          countryId: countries[Math.floor(Math.random() * countries.length)]._id,
          giftId: gifts[Math.floor(Math.random() * gifts.length)]._id
        })
      }
    } finally {
      setIsLoadingSuggestion(false)
    }
  }

  const handleReview = async (id, decision) => {
    try {
      const doc = await database.get(id)
      await database.put({ ...doc, status: decision, reviewedAt: Date.now() })
    } catch(err) {
      console.error(err)
    }
  }

  const c = {
    page: "min-h-screen p-4 md:p-8 flex justify-center bg-[oklch(0.08_0.03_280)] text-[oklch(0.93_0.02_80)] font-sans",
    layout: "w-full max-w-5xl flex flex-col md:flex-row gap-6",
    colLeft: "w-full md:w-80 flex flex-col gap-6 shrink-0",
    colRight: "w-full flex-1 flex flex-col gap-6",
    
    header: "text-2xl font-bold tracking-tight uppercase mb-2 font-mono",
    sectionTitle: "text-xs uppercase tracking-widest mb-4 flex justify-between items-center text-[oklch(0.50_0.04_290)] font-mono",
    card: "p-5 border border-[oklch(0.65_0.15_80/0.12)] rounded-none flex flex-col gap-4 shadow-sm bg-[oklch(0.12_0.03_280/0.7)] backdrop-blur-md",
    
    formGroup: "flex flex-col gap-1",
    label: "text-xs uppercase tracking-wider",
    input: "w-full p-3 border-b-2 border-t-0 border-r-0 border-l-0 border-[oklch(0.72_0.15_75/0.5)] bg-transparent rounded-none focus:outline-none focus:border-[oklch(0.72_0.15_75)] transition-colors font-mono text-sm",
    select: "w-full p-3 border-b-2 border-t-0 border-r-0 border-l-0 border-[oklch(0.72_0.15_75/0.5)] bg-transparent rounded-none focus:outline-none focus:border-[oklch(0.72_0.15_75)] transition-colors appearance-none font-mono text-sm [&>option]:bg-[oklch(0.12_0.03_280)]",
    
    btnPrimary: "w-full py-3 px-4 uppercase font-mono font-bold tracking-widest text-sm text-center transition-all active:scale-95 bg-[oklch(0.72_0.15_75)] text-[oklch(0.10_0.03_280)] hover:bg-[oklch(0.55_0.18_300)] hover:text-white disabled:opacity-50",
    btnSecondary: "py-1 px-3 uppercase text-xs font-bold font-mono border border-[oklch(0.72_0.15_75)] text-[oklch(0.72_0.15_75)] hover:bg-[oklch(0.72_0.15_75)] hover:text-[oklch(0.10_0.03_280)] transition-colors",
    btnAi: "text-xs align-middle px-2 py-1 border border-[oklch(0.50_0.04_290)] text-[oklch(0.50_0.04_290)] hover:bg-[oklch(0.50_0.04_290)] hover:text-white transition-colors rounded-none ml-2 font-mono uppercase tracking-wider",
    
    queueList: "flex flex-col gap-3",
    queueItem: "flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.4)] rounded-none gap-4 hover:border-[oklch(0.72_0.15_75/0.4)] transition-colors",
    queueInfo: "flex flex-col gap-1",
    queueMeta: "text-xs uppercase tracking-widest flex items-center gap-2 font-mono text-[oklch(0.50_0.04_290)]",
    queueTitle: "text-base font-bold text-white",
    queueActions: "flex gap-2 shrink-0",
    
    tableContainer: "w-full overflow-x-auto border border-[oklch(0.65_0.15_80/0.12)]",
    table: "w-full text-left border-collapse",
    th: "p-3 text-xs uppercase tracking-widest border-b border-[oklch(0.65_0.15_80/0.12)] font-mono text-[oklch(0.50_0.04_290)]",
    td: "p-3 border-b border-[oklch(0.65_0.15_80/0.12)] text-sm",
    tdMono: "p-3 border-b border-[oklch(0.65_0.15_80/0.12)] text-sm whitespace-nowrap font-mono",
    tdRight: "p-3 border-b border-[oklch(0.65_0.15_80/0.12)] text-sm text-right font-mono",
    
    pipStatus: "inline-block w-2 h-2 mr-2 bg-[oklch(0.72_0.15_75)]"
  }

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
      `}</style>
      
      {isInitializing && <div className="absolute top-4 right-4 bg-white/10 px-4 py-2 font-mono text-xs z-50">INIT DB...</div>}
      <div className={c.layout}>
        {/* LEFT COLUMN: Input Form */}
        <div className={c.colLeft}>
          <div>
            <h1 className={c.header}>Vault Log</h1>
            <p className="text-sm opacity-70 mb-4">Customer Gift & Compliance Tracker</p>
          </div>

          <form onSubmit={handleSubmit} className={c.card}>
            <div className={c.sectionTitle}>
              <span>New Request</span>
              <button type="button" onClick={handleSuggest} disabled={isLoadingSuggestion} className={c.btnAi}>
                {isLoadingSuggestion ? (
                   <svg className="animate-spin h-3 w-3 mx-1 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                ) : "AI Fill"}
              </button>
            </div>
            
            <div className={c.formGroup}>
              <label className={c.label}>Rep Name</label>
              <input name="rep" value={formData.rep} onChange={handleFormChange} className={c.input} placeholder="e.g. jsmith" />
            </div>
            
            <div className={c.formGroup}>
              <label className={c.label}>Client Account</label>
              <input name="customer" value={formData.customer} onChange={handleFormChange} className={c.input} placeholder="Target Company" />
            </div>
            
            <div className={c.formGroup}>
              <label className={c.label}>Destination Region</label>
              <select name="countryId" value={formData.countryId} onChange={handleFormChange} className={c.select}>
                <option value="" disabled>Select Country...</option>
                {countries.map(c => <option key={c._id} value={c._id}>{c.name} (Cap: ${c.cap})</option>)}
              </select>
            </div>
            
            <div className={c.formGroup}>
              <label className={c.label}>Item</label>
              <select name="giftId" value={formData.giftId} onChange={handleFormChange} className={c.select}>
                <option value="" disabled>Select Item...</option>
                {gifts.map(g => <option key={g._id} value={g._id}>{g.sku} : {g.name} (${g.cost})</option>)}
              </select>
            </div>
            
            <button 
              type="submit" 
              className={c.btnPrimary} 
              style={{ marginTop: '1rem' }}
              disabled={!formData.rep || !formData.customer || !formData.countryId || !formData.giftId}
            >
              Submit Request
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Queues and Data */}
        <div className={c.colRight}>
          
          {/* Pending Review Queue */}
          <section className={c.card}>
            <h2 className={c.sectionTitle}>Pending Legal Review (Action Req)</h2>
            <div className={c.queueList}>
              {pendingRequests.map(req => (
                <div key={req._id} className={c.queueItem}>
                  <div className={c.queueInfo}>
                    <div className={c.queueMeta}>
                      <span className={c.pipStatus}></span>
                      <span>{new Date(req.createdAt).toLocaleDateString()} &mdash; {req.countryName}</span>
                    </div>
                    <div className={c.queueTitle}>
                      {req.customerName} <span className="opacity-60 font-normal text-[oklch(0.50_0.04_290)]">via {req.repName}</span>
                    </div>
                    <div className="text-sm font-mono">
                      {req.giftName} &mdash; COST: ${req.cost} / CAP: ${req.countryCap}
                    </div>
                  </div>
                  <div className={c.queueActions}>
                    <button type="button" onClick={() => handleReview(req._id, 'approved')} className={c.btnSecondary}>Approve</button>
                    <button type="button" onClick={() => handleReview(req._id, 'denied')} className={c.btnSecondary}>Deny</button>
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 && (
                <div className="text-sm opacity-50 p-4 text-center border border-dashed rounded-none">
                  No requests pending review.
                </div>
              )}
            </div>
          </section>

          {/* Ledger */}
          <section className={c.card}>
            <h2 className={c.sectionTitle}>Q4 Cost Ledger by Region</h2>
            <div className={c.tableContainer}>
              <table className={c.table}>
                <thead>
                  <tr>
                    <th className={c.th}>Region</th>
                    <th className={c.th}>Limit / Req</th>
                    <th className={c.th}>Approved Spend</th>
                    <th className={c.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(row => (
                    <tr key={row.code}>
                      <td className={c.tdMono}>{row.code}</td>
                      <td className={c.td}>${row.cap}</td>
                      <td className={c.tdRight}>${row.spend}</td>
                      <td className={`${c.tdMono} md:text-xs ${row.spend > row.cap ? 'text-red-400 font-bold' : 'text-[oklch(0.50_0.04_290)]'}`}>
                        {row.spend > row.cap ? "CAP EXCEEDED" : "NOMINAL"}
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-sm opacity-50">Ledger empty.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}