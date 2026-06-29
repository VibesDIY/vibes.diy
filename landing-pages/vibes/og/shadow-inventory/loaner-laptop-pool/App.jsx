App.jsx
import React, { useState } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("vault-loaners");
  const [activeTab, setActiveTab] = useState("ledger");
  const [isLoading, setIsLoading] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState(null);
  const [returningLaptop, setReturningLaptop] = useState(null);

  const { docs: laptops } = useLiveQuery("type", { key: "laptop" });
  const { docs: requests } = useLiveQuery("type", { key: "request", descending: true });
  const { docs: logs } = useLiveQuery("type", { key: "log", descending: true });

  const ensureSeedData = async () => {
    if (laptops.length > 0) return;
    await database.put({ type: 'laptop', sku: 'LPT-001', model: 'MBP 14" M2', status: 'available', holder: null });
    await database.put({ type: 'laptop', sku: 'LPT-002', model: 'ThinkPad X1', status: 'available', holder: null });
    await database.put({ type: 'laptop', sku: 'LPT-003', model: 'Dell XPS 13', status: 'missing', holder: 'Lost in Shipping' });
  };
  
  React.useEffect(() => { ensureSeedData(); }, [laptops.length]);

  const { doc: newRequest, merge: mergeRequest, submit: submitRequest } = useDocument({
    type: 'request',
    requester: '',
    purpose: '',
    status: 'pending',
    createdAt: Date.now()
  });

  const assignLaptop = async (laptop, request) => {
    await database.put({ ...laptop, status: 'checked_out', holder: request.requester });
    await database.put({ ...request, status: 'fulfilled' });
    await database.put({ 
      type: 'log', action: 'CHECKOUT', laptopId: laptop.sku, user: request.requester, 
      notes: `Req: ${request.purpose}`, date: Date.now() 
    });
    setFulfillingRequest(null);
    setActiveTab('ledger');
  };

  const processReturn = async (laptop, condition) => {
    await database.put({ ...laptop, status: 'available', holder: null });
    await database.put({ 
      type: 'log', action: 'RETURN', laptopId: laptop.sku, user: laptop.holder, 
      notes: condition, date: Date.now() 
    });
    setReturningLaptop(null);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!newRequest.requester) return;
    await submitRequest();
  };

  const c = {
    page: "min-h-screen p-4 md:p-8 font-sans flex flex-col items-center bg-[oklch(0.08_0.03_280)] text-[oklch(0.93_0.02_80)]",
    container: "w-full max-w-5xl flex flex-col gap-6",
    header: "flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4",
    title: "font-mono text-xl uppercase tracking-widest",
    tabList: "flex gap-4 font-mono text-sm",
    tab: "uppercase pb-1 border-b-2 border-[oklch(0.72_0.15_75)] text-[oklch(0.72_0.15_75)] font-bold",
    tabInactive: "uppercase pb-1 border-b-2 border-transparent text-[oklch(0.50_0.04_290)] hover:text-[oklch(0.93_0.02_80)] cursor-pointer transition-colors",
    
    card: "p-5 border border-[oklch(0.65_0.15_80_/_0.12)] bg-[oklch(0.12_0.03_280_/_0.7)] flex flex-col gap-4 backdrop-blur-md",
    cardTitle: "font-mono uppercase text-sm tracking-wide mb-2 text-[oklch(0.50_0.04_290)]",
    
    ledgerGrid: "w-full text-left border-collapse",
    th: "font-mono text-xs uppercase p-3 border-b border-[oklch(0.65_0.15_80_/_0.12)] text-[oklch(0.50_0.04_290)]",
    td: "p-3 border-b border-[oklch(0.65_0.15_80_/_0.12)] text-sm",
    tdMono: "p-3 border-b border-[oklch(0.65_0.15_80_/_0.12)] text-sm font-mono text-[oklch(0.72_0.15_75)]",
    
    flexBetween: "flex justify-between items-center",
    pip: "w-2 h-2 inline-block mr-3",
    pipAvailable: "bg-[oklch(0.72_0.15_75)]",
    pipCheckedOut: "bg-[oklch(0.55_0.18_300)]",
    pipMissing: "bg-red-600",
    
    form: "flex flex-col gap-4",
    field: "flex flex-col gap-1",
    label: "font-mono text-xs uppercase text-[oklch(0.50_0.04_290)]",
    input: "bg-transparent border-b border-[oklch(0.65_0.15_80_/_0.12)] p-2 font-sans w-full focus:outline-none min-h-[44px] focus:border-[oklch(0.72_0.15_75)] transition-colors placeholder-[oklch(0.50_0.04_290)]",
    inputMono: "bg-transparent border border-[oklch(0.65_0.15_80_/_0.12)] p-2 font-mono text-center w-16 focus:outline-none focus:border-[oklch(0.72_0.15_75)]",
    
    btn: "font-mono uppercase text-xs p-3 font-bold flex justify-center items-center gap-2 bg-[oklch(0.72_0.15_75)] text-[oklch(0.08_0.03_280)] hover:bg-[oklch(0.55_0.18_300)] hover:text-white transition-colors cursor-pointer",
    btnSmall: "font-mono uppercase text-[10px] px-2 py-1 border border-[oklch(0.65_0.15_80_/_0.12)] hover:border-[oklch(0.72_0.15_75)] hover:text-[oklch(0.72_0.15_75)] transition-colors cursor-pointer",
    
    logRow: "flex justify-between p-3 border-b border-[oklch(0.65_0.15_80_/_0.12)] text-sm hover:bg-[oklch(0.12_0.03_280)]",
    logMeta: "flex flex-col gap-1",
    logTime: "font-mono text-xs text-[oklch(0.50_0.04_290)]"
  };

  return (
    <div className={c.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        * { border-radius: 0 !important; }
      `}</style>
      
      <div className={c.container}>
        <header className={c.header}>
          <div>
            <h1 className={c.title}>Vault // Loaner Pool</h1>
          </div>
          <nav className={c.tabList}>
            <button className={activeTab === 'ledger' ? c.tab : c.tabInactive} onClick={() => setActiveTab('ledger')}>Ledger</button>
            <button className={activeTab === 'requests' ? c.tab : c.tabInactive} onClick={() => setActiveTab('requests')}>Requests</button>
            <button className={activeTab === 'history' ? c.tab : c.tabInactive} onClick={() => setActiveTab('history')}>History</button>
          </nav>
        </header>

        <main className="w-full">
          {activeTab === 'ledger' && (
            <section className={`${c.card} relative`}>
              {returningLaptop && (
                <div className="absolute inset-0 z-10 bg-[oklch(0.08_0.03_280_/_0.9)] backdrop-blur p-6 flex flex-col gap-4 border border-[oklch(0.72_0.15_75)] outline outline-4 outline-[oklch(0.08_0.03_280)]">
                  <h3 className="font-mono text-[oklch(0.72_0.15_75)] uppercase mb-2">Process Return: {returningLaptop.sku}</h3>
                  <p className="text-sm">Held by: {returningLaptop.holder}</p>
                  <label className={c.label}>Condition Notes</label>
                  <form onSubmit={e => { e.preventDefault(); processReturn(returningLaptop, e.target.condition.value); }} className="flex flex-col gap-4">
                    <input name="condition" className={c.input} placeholder="e.g. Scratched lid, missing charger" required defaultValue="Good condition" />
                    <div className="flex gap-4 mt-2">
                       <button type="submit" className={c.btn}>Confirm Return</button>
                       <button type="button" className={c.btnSmall} onClick={() => setReturningLaptop(null)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
              <h2 className={c.cardTitle}>Inventory Pool</h2>
              <div className="overflow-x-auto">
                <table className={c.ledgerGrid}>
                  <thead>
                    <tr>
                      <th className={c.th}>Status</th>
                      <th className={c.th}>SKU</th>
                      <th className={c.th}>Model</th>
                      <th className={c.th}>Holder</th>
                      <th className={c.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laptops.map(lp => (
                      <tr key={lp._id} className="hover:bg-[oklch(0.12_0.03_280)]">
                        <td className={c.td}>
                          <span className={`${c.pip} ${lp.status==='available'?c.pipAvailable:lp.status==='checked_out'?c.pipCheckedOut:c.pipMissing}`}></span> 
                          <span className="capitalize">{lp.status.replace('_','-')}</span>
                        </td>
                        <td className={c.tdMono}>{lp.sku}</td>
                        <td className={c.td}>{lp.model}</td>
                        <td className={c.td}>{lp.holder || '--'}</td>
                        <td className={c.td}>
                          {lp.status === 'checked_out' && (
                            <button className={c.btnSmall} onClick={() => setReturningLaptop(lp)}>Return</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'requests' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <section className={c.card}>
                <h2 className={c.cardTitle}>New Request</h2>
                <form className={c.form} onSubmit={handleRequestSubmit}>
                  <div className={c.field}>
                    <label className={c.label}>Requester Name</label>
                    <input className={c.input} type="text" placeholder="First Last" 
                           value={newRequest.requester} onChange={e => mergeRequest({ requester: e.target.value })} />
                  </div>
                  <div className={c.field}>
                    <label className={c.label}>Purpose / Justification</label>
                    <div className="flex gap-2 items-center">
                       <input className={c.input} type="text" placeholder="e.g. Travel, Break-fix"
                              value={newRequest.purpose} onChange={e => mergeRequest({ purpose: e.target.value })} />
                       <button type="button" onClick={async () => {
                         setIsLoading(true);
                         try {
                           const res = await callAI("Suggest a short valid corporate reason for requesting a loaner laptop", { schema: { properties: { reason: { type: 'string' } } }});
                           mergeRequest({ purpose: JSON.parse(res).reason });
                         } finally { setIsLoading(false); }
                       }} className={c.btnSmall} disabled={isLoading}>
                         {isLoading ? '...' : 'AI'}
                       </button>
                    </div>
                  </div>
                  <button type="submit" className={c.btn}>Submit Request</button>
                </form>
              </section>

              <section className={c.card}>
                <h2 className={c.cardTitle}>
                  {fulfillingRequest ? `Fulfill: ${fulfillingRequest.requester}` : 'Pending Queue'}
                </h2>
                
                {fulfillingRequest ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm border-l-2 pl-3 border-[oklch(0.72_0.15_75)]">Assign an available unit to fulfill this request.</p>
                    <div className="flex flex-col gap-2">
                      {laptops.filter(l => l.status === 'available').map(l => (
                        <div key={l._id} className="border border-[oklch(0.65_0.15_80_/_0.12)] p-2 flex justify-between items-center bg-[oklch(0.08_0.03_280)]">
                          <span className="font-mono text-sm">{l.sku} - {l.model}</span>
                          <button className={c.btnSmall} onClick={() => assignLaptop(l, fulfillingRequest)}>Assign</button>
                        </div>
                      ))}
                    </div>
                    <button className={`${c.btnSmall} mt-4 self-start`} onClick={() => setFulfillingRequest(null)}>Cancel</button>
                  </div>
                ) : (
                <div className="flex flex-col gap-2">
                  {requests.filter(r => r.status === 'pending').length === 0 && <span className="text-sm text-[oklch(0.50_0.04_290)]">No pending requests.</span>}
                  {requests.filter(r => r.status === 'pending').map(req => (
                    <div key={req._id} className="border border-[oklch(0.65_0.15_80_/_0.12)] p-3 flex flex-col gap-2">
                      <div className={c.flexBetween}>
                        <span className="font-bold text-[oklch(0.72_0.15_75)]">{req.requester}</span>
                        <span className="text-xs font-mono text-[oklch(0.50_0.04_290)]">{new Date(req.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <span className="text-sm italic">"{req.purpose}"</span>
                      <button className={c.btnSmall} onClick={() => setFulfillingRequest(req)}>Fulfill</button>
                    </div>
                  ))}
                </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <section className={c.card}>
              <h2 className={c.cardTitle}>Audit Log</h2>
              <div className="flex flex-col max-h-[60vh] overflow-y-auto">
                {logs.length === 0 && <span className="text-sm text-[oklch(0.50_0.04_290)] p-3">No log entries yet.</span>}
                {logs.map(log => (
                  <div key={log._id} className={c.logRow}>
                    <div className={c.logMeta}>
                      <span className="font-bold text-[oklch(0.72_0.15_75)]">{log.action}: {log.laptopId}</span>
                      <span className="text-[oklch(0.93_0.02_80)]">{log.action==='CHECKOUT' ? 'Assigned to' : 'Returned by'} {log.user}</span>
                      <span className="text-xs italic text-[oklch(0.50_0.04_290)]">"{log.notes}"</span>
                    </div>
                    <div className="text-right flex flex-col gap-1 min-w-max">
                      <span className={c.logTime}>{new Date(log.date).toLocaleDateString()}</span>
                      <span className={c.logTime}>{new Date(log.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}