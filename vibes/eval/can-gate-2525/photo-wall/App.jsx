import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "use-vibes"
import { useFireproof } from "use-fireproof"
import { useViewer, useVibe } from "use-vibes"

function Composer() {
  const { can, ready, me } = useVibe("snapshotWall")
  const { database } = useFireproof("snapshotWall")
  const [caption, setCaption] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const candidate = { type: "post", channelId: "ch:wall", authorHandle: me?.userHandle }
  const verdict = ready ? can.create(candidate) : { ok: false, reason: "" }

  async function post() {
    if (!caption.trim() || !me) return
    const text = caption.trim()
    setBusy(true)
    setCaption("")
    try {
      const res = await database.put({
        type: "post",
        caption: text,
        authorHandle: me.userHandle,
        createdAt: Date.now(),
      })
      callAI(`Tag this photo caption with 3-5 short descriptive tags and a one-line sentiment note. Caption: "${text}"`, {
        schema: { properties: { tags: { type: "array", items: { type: "string" } }, sentiment: { type: "string" } } },
      }).then(async (raw) => {
        try {
          const { tags, sentiment } = JSON.parse(raw)
          const fresh = await database.get(res.id)
          await database.put({ ...fresh, tags, sentiment })
        } catch {}
      }).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  const suggest = async () => {
    setBusy(true)
    try {
      const raw = await callAI("Suggest a short, evocative photo caption for a community photo wall. One sentence, under 12 words.", {
        schema: { properties: { caption: { type: "string" } } },
      })
      setCaption(JSON.parse(raw).caption || "")
    } finally { setBusy(false) }
  }

  return (
    <section id="composer" className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] p-[var(--spacing)] shadow-sm">
      <h2 className="font-['Caveat'] text-3xl mb-3 text-[var(--text-primary)]">Post a snapshot</h2>
      {!ready ? (
        <p className="text-[var(--text-secondary)] text-sm">Loading…</p>
      ) : !verdict.ok ? (
        <p className="text-[var(--text-secondary)] text-sm">{verdict.reason || "Sign in to post."}</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); post() }} className="space-y-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe the scene…"
            rows={2}
            className="w-full rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] p-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !caption.trim()}
              className="flex-1 min-h-[44px] rounded-[var(--radius)] bg-[var(--primary)] text-[var(--accent-text)] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
              ) : "Post"}
            </button>
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              title="Suggest a caption"
              className="min-h-[44px] px-3 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function PostCard({ post }) {
  const { ViewerTag } = useViewer()
  const { database, useLiveQuery } = useFireproof("snapshotWall")
  const { can, ready, me } = useVibe("snapshotWall")
  const { docs: allComments } = useLiveQuery("type", { key: "comment" })
  const comments = allComments.filter((c) => c.postId === post._id).sort((a, b) => a.createdAt - b.createdAt)
  const [body, setBody] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const cVerdict = ready ? can.create({ type: "comment", channelId: "ch:wall", postId: post._id, authorHandle: me?.userHandle }) : { ok: false }

  async function comment() {
    if (!body.trim() || !me) return
    setBusy(true)
    const text = body.trim()
    setBody("")
    try {
      await database.put({ type: "comment", postId: post._id, body: text, authorHandle: me.userHandle, createdAt: Date.now() })
    } finally { setBusy(false) }
  }

  return (
    <article className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b-[length:var(--border-width)] border-[var(--border)]">
        <ViewerTag userHandle={post.authorHandle} />
        <span className="text-xs text-[var(--text-secondary)] ml-auto">{new Date(post.createdAt).toLocaleString()}</span>
      </div>
      <ImgGen prompt={post.caption} database="snapshotWall" _id={post._id} className="w-full block" showControls={false} />
      <div className="p-3 space-y-2">
        <p className="font-['Caveat'] text-2xl leading-tight text-[var(--text-primary)]">{post.caption}</p>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-text)]">#{t}</span>
            ))}
          </div>
        )}
        {post.sentiment && <p className="text-xs italic text-[var(--text-secondary)]">{post.sentiment}</p>}
      </div>
      <div className="px-3 pb-3 space-y-2 border-t-[length:var(--border-width)] border-[var(--border)] pt-3">
        {comments.length === 0 && <p className="text-xs text-[var(--text-secondary)]">No comments yet.</p>}
        <ul className="space-y-2">
          {comments.map((cm) => (
            <li key={cm._id} className="flex items-start gap-2">
              <ViewerTag userHandle={cm.authorHandle} />
              <p className="text-sm text-[var(--text-primary)] flex-1">{cm.body}</p>
            </li>
          ))}
        </ul>
        {cVerdict.ok ? (
          <form onSubmit={(e) => { e.preventDefault(); comment() }} className="flex gap-2 pt-1">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 min-h-[44px] rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--background)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button type="submit" disabled={busy || !body.trim()} className="min-h-[44px] px-4 rounded-[var(--radius)] bg-[var(--primary)] text-[var(--accent-text)] font-medium disabled:opacity-50">
              {busy ? "…" : "Send"}
            </button>
          </form>
        ) : ready && (
          <p className="text-xs text-[var(--text-secondary)]">{cVerdict.reason || "Sign in to comment."}</p>
        )}
      </div>
    </article>
  )
}

