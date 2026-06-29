const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("reply-roulette")
  const [incoming, setIncoming] = React.useState("")
  const [draft, setDraft] = React.useState("")
  const [options, setOptions] = React.useState(null)
  const [loadingGen, setLoadingGen] = React.useState(false)
  const [loadingSuggest, setLoadingSuggest] = React.useState(false)
  const [autoMode, setAutoMode] = React.useState(false)
  const [currentPlayer, setCurrentPlayer] = React.useState("p1")
  const { docs: turns } = useLiveQuery("ts", { descending: false })

  React.useEffect(() => {
    if (!autoMode || loadingGen) return
    const last = turns[turns.length - 1]
    if (!last) return
    let cancelled = false
    const t = setTimeout(async () => {
      const seed = last.text
      const res = await generateOptions(seed, "incoming")
      if (cancelled || !res) return
      const pick = Math.random() < 0.5 ? "b" : "c"
      await postTurn(pick, res[pick], seed)
    }, 1500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [autoMode, turns.length])

  async function generateOptions(seed, seedKind) {
    setLoadingGen(true)
    try {
      const prompt = seedKind === "seed"
        ? `Take this draft message and rewrite it in 4 tonal variations. Draft: "${seed}"`
        : `Generate 4 reply options to this incoming message, ranked tonally. Incoming: "${seed}"`
      const res = await callAI(prompt + ` Return four replies labeled a (Thoughtful - articulate, genuine), b (Agreeable - casual, affirming), c (Playful - has edge, witty), d (Unhinged - chaotic, absurd, funny).`, {
        schema: { properties: { a: { type: "string" }, b: { type: "string" }, c: { type: "string" }, d: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      setOptions(parsed)
      return parsed
    } finally { setLoadingGen(false) }
  }

  async function suggestIncoming() {
    setLoadingSuggest(true)
    try {
      const res = await callAI("Generate a single short realistic incoming chat message someone might receive that would be fun to reply to.", {
        schema: { properties: { message: { type: "string" } } }
      })
      setIncoming(JSON.parse(res).message)
    } finally { setLoadingSuggest(false) }
  }

  async function postTurn(opt, text, inc) {
    await database.put({
      player: currentPlayer,
      incoming: inc || "",
      option: opt,
      text,
      ts: Date.now(),
    })
    setCurrentPlayer(p => p === "p1" ? "p2" : "p1")
    setOptions(null)
    setDraft("")
    setIncoming("")
  }

  const optionDefs = [
    { k: "a", label: "A · THOUGHTFUL", color: "#4fc3f7", bg: "rgba(79,195,247,0.12)", border: "rgba(79,195,247,0.5)", desc: "articulate & genuine" },
    { k: "b", label: "B · AGREEABLE",  color: "#81c784", bg: "rgba(129,199,132,0.12)", border: "rgba(129,199,132,0.5)", desc: "casual & affirming" },
    { k: "c", label: "C · PLAYFUL",    color: "#ffb74d", bg: "rgba(255,183,77,0.12)", border: "rgba(255,183,77,0.5)", desc: "witty & sharp" },
    { k: "d", label: "D · UNHINGED",   color: "#ef5350", bg: "rgba(239,83,80,0.14)", border: "rgba(239,83,80,0.6)", desc: "chaotic & absurd" },
  ]

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] font-['Rajdhani',sans-serif] text-[#2a0a2e]",
    header: "sticky top-0 z-10 bg-[#2a0a2e] text-[#fcee0a] px-4 py-3 shadow-lg border-b-2 border-[#f93c94]",
    title: "font-['Orbitron',sans-serif] font-bold text-2xl tracking-wider",
    tagline: "font-['Share_Tech_Mono',monospace] text-xs text-[#00f0ff] mt-0.5",
    main: "max-w-2xl mx-auto p-4 space-y-4 pb-32",
    section: "bg-[#4d1558] text-white rounded-lg p-5 shadow-xl border border-[#f93c94]/40",
    h2: "font-['Orbitron',sans-serif] font-bold text-lg text-[#fcee0a] mb-3 tracking-wide",
    input: "w-full bg-[#2a0a2e] text-white border border-[#f93c94]/50 rounded px-3 py-3 min-h-[44px] placeholder-white/40 focus:outline-none focus:border-[#00f0ff]",
    textarea: "w-full bg-[#2a0a2e] text-white border border-[#f93c94]/50 rounded px-3 py-3 placeholder-white/40 focus:outline-none focus:border-[#00f0ff] resize-none",
    btn: "min-h-[44px] px-4 py-3 rounded font-['Orbitron',sans-serif] font-bold text-sm tracking-wide bg-[#f93c94] text-white hover:bg-[#fcee0a] hover:text-[#2a0a2e] transition disabled:opacity-50",
    btnGhost: "min-h-[44px] px-4 py-3 rounded font-['Orbitron',sans-serif] font-bold text-sm tracking-wide bg-transparent border-2 border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-[#2a0a2e] transition disabled:opacity-50",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "REPLY ROULETTE" }, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this)
        , _jsxDEV('p', { className: c.tagline, children: "// four shots from cool to chaotic"      }, void 0, false, {fileName: _jsxFileName, lineNumber: 90}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 88}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "composer", className: c.section, children: [
          _jsxDEV('div', { className: "flex items-center justify-between mb-2"   , children: [
            _jsxDEV('h2', { className: c.h2 + " mb-0", children: ["INCOMING (" , currentPlayer.toUpperCase(), ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 95}, this)
            , _jsxDEV('span', { className: "text-xs font-['Share_Tech_Mono',monospace] text-[#00f0ff]"  , children: ["turn: " , currentPlayer]}, void 0, true, {fileName: _jsxFileName, lineNumber: 96}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 94}, this)
          , can("write") ? (
            _jsxDEV(_Fragment, { children: [
              _jsxDEV('textarea', { rows: 2, value: incoming, onChange: e => setIncoming(e.target.value), placeholder: "Paste what they sent you..."    , className: c.textarea,}, void 0, false, {fileName: _jsxFileName, lineNumber: 100}, this )
              , _jsxDEV('div', { className: "flex gap-2 mt-3 flex-wrap"   , children: [
                _jsxDEV('button', { disabled: loadingGen || !incoming.trim(), onClick: () => generateOptions(incoming, "incoming"), className: c.btn, children: 
                  loadingGen ? _jsxDEV('svg', { className: "animate-spin inline w-4 h-4"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "10", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 103}, this) : "GENERATE 4 REPLIES"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 102}, this)
                , _jsxDEV('button', { disabled: loadingSuggest, onClick: suggestIncoming, className: c.btnGhost, type: "button", children: 
                  loadingSuggest ? "..." : "SUGGEST"
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 105}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 101}, this)
              , _jsxDEV('h2', { className: c.h2 + " mt-5", children: "YOUR DRAFT" }, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this)
              , _jsxDEV('textarea', { rows: 2, value: draft, onChange: e => setDraft(e.target.value), placeholder: "Or write your own..."   , className: c.textarea,}, void 0, false, {fileName: _jsxFileName, lineNumber: 110}, this )
              , _jsxDEV('div', { className: "flex gap-2 mt-3 flex-wrap"   , children: [
                _jsxDEV('button', { disabled: !draft.trim(), onClick: () => postTurn("human", draft, incoming), className: c.btn, children: "POST IT" }, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
                , _jsxDEV('button', { disabled: loadingGen || !draft.trim(), onClick: () => generateOptions(draft, "seed"), className: c.btnGhost, children: "USE AS SEED"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 113}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 111}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 99}, this)
          ) : (
            _jsxDEV('p', { className: "text-white/70 text-sm" , children: "Read-only view — contact the owner for write access."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 117}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 93}, this)
        , _jsxDEV('section', { id: "options", className: c.section, children: [
          _jsxDEV('div', { className: "flex items-baseline justify-between mb-4", children: [
            _jsxDEV('h2', { className: c.h2 + " mb-0", children: "REPLY OPTIONS" }, void 0, false, {fileName: _jsxFileName, lineNumber: 121}, this)
            , _jsxDEV('span', { className: "text-[10px] font-['Share_Tech_Mono',monospace] text-white/40 tracking-widest", children: "CALM → CHAOS" }, void 0, false, {fileName: _jsxFileName, lineNumber: 121}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 121}, this)
          , _jsxDEV('div', { className: "space-y-3", children:
            optionDefs.map(opt => {
              const text = _optionalChain([options, 'optionalAccess', _ => _[opt.k]])
              const clickable = can("write") && text
              return (
                _jsxDEV('button', {
                  disabled: !clickable,
                  onClick: () => postTurn(opt.k, text, incoming),
                  className: "w-full text-left rounded-lg border-l-[5px] transition-all hover:scale-[1.015] hover:brightness-110 disabled:hover:scale-100 disabled:cursor-default active:scale-[0.99]",
                  style: { borderColor: opt.color, background: opt.bg, borderTop: `1px solid ${opt.border}`, borderRight: `1px solid ${opt.border}`, borderBottom: `1px solid ${opt.border}`, padding: "14px 16px" },
                  children: [
                    _jsxDEV('div', { className: "flex items-center justify-between mb-2", children: [
                      _jsxDEV('span', { className: "font-['Orbitron',sans-serif] text-xs font-bold tracking-widest", style: { color: opt.color }, children: opt.label }, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this)
                      , _jsxDEV('span', { className: "text-[10px] font-['Share_Tech_Mono',monospace] tracking-wide opacity-60", style: { color: opt.color }, children: opt.desc }, void 0, false, {fileName: _jsxFileName, lineNumber: 139}, this)
                    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 139}, this)
                    , _jsxDEV('div', { className: "text-sm leading-relaxed " + (text ? "text-white" : "text-white/35 italic"), children:
                      text || (loadingGen ? "generating..." : "—")
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 140}, this)
                  ]
                }, opt.k, true, {fileName: _jsxFileName, lineNumber: 132}, this)
              )
            })
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 122}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 120}, this)
        , _jsxDEV('section', { id: "auto-mode", className: c.section, children: 
          _jsxDEV('div', { className: "flex items-center justify-between"  , children: [
            _jsxDEV('div', { children: [
              _jsxDEV('h2', { className: c.h2 + " mb-1", children: ["AUTO VOLLEY "  , autoMode && _jsxDEV('span', { className: "text-[#fcee0a] animate-pulse" , children: "●"}, void 0, false, {fileName: _jsxFileName, lineNumber: 151}, this)]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
              , _jsxDEV('p', { className: "text-xs text-white/70 font-['Share_Tech_Mono',monospace]"  , children: "// AI picks B or C, posts, repeats"       }, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 150}, this)
            , _jsxDEV('button', {
                onClick: () => can("write") && setAutoMode(v => !v),
                disabled: !can("write"),
                title: can("write") ? (autoMode ? "Turn off Auto Volley" : "Turn on Auto Volley") : "Owner-only feature",
                className: "relative w-16 h-9 rounded-full border-2 transition disabled:opacity-40 " + (autoMode ? "bg-[#fcee0a] border-[#fcee0a]" : "bg-[#2a0a2e] border-[#f93c94]"),
 children:
                _jsxDEV('span', { className: "absolute top-0.5 w-7 h-7 rounded-full transition " + (autoMode ? "left-[30px] bg-[#2a0a2e]" : "left-0.5 bg-[#f93c94]"),}, void 0, false, {fileName: _jsxFileName, lineNumber: 159}, this )
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 149}, this)
        }, void 0, false, {fileName: _jsxFileName, lineNumber: 148}, this)
        , _jsxDEV('section', { id: "thread", className: c.section, children: [
          _jsxDEV('div', { className: "flex items-center justify-between mb-3"   , children: [
            _jsxDEV('h2', { className: c.h2 + " mb-0", children: ["CONVERSATION (" , turns.length, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 166}, this)
            , can("write") && turns.length > 0 && (
              _jsxDEV('button', {
                onClick: async () => { for (const t of turns) await database.del(t._id) },
                className: "text-xs font-['Share_Tech_Mono',monospace] text-[#00f0ff] hover:text-[#fcee0a]"   ,
 children: "clear"}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this)
            )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 165}, this)
          , _jsxDEV('div', { className: "space-y-2", children: [
            turns.length === 0 && _jsxDEV('div', { className: "text-sm text-white/50 italic"  , children: "No messages yet — generate or post one to start."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 175}, this)
            , turns.map(t => {
              const badgeColor = { a: "#00f0ff", b: "#7fee5c", c: "#fcee0a", d: "#ff3366", human: "#f93c94" }[t.option] || "#fff"
              const badgeLabel = t.option === "human" ? "YOURS" : t.option.toUpperCase()
              return (
                _jsxDEV('div', { className: "p-3 rounded bg-[#2a0a2e] border"   , style: { borderColor: badgeColor + "55" }, children: [
                  _jsxDEV('div', { className: "flex justify-between text-xs font-['Share_Tech_Mono',monospace] mb-1"    , children: [
                    _jsxDEV('span', { className: "text-[#f93c94]", children: t.player.toUpperCase()}, void 0, false, {fileName: _jsxFileName, lineNumber: 182}, this)
                    , _jsxDEV('span', { style: { color: badgeColor }, children: badgeLabel}, void 0, false, {fileName: _jsxFileName, lineNumber: 183}, this)
                  ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 181}, this)
                  , _jsxDEV('div', { className: "text-sm", children: t.text}, void 0, false, {fileName: _jsxFileName, lineNumber: 185}, this)
                ]}, t._id, true, {fileName: _jsxFileName, lineNumber: 180}, this)
              )
            })
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 174}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 164}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 92}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 87}, this)
  )
}