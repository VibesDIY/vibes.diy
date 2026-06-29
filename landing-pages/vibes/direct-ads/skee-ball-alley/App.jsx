const _jsxFileName = "";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime"; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import React from "react"
import * as THREE from "three"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function GameCanvas({ canvasRef, c, ballsLeft, gameOver, onScore }) {
  const stateRef = React.useRef(null)
  const ballsLeftRef = React.useRef(ballsLeft)
  const gameOverRef = React.useRef(gameOver)
  React.useEffect(() => { ballsLeftRef.current = ballsLeft }, [ballsLeft])
  React.useEffect(() => { gameOverRef.current = gameOver }, [gameOver])

  React.useEffect(() => {
    const container = canvasRef.current
    if (!container) return
    const w = container.clientWidth, h = container.clientHeight
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a0520)
    scene.fog = new THREE.Fog(0x1a0520, 8, 25)
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
    camera.position.set(0, 4.5, 6.5)
    camera.lookAt(0, 1, -3)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.innerHTML = ""
    container.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xff5bad, 0.4))
    const pink = new THREE.PointLight(0xf93c94, 1.5, 20); pink.position.set(-3, 5, 2); scene.add(pink)
    const cyan = new THREE.PointLight(0x00f0ff, 1.5, 20); cyan.position.set(3, 5, 2); scene.add(cyan)
    const yellow = new THREE.PointLight(0xfcee0a, 1, 15); yellow.position.set(0, 4, -6); scene.add(yellow)

    // Ramp (tilted plane)
    const rampLen = 10, rampWid = 3
    const rampAngle = Math.PI / 9
    const ramp = new THREE.Mesh(
      new THREE.PlaneGeometry(rampWid, rampLen),
      new THREE.MeshStandardMaterial({ color: 0x4d1558, roughness: 0.6 })
    )
    ramp.rotation.x = -Math.PI / 2 + rampAngle
    ramp.position.set(0, Math.sin(rampAngle) * rampLen / 2, -Math.cos(rampAngle) * rampLen / 2)
    scene.add(ramp)

    // Side walls
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.4, rampLen),
        new THREE.MeshStandardMaterial({ color: 0xf93c94, emissive: 0xf93c94, emissiveIntensity: 0.3 })
      )
      wall.rotation.x = rampAngle
      wall.position.set(sx * rampWid / 2, Math.sin(rampAngle) * rampLen / 2 + 0.2 * Math.cos(rampAngle), -Math.cos(rampAngle) * rampLen / 2)
      scene.add(wall)
    }

    // Scoring rings at top of ramp (flat circular target)
    const ringGroup = new THREE.Group()
    const topY = Math.sin(rampAngle) * rampLen + 0.05
    const topZ = -Math.cos(rampAngle) * rampLen
    ringGroup.position.set(0, topY, topZ - 0.5)
    ringGroup.rotation.x = -Math.PI / 2
    const ringDefs = [
      { r: 0.3, pts: 100, color: 0xfcee0a },
      { r: 0.6, pts: 50, color: 0xf93c94 },
      { r: 0.95, pts: 30, color: 0x00f0ff },
      { r: 1.3, pts: 10, color: 0xff5bad },
    ]
    ringDefs.forEach((r, i) => {
      const innerR = i === 0 ? 0 : ringDefs[i - 1].r
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(innerR, r.r, 32),
        new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: 0.5, side: THREE.DoubleSide })
      )
      ringGroup.add(mesh)
    })
    scene.add(ringGroup)

    const balls = []
    const ballGeo = new THREE.SphereGeometry(0.2, 16, 16)
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xfcee0a, emissive: 0xfcee0a, emissiveIntensity: 0.4, roughness: 0.3 })

    // Aim ball at bottom of ramp
    const aimBall = new THREE.Mesh(ballGeo, ballMat)
    const startY = 0.2, startZ = 0.5
    aimBall.position.set(0, startY, startZ)
    scene.add(aimBall)

    const aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)]),
      new THREE.LineBasicMaterial({ color: 0x00f0ff })
    )
    aimLine.visible = false
    scene.add(aimLine)

    stateRef.current = { scene, camera, renderer, balls, aimBall, aimLine, ringGroup, ringDefs, topY, topZ, rampAngle, rampLen, rampWid }

    let raf
    const clock = new THREE.Clock()
    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      // Physics for rolling balls
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        b.vel.y -= 9.8 * dt * 0.4 // gravity reduced
        // Ramp constraint: while on ramp (z < 0), keep ball on ramp surface
        b.mesh.position.x += b.vel.x * dt
        b.mesh.position.y += b.vel.y * dt
        b.mesh.position.z += b.vel.z * dt
        // Clamp to ramp surface if rolling up
        if (b.mesh.position.z < 0.5 && b.mesh.position.z > topZ) {
          const t = (0.5 - b.mesh.position.z) / (0.5 - topZ)
          const surfaceY = startY + (topY - startY) * Math.max(0, Math.min(1, t))
          if (b.mesh.position.y < surfaceY) {
            b.mesh.position.y = surfaceY
            b.vel.y = 0
          }
          // friction
          b.vel.x *= 0.99
          b.vel.z *= 0.995
        }
        // Wall bounce
        if (Math.abs(b.mesh.position.x) > rampWid / 2 - 0.2) {
          b.mesh.position.x = Math.sign(b.mesh.position.x) * (rampWid / 2 - 0.2)
          b.vel.x *= -0.6
        }
        // Spin
        b.mesh.rotation.x += b.vel.z * dt * 5
        b.mesh.rotation.z -= b.vel.x * dt * 5

        // Check scoring: ball reached top zone
        if (!b.scored && b.mesh.position.z < topZ + 0.3) {
          b.scored = true
          const dx = b.mesh.position.x
          const dy_target = topY - b.mesh.position.y
          const dist = Math.sqrt(dx*dx)
          let pts = 0
          for (const rd of ringDefs) {
            if (dist <= rd.r) { pts = rd.pts; break }
          }
          // Flash ring group
          ringGroup.children.forEach(m => { m.material.emissiveIntensity = 1.2 })
          setTimeout(() => ringGroup.children.forEach(m => { m.material.emissiveIntensity = 0.5 }), 300)
          onScore(pts)
        }
        // Cleanup
        if (b.mesh.position.z < topZ - 1 || b.mesh.position.y < -2 || b.mesh.position.z > 3) {
          scene.remove(b.mesh)
          balls.splice(i, 1)
        }
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    // Drag handling
    let dragStart = null
    const getPt = (e) => {
      const t = e.touches ? e.touches[0] : e
      const rect = renderer.domElement.getBoundingClientRect()
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    const onDown = (e) => {
      if (ballsLeftRef.current <= 0 || gameOverRef.current) return
      e.preventDefault()
      dragStart = getPt(e)
      aimLine.visible = true
    }
    const onMove = (e) => {
      if (!dragStart) return
      e.preventDefault()
      const p = getPt(e)
      const dx = (p.x - dragStart.x) / w * 4
      const dy = (dragStart.y - p.y) / h * 4
      aimBall.position.x = Math.max(-1.2, Math.min(1.2, dx * 0.5))
      const pts = [
        new THREE.Vector3(aimBall.position.x, aimBall.position.y, aimBall.position.z),
        new THREE.Vector3(aimBall.position.x, aimBall.position.y + dy * 0.3, aimBall.position.z - dy),
      ]
      aimLine.geometry.setFromPoints(pts)
    }
    const onUp = (e) => {
      if (!dragStart) return
      e.preventDefault()
      const p = getPt(e)
      const dy = (dragStart.y - p.y) / h
      aimLine.visible = false
      if (dy > 0.05) {
        // Launch ball
        const power = Math.min(dy * 12, 10)
        const ball = new THREE.Mesh(ballGeo, ballMat.clone())
        ball.position.copy(aimBall.position)
        const vel = new THREE.Vector3(
          (aimBall.position.x) * -0.3,
          power * Math.sin(rampAngle) * 0.6,
          -power * Math.cos(rampAngle)
        )
        balls.push({ mesh: ball, vel, scored: false })
        scene.add(ball)
        // Reset aim ball
        aimBall.position.set(0, startY, startZ)
      }
      dragStart = null
    }
    const el = renderer.domElement
    el.addEventListener("mousedown", onDown)
    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseup", onUp)
    el.addEventListener("mouseleave", onUp)
    el.addEventListener("touchstart", onDown, { passive: false })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onUp, { passive: false })

    const onResize = () => {
      const nw = container.clientWidth, nh = container.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      el.removeEventListener("mousedown", onDown)
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseup", onUp)
      el.removeEventListener("mouseleave", onUp)
      el.removeEventListener("touchstart", onDown)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onUp)
      renderer.dispose()
      container.innerHTML = ""
    }
  }, [canvasRef, onScore])

  return (
    _jsxDEV('section', { id: "game-canvas", className: c.section, children: [
      _jsxDEV('h2', { className: c.h2, children: ["Lane " , gameOver && "— GAME OVER"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 239}, this)
      , _jsxDEV('div', { ref: canvasRef, className: c.canvas,}, void 0, false, {fileName: _jsxFileName, lineNumber: 240}, this )
      , _jsxDEV('p', { className: "text-sm text-[#00f0ff] mt-2 font-mono"   , children:
        gameOver ? "Tap New Game below" : "Drag up the ramp. Release to roll."
      }, void 0, false, {fileName: _jsxFileName, lineNumber: 241}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 238}, this)
  )
}

export default function App() {
  const { viewer, can } = useViewer()
  const { database, useLiveQuery } = useFireproof("neon-skeeball")
  const canvasRef = React.useRef(null)
  const gameRef = React.useRef({ balls: [], score: 0, ballsLeft: 9 })
  const [score, setScore] = React.useState(0)
  const [ballsLeft, setBallsLeft] = React.useState(9)
  const [lastRoll, setLastRoll] = React.useState(null)
  const [gameOver, setGameOver] = React.useState(false)
  const { docs: scores } = useLiveQuery("score", { descending: true, limit: 10 })

  const newGame = () => {
    setScore(0); setBallsLeft(9); setLastRoll(null); setGameOver(false)
    gameRef.current.score = 0; gameRef.current.ballsLeft = 9
  }

  const finalizeGame = React.useCallback(async (finalScore) => {
    if (!can("write")) return
    await database.put({
      score: finalScore,
      playerName: _optionalChain([viewer, 'optionalAccess', _ => _.displayName]) || _optionalChain([viewer, 'optionalAccess', _2 => _2.userSlug]) || "Anon",
      userSlug: _optionalChain([viewer, 'optionalAccess', _3 => _3.userSlug]) || null,
      avatarUrl: _optionalChain([viewer, 'optionalAccess', _4 => _4.avatarUrl]) || null,
      createdAt: Date.now(),
    })
  }, [database, viewer, can])

  const c = {
    page: "min-h-screen text-[#2a0a2e]",
    pageBg: {
      backgroundImage: `linear-gradient(rgba(42,5,46,0.75), rgba(42,5,46,0.65)), url('https://images.unsplash.com/photo-1533542632746-8e3f6f06bec6?w=1920&q=80&fit=crop')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    },
    header: "sticky top-0 z-10 bg-[#2a0a2e] text-[#fcee0a] px-4 py-3 shadow-lg border-b-4 border-[#f93c94]",
    title: "text-2xl font-bold tracking-wider",
    tagline: "text-sm text-[#00f0ff] font-mono",
    main: "max-w-3xl mx-auto p-5 space-y-5 pb-24",
    section: "bg-[#2a0a2e]/90 backdrop-blur rounded-xl p-5 border-2 border-[#f93c94] shadow-xl text-[#ffffff]",
    h2: "text-[1.4rem] font-bold text-[#fcee0a] mb-3 tracking-wide uppercase",
    btn: "min-h-[44px] px-6 py-3 text-base bg-[#f93c94] text-white font-bold rounded-lg shadow-lg active:scale-95 transition disabled:opacity-50 uppercase tracking-wide",
    btnAlt: "min-h-[44px] px-6 py-3 text-base bg-[#00f0ff] text-[#2a0a2e] font-bold rounded-lg shadow-lg active:scale-95 transition uppercase tracking-wide",
    canvas: "w-full aspect-[3/4] bg-[#1a0520] rounded-lg border-2 border-[#00f0ff] touch-none",
    score: "text-4xl font-bold text-[#fcee0a] font-mono",
    label: "text-sm uppercase tracking-widest text-[#00f0ff]",
    row: "flex items-center justify-between py-2 border-b border-[#4d1558] last:border-0",
    rank: "text-[#fcee0a] font-bold font-mono w-8",
    name: "flex-1 text-white",
    pts: "text-[#f93c94] font-bold font-mono",
  }

  return (
    _jsxDEV('div', { className: c.page, style: c.pageBg, children: [
      _jsxDEV('div', { style: {
        position: 'relative',
        minHeight: '60vh',
        backgroundImage: `linear-gradient(rgba(42,5,46,0.55), rgba(42,5,46,0.85)), url('https://images.unsplash.com/photo-1533542632746-8e3f6f06bec6?w=1920&q=80&fit=crop')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '2rem 1.5rem',
        borderBottom: '4px solid #f93c94',
      }, children: [
        _jsxDEV('p', { style: {
          fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: '#00f0ff', marginBottom: '0.75rem', fontFamily: 'monospace',
        }, children: "◢ NEON SKEE-BALL ◣"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 297}, this)
        , _jsxDEV('h1', { style: {
          fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 900, lineHeight: 1.0,
          color: '#fcee0a', textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(252,238,10,0.5), 0 0 80px rgba(249,60,148,0.3)',
          margin: '0 0 1rem',
        }, children: "Step right up." }, void 0, false, {fileName: _jsxFileName, lineNumber: 301}, this)
        , _jsxDEV('p', { style: {
          fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', color: '#ffffff', opacity: 0.85,
          maxWidth: '500px', lineHeight: 1.5, marginBottom: '1.5rem',
        }, children: "Classic skee-ball. Play it right now — no quarters needed."         }, void 0, false, {fileName: _jsxFileName, lineNumber: 306}, this)
        , _jsxDEV('a', { href: "#game-canvas", style: {
          display: 'inline-block', padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 800,
          background: '#f93c94', color: '#fff', borderRadius: '12px', textDecoration: 'none',
          letterSpacing: '0.05em', textTransform: 'uppercase',
          boxShadow: '0 4px 20px rgba(249,60,148,0.4)',
        }, children: "Roll one" }, void 0, false, {fileName: _jsxFileName, lineNumber: 310}, this)
        , _jsxDEV('div', { style: {
          position: 'absolute', bottom: '0.75rem', right: '1rem',
          fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }, children: [
          "Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@gothicrabbit?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Chris Chatham"}, void 0, false, {fileName: _jsxFileName}, this),
          " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral",
            style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' },
            target: "_blank", rel: "noopener noreferrer", children: "Unsplash"}, void 0, false, {fileName: _jsxFileName}, this)
        ]}, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 296}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV(GameCanvas, {
          canvasRef: canvasRef,
          c: c,
          ballsLeft: ballsLeft,
          gameOver: gameOver,
          onScore: (pts) => {
            setLastRoll(pts)
            setScore((s) => {
              const ns = s + pts
              const newLeft = ballsLeft - 1
              setBallsLeft(newLeft)
              if (newLeft <= 0) {
                setGameOver(true)
                finalizeGame(ns)
              }
              return ns
            })
          },}, void 0, false, {fileName: _jsxFileName, lineNumber: 301}, this
        )
        , _jsxDEV('section', { id: "score-panel", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "This Game" }, void 0, false, {fileName: _jsxFileName, lineNumber: 321}, this)
          , _jsxDEV('div', { className: "flex items-center justify-between"  , children: [
            _jsxDEV('div', { children: [
              _jsxDEV('p', { className: c.label, children: "Score"}, void 0, false, {fileName: _jsxFileName, lineNumber: 324}, this)
              , _jsxDEV('p', { className: c.score, children: score}, void 0, false, {fileName: _jsxFileName, lineNumber: 325}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 323}, this)
            , _jsxDEV('div', { children: [
              _jsxDEV('p', { className: c.label, children: "Balls Left" }, void 0, false, {fileName: _jsxFileName, lineNumber: 328}, this)
              , _jsxDEV('p', { className: c.score, children: ballsLeft}, void 0, false, {fileName: _jsxFileName, lineNumber: 329}, this)
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 327}, this)
            , _jsxDEV('button', { className: c.btnAlt, onClick: newGame, children: "New Game" }, void 0, false, {fileName: _jsxFileName, lineNumber: 331}, this)
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 322}, this)
          , _jsxDEV('p', { className: "text-sm text-[#00f0ff] mt-3 font-mono"   , children: ["Last roll: "
              , lastRoll === null ? "—" : `${lastRoll} pts`
            , gameOver && " · GAME OVER — score posted!"
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 333}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 320}, this)
        , _jsxDEV('section', { id: "leaderboard", className: c.section, children: [
          _jsxDEV('h2', { className: c.h2, children: "High Scores" }, void 0, false, {fileName: _jsxFileName, lineNumber: 339}, this)
          , scores.length === 0 ? (
            _jsxDEV('p', { className: "text-[#00f0ff] font-mono text-base"  , children: "No scores yet — be the first!"      }, void 0, false, {fileName: _jsxFileName, lineNumber: 341}, this)
          ) : (
            _jsxDEV('ul', { children: 
              scores.map((s, i) => (
                _jsxDEV('li', { className: c.row, children: [
                  _jsxDEV('span', { className: c.rank, children: ["#", i + 1]}, void 0, true, {fileName: _jsxFileName, lineNumber: 346}, this)
                  , _jsxDEV('span', { className: c.name, children: s.playerName || "Anon"}, void 0, false, {fileName: _jsxFileName, lineNumber: 347}, this)
                  , _jsxDEV('span', { className: c.pts, children: s.score}, void 0, false, {fileName: _jsxFileName, lineNumber: 348}, this)
                ]}, s._id, true, {fileName: _jsxFileName, lineNumber: 345}, this)
              ))
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 343}, this)
          )
          , _jsxDEV('p', { className: "text-sm text-[#00f0ff] mt-3 font-mono"   , children: "Live-synced across all players."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 353}, this)
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 338}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 300}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 295}, this)
  )
}