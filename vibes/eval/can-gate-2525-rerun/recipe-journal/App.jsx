import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function ThemeTokens() {
  return (
    <style>{`
      :root {
        --background: oklch(0.17 0.000 0);
        --text-primary: rgba(255, 255, 255, 0.92);
        --text-secondary: rgba(255, 255, 255, 0.55);
        --border: rgba(255, 255, 255, 0.18);
        --accent: oklch(0.93 0.006 265);
        --surface: rgba(255, 255, 255, 0.04);
        --primary: oklch(0.93 0.006 265);
        --secondary: oklch(0.93 0.006 265);
        --font-family: 'Cormorant Garamond', serif;
        --radius: 0.5rem;
        --radius-sm: 0.25rem;
        --radius-lg: 1rem;
        --spacing: 1rem;
        --border-width: 1px;
      }
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=optional');
    `}</style>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin inline-block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function Composer({ database }) {
  const { useDocument } = useFireproof("recipes")
  const { doc, merge, submit } = useDocument({
    type: "recipe",
    title: "",
    description: "",
    ingredients: [],
    steps: [],
    createdAt: Date.now(),
  })
  const [loadingIng, setLoadingIng] = React.useState(false)
  const [loadingSteps, setLoadingSteps] = React.useState(false)

  async function suggestIngredients() {
    if (!doc.title.trim()) return
    setLoadingIng(true)
    try {
      const res = await callAI(`Suggest ingredients for a recipe titled "${doc.title}". Description: ${doc.description || "n/a"}.`, {
        schema: { properties: { ingredients: { type: "array", items: { type: "string" } } } },
      })
      const parsed = JSON.parse(res)
      merge({ ingredients: [...(doc.ingredients || []), ...(parsed.ingredients || [])] })
    } finally {
      setLoadingIng(false)
    }
  }

  async function suggestSteps() {
    if (!doc.title.trim()) return
    setLoadingSteps(true)
    try {
      const res = await callAI(`Suggest step-by-step instructions for "${doc.title}". Ingredients: ${(doc.ingredients || []).join(", ") || "n/a"}.`, {
        schema: { properties: { steps: { type: "array", items: { type: "string" } } } },
      })
      const parsed = JSON.parse(res)
      merge({ steps: [...(doc.steps || []), ...(parsed.steps || [])] })
    } finally {
      setLoadingSteps(false)
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    if (!doc.title.trim()) return
    submit()
  }

  function updateItem(field, i, value) {
    const next = [...(doc[field] || [])]
    next[i] = value
    merge({ [field]: next })
  }
  function removeItem(field, i) {
    const next = [...(doc[field] || [])]
    next.splice(i, 1)
    merge({ [field]: next })
  }
  function addItem(field) {
    merge({ [field]: [...(doc[field] || []), ""] })
  }

  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)]",
    heading: "text-2xl text-[var(--text-primary)] mb-3 italic",
    label: "block text-sm text-[var(--text-secondary)] mb-1 italic",
    input: "w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text-primary)] min-h-[44px]",
    textarea: "w-full bg-[var(--background)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text-primary)]",
    row: "flex gap-2 items-center mb-2",
    btn: "px-3 py-2 min-h-[44px] rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)] text-sm hover:bg-[var(--surface)] disabled:opacity-50",
    btnPrimary: "px-4 py-3 min-h-[44px] rounded-[var(--radius)] bg-[var(--primary)] text-[#0a0a0a] font-semibold w-full",
    fieldGroup: "mb-4",
    suggestRow: "flex gap-2 mt-1 mb-2",
    remove: "text-[var(--text-secondary)] px-2",
  }

  return (
    <section id="composer" className={c.section}>
      <h2 className={c.heading}>New recipe</h2>
      <form onSubmit={onSubmit}>
        <div className={c.fieldGroup}>
          <label className={c.label}>Title</label>
          <input className={c.input} value={doc.title} onChange={(e) => merge({ title: e.target.value })} placeholder="e.g. Lemon roast chicken" />
        </div>
        <div className={c.fieldGroup}>
          <label className={c.label}>Description</label>
          <textarea className={c.textarea} rows="2" value={doc.description} onChange={(e) => merge({ description: e.target.value })} placeholder="A short note about this recipe" />
        </div>

        <div className={c.fieldGroup}>
          <label className={c.label}>Ingredients</label>
          {(doc.ingredients || []).map((ing, i) => (
            <div key={i} className={c.row}>
              <input className={c.input} value={ing} onChange={(e) => updateItem("ingredients", i, e.target.value)} />
              <button type="button" className={c.remove} onClick={() => removeItem("ingredients", i)} aria-label="Remove">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
          <div className={c.suggestRow}>
            <button type="button" className={c.btn} onClick={() => addItem("ingredients")}>+ Add</button>
            <button type="button" className={c.btn} onClick={suggestIngredients} disabled={loadingIng || !doc.title.trim()}>
              {loadingIng ? <><Spinner /> Suggesting…</> : "✦ Suggest ingredients"}
            </button>
          </div>
        </div>

        <div className={c.fieldGroup}>
          <label className={c.label}>Steps</label>
          {(doc.steps || []).map((s, i) => (
            <div key={i} className={c.row}>
              <span className="text-[var(--text-secondary)] text-sm w-6">{i + 1}.</span>
              <textarea className={c.textarea} rows="2" value={s} onChange={(e) => updateItem("steps", i, e.target.value)} />
              <button type="button" className={c.remove} onClick={() => removeItem("steps", i)} aria-label="Remove">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
          <div className={c.suggestRow}>
            <button type="button" className={c.btn} onClick={() => addItem("steps")}>+ Add</button>
            <button type="button" className={c.btn} onClick={suggestSteps} disabled={loadingSteps || !doc.title.trim()}>
              {loadingSteps ? <><Spinner /> Suggesting…</> : "✦ Suggest steps"}
            </button>
          </div>
        </div>

        <button type="submit" className={c.btnPrimary} disabled={!doc.title.trim()}>Save recipe</button>
      </form>
    </section>
  )
}

function RecipeList({ recipes, onSelect, selectedId }) {
  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)]",
    heading: "text-2xl text-[var(--text-primary)] mb-3 italic",
    muted: "text-[var(--text-secondary)] text-sm italic",
    card: "w-full text-left p-3 min-h-[44px] rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] mb-2 hover:bg-[var(--surface)]",
    cardActive: "bg-[var(--surface)]",
    title: "text-lg text-[var(--text-primary)] italic",
    desc: "text-sm text-[var(--text-secondary)] mt-1",
  }
  return (
    <section id="recipe-list" className={c.section}>
      <h2 className={c.heading}>Your recipes</h2>
      {recipes.length === 0 ? (
        <p className={c.muted}>No recipes yet — your first one is just a title away.</p>
      ) : (
        <ul>
          {recipes.map((r) => (
            <li key={r._id}>
              <button className={`${c.card} ${selectedId === r._id ? c.cardActive : ""}`} onClick={() => onSelect(r._id)}>
                <div className={c.title}>{r.title || "Untitled"}</div>
                {r.description && <div className={c.desc}>{r.description}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecipeDetail({ recipe, database, canEdit, onClose }) {
  const [deleting, setDeleting] = React.useState(false)
  async function onDelete() {
    if (!confirm("Delete this recipe?")) return
    setDeleting(true)
    try {
      await database.del(recipe._id)
      onClose()
    } catch (err) {
      alert("Delete failed: " + err.message)
    } finally {
      setDeleting(false)
    }
  }
  const c = {
    section: "bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--spacing)]",
    headRow: "flex items-start justify-between mb-3 gap-2",
    title: "text-2xl text-[var(--text-primary)] italic",
    desc: "text-sm text-[var(--text-secondary)] mb-4 italic",
    subhead: "text-lg text-[var(--text-primary)] italic mt-4 mb-2",
    list: "list-disc pl-5 text-[var(--text-primary)] space-y-1",
    steps: "list-decimal pl-5 text-[var(--text-primary)] space-y-2",
    actions: "flex gap-2",
    btn: "px-3 py-2 min-h-[44px] rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)] text-sm hover:bg-[var(--surface)] disabled:opacity-50",
  }
  return (
    <section id="recipe-detail" className={c.section}>
      <div className={c.headRow}>
        <h2 className={c.title}>{recipe.title || "Untitled"}</h2>
        <div className={c.actions}>
          {canEdit && (
            <button className={c.btn} onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
          )}
          <button className={c.btn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      {recipe.description && <p className={c.desc}>{recipe.description}</p>}
      {recipe.ingredients?.length > 0 && (
        <>
          <h3 className={c.subhead}>Ingredients</h3>
          <ul className={c.list}>
            {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
          </ul>
        </>
      )}
      {recipe.steps?.length > 0 && (
        <>
          <h3 className={c.subhead}>Steps</h3>
          <ol className={c.steps}>
            {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready } = useVibe("recipes")
  const { useLiveQuery, database } = useFireproof("recipes")
  const { docs: recipes } = useLiveQuery("type", { key: "recipe", descending: true })
  const [selectedId, setSelectedId] = React.useState(null)
  const selected = recipes.find((r) => r._id === selectedId) || null

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header: "sticky top-0 z-10 bg-[var(--background)] border-b-[length:var(--border-width)] border-[var(--border)] px-[var(--spacing)] py-3 flex items-center justify-between",
    brand: "text-3xl italic tracking-wide",
    main: "max-w-2xl mx-auto p-[var(--spacing)] space-y-[var(--spacing)]",
  }

  return (
    <div className={c.page}>
      <ThemeTokens />
      <header id="app-header" className={c.header}>
        <h1 className={c.brand}>Recipe Journal</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {ready && can.create({ type: "recipe" }).ok && <Composer database={database} />}
        {ready && !can.create({ type: "recipe" }).ok && (
          <p className="text-[var(--text-secondary)] text-sm italic">{can.create({ type: "recipe" }).reason} — browsing only.</p>
        )}
        <RecipeList recipes={recipes} onSelect={setSelectedId} selectedId={selectedId} />
        {selected && <RecipeDetail recipe={selected} database={database} canEdit={can.edit(selected).ok} onClose={() => setSelectedId(null)} />}
      </main>
    </div>
  )
}