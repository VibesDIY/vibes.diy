import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

const SCENES = {
  shoegaze: { bg: 'bg-[#2a2438]', ink: 'text-[#e8e1f0]', accent: 'bg-[#9d8ec4]', accentInk: 'text-[#1a1525]', muted: 'text-[#9d8ec4]', card: 'bg-[#3a3149]', border: 'border-[#5a4d6e]', font: 'font-serif italic', label: 'dreamy' },
  jazz:     { bg: 'bg-[#1f1810]', ink: 'text-[#f5e6c8]', accent: 'bg-[#d4a04a]', accentInk: 'text-[#1f1810]', muted: 'text-[#a88a5a]', card: 'bg-[#2a2218]', border: 'border-[#4a3a24]', font: 'font-serif', label: 'late-night' },
  metal:    { bg: 'bg-[#0a0a0a]', ink: 'text-[#f0f0f0]', accent: 'bg-[#c41e1e]', accentInk: 'text-white',   muted: 'text-[#8a3a3a]', card: 'bg-[#1a0a0a]', border: 'border-[#3a1010]', font: 'font-sans font-black uppercase tracking-tight', label: 'brutal' },
  hiphop:   { bg: 'bg-[#0f0f12]', ink: 'text-[#fafafa]', accent: 'bg-[#ffd400]', accentInk: 'text-black',   muted: 'text-[#888]', card: 'bg-[#1a1a1f]', border: 'border-[#2a2a35]', font: 'font-sans font-extrabold', label: 'live' },
  ambient:  { bg: 'bg-[#0a1a24]', ink: 'text-[#c8e0ea]', accent: 'bg-[#3d8ea8]', accentInk: 'text-[#0a1a24]', muted: 'text-[#5a8a9a]', card: 'bg-[#102530]', border: 'border-[#1f4050]', font: 'font-light tracking-wide', label: 'drifting' },
  electronic:{bg: 'bg-[#0a0820]', ink: 'text-[#e0d8ff]', accent: 'bg-[#b8f000]', accentInk: 'text-black',   muted: 'text-[#7a6ab0]', card: 'bg-[#15103a]', border: 'border-[#2a2060]', font: 'font-mono', label: 'pulse' },
  postpunk: { bg: 'bg-[#1a1a1a]', ink: 'text-[#e0e0e0]', accent: 'bg-[#ff5722]', accentInk: 'text-white',   muted: 'text-[#888]', card: 'bg-[#252525]', border: 'border-[#3a3a3a]', font: 'font-mono uppercase', label: 'sharp' },
  country:  { bg: 'bg-[#2a1f15]', ink: 'text-[#f0e0c8]', accent: 'bg-[#c87a3a]', accentInk: 'text-[#2a1f15]', muted: 'text-[#9a7a5a]', card: 'bg-[#352818]', border: 'border-[#5a4028]', font: 'font-serif', label: 'open road' },
  rnb:      { bg: 'bg-[#1a0f1f]', ink: 'text-[#f0d8e8]', accent: 'bg-[#d4458a]', accentInk: 'text-white',   muted: 'text-[#a06088]', card: 'bg-[#251530]', border: 'border-[#4a2548]', font: 'font-serif', label: 'smooth' },
  classical:{ bg: 'bg-[#f5f1e8]', ink: 'text-[#1a1a1a]', accent: 'bg-[#1a1a1a]', accentInk: 'text-[#f5f1e8]', muted: 'text-[#666]', card: 'bg-white',     border: 'border-[#d0c8b0]', font: 'font-serif', label: 'composed' },
}

const SCENE_LIST = [
  ['shoegaze', 'Shoegaze'], ['jazz', 'Jazz'], ['metal', 'Metal'], ['hiphop', 'Hip-Hop'],
  ['ambient', 'Ambient'], ['postpunk', 'Post-Punk'], ['electronic', 'Electronic'],
  ['country', 'Country'], ['rnb', 'R&B'], ['classical', 'Classical']
]

function genCode() {
  const words = ['VIBE','DROP','JAZZ','WAVE','LOUD','HUSH','GLOW','RUSH','DUSK','NEON','MOON','FUZZ']
  return words[Math.floor(Math.random()*words.length)]
}

