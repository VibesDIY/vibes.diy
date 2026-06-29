import React, { useState, useEffect, useMemo } from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const { database, useDocument, useLiveQuery } = useFireproof("launch-war-room")

  const launchQuery = useLiveQuery("type", { key: "launch", descending: true, limit: 1 })
  const launch = launchQuery.docs[0]

  const { doc: launchDraft, merge: mergeLaunch, submit: submitLaunch } = useDocument({
    type: "launch",
    name: "",
    embargoUtc: "",
    createdAt: Date.now(),
  })

  const { docs: regions } = useLiveQuery("type", { key: "region" })
  const { doc: regionDraft, merge: mergeRegion, submit: submitRegion } = useDocument({
    type: "region",
    code: "",
    createdAt: Date.now(),
  })

  const { docs: items } = useLiveQuery("type", { key: "item" })
  const { doc: itemDraft, merge: mergeItem, submit: submitItem } = useDocument({
    type: "item",
    region: "",
    name: "",
    owner: "",
    status: "PENDING",
    createdAt: Date.now(),
  })

  const { docs: incidents } = useLiveQuery("type", { key: "incident", descending: true })
  const { doc: incidentDraft, merge: mergeIncident, submit: submitIncident } = useDocument({
    type: "incident",
    region: "",
    severity: "LOW",
    note: "",
    createdAt: Date.now(),
  })

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const embargoMs = launch?.embargoUtc ? new Date(launch.embargoUtc).getTime() : null
  const remaining = embargoMs ? embargoMs - now : null
  const elapsed = remaining !== null && remaining <= 0
  const cd = useMemo(() => {
    if (remaining === null) return { d: "—", h: "—", m: "—", s: "—" }
    const r = Math.max(0, remaining)
    const d = Math.floor(r / 86400000)
    const h = Math.floor((r % 86400000) / 3600000)
    const m = Math.floor((r % 3600000) / 60000)
    const s = Math.floor((r % 60000) / 1000)
    const pad = (n) => String(n).padStart(2, "0")
    return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) }
  }, [remaining])

  const shipped = items.filter((i) => i.status === "SHIPPED").length
  const blocked = items.filter((i) => i.status === "FAILED").length
  const onDeck = items.filter((i) => i.status === "PENDING" || i.status === "READY").length

  function setItemStatus(item, status) {
    database.put({ ...item, status })
  }

  function handleLaunchSubmit(e) { e.preventDefault(); submitLaunch() }
  const [isSuggesting, setIsSuggesting] = useState(false)
  async function suggestItems() {
    setIsSuggesting(true)
    try {
      const regionList = regions.map((r) => r.code).join(", ") || "US-EAST, EU, APAC"
      const res = await callAI(`Suggest 6 launch go-live checklist items across these regions: ${regionList}. Use realistic owners.`, {
        schema: { properties: { items: { type: "array", items: { type: "object", properties: { region: { type: "string" }, name: { type: "string" }, owner: { type: "string" } } } } } },
      })
      const data = JSON.parse(res)
      for (const it of data.items || []) {
        await database.put({ type: "item", region: it.region, name: it.name, owner: it.owner, status: "PENDING", createdAt: Date.now() })
      }
    } finally {
      setIsSuggesting(false)
    }
  }

  function handleItemSubmit(e) { e.preventDefault(); submitItem() }
  function handleIncidentSubmit(e) { e.preventDefault(); submitIncident() }
  function handleRegionSubmit(e) { e.preventDefault(); submitRegion() }

  const c = {
    page: "min-h-screen mx-auto max-w-[1000px] border-l border-r border-black bg-white text-black",
    header: "px-6 pt-10 pb-6 border-b border-black",
    eyebrow: "text-[0.6rem] font-bold uppercase tracking-[0.12em] mb-3",
    masthead: "flex items-baseline justify-between gap-4 mb-6",
    issueline: "text-[0.6rem] font-bold uppercase tracking-[0.12em]",
    heroBand: "grid grid-cols-[200px_1fr_200px] border-t border-b border-black",
    heroSide: "p-4 flex flex-col justify-between",
    heroSideRight: "p-4 flex flex-col justify-between border-l border-black",
    heroCenter: "p-6 border-l border-r border-black flex items-center justify-center",
    heroTitle: "font-black uppercase text-center leading-[0.85]",
    sectionLabel: "text-[0.6rem] font-bold uppercase tracking-[0.12em]",
    sectionLabelFilled: "text-[0.6rem] font-bold uppercase tracking-[0.12em] inline-block px-2 py-1 bg-black text-white",
    main: "px-6 py-8",
    section: "mb-10",
    sectionHead: "flex items-baseline justify-between mb-4 pb-2 border-b border-black",
    countdownWrap: "border border-black grid grid-cols-4",
    countdownCell: "p-4 border-r border-black last:border-r-0 text-center",
    countdownNum: "text-4xl font-black tabular-nums",
    countdownLabel: "text-[0.55rem] font-bold uppercase tracking-[0.12em] mt-1",
    statRow: "grid grid-cols-3 border border-black",
    statCell: "p-5 border-r border-black last:border-r-0",
    statNum: "text-5xl font-black tabular-nums leading-none",
    statLabel: "text-[0.6rem] font-bold uppercase tracking-[0.12em] mt-2",
    regionGrid: "grid grid-cols-1 md:grid-cols-3 border border-black",
    regionCol: "border-r border-black last:border-r-0 border-b border-black md:border-b-0",
    regionHead: "p-3 border-b border-black",
    regionName: "text-sm font-bold uppercase tracking-[0.08em]",
    regionMeta: "text-[0.6rem] font-bold uppercase tracking-[0.1em] mt-1 text-[#666]",
    itemRow: "grid grid-cols-[24px_1fr_auto] gap-2 items-center px-3 py-3 border-b border-black last:border-b-0 text-sm hover:bg-black hover:text-white",
    statusSquare: "w-4 h-4 border border-black inline-block",
    itemName: "uppercase tracking-[0.04em]",
    itemOwner: "text-[0.6rem] uppercase tracking-[0.1em] text-[#666]",
    itemActions: "flex gap-1",
    btn: "px-3 py-2 border border-black bg-white text-black text-[0.6rem] font-bold uppercase tracking-[0.08em] min-h-[36px] hover:bg-black hover:text-white",
    btnPrimary: "px-6 py-3 border border-black bg-white text-black text-[0.65rem] font-bold uppercase tracking-[0.08em] min-h-[44px] hover:bg-black hover:text-white",
    formGrid: "grid grid-cols-1 md:grid-cols-2 gap-6 border border-black p-6",
    field: "flex flex-col gap-1",
    label: "text-[0.6rem] font-bold uppercase tracking-[0.12em]",
    input: "border-0 border-b border-black bg-transparent py-2 text-base outline-none",
    select: "border-0 border-b border-black bg-transparent py-2 text-base outline-none",
    formActions: "md:col-span-2 flex justify-end gap-2 pt-2",
    table: "border border-black",
    tableHead: "grid grid-cols-[120px_1fr_120px_100px] border-b border-black",
    tableHeadCell: "px-3 py-2 border-r border-black last:border-r-0 text-[0.6rem] font-bold uppercase tracking-[0.12em]",
    tableRow: "grid grid-cols-[120px_1fr_120px_100px] border-b border-black last:border-b-0 hover:bg-black hover:text-white",
    tableCell: "px-3 py-3 border-r border-black last:border-r-0 text-sm",
    incidentForm: "border border-black p-6 mb-4",
    incidentRow: "grid grid-cols-[140px_80px_1fr] gap-3 items-end",
    footer: "px-6 py-8 border-t border-black mt-12 text-[0.6rem] font-bold uppercase tracking-[0.12em] flex justify-between",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className={c.masthead}>
          <div className={c.issueline}>Vol. I — No. 001 — Launch Edition</div>
          <div className={c.issueline}>Internal — Embargoed</div>
        </div>
        <div className={c.eyebrow}>Coordination Desk — {launch?.name || "Untitled Launch"}</div>
      </header>

      <section className={c.heroBand}>
        <div className={c.heroSide}>
          <div className={c.sectionLabel}>Embargo</div>
          <div className={c.sectionLabel}>Status: {elapsed ? "Elapsed" : "Holding"}</div>
        </div>
        <div className={c.heroCenter}>
          <h1 className={c.heroTitle} style={{ fontSize: "clamp(3rem,10vw,8rem)", letterSpacing: "-0.04em", WebkitTextStroke: "2px #000", color: "transparent" }}>
            Launch Desk
          </h1>
        </div>
        <div className={c.heroSideRight}>
          <div className={c.sectionLabel}>Live Edition</div>
          <div className={c.sectionLabel}>All Regions</div>
        </div>
      </section>

      <main id="app" className={c.main}>

        <section id="launch-setup" className={c.section}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabelFilled}>I. Launch Configuration</span>
            <span className={c.sectionLabel}>Set Once</span>
          </div>
          <form onSubmit={handleLaunchSubmit} className={c.formGrid}>
            <div className={c.field}>
              <label className={c.label}>Launch Name</label>
              <input className={c.input} type="text" placeholder="Project Codename" value={launchDraft.name} onChange={(e) => mergeLaunch({ name: e.target.value })} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Embargo Lift (UTC)</label>
              <input className={c.input} type="datetime-local" value={launchDraft.embargoUtc} onChange={(e) => mergeLaunch({ embargoUtc: e.target.value })} />
            </div>
            <div className={c.formActions}>
              <button type="button" className={c.btnPrimary}>Reset</button>
              <button type="submit" className={c.btnPrimary}>Save Launch ›</button>
            </div>
          </form>
        </section>

        <section id="countdown" className={c.section}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabelFilled}>II. Countdown to Lift</span>
            <span className={c.sectionLabel}>UTC</span>
          </div>
          <div className={c.countdownWrap}>
            <div className={c.countdownCell}>
              <div className={c.countdownNum}>{elapsed ? "—" : cd.d}</div>
              <div className={c.countdownLabel}>Days</div>
            </div>
            <div className={c.countdownCell}>
              <div className={c.countdownNum}>{elapsed ? "—" : cd.h}</div>
              <div className={c.countdownLabel}>Hours</div>
            </div>
            <div className={c.countdownCell}>
              <div className={c.countdownNum}>{elapsed ? "—" : cd.m}</div>
              <div className={c.countdownLabel}>Minutes</div>
            </div>
            <div className={c.countdownCell}>
              <div className={c.countdownNum}>{elapsed ? "ELAPSED" : cd.s}</div>
              <div className={c.countdownLabel}>Seconds</div>
            </div>
          </div>
        </section>

        <section id="stats" className={c.section}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabelFilled}>III. Operational Tally</span>
            <span className={c.sectionLabel}>Real Time</span>
          </div>
          <div className={c.statRow}>
            <div className={c.statCell}>
              <div className={c.statNum}>{shipped}</div>
              <div className={c.statLabel}>Items Shipped</div>
            </div>
            <div className={c.statCell}>
              <div className={c.statNum}>{blocked}</div>
              <div className={c.statLabel}>Blocked</div>
            </div>
            <div className={c.statCell}>
              <div className={c.statNum}>{onDeck}</div>
              <div className={c.statLabel}>On Deck</div>
            </div>
          </div>
        </section>

        <section id="regions" className={c.section}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabelFilled}>IV. Regional Rollout</span>
            <span className={c.sectionLabel}>Per-Region Status</span>
          </div>
          <form onSubmit={handleRegionSubmit} className={c.incidentForm}>
            <div className={c.incidentRow}>
              <div className={c.field}>
                <label className={c.label}>New Region Code</label>
                <input className={c.input} type="text" placeholder="e.g. US-EAST" value={regionDraft.code} onChange={(e) => mergeRegion({ code: e.target.value.toUpperCase() })} />
              </div>
              <div className={c.field}>
                <label className={c.label}>Items</label>
                <span className="text-sm tabular-nums">{regions.length}</span>
              </div>
              <div className="flex justify-end">
                <button type="submit" className={c.btnPrimary}>Add Region ›</button>
              </div>
            </div>
          </form>
          <div className={c.regionGrid}>
            {regions.length === 0 && (
              <div className={c.regionCol}>
                <div className={c.regionHead}>
                  <div className={c.regionName}>No Regions Yet</div>
                  <div className={c.regionMeta}>Add one above</div>
                </div>
              </div>
            )}
            {regions.map((r) => {
              const regionItems = items.filter((i) => i.region === r.code)
              const regionShipped = regionItems.filter((i) => i.status === "SHIPPED").length
              return (
                <div key={r._id} className={c.regionCol}>
                  <div className={c.regionHead}>
                    <div className={c.regionName}>{r.code}</div>
                    <div className={c.regionMeta}>{regionShipped} of {regionItems.length} shipped</div>
                  </div>
                  {regionItems.length === 0 && (
                    <div className={c.itemRow}>
                      <span className={c.statusSquare}></span>
                      <div>
                        <div className={c.itemName}>No items</div>
                        <div className={c.itemOwner}>Add via form below</div>
                      </div>
                      <div></div>
                    </div>
                  )}
                  {regionItems.map((it) => (
                    <div key={it._id} className={c.itemRow}>
                      <span className={c.statusSquare} style={{
                        background: it.status === "SHIPPED" ? "#000" : it.status === "FAILED" ? "repeating-linear-gradient(45deg,#000,#000 2px,#fff 2px,#fff 4px)" : it.status === "READY" ? "#666" : "transparent"
                      }}></span>
                      <div>
                        <div className={c.itemName}>{it.name} <span className="text-[#666]">[{it.status}]</span></div>
                        <div className={c.itemOwner}>Owner: {it.owner || "—"}</div>
                      </div>
                      <div className={c.itemActions}>
                        <button className={c.btn} onClick={() => setItemStatus(it, "READY")}>Ready</button>
                        <button className={c.btn} onClick={() => setItemStatus(it, "SHIPPED")}>Ship</button>
                        <button className={c.btn} onClick={() => setItemStatus(it, "FAILED")}>Fail</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </section>

        <section id="add-item" className={c.section}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabelFilled}>V. Add Go-Live Item</span>
            <span className={c.sectionLabel}>Per Region</span>
          </div>
          <form onSubmit={handleItemSubmit} className={c.formGrid}>
            <div className={c.field}>
              <label className={c.label}>Region</label>
              <select className={c.select} value={itemDraft.region} onChange={(e) => mergeItem({ region: e.target.value })}>
                <option value="">—</option>
                {regions.map((r) => <option key={r._id} value={r.code}>{r.code}</option>)}
              </select>
            </div>
            <div className={c.field}>
              <label className={c.label}>Item Name</label>
              <input className={c.input} type="text" placeholder="e.g. Press release live" value={itemDraft.name} onChange={(e) => mergeItem({ name: e.target.value })} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Owner</label>
              <input className={c.input} type="text" placeholder="Name" value={itemDraft.owner} onChange={(e) => mergeItem({ owner: e.target.value })} />
            </div>
            <div className={c.field}>
              <label className={c.label}>Initial Status</label>
              <select className={c.select} value={itemDraft.status} onChange={(e) => mergeItem({ status: e.target.value })}>
                <option>PENDING</option>
                <option>READY</option>
              </select>
            </div>
            <div className={c.formActions}>
              <button type="button" className={c.btnPrimary} onClick={suggestItems} disabled={isSuggesting}>
                {isSuggesting ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin inline-block"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                ) : "Suggest Items ›"}
              </button>
              <button type="submit" className={c.btnPrimary}>Add Item ›</button>
            </div>
          </form>
        </section>

        <section id="incidents" className={c.section}>
          <div className={c.sectionHead}>
            <span className={c.sectionLabelFilled}>VI. Incident Feed</span>
            <span className={c.sectionLabel}>Timestamped Log</span>
          </div>
          <form onSubmit={handleIncidentSubmit} className={c.incidentForm}>
            <div className={c.incidentRow}>
              <div className={c.field}>
                <label className={c.label}>Region</label>
                <select className={c.select} value={incidentDraft.region} onChange={(e) => mergeIncident({ region: e.target.value })}>
                  <option value="">—</option>
                  {regions.map((r) => <option key={r._id} value={r.code}>{r.code}</option>)}
                </select>
              </div>
              <div className={c.field}>
                <label className={c.label}>Severity</label>
                <select className={c.select} value={incidentDraft.severity} onChange={(e) => mergeIncident({ severity: e.target.value })}>
                  <option>LOW</option>
                  <option>HIGH</option>
                </select>
              </div>
              <div className={c.field}>
                <label className={c.label}>Note</label>
                <input className={c.input} type="text" placeholder="One line description" value={incidentDraft.note} onChange={(e) => mergeIncident({ note: e.target.value })} />
              </div>
            </div>
            <div className={c.formActions}>
              <button type="submit" className={c.btnPrimary}>Log Incident ›</button>
            </div>
          </form>
          <div className={c.table}>
            <div className={c.tableHead}>
              <div className={c.tableHeadCell}>Time UTC</div>
              <div className={c.tableHeadCell}>Note</div>
              <div className={c.tableHeadCell}>Region</div>
              <div className={c.tableHeadCell}>Severity</div>
            </div>
            {incidents.length === 0 && (
              <div className={c.tableRow}>
                <div className={c.tableCell}>—</div>
                <div className={c.tableCell}>No incidents logged.</div>
                <div className={c.tableCell}>—</div>
                <div className={c.tableCell}>—</div>
              </div>
            )}
            {incidents.map((inc) => (
              <div key={inc._id} className={c.tableRow}>
                <div className={c.tableCell}>{new Date(inc.createdAt).toISOString().slice(11, 19)}</div>
                <div className={c.tableCell}>{inc.note}</div>
                <div className={c.tableCell}>{inc.region || "—"}</div>
                <div className={c.tableCell}>{inc.severity}</div>
              </div>
            ))}
          </div>
        </section>

      </main>

      <footer className={c.footer}>
        <span>End of Edition</span>
        <span>Page 1 of 1</span>
      </footer>
    </div>
  )
}