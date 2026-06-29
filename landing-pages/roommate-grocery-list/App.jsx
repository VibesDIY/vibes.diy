import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [name, setName] = React.useState(() => localStorage.getItem("stash-name") || "")
  const [draftName, setDraftName] = React.useState(name)
  const saveName = () => {
    const n = draftName.trim()
    if (!n) return
    localStorage.setItem("stash-name", n)
    setName(n)
  }
  const { useDocument, useLiveQuery, database } = useFireproof("stash-grocery")
  const { docs: items } = useLiveQuery("type", { key: "item" })
  const claim = (item) => {
    if (!name) { alert("Set your name first"); return }
    database.put({ ...item, claimedBy: name })
  }
  const unclaim = (item) => database.put({ ...item, claimedBy: null })
  const checkOff = (item) => {
    if (!name) { alert("Set your name first"); return }
    const p = prompt(`What did you pay for ${item.name}?`, "0.00")
    if (p === null) return
    const price = parseFloat(p) || 0
    database.put({ ...item, checked: true, price, paidBy: name, claimedBy: item.claimedBy || name })
  }
  const removeItem = (item) => database.del(item._id)
  const { doc: newItem, merge: mergeItem, submit: submitItem } = useDocument({
    type: "item",
    name: "",
    qty: "1",
    claimedBy: null,
    checked: false,
    price: null,
    paidBy: null,
    createdAt: Date.now(),
  })
  const [suggestLoading, setSuggestLoading] = React.useState(false)
  const suggestStaples = async () => {
    setSuggestLoading(true)
    try {
      const res = await callAI("Suggest 5 common household grocery staples someone might need to restock. Return short item names only.", {
        schema: { properties: { items: { type: "array", items: { type: "string" } } } }
      })
      const { items } = JSON.parse(res)
      for (const n of items) {
        await database.put({ type: "item", name: n, qty: "1", claimedBy: null, checked: false, price: null, paidBy: null, createdAt: Date.now() })
      }
    } finally { setSuggestLoading(false) }
  }
  const c = {
    page: "min-h-screen bg-[#faf7ee] text-[#1a1626] font-['Space_Grotesk',sans-serif] pb-32",
    header: "bg-white border-b-[3px] border-[#1a1626] px-5 py-4 sticky top-0 z-20 shadow-[0_4px_0_0_#1a1626]",
    logo: "flex items-center gap-2",
    logoSquares: "flex gap-1",
    sq: "w-3 h-3 border-2 border-[#1a1626]",
    brand: "text-2xl font-bold uppercase tracking-tight",
    main: "max-w-[920px] mx-auto px-4 py-5 space-y-5",
    section: "bg-white border-[3px] border-[#1a1626] rounded-[4px] shadow-[4px_4px_0_0_#1a1626] p-5",
    sectionTitle: "text-xs uppercase tracking-[0.15em] font-bold text-[#5a5670] mb-3",
    h2: "text-xl font-bold uppercase tracking-tight mb-3",
    input: "w-full border-[3px] border-[#1a1626] rounded-[4px] px-3 py-3 text-base font-medium bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0_0_#1a1626] transition-all min-h-[44px]",
    btnPrimary: "bg-[#d94a2c] text-white border-[3px] border-[#1a1626] rounded-[4px] px-4 py-3 font-bold uppercase tracking-[0.05em] text-sm shadow-[4px_4px_0_0_#1a1626] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#1a1626] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[44px]",
    btnYellow: "bg-[#f1c84b] text-[#1a1626] border-[3px] border-[#1a1626] rounded-[4px] px-3 py-2 font-bold uppercase tracking-[0.05em] text-xs shadow-[3px_3px_0_0_#1a1626] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_0_#1a1626] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[40px]",
    btnGreen: "bg-[#5ab85a] text-[#1a1626] border-[3px] border-[#1a1626] rounded-[4px] px-3 py-2 font-bold uppercase tracking-[0.05em] text-xs shadow-[3px_3px_0_0_#1a1626] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0_0_#1a1626] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all min-h-[40px]",
    chip: "inline-block bg-[#3c6df0] text-white border-[3px] border-[#1a1626] rounded-[4px] px-2 py-1 text-xs font-bold uppercase tracking-[0.05em] shadow-[2px_2px_0_0_#1a1626]",
    row: "border-[3px] border-[#1a1626] rounded-[4px] p-3 bg-[#faf7ee] flex items-center gap-3",
    mono: "font-['JetBrains_Mono',monospace] font-bold",
  }

  return (
    <div className={c.page}>
      <header className={c.header} id="app-header">
        <div className={c.logo}>
          <div className={c.logoSquares}>
            <div className={c.sq + " bg-[#d94a2c]"}></div>
            <div className={c.sq + " bg-[#f1c84b]"}></div>
            <div className={c.sq + " bg-[#5ab85a]"}></div>
          </div>
          <span className={c.brand}>Stash</span>
        </div>
      </header>
      <main id="app" className={c.main}>
        <section id="who-am-i" className={c.section}>
          <p className={c.sectionTitle}>Step 1</p>
          <h2 className={c.h2}>{name ? `Hi, ${name}` : "Who's shopping?"}</h2>
          <div className="flex gap-2">
            <input
              className={c.input}
              placeholder="Your name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
            />
            <button className={c.btnPrimary} onClick={saveName}>Save</button>
          </div>
        </section>
        <section id="add-item" className={c.section}>
          <p className={c.sectionTitle}>Step 2</p>
          <h2 className={c.h2}>Add to the list</h2>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (newItem.name.trim()) submitItem() }}>
            <input className={c.input + " sm:flex-1"} placeholder="e.g. Whole milk" value={newItem.name} onChange={(e) => mergeItem({ name: e.target.value })} />
            <input className={c.input + " sm:w-32"} placeholder="Qty" value={newItem.qty} onChange={(e) => mergeItem({ qty: e.target.value })} />
            <button type="submit" className={c.btnPrimary}>Add item</button>
          </form>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button className={c.btnYellow} onClick={suggestStaples} disabled={suggestLoading}>
              {suggestLoading ? (
                <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin inline" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="8" cy="8" r="6" strokeDasharray="20 10" /></svg>
              ) : "Suggest staples"}
            </button>
          </div>
        </section>
        <section id="item-list" className={c.section}>
          <p className={c.sectionTitle}>The list</p>
          <h2 className={c.h2}>Needed ({items.filter(i => !i.checked).length})</h2>
          {items.filter(i => !i.checked).length === 0 ? (
            <p className="text-[#5a5670] text-sm">Nothing on the list yet. Add something above.</p>
          ) : (
            <ul className="space-y-2">
              {items.filter(i => !i.checked).sort((a,b) => a.createdAt - b.createdAt).map(item => (
                <li key={item._id} className={c.row}>
                  <span className={c.mono + " text-lg w-10 shrink-0"}>{item.qty}</span>
                  <span className="flex-1 font-semibold break-words">{item.name}</span>
                  {item.claimedBy && <span className={c.chip}>{item.claimedBy}</span>}
                  {item.claimedBy === name ? (
                    <>
                      <button className={c.btnGreen} onClick={() => checkOff(item)}>Got it</button>
                      <button className={c.btnYellow} onClick={() => unclaim(item)}>Drop</button>
                    </>
                  ) : !item.claimedBy ? (
                    <button className={c.btnYellow} onClick={() => claim(item)}>Claim</button>
                  ) : null}
                  <button onClick={() => removeItem(item)} aria-label="Remove" className="text-[#1a1626] p-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.filter(i => i.checked).length > 0 && (
            <>
              <p className={c.sectionTitle + " mt-5"}>Got</p>
              <ul className="space-y-2">
                {items.filter(i => i.checked).map(item => (
                  <li key={item._id} className={c.row + " opacity-60"}>
                    <span className={c.mono + " text-lg w-10 shrink-0 line-through"}>{item.qty}</span>
                    <span className="flex-1 font-semibold line-through break-words">{item.name}</span>
                    <span className={c.mono + " text-sm"}>${(item.price || 0).toFixed(2)}</span>
                    <span className={c.chip}>{item.paidBy}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section id="tally" className={c.section}>
          <p className={c.sectionTitle}>Settle up</p>
          <h2 className={c.h2}>Spending</h2>
          {(() => {
            const totals = {}
            items.filter(i => i.checked && i.paidBy).forEach(i => {
              totals[i.paidBy] = (totals[i.paidBy] || 0) + (i.price || 0)
            })
            const entries = Object.entries(totals).sort((a,b) => b[1] - a[1])
            if (entries.length === 0) return <p className="text-[#5a5670] text-sm">No purchases recorded yet.</p>
            return (
              <ul className="space-y-2">
                {entries.map(([who, total]) => (
                  <li key={who} className={c.row}>
                    <span className="flex-1 font-semibold">{who}</span>
                    <span className={c.mono + " text-lg"}>${total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )
          })()}
        </section>
      </main>
    </div>
  )
}