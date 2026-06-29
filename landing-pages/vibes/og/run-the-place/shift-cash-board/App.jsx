import React, { useState } from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";

const c = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif] text-[#0f1028]",
  header:
    "max-w-3xl mx-auto mb-6 p-5 bg-white border-[3px] border-[#0f1028] rounded-[4px] shadow-[4px_4px_0px_#0f1028] flex items-center justify-between",
  title: "text-3xl font-bold uppercase tracking-tight",
  dots: "flex gap-1",
  dot: "w-3 h-3 border-[2px] border-[#0f1028]",
  card: "max-w-3xl mx-auto mb-5 bg-white border-[3px] border-[#0f1028] rounded-[4px] shadow-[4px_4px_0px_#0f1028] overflow-hidden",
  bar: "h-[6px] w-full flex",
  inner: "p-5",
  h2: "text-lg font-bold uppercase tracking-tight mb-3",
  label: "block text-[0.65rem] uppercase tracking-[0.15em] text-[#5a5a6e] mb-1 font-medium",
  input:
    "w-full px-3 py-2 bg-white border-[3px] border-[#0f1028] rounded-[4px] font-['JetBrains_Mono',monospace] text-sm focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-[4px_4px_0px_#0f1028] transition-all duration-150",
  btnRed:
    "px-4 py-2 bg-[#d93a28] text-white border-[3px] border-[#0f1028] rounded-[4px] shadow-[4px_4px_0px_#0f1028] uppercase tracking-[0.08em] text-sm font-bold hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_#0f1028] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150 disabled:opacity-50",
  btnYellow:
    "px-3 py-1.5 bg-[#f0c33c] text-[#0f1028] border-[3px] border-[#0f1028] rounded-[4px] shadow-[3px_3px_0px_#0f1028] uppercase tracking-[0.08em] text-xs font-bold hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_#0f1028] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-150 disabled:opacity-50",
  mono: "font-['JetBrains_Mono',monospace]",
  grid: "grid grid-cols-2 gap-3",
  totalBox: "mt-4 p-4 border-[3px] border-[#0f1028] rounded-[4px] bg-[#f5f1e8]",
  badgeOk: "inline-block px-2 py-0.5 bg-[#4fb867] text-[#0f1028] border-[2px] border-[#0f1028] text-xs font-bold uppercase tracking-wider",
  badgeBad: "inline-block px-2 py-0.5 bg-[#d93a28] text-white border-[2px] border-[#0f1028] text-xs font-bold uppercase tracking-wider",
  badgeLock: "inline-block px-2 py-0.5 bg-[#c8c8d0] text-[#0f1028] border-[2px] border-[#0f1028] text-xs font-bold uppercase tracking-wider",
  row: "border-b-[2px] border-[#0f1028] last:border-b-0 p-3 hover:bg-[#f0c33c] transition-colors",
};

const BAR = (
  <div className={c.bar}>
    <div className="flex-1 bg-[#d93a28]" />
    <div className="flex-1 bg-[#f0c33c]" />
    <div className="flex-1 bg-[#4fb867]" />
    <div className="flex-1 bg-[#3a6fd9]" />
  </div>
);

const Spinner = () => (
  <svg className="animate-spin inline-block" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="42 60" strokeLinecap="round" />
  </svg>
);

const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const fmt = (v) => n(v).toFixed(2);

