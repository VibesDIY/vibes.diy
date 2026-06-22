import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function WallHeader() {
  const { ViewerTag } = useViewer()
  const c = {
    header: "sticky top-0 z-10 bg-[var(--surface)] backdrop-blur border-b border-[var(--border)] px-4 py-3 flex items-center justify-between",
    title: "text-2xl font-bold text-[var(--text-primary)]",
    sub: "text-xs text-[var(--text-secondary)]",
  }
  return (
    <header id="app-header" className={c.header}>
      <div>
        <h1 className={c.title} style={{ fontFamily: "Caveat, cursive" }}>SnapWall</h1>
        <p className={c.sub}>a live photo wall</p>
      </div>
      <ViewerTag />
    </header>
  )
}

function ChannelSetup({ database, can, ready }) {
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const verdict = ready ? can.create({ type: "channel", _id: "ch:" + (name || "wall") }) : { ok: false }
  if (!ready || !verdict.ok) return null
  const c = {
    wrap: "p-4 border-b border-[var(--border)] bg-[var(--surface)]",
    label: "text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-2",
    row: "flex gap-2",
    input: "flex-1 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[44px]",
    btn: "px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--accent-text,#0a0a0a)] font-medium min-h-[44px] disabled:opacity-50",
  }
  const create = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await database.put({ _id: "ch:" + name.trim().toLowerCase().replace(/\s+/g, "-"), type: "channel", name: name.trim(), createdAt: Date.now() })
      setName("")
    } finally { setSaving(false) }
  }
  return (
    <section id="channel-setup" className={c.wrap}>
      <p className={c.label}>owner: create a wall</p>
      <div className={c.row}>
        <input className={c.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="wall name" />
        <button className={c.btn} onClick={create} disabled={saving || !name.trim()}>
          {saving ? "..." : "Create"}
        </button>
      </div>
    </section>
  )
}

function Composer({ database, channelId, can, ready, me }) {
  const [caption, setCaption] = React.useState("")
  const [file, setFile] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const verdict = ready && channelId ? can.create({ type: "post", channelId, authorHandle: me?.userHandle }) : { ok: false, reason: "pick a wall" }
  const c = {
    wrap: "p-4 border-b border-[var(--border)] bg-[var(--surface)]",
    title: "text-sm font-semibold text-[var(--text-primary)] mb-3",
    drop: "border-2 border-dashed border-[var(--border)] rounded-[var(--radius)] p-4 text-center text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--background)]",
    input: "w-full mt-3 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] min-h-[44px]",
    btn: "mt-3 w-full px-4 py-3 rounded-[var(--radius)] bg-[var(--primary)] text-[var(--accent-text,#0a0a0a)] font-semibold min-h-[44px] disabled:opacity-50 flex items-center justify-center gap-2",
    muted: "text-sm text-[var(--text-secondary)] italic",
    preview: "mt-3 max-h-48 rounded-[var(--radius-sm)] object-cover w-full",
  }
  if (!verdict.ok) return (
    <section id="composer" className={c.wrap}>
      <p className={c.muted}>{verdict.reason || "sign in to post"}</p>
    </section>
  )
  const onDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }
  const onPick = (e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!file || !caption.trim() || busy) return
    setBusy(true)
    try {
      let tags = []
      try {
        const res = await callAI(`Suggest 3-5 short descriptive tags (mood, subject, setting) for a photo with caption: "${caption.trim()}"`, {
          schema: { properties: { tags: { type: "array", items: { type: "string" } } } }
        })
        tags = JSON.parse(res).tags || []
      } catch {}
      await database.put({
        type: "post",
        channelId,
        caption: caption.trim(),
        authorHandle: me?.userHandle,
        tags,
        createdAt: Date.now(),
        _files: { photo: file },
      })
      setCaption("")
      setFile(null)
    } finally { setBusy(false) }
  }
  return (
    <section id="composer" className={c.wrap}>
      <h2 className={c.title}>Share a photo</h2>
      <form onSubmit={submit}>
        <label className={c.drop} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          {file ? file.name : "Drop a photo or tap to choose"}
          <input type="file" accept="image/*" onChange={onPick} className="hidden" />
        </label>
        {file && <img src={URL.createObjectURL(file)} alt="" className={c.preview} />}
        <input className={c.input} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." />
        <button type="submit" className={c.btn} disabled={busy || !file || !caption.trim()}>
          {busy && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="42 20" /></svg>}
          {busy ? "Posting..." : "Post"}
        </button>
      </form>
    </section>
  )
}

function CommentForm({ database, post, can, ready, me }) {
  const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const verdict = ready ? can.create({ type: "message", channelId: post.channelId, authorHandle: me?.userHandle }) : { ok: false }
  const c = {
    form: "flex gap-2 mt-2",
    input: "flex-1 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--text-primary)] min-h-[40px]",
    btn: "px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--secondary)] text-[var(--accent-text,#0a0a0a)] text-sm font-medium min-h-[40px] disabled:opacity-50",
    muted: "text-xs text-[var(--text-secondary)] italic mt-2",
  }
  if (!verdict.ok) return <p className={c.muted}>{verdict.reason || "sign in to comment"}</p>
  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      await database.put({ type: "message", channelId: post.channelId, postId: post._id, body: text.trim(), authorHandle: me?.userHandle, createdAt: Date.now() })
      setText("")
    } finally { setSaving(false) }
  }
  return (
    <form onSubmit={submit} className={c.form}>
      <input className={c.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." />
      <button type="submit" className={c.btn} disabled={saving || !text.trim()}>{saving ? "..." : "Send"}</button>
    </form>
  )
}

