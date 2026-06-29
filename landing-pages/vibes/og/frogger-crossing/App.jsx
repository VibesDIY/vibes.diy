import React, { useState, useRef, useEffect, useCallback } from "react"

const COLS = 13, CELL = 44
const ROWS = 11
const W = COLS * CELL, H = ROWS * CELL

const ROW_TYPES = [
  "goal",
  "road", "road",
  "island",
  "road", "road",
  "island",
  "road", "road",
  "start", "start",
]

const ROW_COLORS = {
  goal: "#1a5a1a",
  road: "#2a2a3a",
  island: "#1a4a2a",
  start: "#1a3a1a",
}

function makeCar(row, x, speed, color, width = 2) {
  return { row, x, speed, color, width, emoji: speed > 0 ? "🚗" : "🚙" }
}

const INITIAL_CARS = [
  makeCar(1, 0, 2.0, "#e74c3c", 2), makeCar(1, 5, 2.0, "#e74c3c", 2), makeCar(1, 10, 2.0, "#e74c3c", 2),
  makeCar(2, 3, -2.5, "#3498db", 3), makeCar(2, 9, -2.5, "#3498db", 3),
  makeCar(4, 1, 3.0, "#e67e22", 2), makeCar(4, 6, 3.0, "#e67e22", 2), makeCar(4, 11, 3.0, "#e67e22", 2),
  makeCar(5, 2, -1.8, "#9b59b6", 3), makeCar(5, 8, -1.8, "#9b59b6", 3),
  makeCar(7, 0, 2.5, "#f1c40f", 2), makeCar(7, 5, 2.5, "#f1c40f", 2), makeCar(7, 10, 2.5, "#f1c40f", 2),
  makeCar(8, 4, -3.2, "#1abc9c", 2), makeCar(8, 9, -3.2, "#1abc9c", 2), makeCar(8, 1, -3.2, "#1abc9c", 2),
]

let audioCtx = null
function playSound(freq, dur, type = "sine") {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  try {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type; osc.frequency.value = freq
    gain.gain.value = 0.2
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur / 1000)
    osc.connect(gain); gain.connect(audioCtx.destination)
    osc.start(); osc.stop(audioCtx.currentTime + dur / 1000)
  } catch (e) {}
}

