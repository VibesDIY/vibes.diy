import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

const ARENA_W = 800
const ARENA_H = 500
const SHIP_W = 44
const SHIP_H = 18
const ALIEN_W = 32
const ALIEN_H = 22
const ALIEN_COLS = 9
const ALIEN_ROWS = 4
const BARRIER_COUNT = 3
const BARRIER_BLOCKS_X = 6
const BARRIER_BLOCKS_Y = 3
const BARRIER_BLOCK = 12

function makeAliens() {
  const aliens = []
  const startX = 60
  const startY = 50
  const gapX = 60
  const gapY = 40
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      aliens.push({ x: startX + col*gapX, y: startY + r*gapY, alive: true, row: r })
    }
  }
  return aliens
}

function makeBarriers() {
  const barriers = []
  const totalW = BARRIER_BLOCKS_X * BARRIER_BLOCK
  const spacing = (ARENA_W - BARRIER_COUNT*totalW) / (BARRIER_COUNT+1)
  for (let b = 0; b < BARRIER_COUNT; b++) {
    const bx = spacing + b*(totalW + spacing)
    const by = ARENA_H - 130
    for (let y = 0; y < BARRIER_BLOCKS_Y; y++) {
      for (let x = 0; x < BARRIER_BLOCKS_X; x++) {
        barriers.push({ x: bx + x*BARRIER_BLOCK, y: by + y*BARRIER_BLOCK, alive: true })
      }
    }
  }
  return barriers
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("space-invaders")
  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true })

  const [phase, setPhase] = React.useState("ready") // ready|playing|gameover
  const [score, setScore] = React.useState(0)
  const [wave, setWave] = React.useState(1)
  const [lives, setLives] = React.useState(3)
  const [taunt, setTaunt] = React.useState("")
  const [tauntLoading, setTauntLoading] = React.useState(false)

  const canvasRef = React.useRef(null)
  const stateRef = React.useRef(null)
  const keysRef = React.useRef({ left:false, right:false, fire:false })
  const lastShotRef = React.useRef(0)

  const sortedRuns = [...runs].sort((a,b)=> (b.score||0) - (a.score||0)).slice(0,8)
  const best = sortedRuns[0]?.score || 0

  function resetGame(nextWave = 1, keepLives = null) {
    stateRef.current = {
      ship: { x: ARENA_W/2 - SHIP_W/2, y: ARENA_H - 40 },
      aliens: makeAliens(),
      barriers: makeBarriers(),
      bullets: [],
      enemyBullets: [],
      dir: 1,
      speed: 0.6 + nextWave*0.15,
      stepDown: false,
    }
  }

  function startNew() {
    setScore(0)
    setWave(1)
    setLives(3)
    setTaunt("")
    resetGame(1)
    setPhase("playing")
  }

  function handleStart() { startNew() }
  function handleRestart() { startNew() }

  async function saveRun(finalScore, finalWave) {
    try {
      await database.put({ type:"run", score: finalScore, wave: finalWave, createdAt: Date.now() })
    } catch {}
  }

  async function handleTaunt() {
    setTauntLoading(true)
    try {
      const res = await callAI(`Write a single short sci-fi taunt or congrats line (max 18 words) for a Space Invaders run. Score: ${score}. Wave reached: ${wave}. No quotes around it.`, {
        schema: { properties: { line: { type: "string" } } }
      })
      const parsed = JSON.parse(res)
      setTaunt(parsed.line || "")
    } catch {
      setTaunt("Transmission garbled. Try again, pilot.")
    } finally {
      setTauntLoading(false)
    }
  }

  // keyboard
  React.useEffect(() => {
    function down(e) {
      if (e.key === "ArrowLeft") keysRef.current.left = true
      if (e.key === "ArrowRight") keysRef.current.right = true
      if (e.key === " " || e.key === "Spacebar") { keysRef.current.fire = true; e.preventDefault() }
    }
    function up(e) {
      if (e.key === "ArrowLeft") keysRef.current.left = false
      if (e.key === "ArrowRight") keysRef.current.right = false
      if (e.key === " " || e.key === "Spacebar") keysRef.current.fire = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up) }
  }, [])

  // game loop
  React.useEffect(() => {
    if (phase !== "playing") return
    let raf
    const ctx = canvasRef.current.getContext("2d")

    function step() {
      const s = stateRef.current
      if (!s) return

      // ship
      if (keysRef.current.left) s.ship.x -= 5
      if (keysRef.current.right) s.ship.x += 5
      s.ship.x = Math.max(0, Math.min(ARENA_W - SHIP_W, s.ship.x))

      // fire
      const now = performance.now()
      if (keysRef.current.fire && now - lastShotRef.current > 350) {
        s.bullets.push({ x: s.ship.x + SHIP_W/2 - 2, y: s.ship.y - 6 })
        lastShotRef.current = now
      }

      // bullets
      s.bullets = s.bullets.filter(b => b.y > -10)
      s.bullets.forEach(b => b.y -= 8)

      // aliens
      let hitEdge = false
      let liveAliens = 0
      s.aliens.forEach(a => {
        if (!a.alive) return
        liveAliens++
        a.x += s.dir * s.speed
        if (a.x < 10 || a.x > ARENA_W - ALIEN_W - 10) hitEdge = true
      })
      if (hitEdge) {
        s.dir *= -1
        s.aliens.forEach(a => { if (a.alive) a.y += 14 })
      }

      // enemy fire
      if (Math.random() < 0.02 + wave*0.005) {
        const shooters = s.aliens.filter(a => a.alive)
        if (shooters.length) {
          const a = shooters[Math.floor(Math.random()*shooters.length)]
          s.enemyBullets.push({ x: a.x + ALIEN_W/2 - 2, y: a.y + ALIEN_H })
        }
      }
      s.enemyBullets = s.enemyBullets.filter(b => b.y < ARENA_H + 10)
      s.enemyBullets.forEach(b => b.y += 4 + wave*0.3)

      // bullet vs alien
      for (const b of s.bullets) {
        for (const a of s.aliens) {
          if (!a.alive) continue
          if (b.x < a.x+ALIEN_W && b.x+4 > a.x && b.y < a.y+ALIEN_H && b.y+10 > a.y) {
            a.alive = false
            b.y = -100
            setScore(sc => sc + (40 - a.row*5))
          }
        }
      }

      // bullet vs barriers
      for (const b of s.bullets) {
        for (const blk of s.barriers) {
          if (!blk.alive) continue
          if (b.x < blk.x+BARRIER_BLOCK && b.x+4 > blk.x && b.y < blk.y+BARRIER_BLOCK && b.y+10 > blk.y) {
            blk.alive = false; b.y = -100
          }
        }
      }
      for (const b of s.enemyBullets) {
        for (const blk of s.barriers) {
          if (!blk.alive) continue
          if (b.x < blk.x+BARRIER_BLOCK && b.x+4 > blk.x && b.y < blk.y+BARRIER_BLOCK && b.y+10 > blk.y) {
            blk.alive = false; b.y = ARENA_H+100
          }
        }
      }

      // enemy bullet vs ship
      for (const b of s.enemyBullets) {
        if (b.x < s.ship.x+SHIP_W && b.x+4 > s.ship.x && b.y < s.ship.y+SHIP_H && b.y+10 > s.ship.y) {
          b.y = ARENA_H+100
          setLives(l => {
            const next = l - 1
            if (next <= 0) {
              setPhase("gameover")
              setScore(sc => { saveRun(sc, wave); return sc })
            }
            return next
          })
        }
      }

      // alien reaches ship
      for (const a of s.aliens) {
        if (a.alive && a.y + ALIEN_H >= s.ship.y) {
          setPhase("gameover")
          setScore(sc => { saveRun(sc, wave); return sc })
        }
      }

      // wave clear
      if (liveAliens === 0) {
        setWave(w => {
          const nw = w + 1
          resetGame(nw)
          return nw
        })
      }

      // draw
      ctx.fillStyle = "#0a0612"
      ctx.fillRect(0,0,ARENA_W,ARENA_H)
      // ship
      ctx.fillStyle = "#3aa856"
      ctx.fillRect(s.ship.x, s.ship.y, SHIP_W, SHIP_H)
      ctx.fillRect(s.ship.x+SHIP_W/2-3, s.ship.y-6, 6, 6)
      // aliens
      s.aliens.forEach(a => {
        if (!a.alive) return
        const colors = ["#d43d2a","#f0c419","#2e6cd6","#3aa856"]
        ctx.fillStyle = colors[a.row % colors.length]
        ctx.fillRect(a.x, a.y, ALIEN_W, ALIEN_H)
        ctx.fillStyle = "#0a0612"
        ctx.fillRect(a.x+6, a.y+6, 4, 4)
        ctx.fillRect(a.x+ALIEN_W-10, a.y+6, 4, 4)
      })
      // barriers
      ctx.fillStyle = "#3aa856"
      s.barriers.forEach(b => { if (b.alive) ctx.fillRect(b.x, b.y, BARRIER_BLOCK, BARRIER_BLOCK) })
      // bullets
      ctx.fillStyle = "#f0c419"
      s.bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10))
      ctx.fillStyle = "#d43d2a"
      s.enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10))

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, wave])

  function pressLeft(v) { keysRef.current.left = v }
  function pressRight(v) { keysRef.current.right = v }
  function pressFire(v) { keysRef.current.fire = v }

  const c = {
    page: "min-h-screen w-full bg-[#f5f1e8] text-[#1a1625]",
    bgGrid: "fixed inset-0 -z-10 bg-[linear-gradient(#1a162510_1px,transparent_1px),linear-gradient(90deg,#1a162510_1px,transparent_1px)] bg-[size:60px_60px]",
    shell: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-6",
    header: "flex items-center justify-between gap-3 p-4 border-[3px] border-[#1a1625] rounded bg-white shadow-[4px_4px_0px_#1a1625]",
    logo: "flex items-center gap-2",
    logoDot: "w-3 h-3 border-[3px]",
    brand: "uppercase font-bold tracking-tight text-lg",
    navRow: "flex gap-2",
    navLink: "px-3 py-2 border-[3px] border-[#1a1625] rounded uppercase text-xs font-bold bg-white shadow-[3px_3px_0px_#1a1625]",
    hero: "relative p-6 pt-8 border-[3px] border-[#1a1625] rounded overflow-hidden bg-white shadow-[4px_4px_0px_#1a1625]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroBarSeg: "flex-1",
    heroTitle: "uppercase font-black tracking-tight text-4xl md:text-6xl mt-3",
    heroTitleShadow: "[text-shadow:5px_5px_0_rgba(212,61,42,0.5)]",
    heroSub: "uppercase tracking-widest text-xs mt-3 text-[#666]",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3",
    statCard: "border-[3px] border-[#1a1625] rounded overflow-hidden bg-white shadow-[4px_4px_0px_#1a1625]",
    statHead: "px-3 py-2 uppercase text-xs font-bold tracking-widest",
    statBody: "p-4 flex flex-col gap-1",
    statNum: "font-mono text-3xl font-bold",
    statUnit: "uppercase text-[0.65rem] tracking-widest text-[#666]",
    arena: "relative border-[3px] border-[#1a1625] rounded overflow-hidden bg-[#0a0612] shadow-[4px_4px_0px_#1a1625]",
    arenaCanvas: "block w-full",
    arenaOverlay: "absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#0a0612e0] text-white",
    overlayTitle: "uppercase font-black tracking-tight text-4xl [text-shadow:4px_4px_0_rgba(212,61,42,0.7)]",
    overlayText: "uppercase text-xs tracking-widest",
    actions: "flex flex-wrap gap-3",
    btnPrimary: "px-5 py-3 border-[3px] border-[#1a1625] rounded uppercase text-sm font-bold tracking-widest min-h-[44px] bg-[#d43d2a] text-white shadow-[4px_4px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnSecondary: "px-5 py-3 border-[3px] border-[#1a1625] rounded uppercase text-sm font-bold tracking-widest min-h-[44px] bg-[#f0c419] text-[#1a1625] shadow-[3px_3px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnGhost: "px-5 py-3 border-[3px] border-[#1a1625] rounded uppercase text-sm font-bold tracking-widest min-h-[44px] bg-white text-[#1a1625] hover:shadow-[3px_3px_0px_#1a1625] transition-all",
    sectionLabel: "uppercase text-[0.65rem] tracking-widest font-bold mb-3 text-[#666]",
    card: "p-5 border-[3px] border-[#1a1625] rounded bg-white shadow-[4px_4px_0px_#1a1625]",
    table: "w-full border-collapse",
    th: "text-left uppercase text-[0.6rem] tracking-widest font-bold py-2 border-b-2 border-[#1a1625]",
    td: "py-2 text-sm border-b border-[#1a162520]",
    tdMono: "py-2 text-sm border-b border-[#1a162520] font-mono",
    badgeActive: "inline-block px-2 py-1 border-[3px] rounded uppercase text-[0.6rem] font-bold tracking-widest",
    tauntCard: "p-5 border-[3px] border-[#1a1625] rounded bg-white shadow-[4px_4px_0px_#1a1625]",
    tauntText: "italic text-sm",
    pad: "flex justify-between gap-3",
    padBtn: "flex-1 py-4 border-[3px] border-[#1a1625] rounded uppercase font-bold text-sm min-h-[56px] bg-white shadow-[4px_4px_0px_#1a1625] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  }

  return (
    <div className={c.page}>
      <div className={c.bgGrid} aria-hidden="true"></div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div className={c.shell}>
        <header id="app-header" className={c.header}>
          <div className={c.logo}>
            <span className={c.logoDot} style={{background:"#d43d2a",borderColor:"#1a1625"}}></span>
            <span className={c.logoDot} style={{background:"#f0c419",borderColor:"#1a1625"}}></span>
            <span className={c.logoDot} style={{background:"#3aa856",borderColor:"#1a1625"}}></span>
            <span className={c.brand}>Invaders</span>
          </div>
          <nav className={c.navRow}>
            <a className={c.navLink} href="#leaderboard">Scores</a>
            <a className={c.navLink} href="#taunt">Taunt</a>
          </nav>
        </header>

        <main id="app">
          <section id="hero" className={c.hero}>
            <div className={c.heroBar} aria-hidden="true">
              <span className={c.heroBarSeg} style={{background:"#d43d2a"}}></span>
              <span className={c.heroBarSeg} style={{background:"#f0c419"}}></span>
              <span className={c.heroBarSeg} style={{background:"#3aa856"}}></span>
              <span className={c.heroBarSeg} style={{background:"#2e6cd6"}}></span>
            </div>
            <h1 className={`${c.heroTitle} ${c.heroTitleShadow}`}>Defend Sector 7</h1>
            <p className={c.heroSub}>Arrow keys move · Space fires</p>
          </section>

          <section id="stats" className={c.statRow}>
            <div className={c.statCard}>
              <div className={c.statHead} style={{background:"#d43d2a",color:"#fff",borderBottom:"3px solid #1a1625"}}>Score</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{score}</span>
                <span className={c.statUnit}>Points</span>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={c.statHead} style={{background:"#f0c419",color:"#1a1625",borderBottom:"3px solid #1a1625"}}>Wave</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{wave}</span>
                <span className={c.statUnit}>Current</span>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={c.statHead} style={{background:"#2e6cd6",color:"#fff",borderBottom:"3px solid #1a1625"}}>Lives</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{lives}</span>
                <span className={c.statUnit}>Remaining</span>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={c.statHead} style={{background:"#3aa856",color:"#1a1625",borderBottom:"3px solid #1a1625"}}>Best</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{best}</span>
                <span className={c.statUnit}>All-time</span>
              </div>
            </div>
          </section>

          <section id="arena" className={c.arena}>
            <canvas ref={canvasRef} className={c.arenaCanvas} width={ARENA_W} height={ARENA_H}></canvas>
            {phase !== "playing" && (
              <div className={c.arenaOverlay}>
                <h2 className={c.overlayTitle}>{phase === "gameover" ? "Game Over" : "Ready"}</h2>
                <p className={c.overlayText}>{phase === "gameover" ? `Final score ${score} · Wave ${wave}` : "Arrow keys move · Space fires"}</p>
                <div className={c.actions}>
                  <button type="button" onClick={handleStart} className={c.btnPrimary}>{phase === "gameover" ? "Play Again" : "Start"}</button>
                </div>
              </div>
            )}
          </section>

          <section id="controls" className={c.pad}>
            <button type="button" className={c.padBtn}
              onTouchStart={()=>pressLeft(true)} onTouchEnd={()=>pressLeft(false)}
              onMouseDown={()=>pressLeft(true)} onMouseUp={()=>pressLeft(false)} onMouseLeave={()=>pressLeft(false)}>Left</button>
            <button type="button" className={c.padBtn}
              onTouchStart={()=>pressFire(true)} onTouchEnd={()=>pressFire(false)}
              onMouseDown={()=>pressFire(true)} onMouseUp={()=>pressFire(false)} onMouseLeave={()=>pressFire(false)}>Fire</button>
            <button type="button" className={c.padBtn}
              onTouchStart={()=>pressRight(true)} onTouchEnd={()=>pressRight(false)}
              onMouseDown={()=>pressRight(true)} onMouseUp={()=>pressRight(false)} onMouseLeave={()=>pressRight(false)}>Right</button>
          </section>

          <section id="taunt" className={c.tauntCard}>
            <div className={c.sectionLabel}>Transmission</div>
            <p className={c.tauntText}>{taunt || (phase === "gameover" ? "The mothership has prepared a message..." : "Awaiting end of run...")}</p>
            <div className={c.actions} style={{marginTop:"0.75rem"}}>
              <button type="button" onClick={handleTaunt} disabled={tauntLoading} className={c.btnGhost} style={tauntLoading?{opacity:0.6}:{}}>
                {tauntLoading ? (
                  <span style={{display:"inline-flex",alignItems:"center",gap:"0.5rem"}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1625" strokeWidth="3" style={{animation:"spin 0.8s linear infinite"}}><path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                    Loading
                  </span>
                ) : "Generate"}
              </button>
            </div>
          </section>

          <section id="leaderboard" className={c.card}>
            <div className={c.sectionLabel}>Top Runs</div>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>Rank</th>
                  <th className={c.th}>Date</th>
                  <th className={c.th}>Wave</th>
                  <th className={c.th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.length === 0 && (
                  <tr><td className={c.td} colSpan={4}>No runs yet — launch a game!</td></tr>
                )}
                {sortedRuns.map((r, i) => (
                  <tr key={r._id}>
                    <td className={c.td}>{i+1}</td>
                    <td className={c.td}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className={c.tdMono}>{r.wave}</td>
                    <td className={c.tdMono}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="actions" className={c.actions}>
            <button type="button" onClick={handleStart} className={c.btnPrimary}>New Run</button>
            <button type="button" onClick={handleRestart} className={c.btnSecondary}>Reset</button>
          </section>
        </main>
      </div>
    </div>
  )
}