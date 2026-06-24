import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --background: #fff;
        --accent: #666;
        --text-primary: rgba(20, 20, 20, 0.92);
        --text-secondary: rgba(20, 20, 20, 0.5);
        --border: rgba(20, 20, 20, 0.14);
        --surface: rgba(255, 255, 255, 0.85);
        --primary: #666;
        --secondary: #666;
        --text-disabled: color-mix(in srgb, var(--text-primary) 38%, var(--background));
        --warning: #f59e0b;
        --success: #22c55e;
        --error: #ef4444;
        --neutral: #6b7280;
        --font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
        --font-size-base: 1rem;
        --radius: 0.5rem;
        --radius-sm: 0.25rem;
        --radius-lg: 1rem;
        --spacing: 1rem;
        --border-width: 1px;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --accent: #999999;
          --border: rgba(255, 255, 255, 0.18);
          --background: #0f0f0f;
          --text-primary: rgba(255, 255, 255, 0.92);
          --text-secondary: rgba(255, 255, 255, 0.55);
          --surface: rgba(255, 255, 255, 0.04);
          --primary: #999999;
          --secondary: #999999;
        }
      }
    `}</style>
  )
}

const c = {
  page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
  header: "border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur sticky top-0 z-10",
  headerInner: "max-w-2xl mx-auto px-[var(--spacing)] py-5 flex items-center justify-between gap-3",
  brand: "text-2xl font-bold tracking-tight",
  tagline: "text-xs text-[var(--text-secondary)] uppercase tracking-widest mt-0.5",
  main: "max-w-2xl mx-auto px-[var(--spacing)] py-6 space-y-8",
  section: "space-y-3",
  sectionTitle: "text-xs uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] pb-2",
  card: "border border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] bg-[var(--surface)]",
  input: "w-full bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 min-h-[44px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]",
  textarea: "w-full bg-transparent border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-3 min-h-[160px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-[var(--font-family)] leading-relaxed",
  btn: "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnPrimary: "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--background)] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity",
  postTitle: "text-2xl font-bold tracking-tight leading-tight",
  postMeta: "text-xs text-[var(--text-secondary)] uppercase tracking-widest",
  postBody: "text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap",
  tag: "inline-block text-xs px-2 py-1 border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-secondary)]",
  empty: "text-center text-[var(--text-secondary)] py-12 italic",
  muted: "text-sm text-[var(--text-secondary)]",
  spinner: "animate-spin h-4 w-4",
}

function SpinnerIcon() {
  return (
    <svg className={c.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function Composer({ database, can, me }) {
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [tagsText, setTagsText] = React.useState("")
  const [isAssisting, setIsAssisting] = React.useState(false)
  const [isPublishing, setIsPublishing] = React.useState(false)
  const [assistMode, setAssistMode] = React.useState(null)

  const draft = { type: "post", title, body, tags: [], authorHandle: me?.userHandle }
  const verdict = can.create(draft)

  if (!verdict.ok) {
    return (
      <section id="composer" className={c.section}>
        <h2 className={c.sectionTitle}>Compose</h2>
        <div className={c.card}>
          <p className={c.muted}>{verdict.reason}</p>
        </div>
      </section>
    )
  }

  async function runAssist(mode) {
    if (!body.trim()) return
    setIsAssisting(true)
    setAssistMode(mode)
    try {
      const prompt = mode === "polish"
        ? `Polish this blog post draft. Keep the author's voice. Improve clarity and flow. Return only the rewritten body.\n\nDRAFT:\n${body}`
        : `Write a 2-sentence summary of this blog post. Return only the summary.\n\nPOST:\n${body}`
      const result = await callAI(prompt, {
        schema: { properties: { text: { type: "string", description: mode === "polish" ? "Polished rewrite" : "Short summary" } } },
      })
      const parsed = JSON.parse(result)
      if (mode === "polish") setBody(parsed.text)
      else setBody(body + "\n\n---\nSummary: " + parsed.text)
    } catch (e) {
      console.error(e)
    } finally {
      setIsAssisting(false)
      setAssistMode(null)
    }
  }

  async function publish(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setIsPublishing(true)
    try {
      const tags = tagsText.split(",").map(t => t.trim()).filter(Boolean)
      await database.put({
        type: "post",
        title: title.trim(),
        body: body.trim(),
        tags,
        authorHandle: me?.userHandle,
        createdAt: Date.now(),
      })
      setTitle("")
      setBody("")
      setTagsText("")
    } catch (err) {
      console.error("publish failed", err)
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <section id="composer" className={c.section}>
      <h2 className={c.sectionTitle}>Compose</h2>
      <form onSubmit={publish} className={`${c.card} space-y-3`}>
        <input
          className={c.input}
          placeholder="Post title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={c.textarea}
          placeholder="Write your post..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          className={c.input}
          placeholder="Tags (comma-separated)"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={c.btn}
            disabled={isAssisting || !body.trim()}
            onClick={() => runAssist("polish")}
          >
            {isAssisting && assistMode === "polish" ? <><SpinnerIcon /> Polishing…</> : "Polish with AI"}
          </button>
          <button
            type="button"
            className={c.btn}
            disabled={isAssisting || !body.trim()}
            onClick={() => runAssist("summary")}
          >
            {isAssisting && assistMode === "summary" ? <><SpinnerIcon /> Summarizing…</> : "Add summary"}
          </button>
          <div className="flex-1" />
          <button
            type="submit"
            className={c.btnPrimary}
            disabled={isPublishing || !title.trim() || !body.trim()}
          >
            {isPublishing ? <><SpinnerIcon /> Publishing…</> : "Publish"}
          </button>
        </div>
      </form>
    </section>
  )
}

