import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

const c = {
  page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
  header: "sticky top-0 z-10 backdrop-blur-md bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-b border-[var(--border)]",
  headerInner: "max-w-2xl mx-auto px-5 py-4 flex items-center justify-between",
  brand: "text-2xl tracking-wide italic",
  sub: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]",
  main: "max-w-2xl mx-auto px-5 py-6 space-y-8 pb-32",
  section: "space-y-3",
  sectionTitle: "text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] pb-2",
  card: "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 space-y-3",
  cardTitle: "text-2xl italic",
  meta: "text-xs text-[var(--text-secondary)] flex items-center gap-2",
  list: "space-y-4",
  input: "w-full bg-transparent border-b border-[var(--border)] py-2 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] min-h-[44px]",
  textarea: "w-full bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] p-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]",
  btn: "min-h-[44px] px-5 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text,#0a0a0a)] font-medium tracking-wide hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2",
  btnGhost: "min-h-[44px] px-4 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface)] inline-flex items-center justify-center gap-2",
  btnDanger: "min-h-[44px] px-4 rounded-[var(--radius-sm)] border border-[var(--error)] text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_15%,transparent)] inline-flex items-center justify-center gap-2",
  btnSparkle: "text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] inline-flex items-center gap-1.5",
  empty: "text-center py-12 text-[var(--text-secondary)] italic",
  ingredientList: "list-none space-y-1 pl-0",
  ingredientItem: "flex items-baseline gap-2 before:content-['◦'] before:text-[var(--accent)]",
  stepList: "list-decimal pl-5 space-y-2 marker:text-[var(--text-secondary)] marker:italic",
  spinner: "animate-spin",
}

