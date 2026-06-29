import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useLiveQuery } = useFireproof("asteroids-vector")
  const { docs: runs } = useLiveQuery("type", { key: "run", descending: true })

  const [score, setScore] = React.useState(0)
  const [wave, setWave] = React.useState(1)
  const [lives, setLives] = React.useState(3)
  const [playing, setPlaying] = React.useState(false)
  const [gameOver, setGameOver] = React.useState(false)
  const [selectedRun, setSelectedRun] = React.useState(null)

  const canvasRef = React.useRef(null)
  const stateRef = React.useRef(null)
  const keysRef = React.useRef({ left: false, right: false, up: false, fire: false })
  const fireCooldownRef = React.useRef(0)
  const shotsRef = React.useRef(0)
  const hitsRef = React.useRef(0)
  const startTimeRef = React.useRef(0)

  const sortedRuns = React.useMemo(() => {
    return [...runs].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10)
  }, [runs])
  const bestScore = sortedRuns[0]?.score || 0

  React.useEffect(() => {
    if (!playing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const W = 800, H = 600
    canvas.width = W
    canvas.height = H
    let raf
    let localScore = 0
    let localWave = 1
    let localLives = 3

    function wrap(p) {
      if (p.x < 0) p.x += W
      if (p.x > W) p.x -= W
      if (p.y < 0) p.y += H
      if (p.y > H) p.y -= H
    }

    function explode(x, y, n) {
      const s = stateRef.current
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 1 + Math.random() * 2
        s.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30 })
      }
    }

    function loop() {
      const s = stateRef.current
      if (!s) return
      if (fireCooldownRef.current > 0) fireCooldownRef.current--

      if (s.ship.alive) {
        if (keysRef.current.left) s.ship.angle -= 0.08
        if (keysRef.current.right) s.ship.angle += 0.08
        if (keysRef.current.up) {
          s.ship.vx += Math.cos(s.ship.angle) * 0.12
          s.ship.vy += Math.sin(s.ship.angle) * 0.12
          s.particles.push({
            x: s.ship.x - Math.cos(s.ship.angle) * 12,
            y: s.ship.y - Math.sin(s.ship.angle) * 12,
            vx: -Math.cos(s.ship.angle) * 2 + (Math.random() - 0.5),
            vy: -Math.sin(s.ship.angle) * 2 + (Math.random() - 0.5),
            life: 15,
          })
        }
        s.ship.vx *= 0.99
        s.ship.vy *= 0.99
        s.ship.x += s.ship.vx
        s.ship.y += s.ship.vy
        wrap(s.ship)
        if (s.ship.invuln > 0) s.ship.invuln--
      }

      s.bullets = s.bullets.filter(b => b.life > 0)
      for (const b of s.bullets) {
        b.x += b.vx; b.y += b.vy; b.life--; wrap(b)
      }

      for (const a of s.asteroids) {
        a.x += a.vx; a.y += a.vy; a.rot += a.vrot; wrap(a)
      }

      // bullet-asteroid
      for (let i = s.asteroids.length - 1; i >= 0; i--) {
        const a = s.asteroids[i]
        for (let j = s.bullets.length - 1; j >= 0; j--) {
          const b = s.bullets[j]
          const dx = a.x - b.x, dy = a.y - b.y
          if (dx * dx + dy * dy < a.radius * a.radius) {
            s.bullets.splice(j, 1)
            s.asteroids.splice(i, 1)
            hitsRef.current += 1
            localScore += a.size === 3 ? 20 : a.size === 2 ? 50 : 100
            setScore(localScore)
            explode(a.x, a.y, 12)
            if (a.size > 1) {
              for (let k = 0; k < 2; k++) {
                const ang = Math.random() * Math.PI * 2
                const sp = 1 + Math.random() * 1
                s.asteroids.push({
                  x: a.x, y: a.y,
                  vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                  size: a.size - 1,
                  radius: a.size === 3 ? 28 : 14,
                  rot: Math.random() * Math.PI * 2,
                  vrot: (Math.random() - 0.5) * 0.04,
                  shape: Array.from({ length: 10 }, () => 0.7 + Math.random() * 0.4),
                })
              }
            }
            break
          }
        }
      }

      // ship-asteroid
      if (s.ship.alive && s.ship.invuln <= 0) {
        for (const a of s.asteroids) {
          const dx = a.x - s.ship.x, dy = a.y - s.ship.y
          if (dx * dx + dy * dy < (a.radius + 8) * (a.radius + 8)) {
            s.ship.alive = false
            explode(s.ship.x, s.ship.y, 30)
            localLives--
            setLives(localLives)
            setTimeout(() => {
              if (localLives > 0) {
                s.ship = { x: 400, y: 300, vx: 0, vy: 0, angle: -Math.PI / 2, alive: true, invuln: 120 }
              } else {
                endGame(localScore, localWave)
              }
            }, 1200)
            break
          }
        }
      }

      // next wave
      if (s.asteroids.length === 0) {
        localWave++
        setWave(localWave)
        s.asteroids = spawnAsteroids(3 + localWave, localWave)
      }

      // particles
      s.particles = s.particles.filter(p => p.life > 0)
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life-- }

      // render
      ctx.fillStyle = "#0d0d12"
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = "#f5f3ee"
      ctx.lineWidth = 2

      for (const a of s.asteroids) {
        ctx.beginPath()
        for (let k = 0; k < a.shape.length; k++) {
          const ang = (k / a.shape.length) * Math.PI * 2 + a.rot
          const r = a.radius * a.shape[k]
          const x = a.x + Math.cos(ang) * r
          const y = a.y + Math.sin(ang) * r
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      for (const b of s.bullets) {
        ctx.fillStyle = "#f0c419"
        ctx.fillRect(b.x - 2, b.y - 2, 4, 4)
      }

      for (const p of s.particles) {
        ctx.fillStyle = `rgba(224,57,43,${p.life / 30})`
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2)
      }

      if (s.ship.alive && (s.ship.invuln <= 0 || Math.floor(s.ship.invuln / 6) % 2 === 0)) {
        ctx.save()
        ctx.translate(s.ship.x, s.ship.y)
        ctx.rotate(s.ship.angle)
        ctx.strokeStyle = "#3aa856"
        ctx.beginPath()
        ctx.moveTo(14, 0)
        ctx.lineTo(-10, -8)
        ctx.lineTo(-6, 0)
        ctx.lineTo(-10, 8)
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
      }

      raf = requestAnimationFrame(loop)
    }

    function endGame(finalScore, finalWave) {
      setPlaying(false)
      setGameOver(true)
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
      database.put({
        type: "run",
        score: finalScore,
        wave: finalWave,
        shots: shotsRef.current,
        hits: hitsRef.current,
        duration,
        createdAt: Date.now(),
      })
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, database])

  function setKey(k, v) {
    keysRef.current[k] = v
  }

  function spawnAsteroids(n, w) {
    const arr = []
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.4 + Math.random() * 0.6 + w * 0.05
      arr.push({
        x: Math.random() < 0.5 ? 0 : 800,
        y: Math.random() * 600,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        radius: 48,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.02,
        shape: Array.from({ length: 10 }, () => 0.7 + Math.random() * 0.4),
      })
    }
    return arr
  }

  function newGame() {
    stateRef.current = {
      ship: { x: 400, y: 300, vx: 0, vy: 0, angle: -Math.PI / 2, alive: true, invuln: 120 },
      bullets: [],
      asteroids: spawnAsteroids(4, 1),
      particles: [],
    }
    setScore(0)
    setWave(1)
    setLives(3)
    setGameOver(false)
    shotsRef.current = 0
    hitsRef.current = 0
    startTimeRef.current = Date.now()
  }

  function handleStart(e) {
    e.preventDefault()
    newGame()
    setPlaying(true)
  }

  function handleFire() {
    const s = stateRef.current
    if (!s || !s.ship.alive) return
    if (fireCooldownRef.current > 0) return
    s.bullets.push({
      x: s.ship.x + Math.cos(s.ship.angle) * 16,
      y: s.ship.y + Math.sin(s.ship.angle) * 16,
      vx: Math.cos(s.ship.angle) * 6 + s.ship.vx,
      vy: Math.sin(s.ship.angle) * 6 + s.ship.vy,
      life: 70,
    })
    fireCooldownRef.current = 12
    shotsRef.current += 1
  }

  function handleThrust() { setKey("up", true); setTimeout(() => setKey("up", false), 150) }
  function handleRotateLeft() { setKey("left", true); setTimeout(() => setKey("left", false), 100) }
  function handleRotateRight() { setKey("right", true); setTimeout(() => setKey("right", false), 100) }

  React.useEffect(() => {
    function down(e) {
      if (e.code === "ArrowLeft") { setKey("left", true); e.preventDefault() }
      if (e.code === "ArrowRight") { setKey("right", true); e.preventDefault() }
      if (e.code === "ArrowUp") { setKey("up", true); e.preventDefault() }
      if (e.code === "Space") { handleFire(); e.preventDefault() }
    }
    function up(e) {
      if (e.code === "ArrowLeft") setKey("left", false)
      if (e.code === "ArrowRight") setKey("right", false)
      if (e.code === "ArrowUp") setKey("up", false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  const c = {
    page: "min-h-screen w-full bg-[#f5f3ee] text-[#16161d]",
    wrap: "max-w-[920px] mx-auto px-4 py-6 flex flex-col gap-5",
    header: "flex items-center justify-between p-3 border-[3px] border-[#16161d] rounded-[4px] bg-white shadow-[4px_4px_0_#16161d]",
    logo: "flex items-center gap-2",
    logoDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    brand: "uppercase font-bold tracking-tight text-sm",
    nav: "flex gap-2",
    navChip: "px-3 py-2 border-[3px] border-[#16161d] rounded-[4px] uppercase text-[0.7rem] font-bold tracking-wider bg-white shadow-[3px_3px_0_#16161d] cursor-pointer",
    hero: "relative border-[3px] border-[#16161d] rounded-[4px] p-6 overflow-hidden bg-white shadow-[4px_4px_0_#16161d]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroSeg: "flex-1",
    heroTitle: "uppercase font-bold tracking-tight text-4xl md:text-5xl mt-3 relative",
    heroSub: "uppercase text-[0.65rem] tracking-[0.15em] mt-2",
    statRow: "grid grid-cols-2 md:grid-cols-4 gap-3",
    statCard: "border-[3px] border-[#16161d] rounded-[4px] overflow-hidden bg-white shadow-[3px_3px_0_#16161d]",
    statHead: "px-3 py-2 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px]",
    statBody: "p-3 flex flex-col gap-1",
    statNum: "font-mono font-bold text-2xl",
    statLabel: "uppercase text-[0.6rem] tracking-[0.15em]",
    gameWrap: "border-[3px] border-[#16161d] rounded-[4px] p-3 flex flex-col gap-3 bg-white shadow-[4px_4px_0_#16161d]",
    canvasBox: "relative border-[3px] border-[#16161d] rounded-[4px] aspect-[4/3] w-full overflow-hidden bg-[#0d0d12]",
    overlay: "absolute inset-0 flex flex-col items-center justify-center gap-3 p-4",
    bigBtn: "px-6 py-3 border-[3px] border-[#16161d] rounded-[4px] uppercase font-bold tracking-wider text-sm min-h-[44px] bg-[#e0392b] text-white shadow-[4px_4px_0_#16161d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    controlsRow: "grid grid-cols-4 gap-2",
    ctrlBtn: "border-[3px] border-[#16161d] rounded-[4px] py-3 uppercase text-[0.7rem] font-bold tracking-wider min-h-[44px] bg-white shadow-[3px_3px_0_#16161d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none select-none",
    boardWrap: "border-[3px] border-[#16161d] rounded-[4px] overflow-hidden bg-white shadow-[4px_4px_0_#16161d]",
    boardHead: "px-3 py-2 uppercase text-[0.65rem] tracking-[0.15em] font-bold border-b-[3px] border-[#16161d] bg-[#2e6fdb] text-white",
    table: "w-full",
    th: "text-left px-3 py-2 uppercase text-[0.6rem] tracking-[0.15em] border-b-[2px] border-[#16161d]",
    td: "px-3 py-2 text-[0.82rem] border-b border-[#e5e3dc] cursor-pointer",
    tdMono: "px-3 py-2 text-[0.82rem] font-mono border-b border-[#e5e3dc] cursor-pointer",
    badge: "inline-block px-2 py-1 border-[2px] rounded-[4px] uppercase text-[0.6rem] font-bold tracking-wider",
    empty: "p-6 text-center uppercase text-[0.7rem] tracking-[0.15em]",
    detailWrap: "border-[3px] border-[#16161d] rounded-[4px] p-4 flex flex-col gap-2 bg-white shadow-[4px_4px_0_#16161d]",
    detailRow: "flex justify-between text-[0.82rem]",
    footer: "text-center uppercase text-[0.6rem] tracking-[0.15em] py-4",
  }

  return (
    <div className={c.page}>
      <div className={c.wrap}>
        <header id="app-header" className={c.header}>
          <div className={c.logo}>
            <div className={c.logoDots}>
              <span className={`${c.dot} border-[#16161d] bg-[#e0392b]`}></span>
              <span className={`${c.dot} border-[#16161d] bg-[#f0c419]`}></span>
              <span className={`${c.dot} border-[#16161d] bg-[#3aa856]`}></span>
            </div>
            <span className={c.brand}>Vector</span>
          </div>
          <nav className={c.nav}>
            <a className={c.navChip}>Play</a>
            <a className={c.navChip}>Runs</a>
          </nav>
        </header>

        <main id="app">
          <section id="hero" className={c.hero}>
            <div className={c.heroBar}>
              <div className={`${c.heroSeg} bg-[#e0392b]`}></div>
              <div className={`${c.heroSeg} bg-[#f0c419]`}></div>
              <div className={`${c.heroSeg} bg-[#3aa856]`}></div>
              <div className={`${c.heroSeg} bg-[#2e6fdb]`}></div>
            </div>
            <h1 className={c.heroTitle}>
              <span aria-hidden="true" className="absolute left-[5px] top-[3px] text-[#e0392b] opacity-50 select-none">Asteroids</span>
              <span className="relative">Asteroids</span>
            </h1>
            <p className={c.heroSub}>Rotate · Thrust · Fire · Survive</p>
          </section>

          <section id="stats" className={c.statRow}>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#e0392b] text-white border-[#16161d]`}>Score</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{score}</span>
                <span className={c.statLabel}>Points</span>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#f0c419] text-[#16161d] border-[#16161d]`}>Wave</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{wave}</span>
                <span className={c.statLabel}>Round</span>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#2e6fdb] text-white border-[#16161d]`}>Lives</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{lives}</span>
                <span className={c.statLabel}>Ships</span>
              </div>
            </div>
            <div className={c.statCard}>
              <div className={`${c.statHead} bg-[#3aa856] text-[#16161d] border-[#16161d]`}>Best</div>
              <div className={c.statBody}>
                <span className={c.statNum}>{bestScore}</span>
                <span className={c.statLabel}>High</span>
              </div>
            </div>
          </section>

          <section id="game" className={c.gameWrap}>
            <div className={c.canvasBox}>
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {!playing && (
                <div className={c.overlay}>
                  {gameOver && (
                    <div className="text-white text-center">
                      <div className="uppercase text-[0.65rem] tracking-[0.15em]">Game Over</div>
                      <div className="font-mono font-bold text-3xl mt-1">{score}</div>
                      <div className="uppercase text-[0.6rem] tracking-[0.15em] mt-1">Wave {wave}</div>
                    </div>
                  )}
                  <form onSubmit={handleStart}>
                    <button type="submit" className={c.bigBtn}>{gameOver ? "Play Again" : "Start"}</button>
                  </form>
                </div>
              )}
            </div>
            <div className={c.controlsRow}>
              <button className={c.ctrlBtn} onMouseDown={() => setKey("left", true)} onMouseUp={() => setKey("left", false)} onMouseLeave={() => setKey("left", false)} onTouchStart={(e) => { e.preventDefault(); setKey("left", true) }} onTouchEnd={() => setKey("left", false)}>◄ Rot</button>
              <button className={`${c.ctrlBtn} bg-[#3aa856]`} onMouseDown={() => setKey("up", true)} onMouseUp={() => setKey("up", false)} onMouseLeave={() => setKey("up", false)} onTouchStart={(e) => { e.preventDefault(); setKey("up", true) }} onTouchEnd={() => setKey("up", false)}>▲ Thrust</button>
              <button className={c.ctrlBtn} onMouseDown={() => setKey("right", true)} onMouseUp={() => setKey("right", false)} onMouseLeave={() => setKey("right", false)} onTouchStart={(e) => { e.preventDefault(); setKey("right", true) }} onTouchEnd={() => setKey("right", false)}>Rot ►</button>
              <button className={`${c.ctrlBtn} bg-[#f0c419]`} onMouseDown={handleFire} onTouchStart={(e) => { e.preventDefault(); handleFire() }}>● Fire</button>
            </div>
          </section>

          <section id="leaderboard" className={c.boardWrap}>
            <div className={c.boardHead}>Top 10 Runs</div>
            <table className={c.table}>
              <thead>
                <tr>
                  <th className={c.th}>Rank</th>
                  <th className={c.th}>Score</th>
                  <th className={c.th}>Wave</th>
                  <th className={c.th}>When</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.length === 0 && (
                  <tr><td className={c.td} colSpan={4}><div className={c.empty}>No runs yet — play to set a score</div></td></tr>
                )}
                {sortedRuns.map((r, i) => (
                  <tr key={r._id} onClick={() => setSelectedRun(r)} className="hover:bg-[#f0c419]">
                    <td className={c.td}>
                      <span className={`${c.badge} border-[#16161d] ${i === 0 ? "bg-[#3aa856]" : i < 3 ? "bg-[#f0c419]" : "bg-white"}`}>#{i + 1}</span>
                    </td>
                    <td className={c.tdMono}>{r.score}</td>
                    <td className={c.tdMono}>{r.wave}</td>
                    <td className={c.td}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="detail" className={c.detailWrap}>
            <div className={c.boardHead}>{selectedRun ? "Run Detail" : "Tap a Run Above"}</div>
            <div className={c.detailRow}><span className="uppercase text-[0.65rem] tracking-[0.15em]">Score</span><span className="font-mono font-bold">{selectedRun?.score ?? "—"}</span></div>
            <div className={c.detailRow}><span className="uppercase text-[0.65rem] tracking-[0.15em]">Wave Reached</span><span className="font-mono font-bold">{selectedRun?.wave ?? "—"}</span></div>
            <div className={c.detailRow}><span className="uppercase text-[0.65rem] tracking-[0.15em]">Shots Fired</span><span className="font-mono font-bold">{selectedRun?.shots ?? "—"}</span></div>
            <div className={c.detailRow}><span className="uppercase text-[0.65rem] tracking-[0.15em]">Hits</span><span className="font-mono font-bold">{selectedRun?.hits ?? "—"}</span></div>
            <div className={c.detailRow}><span className="uppercase text-[0.65rem] tracking-[0.15em]">Accuracy</span><span className="font-mono font-bold">{selectedRun && selectedRun.shots ? Math.round((selectedRun.hits / selectedRun.shots) * 100) + "%" : "—"}</span></div>
            <div className={c.detailRow}><span className="uppercase text-[0.65rem] tracking-[0.15em]">Duration</span><span className="font-mono font-bold">{selectedRun ? selectedRun.duration + "s" : "—"}</span></div>
          </section>
        </main>

        <footer className={c.footer}>Arrow Keys · Space to Fire · Wrap-Around Space</footer>
      </div>
    </div>
  )
}