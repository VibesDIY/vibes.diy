import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("av-ledger-db")
  const inventoryQuery = useLiveQuery("type", { key: "inventory", descending: true })
  const shootsQuery = useLiveQuery("type", { key: "shoot", descending: true })

  const [activeTab, setActiveTab] = React.useState("ledger")
  const [isLoading, setIsLoading] = React.useState(false)
  const [newShoot, setNewShoot] = React.useState({ name: "", dates: "" })
  const [selectedSKUs, setSelectedSKUs] = React.useState([])
  const [logForm, setLogForm] = React.useState({ sku: "", note: "" })

  React.useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=optional');`
    document.head.appendChild(style)
  }, [])

  const c = {
    page: "min-h-screen p-4 md:p-8 flex flex-col font-sans bg-[oklch(0.08_0.03_280)] text-[oklch(0.93_0.02_80)]",
    header: "flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-4 border-b border-[oklch(0.65_0.15_80/0.12)] gap-4",
    title: "text-2xl font-bold uppercase tracking-wider tracking-widest text-[oklch(0.72_0.15_75)]",
    nav: "flex gap-2",
    navBtn: "px-4 py-2 uppercase text-sm tracking-wide font-mono transition-colors text-[oklch(0.50_0.04_290)] hover:text-[oklch(0.93_0.02_80)]",
    navBtnActive: "px-4 py-2 uppercase text-sm tracking-wide font-mono font-bold transition-colors bg-[oklch(0.72_0.15_75)] text-[oklch(0.10_0.03_280)]",
    main: "flex-1 grid gap-8 md:grid-cols-12",
    content: "col-span-12 md:col-span-8 lg:col-span-9 flex flex-col gap-6",
    sidebar: "col-span-12 md:col-span-4 lg:col-span-3 flex flex-col gap-6",
    card: "p-6 border border-[oklch(0.65_0.15_80/0.12)] bg-[oklch(0.12_0.03_280/0.7)] backdrop-blur-sm shadow-sm",
    table: "w-full text-left border-collapse",
    th: "p-3 border-b border-[oklch(0.65_0.15_80/0.12)] font-mono text-xs uppercase text-left text-[oklch(0.50_0.04_290)]",
    td: "p-3 border-b border-[oklch(0.65_0.15_80/0.12)] text-sm items-center",
    skutxt: "font-mono text-xs uppercase",
    pip: "w-2 h-2 inline-block mr-3 rounded-none",
    pipAvail: "bg-[oklch(0.72_0.15_75)]",
    pipOut: "bg-[oklch(0.50_0.04_290)]",
    pipMiss: "bg-red-600",
    btnPrimary: "px-4 py-3 uppercase text-xs font-mono font-bold w-full md:w-auto text-center transition-colors shadow-sm bg-[oklch(0.72_0.15_75)] text-[oklch(0.10_0.03_280)] hover:bg-[oklch(0.55_0.18_300)] hover:text-white border-none",
    btnSecondary: "px-4 py-2 uppercase text-xs font-mono w-full md:w-auto text-center transition-colors border border-[oklch(0.65_0.15_80/0.4)] text-[oklch(0.72_0.15_75)] hover:bg-[oklch(0.65_0.15_80/0.1)]",
    inputRow: "flex flex-col gap-1 mb-5",
    label: "font-mono text-xs uppercase tracking-widest text-[oklch(0.50_0.04_290)]",
    input: "py-2 border-b border-[oklch(0.65_0.15_80/0.4)] focus:border-[oklch(0.72_0.15_75)] w-full bg-transparent font-mono outline-none text-sm transition-all shadow-none text-[oklch(0.93_0.02_80)] placeholder:text-[oklch(0.50_0.04_290)]",
    checkbox: "w-4 h-4 border rounded-none appearance-none mr-3 checked:bg-current",
    listItem: "flex justify-between items-center py-3 border-b last:border-0",
  }

  async function populateAIGear() {
    setIsLoading(true)
    try {
      const resp = await callAI("Generate a list of 5 standard video production AV items for an inventory pool: maybe 2 cameras, 2 lav mics, 1 lighting kit. Provide item name, a unique short uppercase SKU, and a default condition of 'Good'.", {
        schema: {
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {type: "string"},
                  sku: {type: "string"},
                  condition: {type: "string"}
                }
              }
            }
          }
        }
      })
      
      const parsed = JSON.parse(resp)
      for (const item of parsed.items) {
        await database.put({ ...item, type: "inventory", status: "Available", addedAt: Date.now() })
      }
    } catch(e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  function handleTabClick(e) {
    e.preventDefault()
  }

  function handleSubmit(e) {
    e.preventDefault()
  }

  async function handleMaintenanceLog(e) {
    e.preventDefault()
    if (!logForm.sku || !logForm.note) return
    const item = inventoryQuery.docs.find(d => d.sku.toLowerCase() === logForm.sku.toLowerCase())
    if (item) {
       await database.put({ ...item, condition: logForm.note })
       setLogForm({ sku: "", note: "" })
    } else {
       alert("SKU not found in ledger.")
    }
  }

  async function handleReturn(shoot) {
    if(!window.confirm(`Check in gear for ${shoot.name}?`)) return
    
    // Set shoot to completed
    await database.put({ ...shoot, status: "Completed", returnedAt: Date.now() })
    
    // Release items back to available
    for (const sku of shoot.items) {
      const item = inventoryQuery.docs.find(d => d.sku === sku)
      if (item) {
        await database.put({ ...item, status: "Available" })
      }
    }
  }

  async function handleCreateShoot(e) {
    e.preventDefault()
    if (!newShoot.name || selectedSKUs.length === 0) return
    
    // Save shoot doc
    await database.put({
      type: "shoot",
      name: newShoot.name,
      dates: newShoot.dates,
      items: selectedSKUs,
      status: "Active",
      createdAt: Date.now()
    })

    // Update items to checked-out
    for (const sku of selectedSKUs) {
      const item = inventoryQuery.docs.find(d => d.sku === sku)
      if (item) await database.put({ ...item, status: "Checked-Out" })
    }

    setNewShoot({ name: "", dates: "" })
    setSelectedSKUs([])
    setActiveTab("shoots")
  }

  return (
    <div id="app" className={`${c.page} font-['Inter',sans-serif]`}>
      <header className={c.header}>
        <div>
          <h1 className={c.title}>AV_LEDGER</h1>
          <p className="font-mono text-xs uppercase mt-1">Internal Gear Pool</p>
        </div>
        <nav className={c.nav}>
          <button 
            className={activeTab === 'ledger' ? c.navBtnActive : c.navBtn} 
            onClick={() => setActiveTab('ledger')}
          >Ledger</button>
          <button 
            className={activeTab === 'shoots' ? c.navBtnActive : c.navBtn} 
            onClick={() => setActiveTab('shoots')}
          >Shoots</button>
        </nav>
      </header>

      <main className={c.main}>
        <section id="main-content" className={c.content}>
          
          {activeTab === 'ledger' && (
            <div className={c.card}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-mono text-sm uppercase font-bold text-[oklch(0.50_0.04_290)]">Current Inventory</h2>
                {inventoryQuery.docs.length === 0 && (
                  <button className={c.btnSecondary} onClick={populateAIGear} disabled={isLoading}>
                    {isLoading ? "Provisioning..." : "Initialize AI Pool"}
                  </button>
                )}
              </div>
              
              <table className={c.table}>
                <thead>
                  <tr>
                    <th className={c.th}>Status</th>
                    <th className={c.th}>SKU</th>
                    <th className={c.th}>Item</th>
                    <th className={c.th}>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryQuery.docs.map(item => (
                    <tr key={item._id}>
                      <td className={c.td}>
                        <span className={`${c.pip} ${item.status === 'Checked-Out' ? c.pipOut : item.status === 'Missing' ? c.pipMiss : c.pipAvail}`}></span>
                        {item.status}
                      </td>
                      <td className={`${c.td} ${c.skutxt}`}>{item.sku}</td>
                      <td className={c.td}>{item.name}</td>
                      <td className={c.td}>{item.condition}</td>
                    </tr>
                  ))}
                  {inventoryQuery.docs.length === 0 && !isLoading && (
                    <tr><td colSpan="4" className={`${c.td} text-center italic`}>Vault is empty.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'shoots' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-mono text-sm uppercase font-bold text-[oklch(0.50_0.04_290)]">Active Assignments</h2>
              </div>
              {shootsQuery.docs.length === 0 && (
                <p className="text-sm text-[oklch(0.50_0.04_290)] italic">No active shoots. Use the sidebar to reserve gear.</p>
              )}
              
              {shootsQuery.docs.map(shoot => (
                <div key={shoot._id} className={c.card}>
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <h3 className="font-bold text-lg">{shoot.name}</h3>
                       <p className="font-mono text-xs text-[oklch(0.50_0.04_290)] mt-1">{shoot.dates} &bull; {shoot.status}</p>
                     </div>
                     {shoot.status === 'Active' && (
                       <button 
                         className="px-3 py-1 text-xs font-mono uppercase border border-[oklch(0.65_0.15_80/0.4)] hover:bg-[oklch(0.72_0.15_75)] hover:text-black transition-colors"
                         onClick={() => handleReturn(shoot)}
                       >
                         Check In All
                       </button>
                     )}
                   </div>
                   
                   <div className="mt-4 border-t border-[oklch(0.65_0.15_80/0.12)] pt-4 space-y-2">
                     {shoot.items?.map(sku => {
                       const relatedItem = inventoryQuery.docs.find(d => d.sku === sku)
                       return (
                          <div key={sku} className="flex justify-between text-sm items-center">
                             <span>
                               <span className={`${c.skutxt} text-[oklch(0.50_0.04_290)] mr-3`}>{sku}</span> 
                               {relatedItem?.name || "Unknown Item"}
                             </span>
                             {shoot.status === 'Active' && relatedItem?.status === 'Checked-Out' && (
                                <span className="text-[oklch(0.72_0.15_75)] text-xs font-mono">OUT</span>
                             )}
                          </div>
                       )
                     })}
                   </div>
                </div>
              ))}
            </div>
          )}

        </section>

        <aside id="sidebar-actions" className={c.sidebar}>
          {activeTab === 'ledger' && (
             <div className={c.card}>
              <h3 className="font-mono text-sm uppercase mb-4 font-bold text-[oklch(0.72_0.15_75)]">Quick Maintenance</h3>
              <form onSubmit={handleMaintenanceLog}>
                 <div className={c.inputRow}>
                  <label className={c.label}>SKU</label>
                  <input className={c.input} type="text" placeholder="LAV-012" value={logForm.sku} onChange={e => setLogForm({...logForm, sku: e.target.value})} />
                </div>
                 <div className={c.inputRow}>
                  <label className={c.label}>Condition Note</label>
                  <input className={c.input} type="text" placeholder="Antenna bent..." value={logForm.note} onChange={e => setLogForm({...logForm, note: e.target.value})} />
                </div>
                <button className={c.btnPrimary} type="submit" disabled={!logForm.sku || !logForm.note}>Update Ledger</button>
              </form>
            </div>
          )}

          {activeTab === 'shoots' && (
             <div className={c.card}>
              <h3 className="font-mono text-sm uppercase mb-4 font-bold text-[oklch(0.72_0.15_75)]">New Reservation</h3>
              <form onSubmit={handleCreateShoot}>
                <div className={c.inputRow}>
                  <div className="flex justify-between items-end">
                    <label className={c.label}>Project Name</label>
                    <button type="button" onClick={async () => {
                      setIsLoading(true)
                      try {
                        const res = await callAI("Suggest a typical corporate video shoot project name (e.g., 'CEO Keynote Q3', 'Studio Product Demo'). Return just the name.", {schema: {properties: {name: {type: "string"}}}})
                        setNewShoot({...newShoot, name: JSON.parse(res).name})
                      } finally { setIsLoading(false) }
                    }} className="text-[10px] font-mono hover:text-[oklch(0.72_0.15_75)]">AI Suggest</button>
                  </div>
                  <input className={c.input} type="text" value={newShoot.name} onChange={e => setNewShoot({...newShoot, name: e.target.value})} placeholder="C-Suite Interviews" disabled={isLoading} />
                </div>
                <div className={c.inputRow}>
                  <label className={c.label}>Dates</label>
                  <input className={c.input} type="text" value={newShoot.dates} onChange={e => setNewShoot({...newShoot, dates: e.target.value})} placeholder="Oct 20-22" />
                </div>
                
                <div className="font-mono text-xs uppercase text-[oklch(0.50_0.04_290)] mb-3 mt-6">Select from Ledger</div>
                {inventoryQuery.docs.filter(d => d.status === 'Available').length === 0 ? (
                  <p className="text-xs mb-4 italic">No available gear.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto mb-6 pr-2 custom-scrollbar space-y-2">
                    {inventoryQuery.docs.filter(d => d.status === 'Available').map(item => (
                       <label key={item._id} className="flex items-center text-sm cursor-pointer hover:text-[oklch(0.72_0.15_75)]">
                          <input 
                            type="checkbox" 
                            className="mr-3" 
                            checked={selectedSKUs.includes(item.sku)}
                            onChange={(e) => {
                              if(e.target.checked) setSelectedSKUs([...selectedSKUs, item.sku])
                              else setSelectedSKUs(selectedSKUs.filter(s => s !== item.sku))
                            }} 
                           />
                          <span className={`${c.skutxt} mr-2 text-[oklch(0.50_0.04_290)]`}>{item.sku}</span> {item.name}
                       </label>
                    ))}
                  </div>
                )}

                <button className={c.btnPrimary} type="submit" disabled={!newShoot.name || selectedSKUs.length === 0}>Checkout Gear</button>
              </form>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}