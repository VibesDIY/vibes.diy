import React, { useState } from "react"
import { useFireproof } from "use-vibes"

export default function D1ReplicaLagTest() {
  const { database: db1 } = useFireproof("lag-db-1")
  const { database: db2 } = useFireproof("lag-db-2")
  const { database: db3 } = useFireproof("lag-db-3")
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)

  const add = (r) => {
    // Mirror every result to the console so a driver can read results via
    // the DevTools console instead of screenshotting the DOM.
    console.log(`[D1TEST] ${r.pass ? "PASS" : "FAIL"} ${r.test} ${JSON.stringify(
      Object.fromEntries(Object.entries(r).filter(([k]) => k !== "test" && k !== "pass"))
    )}`)
    setResults((p) => [...p, r])
  }

  // 1x1 transparent PNG as a real Blob. Putting this in _files makes the
  // runtime do a genuine putAsset round-trip and mint a REAL uploadId —
  // faithfully recreating the hat-smeller image-doc path (the fake-uploadId
  // version gets rejected at put validation and never tests the get).
  function tinyPngBlob() {
    const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: "image/png" })
  }

  async function runTest() {
    setRunning(true)
    setResults([])
    const run = Date.now()
    console.log("[D1TEST] ===== START =====")

    // Test A: single put → get (baseline, should pass)
    try {
      const idA = `single-${run}`
      const t0 = performance.now()
      await db1.put({ _id: idA, type: "test", value: "baseline" })
      const t1 = performance.now()
      const doc = await db1.get(idA)
      const t2 = performance.now()
      add({
        test: "A: single put → get",
        pass: !!doc,
        putMs: (t1 - t0).toFixed(0),
        getMs: (t2 - t1).toFixed(0),
      })
    } catch (e) {
      add({ test: "A: single put → get", pass: false, error: e.message })
    }

    // Test B: burst writes to multiple DBs, then get last write
    // Simulates hat-smeller: hat doc (db1) + image doc (db2) landing close together
    try {
      const ids = []
      const t0 = performance.now()
      for (let i = 0; i < 5; i++) {
        const id = `burst-${run}-${i}`
        ids.push(id)
        await db1.put({ _id: id, type: "test", value: `burst-${i}`, padding: "x".repeat(2000) })
      }
      const tMid = performance.now()
      // Now put to a DIFFERENT db (like ImgGen uses "ImgGen" db while hat uses "hatSmeller")
      const imgId = `img-${run}`
      await db2.put({ _id: imgId, type: "image", value: "image-doc", padding: "x".repeat(3000) })
      const tPut = performance.now()
      // Immediate get on the second db
      const doc = await db2.get(imgId)
      const tGet = performance.now()
      add({
        test: "B: 5 puts db1 + 1 put db2 → get db2",
        pass: !!doc,
        burstMs: (tMid - t0).toFixed(0),
        imgPutMs: (tPut - tMid).toFixed(0),
        imgGetMs: (tGet - tPut).toFixed(0),
      })
    } catch (e) {
      add({ test: "B: 5 puts db1 + 1 put db2 → get db2", pass: false, error: e.message })
    }

    // Test C: concurrent puts to 3 DBs, then get each
    // Maximum write contention on the same DO
    try {
      const t0 = performance.now()
      const id1 = `concurrent-1-${run}`
      const id2 = `concurrent-2-${run}`
      const id3 = `concurrent-3-${run}`
      // Fire all three puts concurrently
      await Promise.all([
        db1.put({ _id: id1, type: "test", value: "c1", padding: "x".repeat(2000) }),
        db2.put({ _id: id2, type: "test", value: "c2", padding: "x".repeat(2000) }),
        db3.put({ _id: id3, type: "test", value: "c3", padding: "x".repeat(2000) }),
      ])
      const tPut = performance.now()
      // Immediately get all three
      const results = await Promise.allSettled([
        db1.get(id1),
        db2.get(id2),
        db3.get(id3),
      ])
      const tGet = performance.now()
      const found = results.filter((r) => r.status === "fulfilled").length
      const missing = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message?.slice(0, 80))
      add({
        test: "C: 3 concurrent puts → 3 gets",
        pass: found === 3,
        found: `${found}/3`,
        putMs: (tPut - t0).toFixed(0),
        getMs: (tGet - tPut).toFixed(0),
        missing: missing.length ? missing : undefined,
      })
    } catch (e) {
      add({ test: "C: 3 concurrent puts → 3 gets", pass: false, error: e.message })
    }

    // Test D: rapid fire — put to db1, put to db2, immediately get db1
    // The db2 write creates D1 contention between the db1 put and db1 get
    try {
      const t0 = performance.now()
      const target = `target-${run}`
      await db1.put({ _id: target, type: "test", value: "target", padding: "x".repeat(3000) })
      const t1 = performance.now()
      // Interleave a write to db2 before reading db1
      await db2.put({ _id: `noise-${run}`, type: "test", value: "noise", padding: "x".repeat(3000) })
      const t2 = performance.now()
      const doc = await db1.get(target)
      const t3 = performance.now()
      add({
        test: "D: put db1 → put db2 → get db1",
        pass: !!doc,
        put1Ms: (t1 - t0).toFixed(0),
        put2Ms: (t2 - t1).toFixed(0),
        getMs: (t3 - t2).toFixed(0),
      })
    } catch (e) {
      add({ test: "D: put db1 → put db2 → get db1", pass: false, error: e.message })
    }

    // Test E: the hat-smeller pattern exactly
    // 1. Put a "hat" doc (with scent data, like the real app)
    // 2. Immediately put an "image" doc to a different db
    // 3. Immediately get the "image" doc back
    for (let trial = 0; trial < 5; trial++) {
      try {
        const t0 = performance.now()
        const hatId = `hat-${run}-${trial}`
        await db1.put({
          _id: hatId,
          type: "hat",
          name: "The Cumulus Crown",
          material: "Spun cloud silk harvested from sleeping thunderheads",
          description: "A towering hat shaped like a perpetually shifting thundercloud with miniature lightning bolts",
          scent: {
            notes: ["petrichor", "ozone-kissed cotton candy", "moonlit lavender", "baby's breath", "ionized thunder"],
            intensity: 6.7,
            summary: "A drowsy electric tenderness like pressing your nose into a pillow stuffed with lightning",
          },
        })
        const t1 = performance.now()

        const imgId = `img-hat-${run}-${trial}`
        // Real Blob → runtime does a genuine putAsset and mints a real
        // uploadId, exactly like ImgGen does after generating an image.
        await db2.put({
          _id: imgId,
          type: "image",
          prompt: "still life of a cloud silk Cumulus Crown hat, painterly, aromatic mist hints of petrichor",
          created: Date.now(),
          currentVersion: 0,
          versions: [{ id: "v1", created: Date.now(), promptKey: "p1" }],
          currentPromptKey: "p1",
          prompts: { p1: { text: "still life of a cloud silk hat", created: Date.now() } },
          _files: { v1: tinyPngBlob() },
        })
        const t2 = performance.now()

        const saved = await db2.get(imgId)
        const t3 = performance.now()
        // Assert the file reference survived the round-trip too — a doc that
        // comes back without its _files entry is its own failure mode.
        const hasFile = !!(saved && saved._files && saved._files.v1)
        add({
          test: `E.${trial}: hat put → img put(real asset) → img get`,
          pass: !!saved && hasFile,
          hasFile,
          hatPutMs: (t1 - t0).toFixed(0),
          imgPutMs: (t2 - t1).toFixed(0),
          imgGetMs: (t3 - t2).toFixed(0),
        })
      } catch (e) {
        add({
          test: `E.${trial}: hat put → img put → img get`,
          pass: false,
          error: e.message.slice(0, 120),
        })
      }
    }

    console.log("[D1TEST] ===== DONE =====")
    setRunning(false)
  }

  const passColor = "#22c55e"
  const failColor = "#ef4444"

  return (
    <div style={{ fontFamily: "monospace", padding: 24, maxWidth: 720, margin: "0 auto", background: "#0f0f23", minHeight: "100vh", color: "#e0e0e0" }}>
      <h1 style={{ color: "#ffd700" }}>D1 Replica Lag Test</h1>
      <p style={{ color: "#888", marginBottom: 8 }}>
        Tests read-after-write visibility under write contention — no image generation.
      </p>
      <p style={{ color: "#666", fontSize: 12, marginBottom: 24 }}>
        Writes to multiple Firefly DBs on the same DO (same vibe = same AppSessions shard),
        then immediately reads back. If D1 routes reads to a replica that hasn't caught the write,
        the get returns not-found.
      </p>

      <button
        onClick={runTest}
        disabled={running}
        style={{
          padding: "12px 24px", fontSize: 16, fontWeight: "bold",
          background: running ? "#333" : "#ffd700", color: "#0f0f23",
          border: "none", borderRadius: 8, cursor: running ? "wait" : "pointer",
          marginBottom: 24,
        }}
      >
        {running ? "Running..." : "Run Tests"}
      </button>

      {results.map((r, i) => (
        <div key={i} style={{
          padding: "10px 14px", marginBottom: 6, borderRadius: 6,
          border: `2px solid ${r.pass ? passColor : failColor}`,
          background: "#1a1a2e",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "bold" }}>{r.test}</span>
            <span style={{ color: r.pass ? passColor : failColor, fontWeight: "bold" }}>
              {r.pass ? "PASS" : "FAIL"}
            </span>
          </div>
          <pre style={{ fontSize: 11, color: "#888", margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== "test" && k !== "pass")), null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}