function Feed() {
  const { useLiveQuery } = useFireproof("snapshotWall")
  const { docs: posts } = useLiveQuery("type", { key: "post" })
  const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <section id="feed" className="space-y-4">
      <h2 className="font-['Caveat'] text-3xl text-[var(--text-primary)] px-1">The wall</h2>
      {sorted.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-sm px-1">No snapshots yet — be the first.</p>
      ) : (
        sorted.map((p) => <PostCard key={p._id} post={p} />)
      )}
    </section>
  )
}

export default function App() {
  const { ViewerTag, isOwner } = useViewer()
  const { can, ready, me } = useVibe("snapshotWall")
  const { database, useLiveQuery } = useFireproof("snapshotWall")
  const { docs: channels } = useLiveQuery("type", { key: "channel" })

  React.useEffect(() => {
    if (!isOwner) return
    if (channels.some((ch) => ch._id === "ch:wall")) return
    database.put({ _id: "ch:wall", type: "channel", name: "wall" }).catch(() => {})
  }, [isOwner, channels, database])

  const c = {
    page: "min-h-screen bg-[var(--background)] font-[var(--font-family)] text-[var(--text-primary)] pb-12",
    header: "sticky top-0 z-10 backdrop-blur bg-[color-mix(in_srgb,var(--background)_85%,transparent)] border-b-[length:var(--border-width)] border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "font-['Caveat'] text-4xl leading-none text-[var(--text-primary)]",
    main: "max-w-2xl mx-auto px-4 py-5 space-y-6",
  }

  return (
    <div className={c.page}>
      <style>{`
:root {
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --accent: oklch(0.93 0.03 130);
  --border: rgba(20, 20, 20, 0.14);
  --background: #fff;
  --surface: rgba(255, 255, 255, 0.85);
  --primary: oklch(0.93 0.03 130);
  --secondary: oklch(0.93 0.03 130);
  --text-disabled: color-mix(in srgb, var(--text-primary) 38%, var(--background));
  --warning: #f59e0b; --success: #22c55e; --error: #ef4444; --neutral: #6b7280;
  --font-family: 'Inter', sans-serif;
  --font-family-mono: ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --font-size-base: 1rem;
  --radius: 0.5rem; --radius-sm: 0.25rem; --radius-lg: 1rem;
  --spacing: 1rem; --border-width: 1px;
  --accent-text: #0a0a0a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --accent: oklch(0.07 0.03 130);
    --border: rgba(255, 255, 255, 0.18);
    --background: #0f0f0f;
    --text-primary: rgba(255, 255, 255, 0.92);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --surface: rgba(255, 255, 255, 0.04);
    --primary: oklch(0.07 0.03 130);
    --secondary: oklch(0.07 0.03 130);
    --accent-text: #fafafa;
  }
}
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;500;600&display=optional');
      `}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Snapshot Wall</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <Composer />
        <Feed />
      </main>
    </div>
  )
}