function ShiftForm({ database }) {
  const { useDocument } = useFireproof("cashout-db");
  const { doc, merge, save, reset } = useDocument({
    type: "shift",
    closer: "",
    cash: "",
    card: "",
    tips: "",
    voids: "",
    posExpected: "",
    signed: false,
    initials: "",
    createdAt: Date.now(),
  });
  const [loading, setLoading] = useState(false);

  const deposit = n(doc.cash) + n(doc.card) - n(doc.tips);
  const expected = n(doc.posExpected) - n(doc.voids);
  const variance = deposit - expected;
  const flag = Math.abs(variance) > 0.5;

  async function suggest() {
    setLoading(true);
    try {
      const r = await callAI("Generate a realistic end-of-shift restaurant cash reconciliation example. Closer first name, cash drawer count, card sales, tips, voids, POS expected total — values in dollars, two decimals, plausible for a busy dinner shift.", {
        schema: { properties: { closer: { type: "string" }, cash: { type: "number" }, card: { type: "number" }, tips: { type: "number" }, voids: { type: "number" }, posExpected: { type: "number" } } },
      });
      const d = JSON.parse(r);
      merge({ closer: d.closer, cash: String(d.cash), card: String(d.card), tips: String(d.tips), voids: String(d.voids), posExpected: String(d.posExpected) });
    } finally {
      setLoading(false);
    }
  }

  async function submitShift() {
    if (!doc.closer || !doc.initials) return;
    await save({ ...doc, signed: true, deposit, expected, variance, createdAt: Date.now() });
    reset();
  }

  return (
    <section className={c.card}>
      {BAR}
      <div className={c.inner}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={c.h2}>New Shift</h2>
          <button className={c.btnYellow} onClick={suggest} disabled={loading}>
            {loading ? <Spinner /> : "Fill Example"}
          </button>
        </div>
        <div className="mb-3">
          <label className={c.label}>Closer Name</label>
          <input className={c.input} value={doc.closer} onChange={(e) => merge({ closer: e.target.value })} />
        </div>
        <div className={c.grid}>
          <div>
            <label className={c.label}>Cash Drawer</label>
            <input className={c.input} inputMode="decimal" value={doc.cash} onChange={(e) => merge({ cash: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Card Sales</label>
            <input className={c.input} inputMode="decimal" value={doc.card} onChange={(e) => merge({ card: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Tips Paid Out</label>
            <input className={c.input} inputMode="decimal" value={doc.tips} onChange={(e) => merge({ tips: e.target.value })} />
          </div>
          <div>
            <label className={c.label}>Voids</label>
            <input className={c.input} inputMode="decimal" value={doc.voids} onChange={(e) => merge({ voids: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={c.label}>POS Expected Total</label>
            <input className={c.input} inputMode="decimal" value={doc.posExpected} onChange={(e) => merge({ posExpected: e.target.value })} />
          </div>
        </div>

        <div className={c.totalBox}>
          <div className="flex justify-between mb-1">
            <span className={c.label} style={{ marginBottom: 0 }}>Deposit</span>
            <span className={`${c.mono} font-bold`}>${fmt(deposit)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className={c.label} style={{ marginBottom: 0 }}>Expected</span>
            <span className={`${c.mono} font-bold`}>${fmt(expected)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t-[2px] border-[#0f1028]">
            <span className={c.label} style={{ marginBottom: 0 }}>Variance</span>
            <span className="flex items-center gap-2">
              <span className={`${c.mono} font-bold text-base`}>{variance >= 0 ? "+" : ""}${fmt(variance)}</span>
              <span className={flag ? c.badgeBad : c.badgeOk}>{flag ? "Flagged" : "Balanced"}</span>
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label className={c.label}>Initials to Sign Off</label>
            <input className={c.input} maxLength={4} value={doc.initials} onChange={(e) => merge({ initials: e.target.value.toUpperCase() })} />
          </div>
          <button className={c.btnRed} onClick={submitShift} disabled={!doc.closer || !doc.initials}>
            Lock Shift
          </button>
        </div>
      </div>
    </section>
  );
}

function Ledger({ database }) {
  const { useLiveQuery } = useFireproof("cashout-db");
  const { docs } = useLiveQuery("type", { key: "shift", descending: true, limit: 50 });
  const sorted = [...docs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <section className={c.card}>
      {BAR}
      <div className={c.inner}>
        <h2 className={c.h2}>Daily Ledger</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-[#5a5a6e] uppercase tracking-wider">No shifts locked yet.</p>
        ) : (
          <div className="border-[3px] border-[#0f1028] rounded-[4px]">
            {sorted.map((d) => {
              const flag = Math.abs(n(d.variance)) > 0.5;
              return (
                <div key={d._id} className={c.row}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wide">{d.closer}</span>
                      <span className={c.badgeLock}>{d.initials}</span>
                      <span className={flag ? c.badgeBad : c.badgeOk}>{flag ? "Short/Over" : "OK"}</span>
                    </div>
                    <span className={`${c.mono} text-xs text-[#5a5a6e]`}>{new Date(d.createdAt || 0).toLocaleString()}</span>
                  </div>
                  <div className={`${c.mono} text-xs flex gap-4 flex-wrap text-[#5a5a6e]`}>
                    <span>CASH ${fmt(d.cash)}</span>
                    <span>CARD ${fmt(d.card)}</span>
                    <span>TIPS ${fmt(d.tips)}</span>
                    <span>VOID ${fmt(d.voids)}</span>
                    <span className="text-[#0f1028] font-bold">DEP ${fmt(d.deposit)}</span>
                    <span className={`font-bold ${flag ? "text-[#d93a28]" : "text-[#4fb867]"}`}>
                      VAR {n(d.variance) >= 0 ? "+" : ""}${fmt(d.variance)}
                    </span>
                  </div>
                  <button
                    className="mt-2 text-xs uppercase tracking-wider underline hover:text-[#d93a28]"
                    onClick={() => database.del(d._id)}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const { database } = useFireproof("cashout-db");
  return (
    <main className={c.page}>
      <header className={c.header}>
        <div className="flex items-center gap-3">
          <div className={c.dots}>
            <div className={`${c.dot} bg-[#d93a28]`} />
            <div className={`${c.dot} bg-[#f0c33c]`} />
            <div className={`${c.dot} bg-[#4fb867]`} />
          </div>
          <h1 className={c.title}>Cash Out</h1>
        </div>
        <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#5a5a6e]">End of Shift</span>
      </header>
      <ShiftForm database={database} />
      <Ledger database={database} />
    </main>
  );
}