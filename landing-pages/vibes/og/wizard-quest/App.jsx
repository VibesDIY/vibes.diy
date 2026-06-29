import React, { useState, useRef, useEffect, useCallback } from "react"
import { callAI } from "call-ai"

const CELL = 40, COLS = 16, ROWS = 12
const W = COLS * CELL, H = ROWS * CELL

const TERRAIN = [
  "TTTTTTTTTTTTTTTT",
  "T..T....T..T...T",
  "T.............TT",
  "TT..T....T.....T",
  "T.....T........T",
  "T..T.......T...T",
  "T......T.......T",
  "T...T......T...T",
  "T..........T...T",
  "T.T....T.......T",
  "T..............TT",
  "TTTTTTTTTTTTTTTT",
]

const NPCS = [
  { id: "sage", name: "Forest Sage", emoji: "🧙", color: "#9b59b6", x: 4, y: 2,
    persona: "You are the Forest Sage, an ancient wizard. You speak wisely about the Crystal of Light hidden in the north. Give mysterious hints. Max 2 sentences." },
  { id: "storm", name: "Storm Mage", emoji: "⚡", color: "#3498db", x: 11, y: 5,
    persona: "You are the Storm Mage. You speak in riddles about thunder and lightning. Always include a weather pun. Max 2 sentences." },
  { id: "shadow", name: "Shadow Keeper", emoji: "🌑", color: "#e74c3c", x: 7, y: 8,
    persona: "You are the Shadow Keeper, guardian of dark secrets. You are cryptic and slightly menacing but ultimately helpful. Max 2 sentences." },
  { id: "crystal", name: "Crystal Spirit", emoji: "💎", color: "#f1c40f", x: 13, y: 2,
    persona: "You are the Crystal Spirit. You glow with joy when found. Congratulate the player warmly. Max 1 sentence." },
]

const DIALOG_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string", description: "The NPC's spoken dialog" }
  },
  required: ["message"]
}

let audioCtx = null
function playSound(freq, dur, type = "sine") {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  try {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type; osc.frequency.value = freq
    gain.gain.value = 0.15
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur / 1000)
    osc.connect(gain); gain.connect(audioCtx.destination)
    osc.start(); osc.stop(audioCtx.currentTime + dur / 1000)
  } catch (e) {}
}

function DialogBox({ npc, message, loading, onClose }) {
  return (
    <div style={{
      position: "absolute", bottom: 12, left: 12, right: 12,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      borderRadius: "12px", padding: "16px 20px",
      border: `2px solid ${npc.color}44`,
      zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <span style={{ fontSize: "24px" }}>{npc.emoji}</span>
        <span style={{ color: npc.color, fontWeight: 700, fontSize: "14px" }}>{npc.name}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "6px", color: "#aaa", padding: "2px 10px", cursor: "pointer", fontSize: "12px",
        }}>×</button>
      </div>
      <p style={{
        color: "#e0e0e0", fontSize: "13px", lineHeight: 1.5, margin: 0,
        fontStyle: loading ? "italic" : "normal",
      }}>
        {loading ? "The wizard ponders..." : (message || "...")}
      </p>
    </div>
  )
}

