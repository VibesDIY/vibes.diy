import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import { useVibe } from "use-vibes"

function Composer() {
  const { can, ready, me } = useVibe("snapwall")
  const { database } = useFireproof("snapwall")
  const [file, setFile] = React.useState(null)
  const [caption, setCaption] = React.useState("")
  const [preview, setPreview] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const inputRef = React.useRef(null)
  React.useEffect(() => {
    if (!file) return setPreview("")
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const handleFile = (f) => { if (f) setFile(f) }
  const onDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }
  const onSubmit = async (e) => {
    e.preventDefault()
    if (!file || !me) return
    setSaving(true); setError("")
    try {
      await database.put({
        type: "post",
        caption: caption.trim(),
        authorHandle: me.userHandle,
        createdAt: Date.now(),
        _files: { photo: file },
      })
      setFile(null); setCaption("")
    } catch (err) { setError(err.message || "post failed") }
    finally { setSaving(false) }
  }
  const c = {
    card: "bg-white border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] p-4",
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#64748b] font-semibold mb-2",
    input: "w-full border-[3px] border-[#0f172a] rounded-[4px] px-3 py-3 min-h-[44px] font-['Space_Grotesk']",
    btn: "bg-[#dc2626] text-white border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] px-5 py-3 min-h-[44px] uppercase tracking-[0.08em] font-bold text-sm disabled:opacity-50",
    drop: "border-[3px] border-dashed border-[#0f172a] rounded-[4px] p-6 text-center bg-[#fef3c7] min-h-[88px] flex items-center justify-center cursor-pointer",
  }
  if (!ready) return <section className={c.card}><div className={c.label}>Loading…</div></section>
  const verdict = can.create({ type: "post", authorHandle: me?.userHandle })
  if (!verdict.ok) return <section className={c.card}><div className={c.label}>Heads up</div><p className="text-sm">{verdict.reason}</p></section>
  return (
    <section id="composer" className={c.card}>
      <div className={c.label}>Drop a Photo</div>
      <form onSubmit={onSubmit}>
        <div
          className={c.drop}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {preview ? <img src={preview} alt="" className="max-h-48 rounded-[4px]" /> : <span className="text-sm">Tap or drag an image</span>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        <input
          className={`${c.input} mt-3`}
          placeholder="Caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        {error && <p className="text-[#dc2626] text-sm mt-2">{error}</p>}
        <button type="submit" className={`${c.btn} mt-3 w-full`} disabled={!file || saving}>
          {saving ? (
            <svg className="animate-spin inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="9" strokeDasharray="42 60" />
            </svg>
          ) : "Post It"}
        </button>
      </form>
    </section>
  )
}

function CommentList({ postId }) {
  const { useLiveQuery, database } = useFireproof("snapwall")
  const { can, ready, me } = useVibe("snapwall")
  const { ViewerTag } = useViewer()
  const { docs } = useLiveQuery("postId", { key: postId })
  const [body, setBody] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const sorted = [...docs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const onPost = async (e) => {
    e.preventDefault()
    if (!body.trim() || !me) return
    setSaving(true)
    try {
      await database.put({
        type: "comment",
        postId,
        body: body.trim(),
        authorHandle: me.userHandle,
        createdAt: Date.now(),
      })
      setBody("")
    } finally { setSaving(false) }
  }
  const verdict = ready ? can.create({ type: "comment", postId, authorHandle: me?.userHandle }) : { ok: false, reason: "" }
  return (
    <div className="mt-3 pt-3 border-t-[3px] border-[#0f172a] space-y-2">
      {sorted.length === 0 && <p className="text-xs text-[#64748b] uppercase tracking-[0.15em]">No comments yet</p>}
      {sorted.map((c) => (
        <div key={c._id} className="bg-[#faf8f1] border-[2px] border-[#0f172a] rounded-[4px] p-2">
          <ViewerTag userHandle={c.authorHandle} />
          <p className="text-sm mt-1">{c.body}</p>
        </div>
      ))}
      {verdict.ok ? (
        <form onSubmit={onPost} className="flex gap-2 mt-2">
          <input
            className="flex-1 border-[3px] border-[#0f172a] rounded-[4px] px-3 py-2 min-h-[44px] font-['Space_Grotesk']"
            placeholder="Say something..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="bg-[#2563eb] text-white border-[3px] border-[#0f172a] rounded-[4px] shadow-[3px_3px_0px_#0f172a] px-3 py-2 min-h-[44px] uppercase text-xs tracking-[0.08em] font-bold disabled:opacity-50"
          >
            {saving ? "..." : "Send"}
          </button>
        </form>
      ) : ready && <p className="text-xs text-[#64748b]">{verdict.reason}</p>}
    </div>
  )
}

function PostCard({ post }) {
  const { ViewerTag } = useViewer()
  const { useLiveQuery } = useFireproof("snapwall")
  const { docs: comments } = useLiveQuery("postId", { key: post._id })
  const [open, setOpen] = React.useState(false)
  const photo = post._files?.photo
  return (
    <article className="bg-white border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] overflow-hidden">
      {photo?.url && <img src={photo.url} alt={post.caption || ""} className="w-full block" />}
      <div className="p-3">
        <ViewerTag userHandle={post.authorHandle} />
        {post.caption && <p className="mt-2 text-base">{post.caption}</p>}
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 text-xs uppercase tracking-[0.08em] font-bold bg-[#fbbf24] border-[3px] border-[#0f172a] rounded-[4px] shadow-[3px_3px_0px_#0f172a] px-3 py-2 min-h-[44px]"
        >
          {open ? "Hide" : "Comments"} ({comments.length})
        </button>
        {open && <CommentList postId={post._id} />}
      </div>
    </article>
  )
}

function Feed() {
  const { useLiveQuery } = useFireproof("snapwall")
  const { docs } = useLiveQuery("type", { key: "post" })
  const posts = [...docs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  if (posts.length === 0) {
    return (
      <section id="feed" className="bg-white border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] p-4">
        <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#64748b] font-semibold">The Wall</div>
        <div className="py-12 text-center text-[#64748b]">No posts yet — be the first.</div>
      </section>
    )
  }
  return (
    <section id="feed" className="space-y-4">
      <div className="text-[0.65rem] uppercase tracking-[0.15em] text-[#64748b] font-semibold px-1">The Wall</div>
      {posts.map((p) => <PostCard key={p._id} post={p} />)}
    </section>
  )
}

export default function App() {
  const { ViewerTag } = useViewer()
  const c = {
    page: "min-h-screen bg-[#faf8f1] font-['Space_Grotesk'] text-[#0f172a]",
    wrap: "max-w-[640px] mx-auto px-4 py-5 space-y-5",
    header: "bg-white border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] px-4 py-3 flex items-center justify-between sticky top-3 z-10",
    brand: "text-2xl font-bold uppercase tracking-[-0.02em]",
    dots: "flex gap-1",
    dot: "w-3 h-3 border-[2px] border-[#0f172a]",
  }
  return (
    <div className={c.page}>
      <main id="app" className={c.wrap}>
        <header id="app-header" className={c.header}>
          <div className="flex items-center gap-2">
            <div className={c.dots}>
              <div className={`${c.dot} bg-[#dc2626]`} />
              <div className={`${c.dot} bg-[#fbbf24]`} />
              <div className={`${c.dot} bg-[#16a34a]`} />
            </div>
            <div className={c.brand}>Snapwall</div>
          </div>
          <ViewerTag />
        </header>
        <Composer />
        <Feed />
      </main>
    </div>
  )
}