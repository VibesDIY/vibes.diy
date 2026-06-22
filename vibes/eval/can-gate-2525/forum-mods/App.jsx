import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function ModeratorPanel() {
  const { useLiveQuery, database } = useFireproof("forum")
  const { can, ready } = useVibe("forum")
  const { ViewerTag, viewer } = useViewer()
  const { docs: grants } = useLiveQuery("type", { key: "modGrant" })
  const [handle, setHandle] = React.useState("")
  const [savingIds, setSavingIds] = React.useState(new Set())

  if (!ready) return null
  const canGrant = can.create({ type: "modGrant", userHandle: "_probe_" })
  if (!canGrant.ok) return null

  async function grant(e) {
    e.preventDefault()
    const h = handle.trim()
    if (!h) return
    try {
      await database.put({ type: "modGrant", userHandle: h, at: Date.now(), byHandle: viewer?.userHandle })
      setHandle("")
    } catch (err) {
      alert("Grant failed: " + (err.message || err))
    }
  }

  async function revoke(g) {
    setSavingIds((s) => new Set(s).add(g._id))
    try {
      await database.del(g._id)
    } catch (err) {
      alert("Revoke failed: " + (err.message || err))
    } finally {
      setSavingIds((s) => {
        const next = new Set(s)
        next.delete(g._id)
        return next
      })
    }
  }

  return (
    <section id="moderators" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Moderators</h2>
      <form onSubmit={grant} className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="user handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="flex-1 min-h-[44px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={!handle.trim()}
          className="min-h-[44px] px-4 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--background)] font-medium disabled:opacity-50"
        >
          Appoint
        </button>
      </form>
      {grants.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No moderators yet.</p>
      ) : (
        <ul className="space-y-2">
          {grants.map((g) => {
            const saving = savingIds.has(g._id)
            return (
              <li
                key={g._id}
                className={`flex items-center justify-between gap-2 ${saving ? "opacity-60" : ""}`}
              >
                <ViewerTag userHandle={g.userHandle} />
                <button
                  onClick={() => revoke(g)}
                  disabled={saving}
                  className="text-xs min-h-[36px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--error)]"
                >
                  {saving ? "Revoking…" : "Revoke"}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function NewPostForm() {
  const { database } = useFireproof("forum")
  const { can, ready } = useVibe("forum")
  const { viewer } = useViewer()
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  if (!ready) {
    return (
      <section id="new-post" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4 opacity-60">
        <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
      </section>
    )
  }

  const verdict = can.create({ type: "post", authorHandle: viewer?.userHandle })
  if (!verdict.ok) {
    return (
      <section id="new-post" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4">
        <p className="text-sm text-[var(--text-secondary)]">{verdict.reason}</p>
      </section>
    )
  }

  async function suggest() {
    setIsLoading(true)
    setError("")
    try {
      const res = await callAI("Suggest a single interesting community forum discussion topic with a short title and a 2-3 sentence body.", {
        schema: { properties: { title: { type: "string" }, body: { type: "string" } } },
      })
      const parsed = JSON.parse(res)
      if (parsed.title) setTitle(parsed.title)
      if (parsed.body) setBody(parsed.body)
    } catch (e) {
      setError("Suggestion failed")
    } finally {
      setIsLoading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!body.trim() || !viewer) return
    setIsLoading(true)
    setError("")
    let tags = []
    let toxicity = 0
    try {
      const res = await callAI(
        `Analyze this forum post. Return up to 4 short lowercase topic tags and a toxicity score from 0 (safe) to 1 (very toxic).\n\nTitle: ${title}\nBody: ${body}`,
        {
          schema: {
            properties: {
              tags: { type: "array", items: { type: "string" } },
              toxicity: { type: "number" },
            },
          },
        }
      )
      const parsed = JSON.parse(res)
      tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : []
      toxicity = typeof parsed.toxicity === "number" ? parsed.toxicity : 0
    } catch {
      // proceed without AI metadata
    }
    try {
      await database.put({
        type: "post",
        title: title.trim(),
        body: body.trim(),
        authorHandle: viewer.userHandle,
        tags,
        toxicity,
        createdAt: Date.now(),
      })
      setTitle("")
      setBody("")
    } catch (e) {
      setError("Post failed: " + (e.message || e))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section id="new-post" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)] mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Start a discussion</h2>
        <button
          type="button"
          onClick={suggest}
          disabled={isLoading}
          className="text-xs min-h-[36px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50"
        >
          Suggest
        </button>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full min-h-[44px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)]"
        />
        <textarea
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading || !body.trim()}
            className="min-h-[44px] px-4 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--background)] font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {isLoading ? "Posting…" : "Post"}
          </button>
          {error && <span className="text-xs text-[var(--error)]">{error}</span>}
        </div>
      </form>
    </section>
  )
}

function PostFeed() {
  const { useLiveQuery, database } = useFireproof("forum")
  const { can } = useVibe("forum")
  const { ViewerTag, viewer } = useViewer()
  const { docs: posts } = useLiveQuery("createdAt", { descending: true, limit: 100 })
  const { docs: actions } = useLiveQuery("type", { key: "modAction" })

  // Build latest action per post
  const latestByPost = {}
  for (const a of actions) {
    if (a.postId && (!latestByPost[a.postId] || a.at > latestByPost[a.postId].at)) {
      latestByPost[a.postId] = a
    }
  }

  const visible = posts.filter((p) => p.type === "post")
  const pinned = visible.filter((p) => latestByPost[p._id]?.action === "pin")
  const removed = new Set(visible.filter((p) => latestByPost[p._id]?.action === "remove").map((p) => p._id))
  const rest = visible.filter((p) => !pinned.includes(p) && !removed.has(p._id))
  const ordered = [...pinned, ...rest]

  async function modAct(post, action) {
    if (!viewer) return
    try {
      await database.put({
        type: "modAction",
        postId: post._id,
        action,
        byHandle: viewer.userHandle,
        at: Date.now(),
      })
    } catch (e) {
      alert("Action failed: " + (e.message || e))
    }
  }

  return (
    <section id="feed" className="bg-[var(--surface)] border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-[var(--spacing)]">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Recent posts</h2>
      {ordered.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">No posts yet. Be the first.</p>
      )}
      <ul className="space-y-3">
        {ordered.map((p) => {
          const a = latestByPost[p._id]
          const isPinned = a?.action === "pin"
          const isFlagged = a?.action === "flag"
          const canPin = can.create({ type: "modAction", postId: p._id, action: "pin", byHandle: viewer?.userHandle }).ok
          const canFlag = can.create({ type: "modAction", postId: p._id, action: "flag", byHandle: viewer?.userHandle }).ok
          const canRemove = can.create({ type: "modAction", postId: p._id, action: "remove", byHandle: viewer?.userHandle }).ok
          const toxic = typeof p.toxicity === "number" && p.toxicity >= 0.6
          return (
            <li
              key={p._id}
              className={`border-[length:var(--border-width)] border-[var(--border)] rounded-[var(--radius)] p-3 ${
                isPinned ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : ""
              } ${toxic ? "ring-1 ring-[var(--warning)]" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <ViewerTag userHandle={p.authorHandle} />
                  {isPinned && (
                    <span className="text-xs px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--background)]">
                      Pinned
                    </span>
                  )}
                  {isFlagged && (
                    <span className="text-xs px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--warning)] text-[var(--background)]">
                      Flagged
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-secondary)] shrink-0">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
              </div>
              {p.title && <h3 className="font-semibold text-[var(--text-primary)] mb-1">{p.title}</h3>}
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap mb-2">{p.body}</p>
              {Array.isArray(p.tags) && p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-secondary)]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              {toxic && (
                <p className="text-xs text-[var(--warning)] mb-2">
                  AI flagged this post (toxicity {(p.toxicity * 100).toFixed(0)}%)
                </p>
              )}
              {(canPin || canFlag || canRemove) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t-[length:var(--border-width)] border-[var(--border)]">
                  {canPin && (
                    <button
                      onClick={() => modAct(p, isPinned ? "unpin" : "pin")}
                      className="text-xs min-h-[36px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)]"
                    >
                      {isPinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                  {canFlag && (
                    <button
                      onClick={() => modAct(p, "flag")}
                      className="text-xs min-h-[36px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--text-primary)]"
                    >
                      Flag
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => modAct(p, "remove")}
                      className="text-xs min-h-[36px] px-3 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--border)] text-[var(--error)]"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)]",
    header: "sticky top-0 z-10 bg-[var(--background)] border-b-[length:var(--border-width)] border-[var(--border)] px-4 py-3 flex items-center justify-between",
    main: "max-w-2xl mx-auto px-4 py-4",
    title: "text-xl font-bold tracking-tight",
  }
  return (
    <div className={c.page}>
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
    --text-disabled: color-mix(in srgb, var(--text-primary) 38%, var(--background));
  }
}
      `}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Town Square</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <ModeratorPanel />
        <NewPostForm />
        <PostFeed />
      </main>
    </div>
  )
}