function PostCard({ post, comments, database, can, ready, me }) {
  const { ViewerTag } = useViewer()
  const photo = post._files?.photo
  const mine = comments.filter((m) => m.postId === post._id).sort((a, b) => a.createdAt - b.createdAt)
  const c = {
    card: "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden shadow-sm",
    head: "p-3 flex items-center justify-between border-b border-[var(--border)]",
    img: "w-full aspect-square object-cover bg-[var(--background)]",
    body: "p-3",
    caption: "text-[var(--text-primary)]",
    tags: "flex flex-wrap gap-1 mt-2",
    tag: "text-xs px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--text-primary)] border border-[var(--border)]",
    aside: "mt-3 p-2 rounded-[var(--radius-sm)] bg-[var(--background)] border border-[var(--border)]",
    asideLabel: "text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-1",
    comments: "mt-3 space-y-2",
    comment: "text-sm flex flex-col gap-1 p-2 rounded-[var(--radius-sm)] bg-[var(--background)] border border-[var(--border)]",
    cTop: "flex items-center gap-2",
    cBody: "text-[var(--text-primary)]",
    time: "text-xs text-[var(--text-secondary)]",
  }
  return (
    <article className={c.card}>
      <div className={c.head}>
        <ViewerTag userHandle={post.authorHandle} />
        <span className={c.time}>{new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
      {photo?.url && <img src={photo.url} alt={post.caption} className={c.img} />}
      <div className={c.body}>
        <p className={c.caption}>{post.caption}</p>
        {post.tags?.length > 0 && (
          <div className={c.tags}>
            {post.tags.map((t, i) => <span key={i} className={c.tag}>#{t}</span>)}
          </div>
        )}
        <div className={c.aside}>
          <p className={c.asideLabel}>AI vibe sketch</p>
          <ImgGen prompt={`stylized scrapbook illustration of: ${post.caption}`} _id={post._id} database="snapwall" />
        </div>
        <div className={c.comments}>
          {mine.map((m) => (
            <div key={m._id} className={c.comment}>
              <div className={c.cTop}>
                <ViewerTag userHandle={m.authorHandle} />
                <span className={c.time}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className={c.cBody}>{m.body}</p>
            </div>
          ))}
          <CommentForm database={database} post={post} can={can} ready={ready} me={me} />
        </div>
      </div>
    </article>
  )
}

function Feed({ posts, comments, database, can, ready, me }) {
  const c = {
    wrap: "p-4 space-y-4",
    empty: "text-center text-[var(--text-secondary)] py-12 italic",
  }
  if (!posts.length) return <section id="feed" className={c.wrap}><p className={c.empty}>No photos yet — be the first.</p></section>
  return (
    <section id="feed" className={c.wrap}>
      {posts.map((p) => <PostCard key={p._id} post={p} comments={comments} database={database} can={can} ready={ready} me={me} />)}
    </section>
  )
}

function ChannelPicker({ channels, current, setCurrent }) {
  if (!channels.length) return null
  const c = {
    wrap: "px-4 py-2 border-b border-[var(--border)] bg-[var(--background)] flex gap-2 overflow-x-auto",
    chip: "px-3 py-1.5 rounded-full border text-sm whitespace-nowrap min-h-[36px]",
    on: "bg-[var(--primary)] text-[var(--accent-text,#0a0a0a)] border-transparent",
    off: "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)]",
  }
  return (
    <nav className={c.wrap}>
      {channels.map((ch) => (
        <button key={ch._id} onClick={() => setCurrent(ch._id)} className={`${c.chip} ${current === ch._id ? c.on : c.off}`}>
          #{ch.name}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("snapwall")
  const { can, ready, me } = useVibe("snapwall")
  const { docs: channels } = useLiveQuery("type", { key: "channel" })
  const { docs: posts } = useLiveQuery("type", { key: "post", descending: true })
  const { docs: comments } = useLiveQuery("type", { key: "message" })
  const [current, setCurrent] = React.useState(null)

  React.useEffect(() => {
    if (!current && channels.length) setCurrent(channels[0]._id)
  }, [channels, current])

  const visiblePosts = posts.filter((p) => p.channelId === current)

  const themeStyle = `
:root {
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --accent: oklch(0.93 0.03 130);
  --border: rgba(20, 20, 20, 0.14);
  --background: #fff;
  --surface: rgba(255, 255, 255, 0.85);
  --primary: oklch(0.93 0.03 130);
  --secondary: oklch(0.93 0.03 130);
  --accent-text: #0a0a0a;
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --border-width: 1px;
  --font-family: 'Inter', sans-serif;
  --font-size-base: 1rem;
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
`

  const c = {
    app: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    main: "max-w-2xl mx-auto",
  }

  return (
    <>
      <style>{themeStyle}</style>
      <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;600&display=optional" rel="stylesheet" />
      <div className={c.app}>
        <main id="app" className={c.main}>
          <WallHeader />
          <ChannelSetup database={database} can={can} ready={ready} />
          <ChannelPicker channels={channels} current={current} setCurrent={setCurrent} />
          <Composer database={database} channelId={current} can={can} ready={ready} me={me} />
          <Feed posts={visiblePosts} comments={comments} database={database} can={can} ready={ready} me={me} />
        </main>
      </div>
    </>
  )
}