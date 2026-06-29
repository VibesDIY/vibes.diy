import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f2e8] p-4 font-['Space_Grotesk',sans-serif] text-[#0a0a14]",
  header: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#0a0a14] rounded p-4 shadow-[4px_4px_0px_#0a0a14]",
  title: "text-2xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 bg-white border-[3px] border-[#0a0a14] rounded p-4 shadow-[4px_4px_0px_#0a0a14]",
  featureTitle: "text-sm font-bold uppercase tracking-widest mb-3",
  input: "w-full p-2 border-[3px] border-[#0a0a14] rounded bg-white font-['JetBrains_Mono',monospace] focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#0a0a14] transition-all",
  bigNum: "w-full p-3 border-[3px] border-[#0a0a14] rounded bg-white font-['JetBrains_Mono',monospace] text-2xl text-center font-bold focus:outline-none",
  btnPrimary: "px-4 py-2 bg-[#d94a3d] text-white border-[3px] border-[#0a0a14] rounded font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#0a0a14] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a14] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50",
  btnSecondary: "px-3 py-1 bg-[#f0c94a] text-[#0a0a14] border-[3px] border-[#0a0a14] rounded font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_#0a0a14] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#0a0a14] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
  btnGhost: "px-3 py-1 bg-white text-[#0a0a14] border-[3px] border-[#0a0a14] rounded font-bold uppercase tracking-wider text-xs hover:shadow-[3px_3px_0px_#0a0a14] transition-all",
  label: "text-xs font-bold uppercase tracking-widest text-[#6a6a7a] mb-1 block",
  teamCard: "border-[3px] border-[#0a0a14] rounded p-3 bg-white",
  bar: "h-[6px] -m-4 mb-3 flex",
};

function computeScore(bid, tricks, nil, blindNil) {
  let pts = 0, bags = 0;
  if (blindNil) {
    pts += tricks === 0 ? 200 : -200;
  } else if (nil) {
    pts += tricks === 0 ? 100 : -100;
  }
  const contractBid = bid;
  const contractTricks = nil || blindNil ? Math.max(0, tricks) : tricks;
  if (contractBid > 0) {
    if (contractTricks >= contractBid) {
      pts += contractBid * 10;
      const over = contractTricks - contractBid;
      pts += over;
      bags = over;
    } else {
      pts -= contractBid * 10;
    }
  }
  return { pts, bags };
}