export default function App() {
  const [playerX, setPlayerX] = useState(2)
  const [playerY, setPlayerY] = useState(9)
  const [facing, setFacing] = useState("down")
  const [dialog, setDialog] = useState(null)
  const [dialogMsg, setDialogMsg] = useState("")
  const [loading, setLoading] = useState(false)
  const [visited, setVisited] = useState(new Set())
  const [hopAnim, setHopAnim] = useState(false)
  const keysRef = useRef({})
  const prevKeysRef = useRef({})
  const rafRef = useRef(null)
  const containerRef = useRef(null)
  const cooldownRef = useRef(0)

  const isWalkable = (x, y) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false
    return TERRAIN[y][x] === "."
  }

  useEffect(() => {
    const onKey = (e) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape"].includes(e.key)) e.preventDefault()
      keysRef.current[e.key] = e.type === "keydown"
      if (e.key === "Escape" && e.type === "keydown") setDialog(null)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    if (containerRef.current) containerRef.current.focus()
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey) }
  }, [])

  const talkToNPC = useCallback(async (npc) => {
    if (loading) return
    setDialog(npc)
    setDialogMsg("")
    setLoading(true)
    playSound(660, 100)
    try {
      const result = await callAI(npc.persona, { schema: DIALOG_SCHEMA })
      const parsed = typeof result === "string" ? JSON.parse(result) : result
      setDialogMsg(parsed.message || parsed.toString())
      setVisited(prev => new Set([...prev, npc.id]))
    } catch (e) {
      setDialogMsg("*the wizard's words fade into silence*")
    }
    setLoading(false)
  }, [loading])

  useEffect(() => {
    const loop = (now) => {
      if (!dialog) {
        const k = keysRef.current
        const pk = prevKeysRef.current
        const justPressed = (key) => k[key] && !pk[key]

        let dx = 0, dy = 0
        if (justPressed("ArrowUp")) { dy = -1; setFacing("up") }
        if (justPressed("ArrowDown")) { dy = 1; setFacing("down") }
        if (justPressed("ArrowLeft")) { dx = -1; setFacing("left") }
        if (justPressed("ArrowRight")) { dx = 1; setFacing("right") }

        if (dx || dy) {
          setPlayerX(prev => {
            const nx = prev + dx
            return isWalkable(nx, playerY + dy) ? nx : prev
          })
          setPlayerY(prev => {
            const ny = prev + dy
            return isWalkable(playerX + dx, ny) ? ny : prev
          })
          playSound(400, 40)
          setHopAnim(true)
          setTimeout(() => setHopAnim(false), 80)
        }

        const npc = NPCS.find(n => Math.abs(n.x - playerX) <= 1 && Math.abs(n.y - playerY) <= 1 && n.x !== playerX || n.y !== playerY)
        if (justPressed(" ") || justPressed("Enter")) {
          const adjacent = NPCS.find(n =>
            (Math.abs(n.x - playerX) + Math.abs(n.y - playerY)) === 1
          )
          if (adjacent && now - cooldownRef.current > 2000) {
            cooldownRef.current = now
            talkToNPC(adjacent)
          }
        }
      }

      prevKeysRef.current = { ...keysRef.current }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playerX, playerY, dialog, loading])

  const FACE_EMOJI = { up: "🧝", down: "🧝", left: "🧝", right: "🧝" }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0a1a 0%, #1a1a2a 50%, #0a0a1a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#fff", padding: "1rem",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "1.5rem",
        marginBottom: "0.75rem",
      }}>
        <span style={{ fontSize: "1.5rem", fontWeight: 900 }}>🗡️ Wizard Quest</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
          {visited.size}/{NPCS.length} wizards found
        </span>
      </div>

      <div ref={containerRef} tabIndex={0} style={{
        width: W, height: H, position: "relative",
        borderRadius: "10px", overflow: "hidden",
        border: "3px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        outline: "none", background: "#1a2a1a",
      }} autoFocus>
        {/* Terrain */}
        {TERRAIN.map((row, y) => row.split("").map((cell, x) => (
          <div key={`${x}-${y}`} style={{
            position: "absolute", left: x * CELL, top: y * CELL,
            width: CELL, height: CELL,
            background: cell === "T" ? "#0a1a0a" : "#1a3a1a",
            borderRight: cell === "T" ? "1px solid #0a2a0a" : "none",
            borderBottom: cell === "T" ? "1px solid #0a2a0a" : "none",
          }}>
            {cell === "T" && (
              <span style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "20px", opacity: 0.6,
              }}>🌲</span>
            )}
            {cell === "." && Math.random() > 0.92 && (
              <span style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "10px", opacity: 0.3,
              }}>🌿</span>
            )}
          </div>
        )))}

        {/* NPCs */}
        {NPCS.map(npc => (
          <div key={npc.id} style={{
            position: "absolute",
            left: npc.x * CELL + 2, top: npc.y * CELL + 2,
            width: CELL - 4, height: CELL - 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", zIndex: 5,
            filter: visited.has(npc.id) ? "none" : "drop-shadow(0 0 8px rgba(255,255,100,0.6))",
            animation: dialog?.id === npc.id ? "none" : "npc-bob 2s ease-in-out infinite",
          }}>
            {npc.emoji}
            {!visited.has(npc.id) && (
              <div style={{
                position: "absolute", top: -8,
                width: 6, height: 6, borderRadius: "50%",
                background: "#ffd700",
                animation: "npc-bob 1s ease-in-out infinite",
              }} />
            )}
          </div>
        ))}

        {/* Player */}
        <div style={{
          position: "absolute",
          left: playerX * CELL + 2, top: playerY * CELL + 2,
          width: CELL - 4, height: CELL - 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", zIndex: 10,
          transition: "left 0.1s ease-out, top 0.1s ease-out",
          transform: hopAnim ? "scale(1.15)" : "scale(1)",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        }}>🧝</div>

        {/* Dialog */}
        {dialog && (
          <DialogBox npc={dialog} message={dialogMsg} loading={loading} onClose={() => setDialog(null)} />
        )}

        <style>{`
          @keyframes npc-bob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
        `}</style>
      </div>

      <div style={{
        marginTop: "0.75rem", textAlign: "center",
        color: "rgba(255,255,255,0.4)", fontSize: "0.85rem",
      }}>
        Arrow keys to move — walk next to a wizard and press Space to talk
      </div>
    </div>
  )
}
