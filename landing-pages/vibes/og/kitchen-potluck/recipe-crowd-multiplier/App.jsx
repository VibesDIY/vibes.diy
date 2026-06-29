import React, { useState, useMemo } from "react"
import { useFireproof } from "use-fireproof"

const FRACTIONS = [
  [0, ""], [1/8, "⅛"], [1/4, "¼"], [1/3, "⅓"], [1/2, "½"],
  [2/3, "⅔"], [3/4, "¾"], [1, ""]
]

function toFraction(n) {
  if (n === 0) return ""
  const whole = Math.floor(n)
  const frac = n - whole
  let best = FRACTIONS[0], bestDiff = Infinity
  for (const f of FRACTIONS) {
    const d = Math.abs(f[0] - frac)
    if (d < bestDiff) { bestDiff = d; best = f }
  }
  if (best[0] === 1) return String(whole + 1)
  if (best[0] === 0) return whole ? String(whole) : "0"
  return whole ? whole + best[1] : best[1]
}

function parseQty(str) {
  str = str.trim()
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)/)
  if (mixed) return +mixed[1] + +mixed[2]/+mixed[3]
  const frac = str.match(/^(\d+)\/(\d+)/)
  if (frac) return +frac[1]/+frac[2]
  const dec = str.match(/^(\d+\.?\d*)/)
  if (dec) return +dec[1]
  return null
}

const UNIT_RE = /^([\d./\s]+?)\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|milliliters?|kg)?\s+(.+)/i

function parseLine(line) {
  const m = line.match(UNIT_RE)
  if (!m) return { qty: null, unit: "", rest: line, raw: line }
  const qty = parseQty(m[1])
  if (qty === null) return { qty: null, unit: "", rest: line, raw: line }
  return { qty, unit: m[2] || "", rest: m[3], raw: line }
}

function scaleLine(parsed, factor) {
  if (parsed.qty === null) return parsed.raw
  const scaled = parsed.qty * factor
  const nice = toFraction(scaled)
  return `${nice}${parsed.unit ? " " + parsed.unit : ""} ${parsed.rest}`
}

const classNames = {
  page: "min-h-screen bg-[#f5ecd9] p-6 font-serif text-[#2a1f14]",
  shell: "max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6",
  header: "mb-4",
  title: "text-4xl font-bold tracking-tight",
  subtitle: "text-sm italic text-[#6b5a3e]",
  feature: "bg-[#fffdf5] border-[3px] border-[#2a1f14] rounded p-4 mb-4 shadow-[4px_4px_0px_#2a1f14]",
  featureTitle: "text-lg font-bold mb-2 uppercase tracking-wide",
}

function Composer({ text, setText, servings, setServings, scaledFor, setScaledFor, onSave, saving }) {
  return (
    <section id="composer" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Your Recipe</h2>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste recipe here, one ingredient per line...&#10;e.g.&#10;2 cups flour&#10;1/2 tsp salt&#10;3 tbsp olive oil"
        className="w-full h-40 p-3 border-[3px] border-[#2a1f14] rounded bg-[#fffdf5] text-base font-serif focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_#2a1f14] transition-all"
      />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="text-sm uppercase tracking-wide">Base servings</label>
        <input type="number" min="1" value={servings} onChange={e => setServings(+e.target.value || 1)}
          className="w-20 p-2 border-[3px] border-[#2a1f14] rounded bg-[#fffdf5] font-mono" />
        <label className="text-sm uppercase tracking-wide">I'm feeding</label>
        <input type="number" min="1" value={scaledFor} onChange={e => setScaledFor(+e.target.value || 1)}
          className="w-20 p-2 border-[3px] border-[#2a1f14] rounded bg-[#fffdf5] font-mono" />
        <span className="text-sm italic">people</span>
        <button onClick={onSave} disabled={saving}
          className="ml-auto px-4 py-2 bg-[#c14d3a] text-white border-[3px] border-[#2a1f14] rounded font-bold uppercase tracking-wide shadow-[3px_3px_0px_#2a1f14] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#2a1f14] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50">
          {saving ? "Saving..." : "Save Recipe"}
        </button>
      </div>
    </section>
  )
}

