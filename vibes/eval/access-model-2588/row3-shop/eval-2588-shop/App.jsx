import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

const CATEGORIES = ["Produce", "Dairy", "Meat", "Pantry", "Frozen", "Bakery", "Household", "Other"]

const c = {
  page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)] pb-32",
  header: "sticky top-0 z-10 bg-[var(--surface)] backdrop-blur border-b border-[var(--border)] px-4 py-3 flex items-center justify-between gap-2",
  title: "text-xl font-bold text-[var(--primary)]",
  main: "px-4 py-4 space-y-5 max-w-2xl mx-auto",
  section: "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4",
  sectionTitle: "text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-3",
  input: "flex-1 min-h-[44px] px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]",
  select: "min-h-[44px] px-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)] text-[var(--text-primary)]",
  btnPrimary: "min-h-[44px] px-4 py-2 bg-[var(--primary)] text-[var(--accent-text)] rounded-[var(--radius)] font-semibold disabled:opacity-50",
  btnGhost: "min-h-[44px] px-3 py-2 border border-[var(--border)] rounded-[var(--radius)] text-[var(--text-primary)] text-sm",
  item: "flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-b-0",
  checkbox: "w-6 h-6 rounded border-2 border-[var(--primary)] flex items-center justify-center shrink-0",
  catLabel: "text-xs font-bold text-[var(--accent)] uppercase tracking-wider mt-3 mb-1",
  empty: "text-center text-[var(--text-secondary)] py-6 text-sm",
  bar: "fixed bottom-0 left-0 right-0 bg-[var(--surface)] backdrop-blur border-t border-[var(--border)] p-3",
  barInner: "max-w-2xl mx-auto flex gap-2",
}

function AddItem({ database, can, ready, me }) {
  const [name, setName] = React.useState("")
  const [cat, setCat] = React.useState("Other")
  if (!ready) return null
  const draft = { type: "item", name: name.trim(), category: cat, checked: false, authorHandle: me?.userHandle }
  const v = can.create(draft)
  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    const n = name.trim()
    setName("")
    try { await database.put({ ...draft, name: n, createdAt: Date.now() }) }
    catch (err) { setName(n); alert("Could not add: " + (err?.message || err)) }
  }
  if (!v.ok) return (
    <section id="add-item" className={c.bar}>
      <div className={c.barInner}><p className="text-sm text-[var(--text-secondary)] m-auto">{v.reason}</p></div>
    </section>
  )
  return (
    <section id="add-item" className={c.bar}>
      <form onSubmit={add} className={c.barInner}>
        <input className={c.input} placeholder="Add an item…" value={name} onChange={e => setName(e.target.value)} />
        <select className={c.select} value={cat} onChange={e => setCat(e.target.value)}>
          {CATEGORIES.map(x => <option key={x}>{x}</option>)}
        </select>
        <button type="submit" className={c.btnPrimary} disabled={!name.trim()}>Add</button>
      </form>
    </section>
  )
}