export default function App() {
  const [frogX, setFrogX] = useState(6)
  const [frogY, setFrogY] = useState(ROWS - 1)
  const [cars, setCars] = useState(INITIAL_CARS.map(c => ({ ...c })))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [dead, setDead] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [hopAnim, setHopAnim] = useState(false)
  const rafRef = useRef(null)
  const prevKeysRef = useRef({})
  const keysRef = useRef({})
  const containerRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
      }
      keysRef.current[e.key] = e.type === "keydown"
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    if (containerRef.current) containerRef.current.focus()
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey) }
  }, [])

  const resetFrog = useCallback(() => {
    setFrogX(6); setFrogY(ROWS - 1); setDead(false)
  }, [])

  const resetGame = useCallback(() => {
    setFrogX(6); setFrogY(ROWS - 1); setScore(0); setLives(3)
    setDead(false); setGameOver(false)
    setCars(INITIAL_CARS.map(c => ({ ...c })))
  }, [])

  useEffect(() => {
    if (gameOver) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return }

    const loop = () => {
      setCars(prev => prev.map(c => {
        let nx = c.x + c.speed * 0.04
        if (nx > COLS + c.width) nx = -c.width
        if (nx < -c.width - 1) nx = COLS + c.width
        return { ...c, x: nx }
      }))

      const k = keysRef.current
      const pk = prevKeysRef.current
      const justPressed = (key) => k[key] && !pk[key]

      if (!dead) {
        let moved = false
        if (justPressed("ArrowUp")) { setFrogY(p => { if (p > 0) { moved = true; return p - 1 } return p }); moved = true }
        if (justPressed("ArrowDown")) { setFrogY(p => { if (p < ROWS - 1) { moved = true; return p + 1 } return p }); moved = true }
        if (justPressed("ArrowLeft")) { setFrogX(p => { if (p > 0) { moved = true; return p - 1 } return p }); moved = true }
        if (justPressed("ArrowRight")) { setFrogX(p => { if (p < COLS - 1) { moved = true; return p + 1 } return p }); moved = true }
        if (moved) {
          playSound(500, 50)
          setHopAnim(true)
          setTimeout(() => setHopAnim(false), 100)
        }
      }

      prevKeysRef.current = { ...k }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [gameOver, dead])

  useEffect(() => {
    if (dead || gameOver) return
    const rowType = ROW_TYPES[frogY]
    if (rowType === "road") {
      const rowCars = cars.filter(c => c.row === frogY)
      for (const c of rowCars) {
        const carL = c.x * CELL, carR = (c.x + c.width) * CELL
        const frogL = frogX * CELL + 6, frogR = (frogX + 1) * CELL - 6
        if (frogR > carL && frogL < carR) {
          setDead(true)
          playSound(120, 200, "sawtooth")
          setLives(prev => {
            if (prev - 1 <= 0) { setGameOver(true) }
            return prev - 1
          })
          setTimeout(resetFrog, 800)
          return
        }
      }
    }
    if (frogY === 0) {
      playSound(880, 150)
      setScore(prev => prev + 1)
      setTimeout(resetFrog, 400)
    }
  }, [frogX, frogY, cars, dead, gameOver])

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a1a0a 0%, #162016 50%, #0a1a0a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#fff", padding: "1rem",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "2rem",
        marginBottom: "0.75rem",
      }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>⭐ {score}</span>
        <span style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>🐸 Frogger</span>
        <span style={{ fontSize: "1.1rem" }}>{"❤️".repeat(Math.max(0, lives))}</span>
      </div>

      <div ref={containerRef} tabIndex={0} style={{
        width: W, height: H, position: "relative",
        borderRadius: "10px", overflow: "hidden",
        border: "3px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        outline: "none",
      }} autoFocus>
        {/* Rows */}
        {ROW_TYPES.map((type, row) => (
          <div key={row} style={{
            position: "absolute", left: 0, top: row * CELL,
            width: "100%", height: CELL,
            background: ROW_COLORS[type],
          }}>
            {type === "road" && (
              <div style={{
                position: "absolute", left: 0, top: CELL / 2 - 1,
                width: "100%", height: 2,
                background: "repeating-linear-gradient(90deg, rgba(255,255,200,0.12) 0, rgba(255,255,200,0.12) 16px, transparent 16px, transparent 32px)",
              }} />
            )}
            {type === "island" && (
              <>
                {[2, 5, 8, 11].map(ix => (
                  <div key={ix} style={{
                    position: "absolute", left: ix * CELL + 8, top: 8,
                    width: CELL - 16, height: CELL - 16,
                    background: "#2a6a3a", borderRadius: "50%", opacity: 0.5,
                  }} />
                ))}
                <div style={{
                  position: "absolute", left: "50%", top: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "rgba(255,255,255,0.2)", fontSize: "10px", fontWeight: 600,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>safe</div>
              </>
            )}
            {type === "goal" && (
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>🏠 home</div>
            )}
          </div>
        ))}

        {/* Cars */}
        {cars.map((c, i) => (
          <div key={i} style={{
            position: "absolute",
            left: c.x * CELL,
            top: c.row * CELL + 4,
            width: c.width * CELL - 4,
            height: CELL - 8,
            background: c.color,
            borderRadius: "6px",
            border: "2px solid rgba(255,255,255,0.15)",
            boxShadow: `0 2px 8px ${c.color}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>{c.emoji}</div>
        ))}

        {/* Frog */}
        <div style={{
          position: "absolute",
          left: frogX * CELL + 3,
          top: frogY * CELL + 3,
          width: CELL - 6, height: CELL - 6,
          background: dead ? "#ff4444" : "#4ade80",
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.5)",
          boxShadow: dead ? "0 0 16px rgba(255,0,0,0.5)" : "0 0 12px rgba(74,222,128,0.4)",
          transition: "left 0.1s ease-out, top 0.1s ease-out",
          transform: hopAnim ? "scale(1.15)" : "scale(1)",
          zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px",
          opacity: dead ? 0.5 : 1,
        }}>🐸</div>
      </div>

      <div style={{
        marginTop: "0.75rem", textAlign: "center",
        color: "rgba(255,255,255,0.4)", fontSize: "0.85rem",
      }}>
        {gameOver ? (
          <div>
            <div style={{ color: "#ff6b6b", fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              Game Over! Score: {score}
            </div>
            <button onClick={resetGame} style={{
              background: "#4ade80", border: "none", borderRadius: "8px",
              color: "#0a2a0a", padding: "8px 24px", fontSize: "1rem",
              fontWeight: 700, cursor: "pointer",
            }}>Play Again</button>
          </div>
        ) : (
          <span>Arrow keys to hop — one step at a time! Reach 🏠 home to score.</span>
        )}
      </div>
    </div>
  )
}
