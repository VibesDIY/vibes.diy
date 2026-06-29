const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Leaderboard({ c, useLiveQuery, activeCode, teamId }) {
  const { docs: teams } = useLiveQuery("gameCode", { key: activeCode })
  const ranked = teams.filter(t => t.type === "team").sort((a, b) => (b.score || 0) - (a.score || 0))
  return (
    _jsxDEV('section', { id: "leaderboard", className: c.section, children: [
      _jsxDEV('h2', { className: c.h2, children: "Leaderboard"}, void 0, false, {fileName: _jsxFileName, lineNumber: 11}, this)
      , ranked.length === 0 && _jsxDEV('p', { className: "text-sm text-[#c9a96a]/60 italic"  , children: "No teams joined yet."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 12}, this)
      , _jsxDEV('ol', { className: "space-y-2", children: 
        ranked.map((t, i) => (
          _jsxDEV('li', { className: `flex justify-between items-center border-[2px] border-[#0f1614] rounded px-3 py-2 ${t._id === teamId ? "bg-[#e8b948]/20" : "bg-[#1a221f]"}`, children: [
            _jsxDEV('span', { className: "font-bold", children: [i + 1, ". " , t.name]}, void 0, true, {fileName: _jsxFileName, lineNumber: 16}, this)
            , _jsxDEV('span', { className: "font-black text-[#e8b948] text-lg"  , children: t.score || 0}, void 0, false, {fileName: _jsxFileName, lineNumber: 17}, this)
          ]}, t._id, true, {fileName: _jsxFileName, lineNumber: 15}, this)
        ))
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 13}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 10}, this)
  )
}

function JoinPanel({ c, database, useLiveQuery, activeCode, setActiveCode, teamId, setTeamId }) {
  const [codeInput, setCodeInput] = React.useState(() => new URLSearchParams(window.location.search).get("code") || "")
  const [teamName, setTeamName] = React.useState("")
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i) }, [])
  const { docs: games } = useLiveQuery("code", { key: activeCode || "__none__" })
  const game = games.find(g => g.type === "game")
  const { docs: questions } = useLiveQuery("_id", { key: _optionalChain([game, 'optionalAccess', _ => _.currentQuestionId]) || "__none__" })
  const currentQ = questions.find(q => q.type === "question")
  const { docs: myAnswers } = useLiveQuery("teamId", { key: teamId || "__none__" })
  const myAnswer = myAnswers.find(a => a.questionId === _optionalChain([currentQ, 'optionalAccess', _2 => _2._id]))
  const remaining = _optionalChain([game, 'optionalAccess', _3 => _3.revealAt]) ? Math.max(0, Math.ceil((game.revealAt + 20000 - now) / 1000)) : 0
  const locked = remaining === 0 || !!myAnswer || _optionalChain([game, 'optionalAccess', _4 => _4.showAnswer])

  async function joinGame() {
    if (codeInput.length !== 4 || !teamName.trim()) return
    const { docs } = await database.query("code", { key: codeInput.toUpperCase() })
    if (!docs.find(d => d.type === "game")) { alert("Game not found"); return }
    const res = await database.put({ type: "team", gameCode: codeInput.toUpperCase(), name: teamName, score: 0, createdAt: Date.now() })
    setActiveCode(codeInput.toUpperCase())
    setTeamId(res.id)
  }

  async function pickOption(idx) {
    if (locked || !currentQ || !teamId) return
    await database.put({ type: "answer", gameCode: activeCode, teamId, questionId: currentQ._id, optionIndex: idx, at: Date.now() })
  }

  return (
    _jsxDEV('section', { id: "join-panel", className: c.section, children: [
      _jsxDEV('h2', { className: c.h2, children: teamId ? "Playing" : "Join Game"}, void 0, false, {fileName: _jsxFileName, lineNumber: 55}, this)
      , !teamId && (
        _jsxDEV('div', { className: "space-y-3", children: [
          _jsxDEV('input', { className: c.input, placeholder: "4-LETTER CODE" , maxLength: 4, value: codeInput, onChange: e => setCodeInput(e.target.value.toUpperCase()),}, void 0, false, {fileName: _jsxFileName, lineNumber: 58}, this )
          , _jsxDEV('input', { className: c.input, placeholder: "Team name" , value: teamName, onChange: e => setTeamName(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 59}, this )
          , _jsxDEV('button', { className: c.btn, onClick: joinGame, children: "Join"}, void 0, false, {fileName: _jsxFileName, lineNumber: 60}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 57}, this)
      )
      , teamId && !currentQ && _jsxDEV('p', { className: "text-center text-[#c9a96a] italic py-6"   , children: "Waiting for host to start…"    }, void 0, false, {fileName: _jsxFileName, lineNumber: 63}, this)
      , teamId && currentQ && (
        _jsxDEV('div', { className: "space-y-3", children: [
          _jsxDEV('div', { className: "flex justify-between items-baseline"  , children: [
            _jsxDEV('span', { className: "text-base uppercase tracking-wider text-[#c9a96a]"   , children: "Question"}, void 0, false, {fileName: _jsxFileName, lineNumber: 67}, this)
            , _jsxDEV('span', { className: `text-2xl font-black ${remaining <= 5 ? "text-[#a83232]" : "text-[#e8b948]"}`, children: [remaining, "s"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 68}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 66}, this)
          , _jsxDEV('p', { className: "text-lg font-bold text-[#f4e8d0]"  , children: currentQ.prompt}, void 0, false, {fileName: _jsxFileName, lineNumber: 70}, this)
          , _jsxDEV('div', { className: "space-y-2", children: 
            currentQ.options.map((opt, i) => {
              const isMine = _optionalChain([myAnswer, 'optionalAccess', _5 => _5.optionIndex]) === i
              const isCorrect = game.showAnswer && i === currentQ.correctIndex
              const isWrongPick = game.showAnswer && isMine && i !== currentQ.correctIndex
              return (
                _jsxDEV('button', { onClick: () => pickOption(i), disabled: locked,
                  className: `w-full min-h-[52px] text-left px-4 py-3 border-[3px] border-[#0f1614] rounded font-bold uppercase tracking-wide shadow-[3px_3px_0_#0a100e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-70
                    ${isCorrect ? "bg-[#5a8a3a] text-[#f4e8d0]" : isWrongPick ? "bg-[#a83232] text-[#f4e8d0]" : isMine ? "bg-[#e8b948] text-[#1a221f]" : "bg-[#1a221f] text-[#f4e8d0]"}`, children: [
                  String.fromCharCode(65 + i), ". " , opt
                ]}, i, true, {fileName: _jsxFileName, lineNumber: 77}, this)
              )
            })
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 71}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 65}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 54}, this)
  )
}

function HostPanel({ c, database, useLiveQuery, activeCode, setActiveCode }) {
  const [gameName, setGameName] = React.useState("")
  const [topic, setTopic] = React.useState("")
  const [genLoading, setGenLoading] = React.useState(false)
  const { docs: games } = useLiveQuery("type", { key: "game" })
  const game = games.find(g => g.code === activeCode)
  const { docs: questions } = useLiveQuery("gameCode", { key: activeCode || "__none__" })
  const sortedQs = [...questions].filter(q => q.type === "question").sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentIdx = game ? sortedQs.findIndex(q => q._id === game.currentQuestionId) : -1
  const currentQ = sortedQs[currentIdx]

  async function createGame() {
    if (!gameName.trim()) return
    const code = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("")
    await database.put({ type: "game", code, name: gameName, status: "lobby", currentQuestionId: null, revealAt: null, showAnswer: false, createdAt: Date.now() })
    setActiveCode(code)
    setGameName("")
  }

  async function generateQuestions() {
    if (!topic.trim() || !activeCode) return
    setGenLoading(true)
    try {
      const res = await callAI(`Generate 10 trivia questions about: ${topic}. Each has a prompt, 4 options, and one correctIndex (0-3).`, {
        schema: { properties: { questions: { type: "array", items: { type: "object", properties: { prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctIndex: { type: "number" } } } } } }
      })
      const data = JSON.parse(res)
      const baseOrder = sortedQs.length
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i]
        await database.put({ type: "question", gameCode: activeCode, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, order: baseOrder + i })
      }
      setTopic("")
    } finally { setGenLoading(false) }
  }

  async function nextQuestion() {
    if (!game) return
    const next = sortedQs[currentIdx + 1] || sortedQs[0]
    if (!next) return
    await database.put({ ...game, currentQuestionId: next._id, revealAt: Date.now(), showAnswer: false, status: "playing" })
  }

  async function showAnswer() {
    if (!game || !currentQ) return
    await database.put({ ...game, showAnswer: true })
    const { docs: answers } = await database.query("questionId", { key: currentQ._id })
    const { docs: teams } = await database.query("type", { key: "team" })
    for (const ans of answers.filter(a => a.type === "answer" && a.gameCode === activeCode)) {
      if (ans.optionIndex === currentQ.correctIndex) {
        const team = teams.find(t => t._id === ans.teamId)
        if (team && !ans.scored) {
          await database.put({ ...team, score: (team.score || 0) + 10 })
          await database.put({ ...ans, scored: true })
        }
      }
    }
  }

  return (
    _jsxDEV('section', { id: "host-panel", className: c.section, children: [
      _jsxDEV('h2', { className: c.h2, children: "Host Control" }, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
      , !activeCode && (
        _jsxDEV('div', { className: "space-y-3", children: [
          _jsxDEV('input', { className: c.input, placeholder: "Game name" , value: gameName, onChange: e => setGameName(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this )
          , _jsxDEV('button', { className: c.btn, onClick: createGame, children: "Create Game" }, void 0, false, {fileName: _jsxFileName, lineNumber: 156}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 154}, this)
      )
      , activeCode && game && (
        _jsxDEV('div', { className: "space-y-3", children: [
          _jsxDEV('div', { className: "bg-[#1a221f] border-[3px] border-dashed border-[#c9a96a]/40 rounded p-4 text-center"      , children: [
            _jsxDEV('p', { className: "text-sm uppercase tracking-[0.2em] text-[#c9a96a]"   , children: [game.name, " · Join code"   ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 162}, this)
            , _jsxDEV('p', { className: "text-5xl font-black tracking-[0.3em] text-[#e8b948] my-2 [text-shadow:_2px_2px_0_#0a100e]"     , children: activeCode}, void 0, false, {fileName: _jsxFileName, lineNumber: 163}, this)
            , _jsxDEV('img', { alt: "QR", className: "w-32 h-32 mx-auto bg-[#f4e8d0] p-1 rounded"     , src: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + "?code=" + activeCode)}`,}, void 0, false, {fileName: _jsxFileName, lineNumber: 164}, this )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 161}, this)
          , _jsxDEV('div', { className: "border-t-2 border-dashed border-[#c9a96a]/40 pt-3 space-y-2"    , children: [
            _jsxDEV('h3', { className: "text-base uppercase tracking-wider text-[#c9a96a]"   , children: ["Deck (" , sortedQs.length, ")"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 167}, this)
            , _jsxDEV('input', { className: c.input, placeholder: "Topic (e.g. 90s movies)"   , value: topic, onChange: e => setTopic(e.target.value),}, void 0, false, {fileName: _jsxFileName, lineNumber: 168}, this )
            , _jsxDEV('button', { className: c.btnAmber, onClick: generateQuestions, disabled: genLoading, children: 
              genLoading ? _jsxDEV('svg', { className: "animate-spin inline w-4 h-4"   , viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "3", children: _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 170}, this )}, void 0, false, {fileName: _jsxFileName, lineNumber: 170}, this) : "✨ Generate 10 Questions"
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 169}, this)
            , sortedQs.length === 0 && _jsxDEV('p', { className: "text-sm text-[#c9a96a]/60 italic"  , children: "No questions yet."  }, void 0, false, {fileName: _jsxFileName, lineNumber: 172}, this)
            , currentQ && _jsxDEV('p', { className: "text-sm text-[#c9a96a]" , children: ["On Q" , currentIdx + 1, ": " , currentQ.prompt]}, void 0, true, {fileName: _jsxFileName, lineNumber: 173}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 166}, this)
          , _jsxDEV('div', { className: "grid grid-cols-2 gap-2 pt-2"   , children: [
            _jsxDEV('button', { className: c.btn, onClick: nextQuestion, disabled: !sortedQs.length, children: "Next Question" }, void 0, false, {fileName: _jsxFileName, lineNumber: 176}, this)
            , _jsxDEV('button', { className: c.btnAmber, onClick: showAnswer, disabled: !currentQ || game.showAnswer, children: "Show Answer" }, void 0, false, {fileName: _jsxFileName, lineNumber: 177}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 175}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 160}, this)
      )
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
  )
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("pub-quiz-live")
  const { viewer, isViewerPending, ViewerTag } = useViewer()
  const [mode, setMode] = React.useState(null)
  const [activeCode, setActiveCode] = React.useState(null)
  const [teamId, setTeamId] = React.useState(null)
  const c = {
    page: "min-h-screen text-[#f4e8d0] font-sans pb-24",
    pageBg: {
      backgroundImage: `linear-gradient(rgba(30,42,38,0.88), rgba(26,34,31,0.92)), url('https://images.unsplash.com/photo-1583106223774-3313c55721ed?w=1920&q=80&fit=crop')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    },
    header: "px-5 pt-6 pb-4 border-b-[3px] border-[#0f1614] bg-[#161f1c] shadow-[0_4px_0_#0a100e]",
    title: "text-3xl font-black uppercase tracking-tight text-[#f4e8d0] [text-shadow:_2px_2px_0_#a83232]",
    tagline: "text-sm uppercase tracking-[0.2em] text-[#c9a96a] mt-1",
    main: "px-5 py-5 max-w-2xl mx-auto space-y-5",
    section: "bg-[#243430] border-[3px] border-[#0f1614] rounded p-5 shadow-[4px_4px_0_#0a100e]",
    h2: "text-[1.4rem] font-black uppercase tracking-wide text-[#e8b948] mb-3 border-b-2 border-dashed border-[#c9a96a]/40 pb-2",
    btn: "min-h-[52px] px-5 py-3 bg-[#a83232] text-[#f4e8d0] font-black uppercase tracking-wider border-[3px] border-[#0f1614] rounded shadow-[3px_3px_0_#0a100e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnAmber: "min-h-[52px] px-5 py-3 bg-[#e8b948] text-[#1a221f] font-black uppercase tracking-wider border-[3px] border-[#0f1614] rounded shadow-[3px_3px_0_#0a100e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    btnGhost: "min-h-[44px] px-4 py-2 bg-transparent text-[#c9a96a] font-bold uppercase tracking-wide border-[2px] border-[#c9a96a]/50 rounded active:bg-[#c9a96a]/10",
    input: "w-full min-h-[48px] px-3 py-2 bg-[#1a221f] text-[#f4e8d0] placeholder-[#c9a96a]/40 border-[3px] border-[#0f1614] rounded font-mono uppercase tracking-wider focus:border-[#e8b948] outline-none",
  }
  return (
    _jsxDEV('div', { className: c.page, style: c.pageBg, children: [
      _jsxDEV('div', { style: {
        position: 'relative',
        width: '100%', minHeight: '60vh',
        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(30,42,38,0.75)), url('https://images.unsplash.com/photo-1583106223774-3313c55721ed?w=1920&q=80&fit=crop')`,
        backgroundSize: 'cover', backgroundPosition: 'center 40%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '2rem 1.5rem',
        borderBottom: '3px solid #0f1614',
      }, children: [
        _jsxDEV('p', { style: {
          fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: '#c9a96a', marginBottom: '0.75rem',
        }, children: "Pub Quiz Live"  }, void 0, false, {fileName: _jsxFileName, lineNumber: 206}, this)
        , _jsxDEV('h1', { style: {
          fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 900, lineHeight: 1.05,
          color: '#e8b948', textShadow: '0 2px 20px rgba(0,0,0,0.5), 2px 2px 0 #a83232, 0 0 40px rgba(232,185,72,0.3)',
          margin: '0 0 1rem', textTransform: 'uppercase',
        }, children: "Your bar. Your rules. Your trivia."       }, void 0, false, {fileName: _jsxFileName, lineNumber: 210}, this)
        , _jsxDEV('p', { style: {
          fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', color: '#f4e8d0', opacity: 0.85,
          maxWidth: '520px', lineHeight: 1.5, marginBottom: '2rem',
        }, children: "The host taps one button — every phone in the room flips to the question."           }, void 0, false, {fileName: _jsxFileName, lineNumber: 215}, this)
        , (!isViewerPending && !viewer) && (
          _jsxDEV('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', margin: '0 0 1.75rem' }, children: [
            _jsxDEV(ViewerTag, { style: { background: '#e8b948', border: 'none', color: '#0f1614', borderRadius: '0.5rem', padding: '0.95rem 2.4rem', fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', boxShadow: '0 6px 22px rgba(0,0,0,0.5)' } }, void 0, false, {fileName: _jsxFileName}, this)
            , _jsxDEV('p', { style: { fontSize: '0.85rem', color: '#f4e8d0', opacity: 0.8, margin: 0 }, children: "Sign in to host or join trivia night." }, void 0, false, {fileName: _jsxFileName}, this)
          ]}, void 0, true, {fileName: _jsxFileName}, this)
        )
        , !mode && _jsxDEV('div', { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }, children: [
          _jsxDEV('button', { onClick: () => setMode("host"), style: {
            padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 800,
            background: '#a83232', color: '#f4e8d0', borderRadius: '8px', border: '3px solid #0f1614',
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            boxShadow: '4px 4px 0 #0a100e',
          }, children: "Host"}, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this)
          , _jsxDEV('button', { onClick: () => setMode("join"), style: {
            padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 800,
            background: '#e8b948', color: '#1a221f', borderRadius: '8px', border: '3px solid #0f1614',
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            boxShadow: '4px 4px 0 #0a100e',
          }, children: "Join"}, void 0, false, {fileName: _jsxFileName, lineNumber: 227}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 220}, this)
        , _jsxDEV('div', { style: {
          position: 'absolute', bottom: '0.75rem', right: '1rem',
          fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }, children: [
          "Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@dnlv_a?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Andrew Danilov"}, void 0, false, {fileName: _jsxFileName}, this),
          " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Unsplash"}, void 0, false, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 205}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        false && (
          _jsxDEV('section', { id: "landing", className: c.section, children: [
            _jsxDEV('h2', { className: c.h2, children: "Trivia Night" }, void 0, false, {fileName: _jsxFileName, lineNumber: 212}, this)
            , _jsxDEV('p', { className: "text-base text-[#c9a96a] mb-4"  , children: "Pick a side of the chalkboard."     }, void 0, false, {fileName: _jsxFileName, lineNumber: 213}, this)
            , _jsxDEV('div', { className: "grid grid-cols-2 gap-3"  , children: [
              _jsxDEV('button', { className: c.btn, onClick: () => setMode("host"), children: "Host"}, void 0, false, {fileName: _jsxFileName, lineNumber: 215}, this)
              , _jsxDEV('button', { className: c.btnAmber, onClick: () => setMode("join"), children: "Join"}, void 0, false, {fileName: _jsxFileName, lineNumber: 216}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 214}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 211}, this)
        )
        , mode && (
          _jsxDEV('button', { className: c.btnGhost, onClick: () => { setMode(null); setActiveCode(null); setTeamId(null) }, children: "← Back" }, void 0, false, {fileName: _jsxFileName, lineNumber: 221}, this)
        )
        , mode === "host" && _jsxDEV(HostPanel, { c: c, database: database, useLiveQuery: useLiveQuery, activeCode: activeCode, setActiveCode: setActiveCode,}, void 0, false, {fileName: _jsxFileName, lineNumber: 223}, this )
        , mode === "join" && _jsxDEV(JoinPanel, { c: c, database: database, useLiveQuery: useLiveQuery, activeCode: activeCode, setActiveCode: setActiveCode, teamId: teamId, setTeamId: setTeamId,}, void 0, false, {fileName: _jsxFileName, lineNumber: 224}, this )
        , mode && activeCode && _jsxDEV(Leaderboard, { c: c, useLiveQuery: useLiveQuery, activeCode: activeCode, teamId: teamId,}, void 0, false, {fileName: _jsxFileName, lineNumber: 225}, this )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 209}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 204}, this)
  )
}