function computeTotals(hands) {
  let t1 = 0, t2 = 0, b1 = 0, b2 = 0;
  for (const h of hands) {
    const s1 = computeScore(h.t1Bid || 0, h.t1Tricks || 0, h.t1Nil, h.t1BlindNil);
    const s2 = computeScore(h.t2Bid || 0, h.t2Tricks || 0, h.t2Nil, h.t2BlindNil);
    t1 += s1.pts; t2 += s2.pts;
    b1 += s1.bags; b2 += s2.bags;
    while (b1 >= 10) { t1 -= 100; b1 -= 10; }
    while (b2 >= 10) { t2 -= 100; b2 -= 10; }
  }
  return { t1, t2, b1, b2 };
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("spades-scoresheet");

  const [setup, setSetup] = useState(() => {
    try {
      const s = localStorage.getItem("spades-setup");
      return s ? JSON.parse(s) : { team1Name: "Team 1", team2Name: "Team 2", p1a: "", p1b: "", p2a: "", p2b: "" };
    } catch { return { team1Name: "Team 1", team2Name: "Team 2", p1a: "", p1b: "", p2a: "", p2b: "" }; }
  });

  useEffect(() => {
    localStorage.setItem("spades-setup", JSON.stringify(setup));
  }, [setup]);

  const { doc: hand, merge: mergeHand, submit: submitHand, reset: resetHand } = useDocument({
    type: "hand",
    createdAt: 0,
    t1Bid: 0, t1Tricks: 0, t1Nil: false, t1BlindNil: false,
    t2Bid: 0, t2Tricks: 0, t2Nil: false, t2BlindNil: false,
  });

  const { docs: hands } = useLiveQuery("createdAt", { descending: false });
  const handDocs = hands.filter(h => h.type === "hand");
  const totals = computeTotals(handDocs);

  const [editingId, setEditingId] = useState(null);

  const saveHand = async () => {
    const tricksTotal = (Number(hand.t1Tricks) || 0) + (Number(hand.t2Tricks) || 0);
    if (tricksTotal !== 13) {
      if (!confirm(`Tricks total ${tricksTotal}, should be 13. Save anyway?`)) return;
    }
    await database.put({
      ...hand,
      createdAt: hand.createdAt || Date.now(),
      t1Bid: Number(hand.t1Bid) || 0,
      t1Tricks: Number(hand.t1Tricks) || 0,
      t2Bid: Number(hand.t2Bid) || 0,
      t2Tricks: Number(hand.t2Tricks) || 0,
    });
    resetHand({
      type: "hand", createdAt: 0,
      t1Bid: 0, t1Tricks: 0, t1Nil: false, t1BlindNil: false,
      t2Bid: 0, t2Tricks: 0, t2Nil: false, t2BlindNil: false,
    });
    setEditingId(null);
  };

  const editHand = (h) => {
    mergeHand({ ...h });
    setEditingId(h._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const undoHand = async (h) => {
    if (confirm("Delete this hand?")) await database.del(h._id);
  };

  const resetAll = async () => {
    if (!confirm("Delete ALL hands?")) return;
    for (const h of handDocs) await database.del(h._id);
  };

  const c = classNames;

  return (
    <main className={c.page}>
      <header className={c.header}>
        <h1 className={c.title}>Spades Scoresheet</h1>
        <p className="text-xs uppercase tracking-widest text-[#6a6a7a] mt-1">Live sync · 2v2</p>
      </header>

      <section className={c.feature}>
        <div className={c.bar}>
          <div className="flex-1 bg-[#d94a3d]"></div>
          <div className="flex-1 bg-[#f0c94a]"></div>
          <div className="flex-1 bg-[#4aa35a]"></div>
          <div className="flex-1 bg-[#3d6dd9]"></div>
        </div>
        <h2 className={c.featureTitle}>Teams</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={c.teamCard}>
            <input className={c.input + " font-bold mb-2"} value={setup.team1Name} onChange={e => setSetup({ ...setup, team1Name: e.target.value })} placeholder="Team 1 Name" />
            <input className={c.input + " mb-2"} value={setup.p1a} onChange={e => setSetup({ ...setup, p1a: e.target.value })} placeholder="Player 1" />
            <input className={c.input} value={setup.p1b} onChange={e => setSetup({ ...setup, p1b: e.target.value })} placeholder="Player 2" />
          </div>
          <div className={c.teamCard}>
            <input className={c.input + " font-bold mb-2"} value={setup.team2Name} onChange={e => setSetup({ ...setup, team2Name: e.target.value })} placeholder="Team 2 Name" />
            <input className={c.input + " mb-2"} value={setup.p2a} onChange={e => setSetup({ ...setup, p2a: e.target.value })} placeholder="Player 1" />
            <input className={c.input} value={setup.p2b} onChange={e => setSetup({ ...setup, p2b: e.target.value })} placeholder="Player 2" />
          </div>
        </div>
      </section>

      <section className={c.feature}>
        <div className="grid grid-cols-2 gap-3">
          <div className={c.teamCard} style={{ borderColor: "#d94a3d", borderWidth: 3 }}>
            <div className="text-xs uppercase tracking-widest font-bold mb-1 truncate">{setup.team1Name}</div>
            <div className="font-['JetBrains_Mono',monospace] text-4xl font-bold">{totals.t1}</div>
            <div className="text-xs uppercase tracking-widest mt-1">Bags: <span className="font-['JetBrains_Mono',monospace] font-bold">{totals.b1}</span></div>
          </div>
          <div className={c.teamCard} style={{ borderColor: "#3d6dd9", borderWidth: 3 }}>
            <div className="text-xs uppercase tracking-widest font-bold mb-1 truncate">{setup.team2Name}</div>
            <div className="font-['JetBrains_Mono',monospace] text-4xl font-bold">{totals.t2}</div>
            <div className="text-xs uppercase tracking-widest mt-1">Bags: <span className="font-['JetBrains_Mono',monospace] font-bold">{totals.b2}</span></div>
          </div>
        </div>
      </section>

      <section className={c.feature}>
        <h2 className={c.featureTitle}>{editingId ? "Edit Hand" : "New Hand"}</h2>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(n => {
            const bidK = `t${n}Bid`, trK = `t${n}Tricks`, nilK = `t${n}Nil`, bnK = `t${n}BlindNil`;
            const color = n === 1 ? "#d94a3d" : "#3d6dd9";
            return (
              <div key={n} className={c.teamCard} style={{ borderColor: color }}>
                <div className="text-xs uppercase tracking-widest font-bold mb-2 truncate">{n === 1 ? setup.team1Name : setup.team2Name}</div>
                <label className={c.label}>Bid</label>
                <input type="number" inputMode="numeric" min="0" max="13" className={c.bigNum + " mb-2"} value={hand[bidK]} onChange={e => mergeHand({ [bidK]: e.target.value })} />
                <label className={c.label}>Tricks</label>
                <input type="number" inputMode="numeric" min="0" max="13" className={c.bigNum + " mb-2"} value={hand[trK]} onChange={e => mergeHand({ [trK]: e.target.value })} />
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold mb-1">
                  <input type="checkbox" className="w-5 h-5 border-[3px] border-[#0a0a14]" checked={hand[nilK]} onChange={e => mergeHand({ [nilK]: e.target.checked, [bnK]: e.target.checked ? false : hand[bnK] })} />
                  Nil
                </label>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold">
                  <input type="checkbox" className="w-5 h-5 border-[3px] border-[#0a0a14]" checked={hand[bnK]} onChange={e => mergeHand({ [bnK]: e.target.checked, [nilK]: e.target.checked ? false : hand[nilK] })} />
                  Blind Nil
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button className={c.btnPrimary} onClick={saveHand}>{editingId ? "Update" : "Save Hand"}</button>
          {editingId && (
            <button className={c.btnGhost} onClick={() => { setEditingId(null); resetHand({ type: "hand", createdAt: 0, t1Bid: 0, t1Tricks: 0, t1Nil: false, t1BlindNil: false, t2Bid: 0, t2Tricks: 0, t2Nil: false, t2BlindNil: false }); }}>Cancel</button>
          )}
        </div>
      </section>

      <section className={c.feature}>
        <div className="flex justify-between items-center mb-3">
          <h2 className={c.featureTitle + " mb-0"}>Hand Log ({handDocs.length})</h2>
          {handDocs.length > 0 && <button className={c.btnGhost} onClick={resetAll}>Reset All</button>}
        </div>
        {handDocs.length === 0 && <p className="text-sm text-[#6a6a7a] uppercase tracking-wider">No hands yet</p>}
        <div className="space-y-2">
          {handDocs.map((h, i) => {
            const s1 = computeScore(h.t1Bid, h.t1Tricks, h.t1Nil, h.t1BlindNil);
            const s2 = computeScore(h.t2Bid, h.t2Tricks, h.t2Nil, h.t2BlindNil);
            return (
              <div key={h._id} className="border-[3px] border-[#0a0a14] rounded p-2 bg-[#f5f2e8]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs uppercase tracking-widest font-bold">Hand {i + 1}</span>
                  <div className="flex gap-1">
                    <button className={c.btnSecondary} onClick={() => editHand(h)}>Edit</button>
                    <button className={c.btnGhost} onClick={() => undoHand(h)}>Undo</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 font-['JetBrains_Mono',monospace] text-sm">
                  <div>
                    <span className="font-bold">{h.t1Bid}/{h.t1Tricks}</span>
                    {h.t1Nil && <span className="ml-1 text-[10px] bg-[#f0c94a] px-1 border border-[#0a0a14]">NIL</span>}
                    {h.t1BlindNil && <span className="ml-1 text-[10px] bg-[#d94a3d] text-white px-1 border border-[#0a0a14]">BN</span>}
                    <span className={"ml-2 font-bold " + (s1.pts >= 0 ? "text-[#4aa35a]" : "text-[#d94a3d]")}>{s1.pts >= 0 ? "+" : ""}{s1.pts}</span>
                    {s1.bags > 0 && <span className="ml-1 text-xs text-[#6a6a7a]">+{s1.bags}b</span>}
                  </div>
                  <div>
                    <span className="font-bold">{h.t2Bid}/{h.t2Tricks}</span>
                    {h.t2Nil && <span className="ml-1 text-[10px] bg-[#f0c94a] px-1 border border-[#0a0a14]">NIL</span>}
                    {h.t2BlindNil && <span className="ml-1 text-[10px] bg-[#d94a3d] text-white px-1 border border-[#0a0a14]">BN</span>}
                    <span className={"ml-2 font-bold " + (s2.pts >= 0 ? "text-[#4aa35a]" : "text-[#d94a3d]")}>{s2.pts >= 0 ? "+" : ""}{s2.pts}</span>
                    {s2.bags > 0 && <span className="ml-1 text-xs text-[#6a6a7a]">+{s2.bags}b</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}