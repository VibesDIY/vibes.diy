const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useDocument, useLiveQuery } = useFireproof("vault-thrift")
  const [itemParam, setItemParam] = React.useState(() => new URLSearchParams(window.location.search).get("item"))
  const [isPosting, setIsPosting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const { doc: newFind, merge: mergeFind, reset: resetFind } = useDocument({
    type: "find",
    name: "",
    price: "",
    source: "",
    brag: "",
    tags: null,
    createdAt: Date.now(),
    _files: {},
  })
  const { docs: finds } = useLiveQuery("type", { key: "find", descending: true })
  const sortedFinds = [...finds].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const { docs: reactions } = useLiveQuery("type", { key: "reaction" })
  const [heroDoc, setHeroDoc] = React.useState(null)
  React.useEffect(() => {
    if (!itemParam) { setHeroDoc(null); return }
    database.get(itemParam).then(setHeroDoc).catch(() => setHeroDoc(null))
  }, [itemParam, finds.length])

  const onPickFile = (e) => {
    const f = _optionalChain([e, 'access', _ => _.target, 'access', _2 => _2.files, 'optionalAccess', _3 => _3[0]])
    if (f) mergeFind({ _files: { photo: f } })
  }

  const onSubmitFind = async (e) => {
    e.preventDefault()
    if (!newFind.name.trim() || !_optionalChain([newFind, 'access', _4 => _4._files, 'optionalAccess', _5 => _5.photo])) return
    setIsPosting(true)
    try {
      let tags = null
      try {
        const resp = await callAI(`Generate playful tags for this thrift find. Item: "${newFind.name}". Brag: "${newFind.brag}". Price: ${newFind.price}.`, {
          schema: { properties: { era: { type: "string" }, style: { type: "string" }, verdict: { type: "string" } } }
        })
        tags = JSON.parse(resp)
      } catch (e2) {}
      await database.put({
        ...newFind,
        tags,
        createdAt: Date.now(),
        authorSlug: _optionalChain([viewer, 'optionalAccess', _6 => _6.userSlug]) || "anon",
        authorName: _optionalChain([viewer, 'optionalAccess', _7 => _7.displayName]) || "anon",
      })
      resetFind()
    } finally {
      setIsPosting(false)
    }
  }

  const react = async (itemId, emoji) => {
    await database.put({ type: "reaction", itemId, emoji, createdAt: Date.now(), by: _optionalChain([viewer, 'optionalAccess', _8 => _8.userSlug]) || "anon" })
  }

  const openHero = (id) => {
    const url = new URL(window.location.href)
    url.searchParams.set("item", id)
    window.history.pushState({}, "", url)
    setItemParam(id)
  }

  const closeHero = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete("item")
    window.history.pushState({}, "", url)
    setItemParam(null)
  }

  const copyShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const countFor = (itemId, emoji) => reactions.filter(r => r.itemId === itemId && r.emoji === emoji).length

  const c = {
    page: "min-h-screen bg-[#0a0719] text-[#ede4d3] font-['Inter',sans-serif]",
    header: "sticky top-0 z-10 bg-[#0a0719]/90 backdrop-blur border-b border-[#c89a4a]/20 px-4 py-3 flex items-center justify-between",
    title: "font-['Space_Mono',monospace] text-xl tracking-tight text-[#e6b86a]",
    tagline: "text-[0.85rem] text-[#7a708a]",
    main: "max-w-2xl mx-auto px-5 pb-24",
    section: "mt-4 rounded-xl bg-[#1a1530]/70 border border-[#c89a4a]/15 p-6",
    sectionTitle: "font-['Space_Mono',monospace] text-[1.4rem] font-bold uppercase tracking-wider text-[#e6b86a] mb-3",
    btn: "min-h-[44px] px-6 py-3 rounded-lg bg-[#e6b86a] text-base text-[#0a0719] font-medium active:opacity-80 disabled:opacity-50",
    btnGhost: "min-h-[44px] px-6 py-3 rounded-lg border border-[#c89a4a]/30 text-base text-[#ede4d3] active:bg-[#1a1530]",
    input: "w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#0a0719] border border-[#c89a4a]/20 text-base text-[#ede4d3] placeholder:text-[#7a708a]",
    feedGrid: "grid grid-cols-2 gap-3 mt-3",
    card: "rounded-lg overflow-hidden bg-[#1a1530] border border-[#c89a4a]/15 active:opacity-80",
    cardImg: "w-full aspect-square object-cover bg-[#0a0719]",
    cardBody: "p-3",
    reactionBtn: "min-h-[56px] flex-1 flex flex-col items-center justify-center rounded-lg bg-[#1a1530] border border-[#c89a4a]/20 active:bg-[#2a1f4a]",
    muted: "text-[#7a708a]",
    accentText: "text-[#e6b86a]",
    purple: "text-[#9966cc]",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV(‘header’, { id: "app-header", className: c.header, style: {
          background: "linear-gradient(rgba(10,7,25,0.3), rgba(10,7,25,0.65)), url(‘https://images.unsplash.com/photo-1637228393246-c38a4b3d2011?w=1920&q=80&fit=crop’) center/cover",
          padding: "0", borderBottom: "1px solid rgba(200,154,74,0.2)", minHeight: "60vh", display: "flex", alignItems: "flex-end", position: "relative"
        }, children: [
        _jsxDEV(‘div’, { style: { padding: "3rem 1.5rem", width: "100%" }, children: [
          _jsxDEV(‘h1’, { style: { color: "#e6b86a", fontSize: "clamp(2.5rem, 8vw, 5rem)", fontWeight: "900", lineHeight: "1.1", letterSpacing: "-0.02em", fontFamily: "’Space Mono’, monospace", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }, children: "Today’s best finds."}, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
          , _jsxDEV(‘p’, { style: { color: "rgba(237,228,211,0.8)", fontSize: "clamp(1rem, 2.5vw, 1.3rem)", marginTop: "1rem", maxWidth: "500px", lineHeight: "1.5" }, children: "Show off what you scored. Rate everyone else’s haul."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)
          , _jsxDEV(‘div’, { className: c.muted, style: { color: "rgba(237,228,211,0.6)", marginTop: "0.75rem", fontSize: "1rem" }, children: _optionalChain([viewer, ‘optionalAccess’, _9 => _9.displayName]) || "guest"}, void 0, false, {fileName: _jsxFileName, lineNumber: 115}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
        , _jsxDEV(‘div’, { style: { position: ‘absolute’, bottom: ‘0.75rem’, right: ‘1rem’, fontSize: ‘0.7rem’, color: ‘rgba(255,255,255,0.5)’, textShadow: ‘0 1px 3px rgba(0,0,0,0.5)’ }, children: ["Photo by ", _jsxDEV(‘a’, { href: "https://unsplash.com/@hugoclement?utm_source=vibes_diy&utm_medium=referral", style: { color: ‘rgba(255,255,255,0.7)’, textDecoration: ‘underline’ }, target: "_blank", rel: "noopener noreferrer", children: "Hugo Clement" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV(‘a’, { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: ‘rgba(255,255,255,0.7)’, textDecoration: ‘underline’ }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 110}, this)
      , _jsxDEV('main', { id: "app", children: [
        itemParam && heroDoc && (
          _jsxDEV('section', { id: "hero-view", className: c.section, children: [
            _jsxDEV('button', { onClick: closeHero, className: `${c.btnGhost} mb-3`, children: "← Back to feed"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 120}, this)
            , _optionalChain([heroDoc, 'access', _10 => _10._files, 'optionalAccess', _11 => _11.photo, 'optionalAccess', _12 => _12.url]) && (
              _jsxDEV('img', { src: heroDoc._files.photo.url, alt: heroDoc.name, className: "w-full rounded-lg mb-3"  ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 122}, this )
            )
            , _jsxDEV('div', { className: `${c.title} text-2xl mb-1`, children: heroDoc.name}, void 0, false, {fileName: _jsxFileName, lineNumber: 124}, this)
            , _jsxDEV('div', { className: `${c.accentText} text-lg`, children: heroDoc.price}, void 0, false, {fileName: _jsxFileName, lineNumber: 125}, this)
            , _jsxDEV('div', { className: `${c.muted} text-base mt-1`, children: ["from " , heroDoc.source]}, void 0, true, {fileName: _jsxFileName, lineNumber: 126}, this)
            , _jsxDEV('p', { className: "mt-3 italic" , children: ["\"", heroDoc.brag, "\""]}, void 0, true, {fileName: _jsxFileName, lineNumber: 127}, this)
            , heroDoc.tags && (
              _jsxDEV('div', { className: "flex flex-wrap gap-2 mt-3"   , children: [
                heroDoc.tags.era && _jsxDEV('span', { className: `text-[0.85rem] px-3 py-1 rounded-full border border-[#c89a4a]/30 ${c.accentText}`, children: heroDoc.tags.era}, void 0, false, {fileName: _jsxFileName, lineNumber: 130}, this)
                , heroDoc.tags.style && _jsxDEV('span', { className: `text-[0.85rem] px-3 py-1 rounded-full border border-[#9966cc]/40 ${c.purple}`, children: heroDoc.tags.style}, void 0, false, {fileName: _jsxFileName, lineNumber: 131}, this)
                , heroDoc.tags.verdict && _jsxDEV('span', { className: "text-[0.85rem] px-3 py-1 rounded-full border border-[#c89a4a]/30 italic"      , children: heroDoc.tags.verdict}, void 0, false, {fileName: _jsxFileName, lineNumber: 132}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 129}, this)
            )
            , _jsxDEV('div', { className: "grid grid-cols-4 gap-2 mt-4"   , children: 
              [["🔥","steal"],["💎","gem"],["😬","overpaid"],["🤌","perfect"]].map(([emoji,label]) => (
                _jsxDEV('button', {

                  onClick: () => can("write") && react(heroDoc._id, emoji),
                  disabled: !can("write"),
                  className: c.reactionBtn,
 children: [
                  _jsxDEV('span', { className: "text-2xl", children: emoji}, void 0, false, {fileName: _jsxFileName, lineNumber: 143}, this)
                  , _jsxDEV('span', { className: `text-[0.85rem] ${c.muted}`, children: label}, void 0, false, {fileName: _jsxFileName, lineNumber: 144}, this)
                  , _jsxDEV('span', { className: `text-base ${c.accentText}`, children: countFor(heroDoc._id, emoji)}, void 0, false, {fileName: _jsxFileName, lineNumber: 145}, this)
                ]}, emoji, true, {fileName: _jsxFileName, lineNumber: 137}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 135}, this)
            , _jsxDEV('button', { onClick: copyShare, className: `${c.btn} w-full mt-4`, children: 
              copied ? "Link copied!" : "Share this find"
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 149}, this)
            , !can("write") && _jsxDEV('p', { className: `${c.muted} text-[0.85rem] mt-2 text-center`, children: "Read-only — contact the owner to react."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 119}, this)
        )
        , itemParam && !heroDoc && (
          _jsxDEV('section', { className: c.section, children: [
            _jsxDEV('p', { className: c.muted, children: "Loading find..." }, void 0, false, {fileName: _jsxFileName, lineNumber: 157}, this)
            , _jsxDEV('button', { onClick: closeHero, className: `${c.btnGhost} mt-3`, children: "← Back to feed"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 158}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 156}, this)
        )
        , !itemParam && can("write") && (
          _jsxDEV('section', { id: "post-find", className: c.section, children: [
            _jsxDEV('h2', { className: c.sectionTitle, children: "Post your find"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 163}, this)
            , _jsxDEV('form', { className: "space-y-2", onSubmit: onSubmitFind, children: [
              _jsxDEV('input', { type: "file", accept: "image/*", onChange: onPickFile, className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 165}, this )
              , _optionalChain([newFind, 'access', _13 => _13._files, 'optionalAccess', _14 => _14.photo]) && _jsxDEV('div', { className: "text-[0.85rem] text-[#7a708a]" , children: "Photo ready" }, void 0, false, {fileName: _jsxFileName, lineNumber: 166}, this)
              , _jsxDEV('input', { placeholder: "Item name (velvet blazer)"   , value: newFind.name, onChange: (e) => mergeFind({ name: e.target.value }), className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 167}, this )
              , _jsxDEV('input', { placeholder: "Price paid ($8)"  , value: newFind.price, onChange: (e) => mergeFind({ price: e.target.value }), className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this )
              , _jsxDEV('input', { placeholder: "Where found (Goodwill on 5th)"    , value: newFind.source, onChange: (e) => mergeFind({ source: e.target.value }), className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 169}, this )
              , _jsxDEV('input', { placeholder: "One-line brag" , value: newFind.brag, onChange: (e) => mergeFind({ brag: e.target.value }), className: c.input,}, void 0, false, {fileName: _jsxFileName, lineNumber: 170}, this )
              , _jsxDEV('button', { type: "submit", disabled: isPosting, className: c.btn, children: 
                isPosting ? (
                  _jsxDEV('span', { className: "inline-flex items-center gap-2"  , children: [
                    _jsxDEV('svg', { className: "animate-spin", width: "16", height: "16", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 174}, this), "Posting..."

                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 173}, this)
                ) : "Post a find"
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 171}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 164}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 162}, this)
        )
        , !itemParam && _jsxDEV('section', { id: "feed", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: "Community finds" }, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this)
          , sortedFinds.length === 0 && _jsxDEV('p', { className: `${c.muted} text-base text-center py-8`, children: "No finds yet — be the first to drop one in the vault." }, void 0, false, {fileName: _jsxFileName, lineNumber: 184}, this)
          , _jsxDEV('div', { className: c.feedGrid, children:
            sortedFinds.map((find) => (
              _jsxDEV('button', { key: find._id, onClick: () => openHero(find._id), className: c.card, children: [
                find._files && find._files.photo && find._files.photo.url
                  ? _jsxDEV('img', { src: find._files.photo.url, alt: find.name, className: c.cardImg }, void 0, false, {fileName: _jsxFileName, lineNumber: 188}, this)
                  : _jsxDEV('div', { className: `${c.cardImg} flex items-center justify-center text-4xl`, children: "🛍️" }, void 0, false, {fileName: _jsxFileName, lineNumber: 189}, this)
                , _jsxDEV('div', { className: c.cardBody, children: [
                  _jsxDEV('div', { className: "font-medium text-base truncate", children: find.name }, void 0, false, {fileName: _jsxFileName, lineNumber: 191}, this)
                  , _jsxDEV('div', { className: `${c.accentText} text-[0.85rem]`, children: find.price }, void 0, false, {fileName: _jsxFileName, lineNumber: 192}, this)
                  , _jsxDEV('div', { className: `${c.muted} text-[0.85rem] truncate`, children: find.source }, void 0, false, {fileName: _jsxFileName, lineNumber: 193}, this)
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 190}, this)
              ]}, find._id, true, {fileName: _jsxFileName, lineNumber: 187}, this)
            ))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 185}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 182}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 117}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 109}, this)
  )
}