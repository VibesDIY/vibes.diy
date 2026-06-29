const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("vibe-field")
  const { docs } = useLiveQuery("createdAt", { descending: true })
  const [messages, setMessages] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuggesting, setIsSuggesting] = React.useState(false)

  async function handleGenerate() {
    if (!messages.trim()) return
    setIsLoading(true)
    try {
      const res = await callAI(
        `Read these group chat messages and return a short mood summary and a detailed prompt for an ABSTRACT color-field image (colors, gradients, textures, light — NO scenes, figures, or objects):\n\n${messages}`,
        { schema: { properties: { mood: { type: "string" }, prompt: { type: "string" } } } }
      )
      const { mood, prompt } = JSON.parse(res)
      await database.put({ type: "vibe", mood, prompt, source: messages, createdAt: Date.now(), createdBy: _optionalChain([viewer, 'optionalAccess', _ => _.userSlug]) || "anon" })
      setMessages("")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSuggest() {
    setIsSuggesting(true)
    try {
      const res = await callAI(
        "Generate a realistic short snippet of 3-4 group chat messages with names and lowercase casual tone, capturing some specific mood.",
        { schema: { properties: { snippet: { type: "string" } } } }
      )
      setMessages(JSON.parse(res).snippet)
    } finally {
      setIsSuggesting(false)
    }
  }

  const c = {
    page: "min-h-screen bg-[#121212] text-white font-['Inter',sans-serif]",
    header: "sticky top-0 z-10 bg-[#1a1a1a] border-b border-white/15 px-5 py-4",
    title: "text-2xl font-semibold tracking-tight",
    tagline: "text-sm text-[#7d7d7d] mt-1",
    main: "pb-24",
    section: "border-b border-white/10 px-5 py-6",
    sectionTitle: "text-sm font-semibold uppercase tracking-widest text-[#7dd87d] mb-3",
    textarea: "w-full min-h-[120px] bg-[#1a1a1a] border border-white/15 rounded-lg p-3 text-white placeholder-[#4d4d4d] focus:outline-none focus:border-[#7dd87d]",
    btn: "w-full min-h-[48px] bg-[#7dd87d] text-black font-semibold rounded-lg px-4 active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2",
    btnGhost: "text-xs text-[#7dd87d] underline",
    card: "mb-8",
    cardImg: "w-full aspect-square bg-[#1a1a1a] overflow-hidden",
    cardMood: "text-base font-medium mt-4 text-white px-5",
    cardMeta: "text-xs text-[#4d4d4d] mt-1 px-5 pb-4",
    empty: "text-center text-[#4d4d4d] py-16 text-sm px-8",
  }

  return (
    _jsxDEV('div', { className: c.page, children: [
      _jsxDEV('header', { id: "app-header", className: c.header, children: [
        _jsxDEV('h1', { className: c.title, children: "Vibe Field" }, void 0, false, {fileName: _jsxFileName, lineNumber: 65}, this)
        , _jsxDEV('p', { className: c.tagline, children: "Group chat → ambient color field"     }, void 0, false, {fileName: _jsxFileName, lineNumber: 66}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 64}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        can("write") ? (
          _jsxDEV('section', { id: "compose", className: c.section, children: [
            _jsxDEV('h2', { className: c.sectionTitle, children: "Paste messages" }, void 0, false, {fileName: _jsxFileName, lineNumber: 71}, this)
            , _jsxDEV('textarea', {
              className: c.textarea,
              placeholder: "alex: ugh today was rough\nsam: same, need a drink\njo: friday cant come fast enough"             ,
              value: messages,
              onChange: (e) => setMessages(e.target.value),
              disabled: isLoading,}, void 0, false, {fileName: _jsxFileName, lineNumber: 72}, this
            )
            , _jsxDEV('div', { className: "flex justify-between items-center mt-2 mb-3"    , children: [
              _jsxDEV('button', { type: "button", className: c.btnGhost, onClick: handleSuggest, disabled: isSuggesting, children: 
                isSuggesting ? "Thinking..." : "Try an example"
              }, void 0, false, {fileName: _jsxFileName, lineNumber: 80}, this)
              , _jsxDEV('span', { className: "text-xs text-[#4d4d4d]" , children: [messages.length, " chars" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 83}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 79}, this)
            , _jsxDEV('button', { type: "button", className: c.btn, onClick: handleGenerate, disabled: isLoading || !messages.trim(), children: 
              isLoading ? (
                _jsxDEV(_Fragment, { children: [
                  _jsxDEV('svg', { className: "animate-spin", width: "18", height: "18", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: 
                    _jsxDEV('path', { d: "M21 12a9 9 0 1 1-6.219-8.56"     ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 89}, this )
                  }, void 0, false, {fileName: _jsxFileName, lineNumber: 88}, this), "Reading the room..."

                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 87}, this)
              ) : "Generate vibe"
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 85}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 70}, this)
        ) : (
          _jsxDEV('section', { id: "compose", className: c.section, children: [
            _jsxDEV('h2', { className: c.sectionTitle, children: "How it works" }, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this)
            , _jsxDEV('p', { className: "text-sm text-[#9d9d9d] leading-relaxed mb-3" , children: "Paste your group chat messages → AI reads the mood → generates an abstract color-field painting that captures the vibe."        }, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this)
            , _jsxDEV('p', { className: "text-xs text-[#5d5d5d]" , children: "Contact the owner for write access to generate your own vibes." }, void 0, false, {fileName: _jsxFileName, lineNumber: 98}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 97}, this)
        )
        , _jsxDEV('section', { id: "gallery", className: c.section, children: [
          _jsxDEV('h2', { className: c.sectionTitle, children: ["Past vibes ("  , docs.length, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 102}, this)
          , docs.length === 0 ? (
            _jsxDEV('div', { className: c.empty, children: [
              _jsxDEV('p', { className: "text-4xl mb-4" , children: "🎨" }, void 0, false, {fileName: _jsxFileName, lineNumber: 104}, this)
              , _jsxDEV('p', { className: "text-[#7d7d7d] font-medium mb-2" , children: "No vibes generated yet." }, void 0, false, {fileName: _jsxFileName, lineNumber: 104}, this)
              , _jsxDEV('p', { className: "text-[#4d4d4d] text-xs leading-relaxed" , children: "Paste a snippet of group chat above, hit Generate vibe, and watch the AI paint your conversation as pure color and mood." }, void 0, false, {fileName: _jsxFileName, lineNumber: 104}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 104}, this)
          ) : (
            docs.map((d) => (
              _jsxDEV('div', { className: c.card, children: [
                _jsxDEV('div', { className: c.cardImg, children: 
                  _jsxDEV(ImgGen, { _id: `img-${d._id}`, prompt: d.prompt, database: "vibe-field", showControls: false,}, void 0, false, {fileName: _jsxFileName, lineNumber: 109}, this )
                }, void 0, false, {fileName: _jsxFileName, lineNumber: 108}, this)
                , _jsxDEV('p', { className: c.cardMood, children: d.mood}, void 0, false, {fileName: _jsxFileName, lineNumber: 111}, this)
                , _jsxDEV('p', { className: c.cardMeta, children: new Date(d.createdAt).toLocaleString()}, void 0, false, {fileName: _jsxFileName, lineNumber: 112}, this)
              ]}, d._id, true, {fileName: _jsxFileName, lineNumber: 107}, this)
            ))
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 101}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 68}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 63}, this)
  )
}