export default function App() {
  const [scene, setScene] = React.useState(() => localStorage.getItem('the-drop-scene'))
  const [screen, setScreen] = React.useState('home')
  const [sessionCode, setSessionCode] = React.useState(null)
  const [myName, setMyName] = React.useState('')
  const [isHost, setIsHost] = React.useState(false)
  const { database, useLiveQuery, useDocument } = useFireproof('the-drop')

  const hostForm = useDocument({ type: 'session-draft', album: '', artist: '', notes: '', hostName: '', dropOffsetMin: 10 })

  async function createSession() {
    const code = genCode() + Math.floor(Math.random()*99)
    const dropTime = Date.now() + hostForm.doc.dropOffsetMin * 60000
    await database.put({
      type: 'session', code,
      album: hostForm.doc.album, artist: hostForm.doc.artist,
      notes: hostForm.doc.notes, hostName: hostForm.doc.hostName || 'Host',
      dropTime, status: 'waiting', createdAt: Date.now()
    })
    await database.put({ type: 'member', sessionCode: code, name: hostForm.doc.hostName || 'Host', joinedAt: Date.now() })
    setMyName(hostForm.doc.hostName || 'Host')
    setSessionCode(code)
    setIsHost(true)
    setScreen('lobby')
  }

  const c = scene ? SCENES[scene] : SCENES.shoegaze
  const cls = {
    page: `min-h-screen ${c.bg} ${c.ink} ${c.font}`,
    header: `px-5 py-4 border-b ${c.border} flex items-center justify-between sticky top-0 ${c.bg} z-10`,
    title: 'text-2xl font-black tracking-tight',
    sceneTag: `text-xs uppercase tracking-[0.2em] ${c.muted}`,
    main: 'px-5 py-6 max-w-2xl mx-auto pb-24',
    section: `mb-6 ${c.card} border ${c.border} rounded-lg p-5`,
    h2: 'text-lg font-bold mb-3 uppercase tracking-wide',
    btn: `${c.accent} ${c.accentInk} font-bold uppercase tracking-wide px-6 py-4 rounded-md min-h-[52px] w-full text-center`,
    btnGhost: `border ${c.border} ${c.ink} font-bold uppercase tracking-wide px-6 py-4 rounded-md min-h-[52px] w-full text-center`,
    input: `w-full bg-transparent border ${c.border} rounded-md px-4 py-3 ${c.ink} min-h-[48px] outline-none focus:border-current`,
    code: `font-mono text-5xl font-black tracking-[0.3em] text-center py-6`,
    muted: c.muted,
  }

  if (!scene) {
    return <SceneSelector onPick={(s) => { localStorage.setItem('the-drop-scene', s); setScene(s) }} />
  }

  return (
    <div className={cls.page}>
      <header id="app-header" className={cls.header}>
        <div>
          <h1 className={cls.title}>THE DROP</h1>
          <p className={cls.sceneTag}>scene: {c.label}</p>
        </div>
        <button onClick={() => { localStorage.removeItem('the-drop-scene'); setScene(null) }} className={`text-xs ${c.muted} underline`}>switch scene</button>
      </header>
      <main id="app" className={cls.main}>
        {screen === 'home' && (
        <section id="home" className={cls.section}>
          <h2 className={cls.h2}>Tonight's session</h2>
          <p className={`${cls.muted} mb-6 text-sm`}>Drop an album. Listen together. React in real time.</p>
          <div className="space-y-3">
            <button onClick={() => setScreen('host-setup')} className={cls.btn}>Host a Drop</button>
            <button onClick={() => setScreen('join-entry')} className={cls.btnGhost}>Join a Drop</button>
          </div>
        </section>
        )}
        {screen === 'host-setup' && (
        <section id="host-setup" className={cls.section}>
          <h2 className={cls.h2}>Set up the drop</h2>
          <div className="space-y-3">
            <input className={cls.input} placeholder="Album name" value={hostForm.doc.album} onChange={e => hostForm.merge({ album: e.target.value })} />
            <input className={cls.input} placeholder="Artist" value={hostForm.doc.artist} onChange={e => hostForm.merge({ artist: e.target.value })} />
            <textarea className={cls.input} placeholder="Notes — why this album?" rows={3} value={hostForm.doc.notes} onChange={e => hostForm.merge({ notes: e.target.value })} />
            <input className={cls.input} placeholder="Your name" value={hostForm.doc.hostName} onChange={e => hostForm.merge({ hostName: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              {[10,30,60].map(m => (
                <button key={m} onClick={() => hostForm.merge({ dropOffsetMin: m })} className={hostForm.doc.dropOffsetMin === m ? cls.btn : cls.btnGhost}>+{m<60?m+'m':'1hr'}</button>
              ))}
            </div>
            <button onClick={createSession} disabled={!hostForm.doc.album} className={cls.btn} style={{opacity: hostForm.doc.album ? 1 : 0.5}}>Create Drop</button>
            <button onClick={() => setScreen('home')} className={`text-sm ${c.muted} underline w-full text-center pt-2`}>back</button>
          </div>
        </section>
        )}
        {screen === 'join-entry' && (
        <section id="join-entry" className={cls.section}>
          <h2 className={cls.h2}>Join the drop</h2>
          <JoinForm cls={cls} c={c} database={database} onJoin={(code, name) => { setSessionCode(code); setMyName(name); setIsHost(false); setScreen('lobby') }} onBack={() => setScreen('home')} />
        </section>
        )}
        {screen === 'lobby' && sessionCode && (
        <Lobby cls={cls} c={c} database={database} useLiveQuery={useLiveQuery} sessionCode={sessionCode} isHost={isHost} onDrop={() => setScreen('live-feed')} onLeave={() => { setSessionCode(null); setScreen('home') }} />
        )}
        {screen === 'live-feed' && sessionCode && (
        <LiveFeed cls={cls} c={c} scene={scene} database={database} useLiveQuery={useLiveQuery} sessionCode={sessionCode} myName={myName} isHost={isHost} onEnd={() => { setSessionCode(null); setScreen('home') }} />
        )}
      </main>
    </div>
  )
}

const PLACEHOLDERS = {
  shoegaze: ['the reverb just opened up', 'lost in the wash', 'pure haze'],
  jazz: ['hear that chord substitution', 'late night energy', 'the bass walks'],
  metal: ['that riff destroyed me', 'breakdown incoming', 'no survivors'],
  hiphop: ['that sample flip', 'bars', 'pocket deep'],
  ambient: ['just breathing with this', 'texture shift at 4:20', 'space and time'],
  postpunk: ['angular', 'that bassline drives', 'sharp edges'],
  electronic: ['drop incoming', 'this pattern hits', 'pure pulse'],
  country: ['feel that pedal steel', 'open road', 'whiskey in the chord'],
  rnb: ['that vocal run', 'pure silk', 'pocket groove'],
  classical: ['the strings swell', 'movement shift', 'pure form'],
}

const EMOJIS = ['🔥','💀','✨','💫','⚡','🌊','💎','🎯']

function LiveFeed({ cls, c, scene, database, useLiveQuery, sessionCode, myName, isHost, onEnd }) {
  const sessionQ = useLiveQuery('code', { key: sessionCode })
  const session = sessionQ.docs.find(d => d.type === 'session')
  const reactionsQ = useLiveQuery('sessionCode', { key: sessionCode })
  const reactions = reactionsQ.docs.filter(d => d.type === 'reaction').sort((a,b) => b.createdAt - a.createdAt)

  const [text, setText] = React.useState('')
  const [floaters, setFloaters] = React.useState([])
  const placeholders = PLACEHOLDERS[scene] || PLACEHOLDERS.shoegaze
  const placeholder = placeholders[Math.floor(Date.now() / 5000) % placeholders.length]

  async function postText() {
    if (!text.trim()) return
    await database.put({ type: 'reaction', sessionCode, name: myName, content: text.slice(0,50), reactionType: 'text', createdAt: Date.now() })
    setText('')
  }

  async function postEmoji(emoji) {
    const id = Math.random().toString(36).slice(2)
    setFloaters(f => [...f, { id, emoji, x: 20 + Math.random()*60 }])
    setTimeout(() => setFloaters(f => f.filter(x => x.id !== id)), 3000)
    await database.put({ type: 'reaction', sessionCode, name: myName, content: emoji, reactionType: 'emoji', createdAt: Date.now() })
  }

  async function endSession() {
    if (session) await database.put({ ...session, status: 'ended' })
    onEnd()
  }

  if (session?.status === 'ended') {
    const emojiCounts = {}
    reactions.filter(r => r.reactionType === 'emoji').forEach(r => emojiCounts[r.content] = (emojiCounts[r.content]||0) + 1)
    const topEmojis = Object.entries(emojiCounts).sort((a,b) => b[1]-a[1]).slice(0,5)
    return (
      <div className="space-y-4">
        <p className={`text-xs uppercase tracking-[0.3em] ${c.muted}`}>that's a wrap</p>
        <h2 className="text-4xl font-black">{session.album}</h2>
        <p className={c.muted}>{session.artist}</p>
        <div className={`border-t ${c.border} pt-4 grid grid-cols-2 gap-4`}>
          <div><p className={`text-xs ${c.muted} uppercase`}>reactions</p><p className="text-3xl font-black">{reactions.length}</p></div>
          <div><p className={`text-xs ${c.muted} uppercase`}>top vibes</p><p className="text-2xl">{topEmojis.map(([e]) => e).join(' ')}</p></div>
        </div>
        <div className={`border-t ${c.border} pt-4 max-h-64 overflow-y-auto space-y-2`}>
          {reactions.filter(r => r.reactionType === 'text').map(r => (
            <div key={r._id} className="text-sm"><span className={`${c.muted} text-xs uppercase mr-2`}>{r.name}</span>{r.content}</div>
          ))}
        </div>
        <button onClick={onEnd} className={cls.btn}>Host Another</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="fixed inset-x-0 bottom-0 top-0 pointer-events-none z-20 overflow-hidden">
        {floaters.map(f => (
          <div key={f.id} className="absolute bottom-0 text-5xl float-up" style={{ left: `${f.x}%`, animation: 'floatUp 3s ease-out forwards' }}>{f.emoji}</div>
        ))}
      </div>
      <style>{`@keyframes floatUp { 0% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(-90vh); opacity: 0 } }`}</style>

      <div className="mb-3">
        <p className={`text-xs uppercase tracking-[0.2em] ${c.muted}`}>now playing</p>
        <h3 className="text-xl font-black">{session?.album}</h3>
        <p className={`${c.muted} text-sm`}>{session?.artist}</p>
      </div>

      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => postEmoji(e)} className={`text-3xl ${c.card} border ${c.border} rounded-md min-w-[56px] h-14 flex items-center justify-center active:scale-95 transition-transform`}>{e}</button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input className={cls.input} placeholder={placeholder} maxLength={50} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && postText()} />
        <button onClick={postText} className={`${c.accent} ${c.accentInk} font-bold px-4 rounded-md`}>send</button>
      </div>

      <div className={`border-t ${c.border} pt-3 space-y-2 max-h-96 overflow-y-auto`}>
        {reactions.length === 0 && <p className={`${c.muted} text-sm text-center py-4`}>first reaction lands here</p>}
        {reactions.map(r => (
          <div key={r._id} className={`${c.card} border ${c.border} rounded-md px-3 py-2 text-sm`}>
            <span className={`${c.muted} text-xs uppercase tracking-wide mr-2`}>{r.name}</span>
            <span className={r.reactionType === 'emoji' ? 'text-2xl' : ''}>{r.content}</span>
          </div>
        ))}
      </div>

      {isHost && <button onClick={endSession} className={`mt-4 ${cls.btnGhost}`}>End Session</button>}
    </div>
  )
}

function Lobby({ cls, c, database, useLiveQuery, sessionCode, isHost, onDrop, onLeave }) {
  const sessionQ = useLiveQuery('code', { key: sessionCode })
  const session = sessionQ.docs.find(d => d.type === 'session')
  const membersQ = useLiveQuery('sessionCode', { key: sessionCode })
  const members = membersQ.docs.filter(d => d.type === 'member')

  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  if (!session) return <div className="text-center py-8"><p className={c.muted}>Loading session...</p></div>

  const remaining = Math.max(0, session.dropTime - now)
  const seconds = Math.floor(remaining / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  React.useEffect(() => {
    if (session.status === 'live' || remaining <= 0) {
      if (session.status !== 'live' && isHost) {
        database.put({ ...session, status: 'live' })
      }
      onDrop()
    }
  }, [remaining, session.status])

  async function startEarly() {
    await database.put({ ...session, dropTime: Date.now(), status: 'live' })
  }

  const isFullscreen = seconds < 60 && seconds > 0
  const isPulse = seconds <= 10 && seconds > 0

  if (isFullscreen) {
    return (
      <div className={`fixed inset-0 ${c.bg} flex flex-col items-center justify-center z-50 ${isPulse ? 'animate-pulse' : ''}`}>
        <p className={`${c.muted} uppercase tracking-[0.3em] text-sm mb-4`}>dropping in</p>
        <div className={`text-[12rem] leading-none font-black ${c.ink}`}>{seconds}</div>
        <p className={`${cls.muted} mt-6`}>{session.album} — {session.artist}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className={`text-xs uppercase tracking-[0.2em] ${c.muted} mb-1`}>session code</p>
        <div className={cls.code}>{sessionCode}</div>
      </div>
      <div className={`border-t ${c.border} pt-4`}>
        <h3 className="text-2xl font-black">{session.album || 'Untitled'}</h3>
        <p className={c.muted}>{session.artist}</p>
        {session.notes && <p className="mt-3 text-sm italic">"{session.notes}"</p>}
        <p className={`text-xs ${c.muted} mt-2`}>hosted by {session.hostName}</p>
      </div>
      <div className={`border-t ${c.border} pt-4 text-center`}>
        <p className={`text-xs uppercase tracking-[0.2em] ${c.muted}`}>drops in</p>
        <p className="text-5xl font-black font-mono">{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</p>
      </div>
      <div className={`border-t ${c.border} pt-4`}>
        <p className={`text-xs uppercase tracking-[0.2em] ${c.muted} mb-2`}>roster ({members.length})</p>
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <span key={m._id} className={`${c.card} border ${c.border} px-3 py-1 rounded-full text-sm`}>{m.name}</span>
          ))}
        </div>
      </div>
      {isHost && <button onClick={startEarly} className={cls.btn}>Start Early</button>}
      <button onClick={onLeave} className={`text-sm ${c.muted} underline w-full text-center pt-2`}>leave</button>
    </div>
  )
}

function JoinForm({ cls, c, database, onJoin, onBack }) {
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [err, setErr] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function join() {
    setLoading(true); setErr('')
    try {
      const result = await database.query('code', { key: code.toUpperCase() })
      const session = result.rows.find(r => r.doc?.type === 'session')
      if (!session) { setErr('No drop with that code.'); return }
      await database.put({ type: 'member', sessionCode: code.toUpperCase(), name: name || 'Anon', joinedAt: Date.now() })
      onJoin(code.toUpperCase(), name || 'Anon')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <input className={`${cls.input} font-mono text-2xl uppercase tracking-[0.3em] text-center`} placeholder="CODE" maxLength={8} value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
      <input className={cls.input} placeholder="Your nickname" value={name} onChange={e => setName(e.target.value)} />
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <button onClick={join} disabled={!code || loading} className={cls.btn} style={{opacity: code && !loading ? 1 : 0.5}}>
        {loading ? 'Joining...' : 'Join Drop'}
      </button>
      <button onClick={onBack} className={`text-sm ${c.muted} underline w-full text-center pt-2`}>back</button>
    </div>
  )
}

function SceneSelector({ onPick }) {
  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">welcome to</p>
        <h1 className="text-5xl font-black mb-8 tracking-tight">THE DROP</h1>
        <p className="text-xl mb-8">What's your scene?</p>
        <div className="grid grid-cols-2 gap-3">
          {SCENE_LIST.map(([k, label]) => (
            <button key={k} onClick={() => onPick(k)} className="border border-zinc-700 hover:border-white px-4 py-5 rounded-md text-left min-h-[64px] font-bold uppercase tracking-wide transition-colors">
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}