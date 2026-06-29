import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

function HistoryList({ useLiveQuery, c, TRACKS }) {
  const { docs } = useLiveQuery("type", { key: "run", descending: true, limit: 50 })
  const bestBy = {}
  docs.forEach((d) => {
    if (!bestBy[d.trackId] || d.accuracy > bestBy[d.trackId].accuracy) bestBy[d.trackId] = d
  })
  if (docs.length === 0) return <div className="text-sm text-[#666] uppercase tracking-widest">No runs yet — play one!</div>
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[0.6rem] uppercase tracking-widest text-[#666] mb-2">Best Per Track</div>
        {TRACKS.map((t) => (
          <div key={t.id} className={c.row}>
            <span className="font-bold uppercase text-sm">{t.name}</span>
            <span className="font-['JetBrains_Mono',monospace] text-sm">
              {bestBy[t.id] ? `${bestBy[t.id].accuracy}% · ${bestBy[t.id].rank}` : "—"}
            </span>
          </div>
        ))}
      </div>
      <div>
        <div className="text-[0.6rem] uppercase tracking-widest text-[#666] mb-2">Recent Runs</div>
        {docs.slice(0, 10).map((d) => (
          <div key={d._id} className={c.row}>
            <div className={c.rank} style={{ background: d.rank === "S" ? "#f4c542" : d.rank === "A" ? "#4ade80" : "#fff" }}>{d.rank}</div>
            <span className="flex-1 px-3 text-sm uppercase">{d.trackName}</span>
            <span className="font-['JetBrains_Mono',monospace] text-sm">{d.accuracy}% · x{d.bestCombo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const TRACKS = [
    { id: "slow", name: "Slow Pulse", bpm: 80, beats: 16, color: "#f4c542" },
    { id: "mid", name: "Mid Drive", bpm: 110, beats: 20, color: "#e63946" },
    { id: "fast", name: "Fast Rush", bpm: 140, beats: 24, color: "#4ade80" },
  ]
  const { useLiveQuery, database } = useFireproof("beat-tap-db")
  const [trackId, setTrackId] = React.useState("slow")
  const [playing, setPlaying] = React.useState(false)
  const [targets, setTargets] = React.useState([])
  const [hits, setHits] = React.useState(0)
  const [misses, setMisses] = React.useState(0)
  const [combo, setCombo] = React.useState(0)
  const [bestCombo, setBestCombo] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const track = TRACKS.find((t) => t.id === trackId)
  const totalTaps = hits + misses
  const accuracy = totalTaps > 0 ? Math.round((hits / totalTaps) * 100) : 0
  const rank = accuracy >= 95 ? "S" : accuracy >= 85 ? "A" : accuracy >= 70 ? "B" : "C"

  function startRun() {
    setPlaying(true); setDone(false); setHits(0); setMisses(0); setCombo(0); setBestCombo(0); setTargets([])
    const spb = 60000 / track.bpm
    for (let i = 0; i < track.beats; i++) {
      setTimeout(() => {
        const id = Math.random().toString(36).slice(2)
        setTargets((t) => [...t, { id, x: 15 + Math.random() * 70, y: 15 + Math.random() * 70, born: Date.now() }])
        setTimeout(() => {
          setTargets((t) => {
            if (t.find((x) => x.id === id)) {
              setMisses((m) => m + 1); setCombo(0)
              return t.filter((x) => x.id !== id)
            }
            return t
          })
        }, 1200)
      }, 1000 + i * spb)
    }
    setTimeout(() => { setPlaying(false); setDone(true) }, 1000 + track.beats * spb + 1300)
  }

  function tapTarget(id, born) {
    const age = Date.now() - born
    const good = age > 600 && age < 1100
    setTargets((t) => t.filter((x) => x.id !== id))
    if (good) {
      setHits((h) => h + 1)
      setCombo((c) => { const n = c + 1; setBestCombo((b) => Math.max(b, n)); return n })
    } else {
      setMisses((m) => m + 1); setCombo(0)
    }
  }

  React.useEffect(() => {
    if (done && totalTaps > 0) {
      database.put({ type: "run", trackId, trackName: track.name, hits, misses, accuracy, rank, bestCombo, createdAt: Date.now() })
    }
  }, [done])

  const c = {
    page: "min-h-screen bg-[#f5f1e8] text-[#0f0f1a] font-['Space_Grotesk',sans-serif]",
    header: "border-b-[3px] border-[#0f0f1a] bg-white px-5 py-4 flex items-center justify-between",
    brand: "text-xl font-bold uppercase tracking-tight",
    logo: "flex gap-1",
    dot: "w-3 h-3 border-[2px] border-[#0f0f1a]",
    main: "max-w-[920px] mx-auto px-5 py-6 space-y-5",
    section: "bg-white border-[3px] border-[#0f0f1a] rounded p-5 shadow-[4px_4px_0_#0f0f1a]",
    h2: "text-sm font-bold uppercase tracking-widest mb-4",
    btn: "bg-[#e63946] text-white border-[3px] border-[#0f0f1a] px-4 py-3 font-bold uppercase tracking-wider text-sm rounded shadow-[3px_3px_0_#0f0f1a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
    btnYellow: "bg-[#f4c542] text-[#0f0f1a] border-[3px] border-[#0f0f1a] px-4 py-3 font-bold uppercase tracking-wider text-sm rounded shadow-[3px_3px_0_#0f0f1a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
    stage: "relative bg-[#0f0f1a] rounded border-[3px] border-[#0f0f1a] aspect-square w-full overflow-hidden",
    stat: "border-[3px] border-[#0f0f1a] rounded p-3 bg-white",
    statNum: "font-['JetBrains_Mono',monospace] text-2xl font-bold",
    statLabel: "text-[0.6rem] uppercase tracking-widest text-[#666]",
    row: "flex items-center justify-between border-b-[2px] border-[#0f0f1a] py-2 last:border-b-0",
    rank: "font-['JetBrains_Mono',monospace] font-bold text-lg w-8 h-8 border-[3px] border-[#0f0f1a] rounded flex items-center justify-center",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-3">
          <div className={c.logo}>
            <div className={`${c.dot} bg-[#e63946]`} />
            <div className={`${c.dot} bg-[#f4c542]`} />
            <div className={`${c.dot} bg-[#4ade80]`} />
          </div>
          <h1 className={c.brand}>Beat Tap</h1>
        </div>
        <span className="text-[0.65rem] uppercase tracking-widest text-[#666]">Rhythm Game</span>
      </header>
      <main id="app" className={c.main}>
        <section id="track-picker" className={c.section}>
          <h2 className={c.h2}>Pick a Track</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                disabled={playing}
                onClick={() => setTrackId(t.id)}
                className={`${trackId === t.id ? c.btn : c.btnYellow} text-left flex flex-col items-start gap-1 ${playing ? "opacity-50" : ""}`}
              >
                <span className="text-base">{t.name}</span>
                <span className="text-[0.65rem] opacity-70">{t.bpm} BPM · {t.beats} beats</span>
              </button>
            ))}
          </div>
        </section>
        <section id="play-stage" className={c.section}>
          <h2 className={c.h2}>Tap on the Beat — {track.name}</h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className={c.stat}><div className={c.statNum}>{hits}</div><div className={c.statLabel}>Hits</div></div>
            <div className={c.stat}><div className={c.statNum}>{misses}</div><div className={c.statLabel}>Miss</div></div>
            <div className={c.stat}><div className={c.statNum}>{combo}</div><div className={c.statLabel}>Combo</div></div>
            <div className={c.stat}><div className={c.statNum}>{totalTaps > 0 ? accuracy : "—"}</div><div className={c.statLabel}>Acc%</div></div>
          </div>
          <div className={c.stage}>
            {targets.map((t) => {
              const age = Date.now() - t.born
              const size = Math.min(80, 20 + age / 15)
              const ringGood = age > 600 && age < 1100
              return (
                <button
                  key={t.id}
                  onClick={() => tapTarget(t.id, t.born)}
                  className="absolute rounded-full border-[3px] transition-none"
                  style={{
                    left: `${t.x}%`, top: `${t.y}%`,
                    width: `${size}px`, height: `${size}px`,
                    transform: "translate(-50%,-50%)",
                    background: track.color,
                    borderColor: ringGood ? "#fff" : "#0f0f1a",
                    boxShadow: ringGood ? "0 0 0 4px #fff" : "none",
                  }}
                />
              )
            })}
            {!playing && !done && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm uppercase tracking-widest opacity-60">Press start</div>
            )}
            {done && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="font-['JetBrains_Mono',monospace] text-7xl font-bold" style={{ color: track.color }}>{rank}</div>
                <div className="text-sm uppercase tracking-widest mt-2">{accuracy}% · combo {bestCombo}</div>
              </div>
            )}
          </div>
          <button disabled={playing} onClick={startRun} className={`${c.btn} w-full mt-4 ${playing ? "opacity-50" : ""}`}>
            {playing ? "Playing…" : done ? "Play Again" : "Start Run"}
          </button>
        </section>
        <section id="history" className={c.section}>
          <h2 className={c.h2}>Ranks History</h2>
          <HistoryList useLiveQuery={useLiveQuery} c={c} TRACKS={TRACKS} />
        </section>
      </main>
    </div>
  )
}