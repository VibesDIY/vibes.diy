import React from "react"
import { callAI } from "call-ai"
import { ImgGen } from "img-gen"
import { useFireproof } from "use-fireproof"

const TIERS = [
  { id: 1, name: "Tier 1 Bot",  baseCost: 10,    yield: 0.1 },
  { id: 2, name: "Tier 2 Bot",  baseCost: 100,   yield: 1 },
  { id: 3, name: "Tier 3 Bot",  baseCost: 1200,  yield: 8 },
  { id: 4, name: "Tier 4 Bot",  baseCost: 15000, yield: 50 },
  { id: 5, name: "Tier 5 Bot",  baseCost: 200000, yield: 400 },
]

function costFor(tier, owned) {
  return Math.ceil(tier.baseCost * Math.pow(1.15, owned))
}

function fmt(n) {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0)
  if (n < 1e6) return (n / 1000).toFixed(2) + "K"
  if (n < 1e9) return (n / 1e6).toFixed(2) + "M"
  return (n / 1e9).toFixed(2) + "B"
}

export default function App() {
  const { database, useDocument } = useFireproof("coin-tapper")
  const { doc: state, merge, save } = useDocument({
    _id: "game-state",
    coins: 0,
    totalEarned: 0,
    owned: [0, 0, 0, 0, 0],
    lastTick: Date.now(),
  })

  const coinsPerSec = TIERS.reduce((s, t, i) => s + t.yield * (state.owned?.[i] || 0), 0)

  React.useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const last = state.lastTick || now
      const dt = (now - last) / 1000
      if (dt <= 0) return
      const gain = coinsPerSec * dt
      if (gain > 0 || dt > 5) {
        database.put({
          ...state,
          coins: (state.coins || 0) + gain,
          totalEarned: (state.totalEarned || 0) + gain,
          lastTick: now,
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [state, coinsPerSec, database])

  function handleTap() {
    database.put({
      ...state,
      coins: (state.coins || 0) + 1,
      totalEarned: (state.totalEarned || 0) + 1,
    })
  }

  function handleBuy(idx) {
    const owned = state.owned?.[idx] || 0
    const cost = costFor(TIERS[idx], owned)
    if ((state.coins || 0) < cost) return
    const nextOwned = [...(state.owned || [0,0,0,0,0])]
    nextOwned[idx] = owned + 1
    database.put({
      ...state,
      coins: state.coins - cost,
      owned: nextOwned,
    })
  }

  const c = {
    page: "min-h-screen p-4 pb-24 max-w-[920px] mx-auto bg-[#f5f3ec] text-[#15151f]",
    header: "border-[3px] border-[#15151f] rounded-[4px] p-4 mb-4 flex items-center justify-between bg-white shadow-[4px_4px_0px_#15151f]",
    brand: "flex items-center gap-2",
    brandDots: "flex gap-1",
    dot: "w-3 h-3 border-[3px]",
    title: "text-xl font-bold uppercase tracking-tight",
    hero: "border-[3px] border-[#15151f] rounded-[4px] p-6 mb-4 relative overflow-hidden bg-white shadow-[4px_4px_0px_#15151f]",
    heroBar: "absolute top-0 left-0 right-0 h-[6px] flex",
    heroSeg: "flex-1",
    coinDisplay: "text-center mt-3",
    coinNum: "text-5xl font-bold font-mono",
    coinLabel: "text-[0.65rem] uppercase tracking-[0.15em] mt-1 text-[#6b6b78]",
    statRow: "grid grid-cols-2 gap-3 mb-4",
    statCard: "border-[3px] border-[#15151f] rounded-[4px] overflow-hidden bg-white shadow-[3px_3px_0px_#15151f]",
    statHead: "px-3 py-2 text-[0.65rem] uppercase tracking-[0.15em] font-bold border-b-[3px]",
    statBody: "p-3",
    statNum: "text-2xl font-mono font-bold",
    statUnit: "text-[0.6rem] uppercase tracking-[0.15em] mt-1 text-[#6b6b78]",
    tapWrap: "flex justify-center my-6",
    tapBtn: "w-48 h-48 border-[3px] border-[#15151f] rounded-[4px] text-2xl font-bold uppercase tracking-tight bg-[#d63a1c] text-white shadow-[6px_6px_0px_#15151f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#15151f] transition-all",
    section: "border-[3px] border-[#15151f] rounded-[4px] p-4 mb-4 bg-white shadow-[4px_4px_0px_#15151f]",
    sectionTitle: "text-sm font-bold uppercase tracking-[0.08em] mb-3",
    tierList: "flex flex-col gap-3",
    tierRow: "border-[3px] border-[#15151f] rounded-[4px] p-3 flex items-center justify-between gap-3 bg-[#f5f3ec] shadow-[3px_3px_0px_#15151f]",
    tierInfo: "flex-1 min-w-0",
    tierName: "font-bold uppercase text-sm tracking-tight",
    tierMeta: "text-[0.7rem] font-mono mt-1 text-[#6b6b78]",
    buyBtn: "border-[3px] border-[#15151f] rounded-[4px] px-4 py-3 font-bold uppercase text-xs tracking-[0.05em] min-h-[44px] bg-[#ecc23b] text-[#15151f] shadow-[3px_3px_0px_#15151f] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#15151f] transition-all disabled:opacity-50 disabled:cursor-not-allowed",
    footer: "text-center text-[0.65rem] uppercase tracking-[0.15em] mt-6 text-[#6b6b78]",
  }

  return (
    <div className={c.page} style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=block" rel="stylesheet" />
      <header id="app-header" className={c.header}>
        <div className={c.brand}>
          <div className={c.brandDots}>
            <span className={`${c.dot} border-[#15151f] bg-[#d63a1c]`}></span>
            <span className={`${c.dot} border-[#15151f] bg-[#ecc23b]`}></span>
            <span className={`${c.dot} border-[#15151f] bg-[#3da35d]`}></span>
          </div>
          <span className={c.title}>Coin Tapper</span>
        </div>
        <span className="text-[0.65rem] uppercase tracking-[0.15em]">v1</span>
      </header>

      <main id="app">
        <section id="hero" className={c.hero}>
          <div className={c.heroBar}>
            <span className={`${c.heroSeg} bg-[#d63a1c]`}></span>
            <span className={`${c.heroSeg} bg-[#ecc23b]`}></span>
            <span className={`${c.heroSeg} bg-[#3da35d]`}></span>
            <span className={`${c.heroSeg} bg-[#2c63d6]`}></span>
          </div>
          <div className={c.coinDisplay}>
            <div className={c.coinNum} style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fmt(state.coins || 0)}</div>
            <div className={c.coinLabel}>Coins</div>
          </div>
        </section>

        <section id="stats" className={c.statRow}>
          <div className={c.statCard}>
            <div className={`${c.statHead} bg-[#2c63d6] text-white border-[#15151f]`}>Per Sec</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{fmt(coinsPerSec)}</div>
              <div className={c.statUnit}>auto income</div>
            </div>
          </div>
          <div className={c.statCard}>
            <div className={`${c.statHead} bg-[#3da35d] text-[#15151f] border-[#15151f]`}>Total</div>
            <div className={c.statBody}>
              <div className={c.statNum}>{fmt(state.totalEarned || 0)}</div>
              <div className={c.statUnit}>lifetime earned</div>
            </div>
          </div>
        </section>

        <section id="tap">
          <div className={c.tapWrap}>
            <button className={c.tapBtn} onClick={handleTap}>Tap +1</button>
          </div>
        </section>

        <section id="shop" className={c.section}>
          <h2 className={c.sectionTitle}>Auto-Tappers</h2>
          <ul className={c.tierList}>
            {TIERS.map((t, i) => {
              const owned = state.owned?.[i] || 0
              const cost = costFor(t, owned)
              const canAfford = (state.coins || 0) >= cost
              return (
                <li key={t.id} className={c.tierRow}>
                  <div className={c.tierInfo}>
                    <div className={c.tierName}>{t.name}</div>
                    <div className={c.tierMeta} style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      Owned {owned} · {fmt(t.yield * owned)}/s · cost {fmt(cost)}
                    </div>
                  </div>
                  <button className={c.buyBtn} onClick={() => handleBuy(i)} disabled={!canAfford}>Buy</button>
                </li>
              )
            })}
          </ul>
        </section>

        <footer className={c.footer}>Idle Empire · Auto-Saves</footer>
      </main>
    </div>
  )
}