import React, { useState, useEffect, useRef } from "react"
import { useImgGen, useFireproof } from "use-vibes"

// ── Contention config (this app: hat-smeller racer, light fanout) ───
// access.js gives the image doc (type:"image") an empty {} result; the
// immediate get races the channel/grant assignment. Two at a time keeps
// the QuickJS eval from backing up into put timeouts.
const CONFIG = {
  title: "Gallery Flood",
  slots: 2, // light fanout — enough to widen the window, not overload eval
  promptStyle: "long",
  noiseWriter: false,
  noiseEveryMs: 70,
  companionWrites: true,
}

const LONG = [
  "An ornate baroque still life of a towering thundercloud hat woven from spun cloud-silk and iridescent butterfly scales, miniature lightning crackling between its layered folds, painterly chiaroscuro, museum lighting, ultra detailed",
  "A sprawling cyberpunk night market drenched in neon rain, hundreds of paper lanterns, reflective puddles, dense atmospheric fog, volumetric light shafts, intricate signage, cinematic wide shot, hyper detailed",
  "A colossal mechanical whale drifting through a sky of golden cumulus clouds, brass rivets and stained-glass fins catching sunset light, steampunk filigree, epic scale, richly detailed concept art",
  "An enchanted overgrown library where bioluminescent vines spiral around marble columns, floating candle-lit books, shafts of dusty light, mossy stone, deep shadows, fantasy illustration, intricate detail",
  "A surreal desert of mirrored dunes under a double moon, a lone traveler in flowing robes casting long shadows, glassy reflections, fine sand texture, dramatic horizon, highly detailed matte painting",
  "A grand underwater cathedral of coral and pearl, schools of luminous fish weaving through arches, god-rays piercing turquoise water, delicate calcified tracery, serene and vast, ultra detailed",
]

const BATCHES = 6 // auto-run this many batches per click to sample the rare race

export default function ImgRaceApp() {
  const [runId, setRunId] = useState(null)
  const [batch, setBatch] = useState(0)
  const [results, setResults] = useState({})
  const totalsRef = useRef({ race: 0, ok: 0, err: 0 })
  const { database: noiseDb } = useFireproof("noise-db")
  const active = runId !== null
  const running = active && Object.keys(results).length < CONFIG.slots

  // Noise writer: keep writing padding docs to a separate db on the same DO
  // for the whole generation window, so other writes land exactly when the
  // image-doc put/get happens.
  useEffect(() => {
    if (!running || !CONFIG.noiseWriter) return
    let n = 0
    const t = setInterval(() => {
      noiseDb
        .put({ _id: `noise-${runId}-${n++}`, type: "noise", payload: "x".repeat(2500), created: Date.now() })
        .catch(() => {})
    }, CONFIG.noiseEveryMs)
    return () => clearInterval(t)
  }, [running, runId, noiseDb])

  const onDone = (idx, status, message) =>
    setResults((p) => (p[idx] ? p : { ...p, [idx]: { status, message } }))

  function run() {
    console.log(`[IMGTEST] ===== ${CONFIG.title} START batches=${BATCHES} slots=${CONFIG.slots} =====`)
    totalsRef.current = { race: 0, ok: 0, err: 0 }
    setBatch(0)
    setResults({})
    setRunId(Date.now())
  }

  // When a batch finishes, tally it and either start the next batch or stop.
  useEffect(() => {
    if (!active || Object.keys(results).length !== CONFIG.slots) return
    const race = Object.values(results).filter((r) => r.status === "race").length
    const ok = Object.values(results).filter((r) => r.status === "ok").length
    const err = Object.values(results).filter((r) => r.status === "err").length
    totalsRef.current.race += race
    totalsRef.current.ok += ok
    totalsRef.current.err += err
    console.log(`[IMGTEST] batch ${batch} race=${race} ok=${ok} err=${err}`)
    if (batch + 1 < BATCHES) {
      setBatch((b) => b + 1)
      setResults({})
      setRunId(Date.now())
    } else {
      const t = totalsRef.current
      console.log(`[IMGTEST] ===== ${CONFIG.title} DONE total race=${t.race} ok=${t.ok} err=${t.err} =====`)
      setRunId(null)
    }
  }, [results, active, batch])

  return (
    <div style={{ fontFamily: "monospace", padding: 24, background: "#0f0f23", minHeight: "100vh", color: "#e0e0e0" }}>
      <h1 style={{ color: "#ff5577" }}>{CONFIG.title} — imgGen racer</h1>
      <p style={{ color: "#888", fontSize: 13 }}>
        {CONFIG.slots} concurrent generations × {BATCHES} batches, long prompts, write-noise on the same AppSessions DO
        during the image puts. Watches each slot for "Failed to get document: not-found" (the race).
      </p>
      <button
        onClick={run}
        disabled={active}
        style={{
          padding: "12px 24px", fontSize: 16, fontWeight: "bold",
          background: active ? "#333" : "#ff5577", color: "#0f0f23",
          border: "none", borderRadius: 8, cursor: active ? "wait" : "pointer", margin: "12px 0 20px",
        }}
      >
        {active ? `Batch ${batch + 1}/${BATCHES}…` : "Run Storm"}
      </button>

      {active &&
        Array.from({ length: CONFIG.slots }).map((_, idx) => (
          <Slot key={`${runId}-${idx}`} runId={runId} idx={idx} onDone={onDone} result={results[idx]} />
        ))}
    </div>
  )
}

function Slot({ runId, idx, onDone, result }) {
  const _id = `img-${runId}-${idx}`
  const prompt = `${LONG[idx % LONG.length]} — run ${runId}`
  const { database: parentDb } = useFireproof("parents-db")
  const companionRef = useRef(false)

  useEffect(() => {
    if (CONFIG.companionWrites && !companionRef.current) {
      companionRef.current = true
      // type:"hat" so access.js grants channels:["cabinet"] (owner write),
      // exactly like the real hat doc that precedes each image.
      parentDb
        .put({ _id: `hat-${runId}-${idx}`, type: "hat", name: "Flood Hat", material: "neon rain", description: "a cyberpunk market hat", created: Date.now() })
        .catch(() => {})
    }
  }, [parentDb])

  const { loading, progress, error, document } = useImgGen({ _id, prompt, database: "ImgGen" })
  const reportedRef = useRef(false)

  useEffect(() => {
    if (reportedRef.current) return
    if (error) {
      reportedRef.current = true
      const raced = /Failed to get document|not-found/i.test(error.message || "")
      console.log(`[IMGTEST] ${raced ? "RACE" : "ERR"} slot${idx}: ${(error.message || "").slice(0, 160)}`)
      onDone(idx, raced ? "race" : "err", error.message)
    } else if (document && !loading && progress === 100) {
      reportedRef.current = true
      console.log(`[IMGTEST] OK slot${idx}`)
      onDone(idx, "ok")
    }
  }, [error, document, loading, progress, idx, onDone])

  const color = result?.status === "race" ? "#ff5577" : result?.status === "ok" ? "#22c55e" : result?.status === "err" ? "#f59e0b" : "#555"
  return (
    <div style={{ padding: "8px 12px", marginBottom: 6, border: `2px solid ${color}`, borderRadius: 6, background: "#1a1a2e" }}>
      slot {idx}: {result ? result.status.toUpperCase() : `generating… ${progress}%`}
      {result?.message ? <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{result.message.slice(0, 160)}</div> : null}
    </div>
  )
}