function PostItem({ post, database, can, ViewerTag }) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState(post.title)
  const [editBody, setEditBody] = React.useState(post.body)
  const [editTags, setEditTags] = React.useState((post.tags || []).join(", "))
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const canEdit = can.edit(post).ok
  const canDelete = can.delete(post).ok

  async function saveEdit() {
    setIsSaving(true)
    try {
      const tags = editTags.split(",").map(t => t.trim()).filter(Boolean)
      await database.put({ ...post, title: editTitle.trim(), body: editBody.trim(), tags })
      setIsEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return
    setIsDeleting(true)
    try {
      await database.del(post._id)
    } catch (err) {
      console.error(err)
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <article className={`${c.card} space-y-3`}>
        <input className={c.input} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
        <textarea className={c.textarea} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
        <input className={c.input} value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="Tags" />
        <div className="flex gap-2">
          <button className={c.btnPrimary} disabled={isSaving} onClick={saveEdit}>
            {isSaving ? <><SpinnerIcon /> Saving…</> : "Save"}
          </button>
          <button className={c.btn} onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </article>
    )
  }

  return (
    <article className={`${c.card} space-y-3 ${isDeleting ? "opacity-50" : ""}`}>
      <header className="space-y-1">
        <h3 className={c.postTitle}>{post.title}</h3>
        <div className={c.postMeta}>
          {new Date(post.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          {post.authorHandle && <> · <ViewerTag userHandle={post.authorHandle} /></>}
        </div>
      </header>
      <div className={c.postBody}>{post.body}</div>
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((t) => <span key={t} className={c.tag}>#{t}</span>)}
        </div>
      )}
      {(canEdit || canDelete) && (
        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          {canEdit && <button className={c.btn} onClick={() => setIsEditing(true)}>Edit</button>}
          {canDelete && (
            <button className={c.btn} disabled={isDeleting} onClick={deletePost}>
              {isDeleting ? <><SpinnerIcon /> Deleting…</> : "Delete"}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function Feed({ database, can, ViewerTag }) {
  const { useLiveQuery } = useFireproof("blog")
  const { docs: posts } = useLiveQuery("createdAt", { descending: true })
  const postDocs = posts.filter(d => d.type === "post")

  return (
    <section id="feed" className={c.section}>
      <h2 className={c.sectionTitle}>Posts</h2>
      {postDocs.length === 0 ? (
        <div className={c.empty}>No posts yet.</div>
      ) : (
        <div className="space-y-4">
          {postDocs.map((p) => (
            <PostItem key={p._id} post={p} database={database} can={can} ViewerTag={ViewerTag} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function App() {
  const { database } = useFireproof("blog")
  const { ViewerTag, isViewerPending } = useViewer()
  const { can, ready, me } = useVibe("blog")

  return (
    <div className={c.page}>
      <ThemeStyles />
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div>
            <div className={c.brand}>My Personal Blog</div>
            <div className={c.tagline}>Notes, essays, and dispatches</div>
          </div>
          <ViewerTag />
        </div>
      </header>
      <main id="app" className={c.main}>
        {ready && !isViewerPending && (
          <Composer database={database} can={can} me={me} />
        )}
        <Feed database={database} can={can} ViewerTag={ViewerTag} />
      </main>
    </div>
  )
}