function ShoppingList({ items, database, can, ready }) {
  const [saving, setSaving] = React.useState(() => new Set())
  if (!items.length) return (
    <section id="shopping-list" className={c.section}>
      <h2 className={c.sectionTitle}>Your List</h2>
      <p className={c.empty}>No items yet. Add something below to get started.</p>
    </section>
  )
  const grouped = CATEGORIES.map(cat => [cat, items.filter(i => i.category === cat)]).filter(([, l]) => l.length)
  async function toggle(item) {
    const id = item._id
    setSaving(s => { const n = new Set(s); n.add(id); return n })
    try { await database.put({ ...item, checked: !item.checked }) }
    finally { setSaving(s => { const n = new Set(s); n.delete(id); return n }) }
  }
  async function remove(item) {
    setSaving(s => { const n = new Set(s); n.add(item._id); return n })
    try { await database.del(item._id) } catch (e) { alert("Delete failed") }
    finally { setSaving(s => { const n = new Set(s); n.delete(item._id); return n }) }
  }
  const remaining = items.filter(i => !i.checked).length
  return (
    <section id="shopping-list" className={c.section}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={c.sectionTitle + " mb-0"}>Your List</h2>
        <span className="text-xs text-[var(--text-secondary)]">{remaining} left of {items.length}</span>
      </div>
      {grouped.map(([cat, list]) => (
        <div key={cat}>
          <div className={c.catLabel}>{cat}</div>
          <ul>
            {list.map(item => {
              const isSaving = saving.has(item._id)
              const editable = ready && can.edit(item).ok
              return (
                <li key={item._id} className={c.item + (isSaving ? " opacity-60" : "")}>
                  <button
                    className={c.checkbox + (item.checked ? " bg-[var(--primary)]" : "")}
                    disabled={!editable || isSaving}
                    onClick={() => toggle(item)}
                    aria-label={item.checked ? "Uncheck" : "Check"}
                  >
                    {item.checked && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                  <span className={"flex-1 " + (item.checked ? "line-through text-[var(--text-secondary)]" : "")}>{item.name}</span>
                  {isSaving && <span className="text-xs text-[var(--text-secondary)]">Saving…</span>}
                  {editable && !isSaving && (
                    <button onClick={() => remove(item)} className="text-[var(--text-secondary)] p-1" aria-label="Delete">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Suggestions({ items, database, can, me }) {
  const [loading, setLoading] = React.useState(false)
  const [picks, setPicks] = React.useState([])
  const [adding, setAdding] = React.useState(() => new Set())
  const draft = { type: "item", name: "x", category: "Other", checked: false, authorHandle: me?.userHandle }
  if (!can.create(draft).ok) return null

  async function suggest() {
    setLoading(true)
    try {
      const list = items.map(i => i.name).join(", ") || "(empty list)"
      const res = await callAI(
        `Shopping list so far: ${list}. Suggest 5 commonly paired essentials NOT already on the list. Pick a category from: ${CATEGORIES.join(", ")}.`,
        { schema: { properties: { suggestions: { type: "array", items: { type: "object", properties: { name: { type: "string" }, category: { type: "string" } } } } } } }
      )
      const parsed = JSON.parse(res)
      setPicks(parsed.suggestions || [])
    } catch (e) { alert("AI failed: " + (e?.message || e)) }
    finally { setLoading(false) }
  }
  async function accept(p, idx) {
    setAdding(s => { const n = new Set(s); n.add(idx); return n })
    try {
      await database.put({ type: "item", name: p.name, category: CATEGORIES.includes(p.category) ? p.category : "Other", checked: false, authorHandle: me?.userHandle, createdAt: Date.now() })
      setPicks(ps => ps.filter((_, i) => i !== idx))
    } catch (e) { alert("Add failed") }
    finally { setAdding(s => { const n = new Set(s); n.delete(idx); return n }) }
  }
  function dismiss(idx) { setPicks(ps => ps.filter((_, i) => i !== idx)) }

  return (
    <section id="suggestions" className={c.section}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={c.sectionTitle + " mb-0"}>Missing essentials?</h2>
        <button className={c.btnGhost} onClick={suggest} disabled={loading}>
          {loading ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20"/></svg>
          ) : "Suggest"}
        </button>
      </div>
      {!picks.length && !loading && <p className={c.empty}>Tap "Suggest" for AI-recommended additions based on your list.</p>}
      <ul className="space-y-2">
        {picks.map((p, i) => (
          <li key={i} className="flex items-center gap-2 p-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)]">
            <div className="flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-[var(--text-secondary)]">{p.category}</div>
            </div>
            <button className={c.btnPrimary + " text-sm"} disabled={adding.has(i)} onClick={() => accept(p, i)}>Add</button>
            <button className={c.btnGhost} onClick={() => dismiss(i)} aria-label="Dismiss">✕</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const THEME = `:root {
  --surface: rgba(255,255,255,0.85); --primary: oklch(0.38 0.17 295);
  --text-primary: rgba(20,20,20,0.92); --border: rgba(20,20,20,0.14);
  --accent: oklch(0.38 0.17 295); --background: #fff;
  --text-secondary: rgba(20,20,20,0.5); --accent-text: #fafafa;
  --font-family: 'Nunito', sans-serif; --radius: 0.5rem; --radius-lg: 1rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: rgba(255,255,255,0.04); --primary: oklch(0.62 0.17 295);
    --text-primary: rgba(255,255,255,0.92); --border: rgba(255,255,255,0.18);
    --accent: oklch(0.62 0.17 295); --background: #0f0f0f;
    --text-secondary: rgba(255,255,255,0.55); --accent-text: #0a0a0a;
  }
}`

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready, me } = useVibe("cartSync")
  const { useLiveQuery, database } = useFireproof("cartSync")
  const { docs: items } = useLiveQuery("type", { key: "item" })
  return (
    <div className={c.page}>
      <style>{THEME}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Cart Sync</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <ShoppingList items={items} database={database} can={can} ready={ready} />
        <Suggestions items={items} database={database} can={can} me={me} />
      </main>
      <AddItem database={database} can={can} ready={ready} me={me} />
    </div>
  )
}