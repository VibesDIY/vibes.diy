import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

function GameSection({ c, nickname, highScore, onFinish }) {
  const canvasRef = React.useRef(null)
  const stateRef = React.useRef(null)
  const [score, setScore] = React.useState(0)
  const [lives, setLives] = React.useState(3)
  const [bricksLeft, setBricksLeft] = React.useState(50)
  const [running, setRunning] = React.useState(false)

  const W = 600, H = 400
  const PADDLE_W = 90, PADDLE_H = 14
  const BALL_R = 7
  const ROWS = 5, COLS = 10
  const BRICK_W = 56, BRICK_H = 18, BRICK_GAP = 4, BRICK_TOP = 40, BRICK_LEFT = 12
  const COLORS = ["#e8412a", "#f2c84b", "#3b9d52", "#2563d9", "#a855f7"]

  function makeBricks() {
    const b = []
    for (let r = 0; r < ROWS; r++)
      for (let col = 0; col < COLS; col++)
        b.push({ x: BRICK_LEFT + col * (BRICK_W + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), w: BRICK_W, h: BRICK_H, color: COLORS[r], alive: true })
    return b
  }

  function startRound() {
    stateRef.current = {
      paddleX: W / 2 - PADDLE_W / 2,
      ball: { x: W / 2, y: H - 40, vx: 3.2, vy: -3.2 },
      bricks: makeBricks(),
      score: 0,
      lives: 3,
      keys: { left: false, right: false },
      finished: false,
    }
    setScore(0); setLives(3); setBricksLeft(50); setRunning(true)
  }

  React.useEffect(() => {
    if (!running) return
    const cvs = canvasRef.current
    const ctx = cvs.getContext("2d")
    let raf

    function onMove(e) {
      const rect = cvs.getBoundingClientRect()
      const scale = cvs.width / rect.width
      const x = (e.clientX - rect.left) * scale
      stateRef.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2))
    }
    function onTouch(e) {
      if (!e.touches[0]) return
      const rect = cvs.getBoundingClientRect()
      const scale = cvs.width / rect.width
      const x = (e.touches[0].clientX - rect.left) * scale
      stateRef.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2))
    }
    function onKey(down) {
      return (e) => {
        if (e.key === "ArrowLeft") stateRef.current.keys.left = down
        if (e.key === "ArrowRight") stateRef.current.keys.right = down
      }
    }
    cvs.addEventListener("mousemove", onMove)
    cvs.addEventListener("touchmove", onTouch, { passive: true })
    window.addEventListener("keydown", onKey(true))
    window.addEventListener("keyup", onKey(false))

    function loop() {
      const s = stateRef.current
      if (!s || s.finished) return
      if (s.keys.left) s.paddleX = Math.max(0, s.paddleX - 6)
      if (s.keys.right) s.paddleX = Math.min(W - PADDLE_W, s.paddleX + 6)

      s.ball.x += s.ball.vx; s.ball.y += s.ball.vy
      if (s.ball.x < BALL_R || s.ball.x > W - BALL_R) s.ball.vx *= -1
      if (s.ball.y < BALL_R) s.ball.vy *= -1

      const paddleY = H - 24
      if (s.ball.y + BALL_R >= paddleY && s.ball.y - BALL_R <= paddleY + PADDLE_H
          && s.ball.x >= s.paddleX && s.ball.x <= s.paddleX + PADDLE_W && s.ball.vy > 0) {
        s.ball.vy *= -1
        const hit = (s.ball.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)
        s.ball.vx = hit * 4.5
      }

      for (const b of s.bricks) {
        if (!b.alive) continue
        if (s.ball.x > b.x && s.ball.x < b.x + b.w && s.ball.y > b.y && s.ball.y < b.y + b.h) {
          b.alive = false; s.ball.vy *= -1; s.score += 10
          setScore(s.score); setBricksLeft(s.bricks.filter(x => x.alive).length)
          break
        }
      }

      if (s.ball.y > H) {
        s.lives -= 1; setLives(s.lives)
        if (s.lives <= 0) {
          s.finished = true; setRunning(false)
          onFinish({ nickname: nickname || "ANON", score: s.score, bricksCleared: 50 - s.bricks.filter(x => x.alive).length, won: false })
          return
        }
        s.ball = { x: W / 2, y: H - 40, vx: 3.2, vy: -3.2 }
      }
      if (s.bricks.every(b => !b.alive)) {
        s.finished = true; setRunning(false)
        onFinish({ nickname: nickname || "ANON", score: s.score, bricksCleared: 50, won: true })
        return
      }

      ctx.fillStyle = "#15151f"; ctx.fillRect(0, 0, W, H)
      for (const b of s.bricks) {
        if (!b.alive) continue
        ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h)
        ctx.strokeStyle = "#15151f"; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h)
      }
      ctx.fillStyle = "#f5f1e8"; ctx.fillRect(s.paddleX, paddleY, PADDLE_W, PADDLE_H)
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2); ctx.fillStyle = "#f2c84b"; ctx.fill()

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      cvs.removeEventListener("mousemove", onMove)
      cvs.removeEventListener("touchmove", onTouch)
      window.removeEventListener("keydown", onKey(true))
      window.removeEventListener("keyup", onKey(false))
    }
  }, [running, nickname, onFinish])

  return (
    <section id="game" className={c.section}>
      <h2 className={c.h2}>Play</h2>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="border-[3px] border-[#15151f] shadow-[3px_3px_0_#15151f]">
          <div className="bg-[#e8412a] text-white text-[0.6rem] uppercase tracking-[0.15em] px-2 py-1 font-bold border-b-[3px] border-[#15151f]">Score</div>
          <div className="font-mono text-xl font-bold text-center py-2">{score}</div>
        </div>
        <div className="border-[3px] border-[#15151f] shadow-[3px_3px_0_#15151f]">
          <div className="bg-[#f2c84b] text-[#15151f] text-[0.6rem] uppercase tracking-[0.15em] px-2 py-1 font-bold border-b-[3px] border-[#15151f]">Lives</div>
          <div className="font-mono text-xl font-bold text-center py-2">{lives}</div>
        </div>
        <div className="border-[3px] border-[#15151f] shadow-[3px_3px_0_#15151f]">
          <div className="bg-[#2563d9] text-white text-[0.6rem] uppercase tracking-[0.15em] px-2 py-1 font-bold border-b-[3px] border-[#15151f]">Bricks</div>
          <div className="font-mono text-xl font-bold text-center py-2">{bricksLeft}</div>
        </div>
        <div className="border-[3px] border-[#15151f] shadow-[3px_3px_0_#15151f]">
          <div className="bg-[#3b9d52] text-[#15151f] text-[0.6rem] uppercase tracking-[0.15em] px-2 py-1 font-bold border-b-[3px] border-[#15151f]">High</div>
          <div className="font-mono text-xl font-bold text-center py-2">{highScore}</div>
        </div>
      </div>
      <canvas ref={canvasRef} className={c.canvas} width={W} height={H}/>
      <div className="mt-3 flex gap-2">
        <button type="button" className={c.btn} onClick={startRound} disabled={running}>
          {running ? "Playing..." : "Start Round"}
        </button>
        <span className="text-[0.7rem] uppercase tracking-wider self-center text-[#15151f]/60">Mouse, touch, or ← →</span>
      </div>
    </section>
  )
}