function Panels({ text, factor, onShoppingList }) {
  const lines = text.split("\n").filter(l => l.trim())
  const parsed = lines.map(parseLine)
  return (
    <section id="panels" className={classNames.feature}>
      <div className="flex justify-between items-center mb-3">
        <h2 className={classNames.featureTitle}>Original vs Scaled</h2>
        <button onClick={onShoppingList}
          className="px-3 py-1.5 bg-[#d4a94a] text-[#2a1f14] border-[3px] border-[#2a1f14] rounded font-bold uppercase text-xs tracking-wide shadow-[3px_3px_0px_#2a1f14] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#2a1f14] transition-all">
          Shopping List
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border-[3px] border-[#2a1f14] rounded p-3 bg-[#faf3e0]">
          <h3 className="text-xs uppercase tracking-widest mb-2 text-[#6b5a3e]">Original · {lines.length} lines</h3>
          <ul className="space-y-1">
            {parsed.map((p,i) => <li key={i} className="text-base">{p.raw}</li>)}
            {!lines.length && <li className="italic text-[#6b5a3e]">Paste a recipe above.</li>}
          </ul>
        </div>
        <div className="border-[3px] border-[#2a1f14] rounded p-3 bg-[#fffdf5]">
          <h3 className="text-xs uppercase tracking-widest mb-2 text-[#6b5a3e]">Scaled ×{factor.toFixed(2)}</h3>
          <ul className="space-y-1">
            {parsed.map((p,i) => {
              const scaled = scaleLine(p, factor)
              const changed = p.qty !== null
              return (
                <li key={i} className="text-base">
                  {changed ? <mark className="bg-[#d4a94a] px-1 rounded">{scaled}</mark> : <span className="italic text-[#6b5a3e]">{scaled}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Sidebar({ docs, onOpen, onDelete }) {
  return (
    <aside id="sidebar" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Saved Recipes</h2>
      {!docs.length && <p className="italic text-sm text-[#6b5a3e]">No saved recipes yet.</p>}
      <ul className="space-y-2">
        {docs.map(d => {
          const first = (d.text || "").split("\n")[0].slice(0, 40) || "Untitled"
          return (
            <li key={d._id} className="border-[3px] border-[#2a1f14] rounded p-2 bg-[#faf3e0] shadow-[3px_3px_0px_#2a1f14]">
              <button onClick={() => onOpen(d)} className="text-left w-full font-semibold text-sm hover:underline">
                {first}
              </button>
              <div className="text-xs text-[#6b5a3e] mt-1 font-mono">
                {d.servings}→{d.scaledFor} servings
              </div>
              <button onClick={() => onDelete(d._id)} className="text-xs text-[#c14d3a] mt-1 hover:underline">delete</button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("recipe-crowd-multiplier")
  const [text, setText] = useState("")
  const [servings, setServings] = useState(4)
  const [scaledFor, setScaledFor] = useState(8)
  const [saving, setSaving] = useState(false)
  const { docs } = useLiveQuery("type", { key: "recipe", descending: true })

  const factor = useMemo(() => (scaledFor || 1) / (servings || 1), [scaledFor, servings])

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      await database.put({ type: "recipe", text, servings, scaledFor, createdAt: Date.now() })
    } finally { setSaving(false) }
  }

  const handleOpen = (d) => {
    setText(d.text || "")
    setServings(d.servings || 4)
    setScaledFor(d.scaledFor || 4)
  }

  const handleDelete = (id) => database.del(id)

  const handleShoppingList = () => {
    const lines = text.split("\n").filter(l => l.trim())
    const items = lines.map(l => scaleLine(parseLine(l), factor))
    const html = `<html><head><title>Shopping List</title>
      <style>body{font-family:Georgia,serif;background:#f5ecd9;padding:2rem;color:#2a1f14}
      h1{border-bottom:3px solid #2a1f14;padding-bottom:.5rem}
      li{padding:.4rem 0;border-bottom:1px dashed #6b5a3e;list-style:none}
      ul{padding:0}</style></head><body>
      <h1>Shopping List · for ${scaledFor}</h1>
      <ul>${items.map(i => `<li>☐ ${i}</li>`).join("")}</ul>
      <script>window.print()</script></body></html>`
    const w = window.open("", "_blank")
    w.document.write(html); w.document.close()
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Recipe Crowd Multiplier</h1>
        <p className={classNames.subtitle}>Scale any recipe to feed a crowd, sensibly rounded.</p>
      </header>
      <div className={classNames.shell}>
        <div>
          <Composer text={text} setText={setText} servings={servings} setServings={setServings}
            scaledFor={scaledFor} setScaledFor={setScaledFor} onSave={handleSave} saving={saving} />
          <Panels text={text} factor={factor} onShoppingList={handleShoppingList} />
        </div>
        <Sidebar docs={docs} onOpen={handleOpen} onDelete={handleDelete} />
      </div>
    </main>
  )
}