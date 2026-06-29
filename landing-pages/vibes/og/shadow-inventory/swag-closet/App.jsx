import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const c = {
    fontLoader: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Mono:wght@400;700&display=swap');",
    page: "min-h-screen p-4 md:p-8 flex flex-col gap-8 md:block max-w-4xl mx-auto rounded-none relative z-10 bg-[oklch(0.08_0.03_280)] text-[oklch(0.93_0.02_80)] font-sans",
    header: "flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[oklch(0.65_0.15_80/0.12)] pb-6 mb-8 rounded-none",
    title: "text-3xl md:text-5xl font-bold uppercase tracking-tighter rounded-none text-[oklch(0.93_0.02_80)]",
    subtitle: "uppercase text-xs tracking-widest mt-2 rounded-none text-[oklch(0.50_0.04_290)] font-mono",
    card: "border-[1px] border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.7)] backdrop-blur-md p-6 mb-6 rounded-none shadow-sm",
    table: "w-full text-left text-sm whitespace-nowrap rounded-none",
    th: "p-3 border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] uppercase tracking-wider text-xs font-semibold rounded-none text-[oklch(0.50_0.04_290)]",
    td: "p-3 border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] rounded-none",
    tdMono: "p-3 border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] text-xs rounded-none font-mono text-[oklch(0.72_0.15_75)]",
    input: "w-full p-3 bg-transparent border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] outline-none rounded-none text-sm transition-all focus:border-[oklch(0.72_0.15_75)] focus:bg-[oklch(0.72_0.15_75/0.05)] text-[oklch(0.93_0.02_80)] placeholder-[oklch(0.50_0.04_290)]",
    inputMono: "w-24 p-3 bg-transparent border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] outline-none rounded-none text-center text-sm transition-all text-xs font-mono focus:border-[oklch(0.72_0.15_75)] focus:bg-[oklch(0.72_0.15_75/0.05)] text-[oklch(0.93_0.02_80)] placeholder-[oklch(0.50_0.04_290)]",
    label: "block text-xs uppercase tracking-widest mb-1 rounded-none text-[oklch(0.50_0.04_290)] font-mono",
    btnPrimary: "px-6 py-3 font-bold uppercase tracking-wider text-sm transition-all shadow-[4px_4px_0px] border-[1px] border-[oklch(0.65_0.15_80/0.12)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none rounded-none flex items-center justify-center gap-2 bg-[oklch(0.72_0.15_75)] text-[oklch(0.10_0.03_280)] shadow-[oklch(0.55_0.18_300)] hover:bg-[oklch(0.80_0.16_80)]",
    btnGhost: "px-4 py-2 text-xs uppercase tracking-widest transition-all rounded-none text-[oklch(0.50_0.04_290)] hover:text-[oklch(0.93_0.02_80)] hover:bg-[oklch(0.65_0.15_80/0.05)]",
    badgeSuccess: "inline-block w-2 h-2 mr-2 rounded-none bg-[oklch(0.72_0.15_75)]",
    badgeWarning: "inline-block w-2 h-2 mr-2 rounded-none bg-[#ef4444]",
    flexBetween: "flex justify-between items-center rounded-none",
    grid2: "grid grid-cols-1 md:grid-cols-2 gap-6 rounded-none",
    grid4: "grid grid-cols-2 md:grid-cols-4 gap-4 rounded-none",
    logItem: "p-3 border-l-[2px] border-[oklch(0.55_0.18_300)] bg-[oklch(0.55_0.18_300/0.05)] mb-2 text-sm flex justify-between items-start rounded-none hover:bg-[oklch(0.55_0.18_300/0.1)] transition-colors"
  }

  // Placeholder static data
  const items = [
    { _id: '1', sku: 'SWG-TS-M', name: 'Classic Logo Tee', size: 'M', count: 45, threshold: 10 },
    { _id: '2', sku: 'SWG-TUMB-BL', name: 'Matte Tumbler', size: 'N/A', count: 8, threshold: 20 },
  ]

  const history = [
    { _id: 'h1', sku: 'SWG-TUMB-BL', person: 'Alice', qty: 15, date: '2023-10-25' },
    { _id: 'h2', sku: 'SWG-TS-M', person: 'Bob', qty: 5, date: '2023-10-24' }
  ]

  const { useLiveQuery, database } = useFireproof("swag-vault");
  
  const { docs: liveItems } = useLiveQuery("type", { key: "item" });
  const { docs: liveTransactions } = useLiveQuery("type", { descending: true });

  const activeItems = liveItems.length > 0 ? liveItems : items;
  const historyLog = liveTransactions.filter(d => d.type === 'checkout' || d.type === 'receive' || d.type === 'request');

  const [expandedRow, setExpandedRow] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState({ sku: '', name: '', size: 'N/A', count: 0, threshold: 10 })
  const [checkoutData, setCheckoutData] = useState({ person: '', qty: 1 })
  const [requestText, setRequestText] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.sku || !newItem.name) return;
    
    await database.put({ ...newItem, type: 'item', createdAt: Date.now() });
    await database.put({
      type: 'receive',
      sku: newItem.sku,
      qty: newItem.count,
      person: 'Initial Stock',
      date: new Date().toISOString(),
      createdAt: Date.now()
    });
    
    setNewItem({ sku: '', name: '', size: 'N/A', count: 0, threshold: 10 });
    setShowAddForm(false);
  }

  const handleCheckout = async (item) => {
    if (!checkoutData.person || checkoutData.qty < 1) return;
    
    // Update inventory count
    await database.put({ ...item, count: item.count - checkoutData.qty });
    
    // Log transaction
    await database.put({
      type: 'checkout',
      sku: item.sku,
      person: checkoutData.person,
      qty: checkoutData.qty,
      date: new Date().toISOString(),
      createdAt: Date.now()
    });
    
    setCheckoutData({ person: '', qty: 1 });
    setExpandedRow(null);
  }

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!requestText) return;
    
    await database.put({
      type: 'request',
      content: requestText,
      date: new Date().toISOString(),
      createdAt: Date.now()
    });
    
    setRequestText('');
  }

  const suggestSwag = async () => {
    setIsAiLoading(true);
    try {
      const res = await callAI("Suggest 1 extremely cool, high-end piece of modern tech-conference marketing swag (e.g. 'Matte Black Anker Powerbank' or 'Branded YETI Mug'). Describe briefly.", {
        schema: { properties: { suggestion: { type: 'string' } } }
      });
      const data = JSON.parse(res);
      setRequestText(data.suggestion);
    } finally {
      setIsAiLoading(false);
    }
  }

  return (
    <div className={c.page}>
      <style>{c.fontLoader}</style>
      
      <header className={c.header}>
        <div>
          <h1 className={c.title}>Vault_MQ</h1>
          <p className={c.subtitle}>Marketing Assets Ledger</p>
        </div>
        <div className="mt-4 md:mt-0">
          <button className={c.btnPrimary} onClick={() => setShowAddForm(!showAddForm)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Receive Stock
          </button>
        </div>
      </header>

      {showAddForm && (
        <section className={c.card}>
          <h2 className="uppercase text-sm tracking-widest mb-4">Inbound Receipt</h2>
          <form className="space-y-4" onSubmit={handleAddItem}>
            <div className={c.grid4}>
              <div>
                <label className={c.label}>SKU</label>
                <input className={c.input} placeholder="SWG-..." value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className={c.label}>Asset Name</label>
                <input className={c.input} placeholder="Item description" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              </div>
              <div>
                <label className={c.label}>Initial Count</label>
                <input className={c.input} type="number" placeholder="0" value={newItem.count} onChange={e => setNewItem({...newItem, count: parseInt(e.target.value) || 0})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className={c.btnGhost} onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className={c.btnPrimary}>Commit to Ledger</button>
            </div>
          </form>
        </section>
      )}

      <section className="mb-12">
        <div className={c.card + " overflow-x-auto"}>
          <table className={c.table}>
            <thead>
              <tr>
                <th className={c.th}>Status</th>
                <th className={c.th}>SKU</th>
                <th className={c.th}>Asset Descriptor</th>
                <th className={c.th}>Variant</th>
                <th className={c.th + " text-right"}>Qty Available</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map(item => (
                <React.Fragment key={item._id}>
                  <tr 
                    className="cursor-pointer transition-colors hover:bg-[oklch(0.55_0.18_300/0.1)]" 
                    onClick={() => setExpandedRow(expandedRow === item._id ? null : item._id)}
                  >
                    <td className={c.td}>
                      <span className={item.count < item.threshold ? c.badgeWarning : c.badgeSuccess}></span>
                    </td>
                    <td className={c.tdMono}>{item.sku}</td>
                    <td className={c.td}>{item.name}</td>
                    <td className={c.tdMono}>{item.size}</td>
                    <td className={c.tdMono + " text-right font-bold text-lg"}>{item.count}</td>
                  </tr>
                  
                  {expandedRow === item._id && (
                    <tr className="bg-[oklch(0.08_0.03_280)]">
                      <td colSpan="5" className="p-0 border-b-[1px] border-[oklch(0.65_0.15_80/0.12)]">
                        <div className="p-4 pl-12 border-l-[2px] border-[oklch(0.72_0.15_75)] ml-2">
                          <div className={c.flexBetween + " mb-4"}>
                            <h4 className="text-xs uppercase tracking-widest text-[oklch(0.50_0.04_290)]">Disbursement Protocol</h4>
                          </div>
                          
                          <form className="flex items-end gap-4 mb-6" onSubmit={(e) => { e.preventDefault(); handleCheckout(item); }}>
                            <div className="flex-1">
                              <label className={c.label}>Requisitioner</label>
                              <input className={c.input} placeholder="Name or Dept" value={checkoutData.person} onChange={e => setCheckoutData({...checkoutData, person: e.target.value})} required />
                            </div>
                            <div>
                              <label className={c.label}>Units</label>
                              <input className={c.inputMono} type="number" min="1" max={item.count} value={checkoutData.qty} onChange={e => setCheckoutData({...checkoutData, qty: parseInt(e.target.value) || 1})} />
                            </div>
                            <button type="submit" className={c.btnPrimary} disabled={!checkoutData.person}>Authorize</button>
                          </form>

                          <h4 className="text-xs uppercase tracking-widest mb-2 border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] pb-2 text-[oklch(0.50_0.04_290)] mt-8">Ledger History</h4>
                          {historyLog.filter(h => h.sku === item.sku && h.type === 'checkout').length === 0 && <p className="text-xs text-[oklch(0.50_0.04_290)] italic mt-2">No disbursements recorded.</p>}
                          {historyLog.filter(h => h.sku === item.sku && h.type === 'checkout').map(h => (
                            <div key={h._id} className={c.flexBetween + " py-2 border-b-[1px] border-[oklch(0.65_0.15_80/0.12)] last:border-0 text-sm text-[oklch(0.93_0.02_80)] bg-[oklch(0.65_0.15_80/0.02)] px-2"}>
                              <span className="opacity-70 font-mono text-xs text-[oklch(0.55_0.18_300)]">{new Date(h.date).toLocaleDateString()}</span>
                              <span>{h.person}</span>
                              <span className="font-mono text-xs text-[oklch(0.72_0.15_75)]">-{h.qty}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={c.grid2}>
        <section className={c.card}>
          <div className={c.flexBetween + " mb-4"}>
            <h2 className="uppercase text-sm tracking-widest text-[oklch(0.50_0.04_290)]">Procurement Request</h2>
            <button type="button" onClick={suggestSwag} disabled={isAiLoading} className={c.btnGhost + " flex items-center gap-2 border-[1px] border-[oklch(0.55_0.18_300)] disabled:opacity-50"}>
               {isAiLoading ? (
                 <svg className="animate-spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10"/></svg>
               ) : (
                 <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20L12 2z"/></svg>
               )}
               {isAiLoading ? 'Analyzing...' : 'Suggest Asset'}
            </button>
          </div>
          <form className="space-y-4" onSubmit={handleRequest}>
            <div>
              <label className={c.label}>Requested Asset</label>
              <textarea className={c.input + " resize-none h-24"} placeholder="Describe the swag needed..." value={requestText} onChange={e => setRequestText(e.target.value)} />
            </div>
            <button type="submit" className={c.btnPrimary + " w-full"} disabled={!requestText}>Submit Request</button>
          </form>
        </section>

        <section className={c.card + " overflow-y-auto max-h-[320px]"}>
          <h2 className="uppercase text-sm tracking-widest mb-4 text-[oklch(0.50_0.04_290)]">Transaction Audit Log</h2>
          <div className="space-y-2">
            {historyLog.length === 0 && <div className="text-xs text-[oklch(0.50_0.04_290)] italic">Awaiting net-new transactions.</div>}
            {historyLog.map(h => (
              <div key={h._id} className={c.logItem}>
                <div className="flex-1">
                  <div className="text-[10px] font-mono uppercase opacity-70 text-[oklch(0.55_0.18_300)] mb-1">{new Date(h.date).toLocaleString()} / {h.type}</div>
                  <div className="text-[oklch(0.93_0.02_80)]">
                    {h.type === 'request' ? h.content : `${h.type === 'checkout' ? 'Outbound' : 'Inbound'}: ${h.sku}`}
                  </div>
                  {h.person && <div className="text-xs mt-1 text-[oklch(0.50_0.04_290)]">{h.person}</div>}
                </div>
                {h.qty && (
                  <div className={`font-mono text-xs ${h.type === 'checkout' ? 'text-[oklch(0.72_0.15_75)]' : 'text-[#10b981]'}`}>
                    {h.type === 'checkout' ? '-' : '+'}{h.qty}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}