function Spinner() {
  return (
    <svg className={c.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.8L19 10l-5.1 1.2L12 17l-1.9-5.8L5 10l5.1-1.2z" />
    </svg>
  )
}

function ComposeRecipe({ database, me, savingIds, setSavingIds }) {
  const [title, setTitle] = React.useState("")
  const [ingredients, setIngredients] = React.useState("")
  const [steps, setSteps] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [aiLoading, setAiLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  async function suggest() {
    if (!title.trim()) return
    setAiLoading(true)
    try {
      const raw = await callAI(
        `Suggest a recipe sketch for "${title}". Provide a short ingredient list (one per line), numbered steps, and one helpful tip.`,
        {
          schema: {
            properties: {
              ingredients: { type: "array", items: { type: "string" } },
              steps: { type: "array", items: { type: "string" } },
              tip: { type: "string" },
            },
          },
        }
      )
      const data = JSON.parse(raw)
      if (data.ingredients?.length) setIngredients(data.ingredients.join("\n"))
      if (data.steps?.length) setSteps(data.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"))
      if (data.tip) setNotes(data.tip)
    } catch (err) {
      console.error(err)
    } finally {
      setAiLoading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await database.put({
        type: "recipe",
        title: title.trim(),
        ingredients: ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
        steps: steps.split("\n").map((s) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean),
        notes: notes.trim(),
        createdBy: me?.userHandle,
        createdAt: Date.now(),
      })
      setTitle(""); setIngredients(""); setSteps(""); setNotes("")
    } catch (err) {
      console.error("save failed", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="compose" className={c.section}>
      <h2 className={c.sectionTitle}>New Entry</h2>
      <form className={c.card} onSubmit={save}>
        <input className={c.input} placeholder="Recipe title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex justify-end">
          <button type="button" onClick={suggest} disabled={aiLoading || !title.trim()} className={c.btnSparkle}>
            {aiLoading ? <Spinner /> : <SparkleIcon />}
            {aiLoading ? "thinking…" : "suggest"}
          </button>
        </div>
        <textarea className={c.textarea} rows="5" placeholder="Ingredients (one per line)" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
        <textarea className={c.textarea} rows="6" placeholder="Steps (one per line)" value={steps} onChange={(e) => setSteps(e.target.value)} />
        <textarea className={c.textarea} rows="2" placeholder="Notes or a tip…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="submit" disabled={saving || !title.trim()} className={c.btn}>
            {saving ? <Spinner /> : null}
            {saving ? "saving…" : "save entry"}
          </button>
        </div>
      </form>
    </section>
  )
}

function RecipeCard({ recipe, database, can, savingIds, setSavingIds }) {
  const [editing, setEditing] = React.useState(false)
  const [title, setTitle] = React.useState(recipe.title)
  const [ingredients, setIngredients] = React.useState((recipe.ingredients || []).join("\n"))
  const [steps, setSteps] = React.useState((recipe.steps || []).join("\n"))
  const [notes, setNotes] = React.useState(recipe.notes || "")
  const saving = savingIds.has(recipe._id)

  async function saveEdit() {
    setSavingIds((prev) => { const n = new Set(prev); n.add(recipe._id); return n })
    try {
      await database.put({
        ...recipe,
        title: title.trim(),
        ingredients: ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
        steps: steps.split("\n").map((s) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean),
        notes: notes.trim(),
        updatedAt: Date.now(),
      })
      setEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(recipe._id); return n })
    }
  }

  async function remove() {
    setSavingIds((prev) => { const n = new Set(prev); n.add(recipe._id); return n })
    try { await database.del(recipe._id) }
    catch (err) { console.error(err) }
    finally { setSavingIds((prev) => { const n = new Set(prev); n.delete(recipe._id); return n }) }
  }

  const canEdit = can.edit(recipe).ok
  const canDelete = can.delete(recipe).ok

  if (editing) {
    return (
      <article className={c.card} style={{ opacity: saving ? 0.6 : 1 }}>
        <input className={c.input} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={c.textarea} rows="5" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
        <textarea className={c.textarea} rows="6" value={steps} onChange={(e) => setSteps(e.target.value)} />
        <textarea className={c.textarea} rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className={c.btnGhost}>cancel</button>
          <button onClick={saveEdit} disabled={saving} className={c.btn}>
            {saving ? <Spinner /> : null}{saving ? "saving…" : "save"}
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className={c.card} style={{ opacity: saving ? 0.6 : 1 }}>
      <h3 className={c.cardTitle}>{recipe.title}</h3>
      <p className={c.meta}>
        <span>{new Date(recipe.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
        {recipe.createdBy && <span>· {recipe.createdBy}</span>}
        {saving && <span className="inline-flex items-center gap-1"><Spinner /> saving…</span>}
      </p>
      {recipe.ingredients?.length > 0 && (
        <div>
          <p className={c.sub}>Ingredients</p>
          <ul className={c.ingredientList}>
            {recipe.ingredients.map((ing, i) => <li key={i} className={c.ingredientItem}>{ing}</li>)}
          </ul>
        </div>
      )}
      {recipe.steps?.length > 0 && (
        <div>
          <p className={c.sub}>Method</p>
          <ol className={c.stepList}>
            {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
      {recipe.notes && <p className="italic text-[var(--text-secondary)] border-l-2 border-[var(--accent)] pl-3">{recipe.notes}</p>}
      {(canEdit || canDelete) && (
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          {canEdit && <button onClick={() => setEditing(true)} className={c.btnGhost}>edit</button>}
          {canDelete && <button onClick={remove} disabled={saving} className={c.btnDanger}>delete</button>}
        </div>
      )}
    </article>
  )
}

function RecipeList({ database, recipes, can, me, savingIds, setSavingIds }) {
  return (
    <section id="recipes" className={c.section}>
      <h2 className={c.sectionTitle}>The Journal</h2>
      <div className={c.list}>
        {recipes.length === 0 ? (
          <p className={c.empty}>No entries yet — the page awaits.</p>
        ) : (
          recipes.map((r) => (
            <RecipeCard key={r._id} recipe={r} database={database} can={can} savingIds={savingIds} setSavingIds={setSavingIds} />
          ))
        )}
      </div>
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const { can, ready, me } = useVibe("recipeJournal")
  const { database, useLiveQuery } = useFireproof("recipeJournal")
  const { docs: recipes } = useLiveQuery("type", { key: "recipe", descending: true })
  const [savingIds, setSavingIds] = React.useState(new Set())

  return (
    <div className={c.page}>
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
          --accent-text: #0a0a0a;
          --font-family: 'Cormorant Garamond', serif;
          --radius: 0.5rem;
          --radius-sm: 0.25rem;
          --spacing: 1rem;
          --border-width: 1px;
          --warning: #f59e0b;
          --success: #22c55e;
          --error: #ef4444;
        }
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=optional');
      `}</style>

      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div>
            <h1 className={c.brand}>Hearth & Pen</h1>
            <p className={c.sub}>a recipe journal</p>
          </div>
          <ViewerTag />
        </div>
      </header>

      <main id="app" className={c.main}>
        {ready && can.create({ type: "recipe", createdBy: me?.userHandle }).ok && (
          <ComposeRecipe database={database} me={me} savingIds={savingIds} setSavingIds={setSavingIds} />
        )}
        <RecipeList database={database} recipes={recipes} can={can} me={me} savingIds={savingIds} setSavingIds={setSavingIds} />
      </main>
    </div>
  )
}