export default function App() {
  const { useLiveQuery, database } = useFireproof("brick-smasher")
  const [nickname, setNickname] = React.useState("")
  const [suggesting, setSuggesting] = React.useState(false)
  const { docs: games } = useLiveQuery("type", { key: "game", descending: true, limit: 20 })
  const highScore = games.reduce((m, g) => Math.max(m, g.score || 0), 0)

  async function suggestNickname() {
    setSuggesting(true)
    try {
      const r = await callAI("Generate a punchy 1-2 word arcade gamer nickname, all caps style.", {
        schema: { properties: { name: { type: "string" } } }
      })
      setNickname(JSON.parse(r).name || "")
    } finally { setSuggesting(false) }
  }

  const c = {
    page: "min-h-screen bg-[#f5f1e8] font-['Space_Grotesk',sans-serif] text-[#15151f]",
    header: "border-b-[3px] border-[#15151f] bg-white px-4 py-3 flex items-center justify-between",
    brand: "text-xl font-bold uppercase tracking-tight",
    logo: "flex gap-1",
    dot: "w-3 h-3 border-[2px] border-[#15151f]",
    main: "max-w-[920px] mx-auto px-4 py-6 space-y-6",
    section: "bg-white border-[3px] border-[#15151f] shadow-[4px_4px_0_#15151f] p-4",
    h2: "text-sm font-bold uppercase tracking-[0.15em] mb-3",
    btn: "border-[3px] border-[#15151f] bg-[#e8412a] text-white font-bold uppercase tracking-wider px-4 py-3 shadow-[3px_3px_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none min-h-[44px]",
    btn2: "border-[3px] border-[#15151f] bg-[#f2c84b] text-[#15151f] font-bold uppercase tracking-wider px-3 py-2 shadow-[3px_3px_0_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    input: "w-full border-[3px] border-[#15151f] bg-white px-3 py-2 font-mono text-sm shadow-[3px_3px_0_#15151f] focus:outline-none",
    canvas: "block mx-auto border-[3px] border-[#15151f] bg-[#15151f] max-w-full",
    row: "flex items-center justify-between border-b-[2px] border-[#15151f]/20 py-2 last:border-b-0",
    badge: "inline-block border-[2px] border-[#15151f] px-2 py-0.5 text-[0.65rem] uppercase font-bold tracking-wider",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-3">
          <div className={c.logo}>
            <span className={`${c.dot} bg-[#e8412a]`}/>
            <span className={`${c.dot} bg-[#f2c84b]`}/>
            <span className={`${c.dot} bg-[#3b9d52]`}/>
          </div>
          <h1 className={c.brand}>Brick Smasher</h1>
        </div>
        <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#15151f]/60">Level Dashboard</span>
      </header>
      <main id="app" className={c.main}>
        <section id="player" className={c.section}>
          <h2 className={c.h2}>Player</h2>
          <div className="flex gap-2 items-stretch">
            <input
              className={c.input}
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <button type="button" className={c.btn2} onClick={suggestNickname} disabled={suggesting}>
              {suggesting ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin">
                  <path d="M12 2 A 10 10 0 0 1 22 12" strokeLinecap="round"/>
                </svg>
              ) : "Suggest"}
            </button>
          </div>
        </section>
        <GameSection
          c={c}
          nickname={nickname}
          highScore={highScore}
          onFinish={(result) => database.put({ type: "game", ...result, createdAt: Date.now() })}
        />
        <section id="leaderboard" className={c.section}>
          <h2 className={c.h2}>Top Scores</h2>
          {games.length === 0 ? (
            <p className="text-sm text-[#15151f]/60 font-mono">No rounds yet — be the first.</p>
          ) : (
            <ol className="space-y-1">
              {[...games].sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 5).map((g, i) => (
                <li key={g._id} className={c.row}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold w-6">{i+1}</span>
                    <span className="font-bold uppercase tracking-wider text-sm">{g.nickname}</span>
                    {g.won && <span className={`${c.badge} bg-[#3b9d52] text-[#15151f]`}>Won</span>}
                  </div>
                  <span className="font-mono font-bold text-lg">{g.score}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section id="recent" className={c.section}>
          <h2 className={c.h2}>Recent Games</h2>
          {games.length === 0 ? (
            <p className="text-sm text-[#15151f]/60 font-mono">Play a round to see history here.</p>
          ) : (
            <ul>
              {games.map((g) => (
                <li key={g._id} className={c.row}>
                  <div className="flex items-center gap-2">
                    <span className={`${c.badge} ${g.won ? "bg-[#3b9d52]" : "bg-[#e8412a] text-white"}`}>{g.won ? "Win" : "Loss"}</span>
                    <span className="font-bold uppercase tracking-wider text-sm">{g.nickname}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.7rem] uppercase tracking-wider text-[#15151f]/60 font-mono">{g.bricksCleared}/50</span>
                    <span className="font-mono font-bold">{g.score}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}