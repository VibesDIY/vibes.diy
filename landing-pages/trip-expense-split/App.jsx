import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

export default function App() {
  const { viewer, can } = useViewer();
  const { useDocument, useLiveQuery, database } = useFireproof("splitwise-trip");

  const { doc: memberDoc, merge: mergeMember, submit: submitMember } = useDocument({ type: "member", name: "", createdAt: Date.now() });
  const { docs: members } = useLiveQuery("type", { key: "member" });

  const { doc: expenseDoc, merge: mergeExpense, submit: submitExpense } = useDocument({ type: "expense", description: "", amount: 0, payer: "", covers: [], createdAt: Date.now() });
  const { docs: expenses } = useLiveQuery("type", { key: "expense", descending: true });

  const [suggestions, setSuggestions] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const balances = {};
  members.forEach(m => { balances[m.name] = 0; });
  expenses.forEach(e => {
    if (!e.covers || e.covers.length === 0) return;
    const share = e.amount / e.covers.length;
    if (balances[e.payer] !== undefined) balances[e.payer] += e.amount;
    e.covers.forEach(name => { if (balances[name] !== undefined) balances[name] -= share; });
  });

  async function suggestSettlements() {
    setIsLoading(true);
    try {
      const prompt = `Given these net balances (positive = owed money, negative = owes money): ${JSON.stringify(balances)}. Return the minimum list of payments to settle all debts to zero.`;
      const res = await callAI(prompt, { schema: { properties: { payments: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, amount: { type: "number" } } } } } } });
      setSuggestions(JSON.parse(res).payments || []);
    } finally { setIsLoading(false); }
  }

  const c = {
    page: "min-h-screen bg-[#2d2d33] text-[#fafafa] pb-24",
    header: "sticky top-0 z-10 bg-[#1f1f24] border-b border-[#4d4d55] px-4 py-4 shadow-lg",
    title: "text-xl font-bold text-[#fafafa] tracking-tight",
    tagline: "text-xs text-[#b5b9c4] mt-0.5",
    main: "px-4 py-4 space-y-4 max-w-2xl mx-auto",
    section: "bg-[#3d3d44] border border-[#4d4d55] rounded-xl p-4 shadow-md",
    h2: "text-sm font-semibold uppercase tracking-wider text-[#f5b342] mb-3",
    btn: "min-h-[44px] px-4 py-3 bg-[#f5b342] text-[#1f1f24] font-semibold rounded-lg hover:bg-[#e89c2a] active:scale-95 transition",
    btnSecondary: "min-h-[44px] px-4 py-3 bg-[#3d3d44] border border-[#4d4d55] text-[#fafafa] font-medium rounded-lg active:scale-95 transition",
    input: "w-full min-h-[44px] px-3 py-2 bg-[#2d2d33] border border-[#4d4d55] rounded-lg text-[#fafafa] placeholder:text-[#9097a3] focus:outline-none focus:border-[#f5b342]",
    pill: "inline-flex items-center px-2 py-1 bg-[#2d2d33] border border-[#4d4d55] rounded-full text-xs text-[#dde0e7]",
    muted: "text-sm text-[#b5b9c4]",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Splitwise Trip</h1>
        <p className={c.tagline}>Shared expenses, settled simply</p>
      </header>
      <main id="app" className={c.main}>
        <section id="members" className={c.section}>
          <h2 className={c.h2}>Group Members</h2>
          {can("write") && (
            <form onSubmit={submitMember} className="flex gap-2 mb-3">
              <input className={c.input} placeholder="Add a name…" value={memberDoc.name} onChange={e => mergeMember({ name: e.target.value })} />
              <button type="submit" className={c.btn} disabled={!memberDoc.name.trim()}>Add</button>
            </form>
          )}
          {members.length === 0 ? (
            <p className={c.muted}>No members yet — add a name to begin.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <span key={m._id} className={c.pill}>
                  {m.name}
                  {can("write") && <button onClick={() => database.del(m._id)} className="ml-2 text-[#9097a3] hover:text-[#f5b342]">×</button>}
                </span>
              ))}
            </div>
          )}
        </section>
        <section id="add-expense" className={c.section}>
          <h2 className={c.h2}>Add Expense</h2>
          {!can("write") ? (
            <p className={c.muted}>Read-only view — contact the owner for write access.</p>
          ) : members.length < 2 ? (
            <p className={c.muted}>Add at least 2 members first.</p>
          ) : (
            <form onSubmit={submitExpense} className="space-y-2">
              <input className={c.input} placeholder="What was it?" value={expenseDoc.description} onChange={e => mergeExpense({ description: e.target.value })} />
              <input className={c.input} placeholder="Amount" type="number" step="0.01" value={expenseDoc.amount || ""} onChange={e => mergeExpense({ amount: parseFloat(e.target.value) || 0 })} />
              <div>
                <p className={c.muted + " mb-1"}>Paid by:</p>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button type="button" key={m._id} onClick={() => mergeExpense({ payer: m.name })} className={expenseDoc.payer === m.name ? "px-3 py-2 bg-[#f5b342] text-[#1f1f24] rounded-full text-xs font-semibold" : c.pill}>{m.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className={c.muted + " mb-1"}>Covers:</p>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => {
                    const on = expenseDoc.covers?.includes(m.name);
                    return (
                      <button type="button" key={m._id} onClick={() => mergeExpense({ covers: on ? expenseDoc.covers.filter(n => n !== m.name) : [...(expenseDoc.covers || []), m.name] })} className={on ? "px-3 py-2 bg-[#f5b342] text-[#1f1f24] rounded-full text-xs font-semibold" : c.pill}>{m.name}</button>
                    );
                  })}
                </div>
              </div>
              <button type="submit" className={c.btn} disabled={!expenseDoc.description || !expenseDoc.amount || !expenseDoc.payer || !expenseDoc.covers?.length}>Add expense</button>
            </form>
          )}
        </section>
        <section id="expenses" className={c.section}>
          <h2 className={c.h2}>Expense Feed</h2>
          {expenses.length === 0 ? (
            <p className={c.muted}>No expenses yet.</p>
          ) : (
            <ul className="space-y-2">
              {expenses.map(e => (
                <li key={e._id} className="flex items-start justify-between gap-2 p-3 bg-[#2d2d33] border border-[#4d4d55] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#fafafa]">{e.description}</p>
                    <p className="text-xs text-[#b5b9c4] mt-1">{e.payer} paid ${e.amount?.toFixed(2)} for {e.covers?.join(", ")}</p>
                  </div>
                  <span className="text-[#f5b342] font-semibold">${e.amount?.toFixed(2)}</span>
                  {can("write") && <button onClick={() => database.del(e._id)} className="text-[#9097a3] hover:text-[#f5b342] px-2">×</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section id="balances" className={c.section}>
          <h2 className={c.h2}>Running Balances</h2>
          {members.length === 0 ? (
            <p className={c.muted}>No members yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map(m => {
                const bal = balances[m.name] || 0;
                const owes = bal < -0.01;
                const owed = bal > 0.01;
                return (
                  <li key={m._id} className="flex items-center justify-between p-3 bg-[#2d2d33] border border-[#4d4d55] rounded-lg">
                    <span className="font-medium">{m.name}</span>
                    <span className={owes ? "text-[#ff6b6b] font-semibold" : owed ? "text-[#7ed957] font-semibold" : "text-[#b5b9c4]"}>
                      {owes ? `owes $${Math.abs(bal).toFixed(2)}` : owed ? `gets $${bal.toFixed(2)}` : "settled"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section id="settlements" className={c.section}>
          <h2 className={c.h2}>Settle Up</h2>
          <button onClick={suggestSettlements} disabled={isLoading || members.length < 2} className={c.btn + " w-full mb-3 flex items-center justify-center gap-2"}>
            {isLoading && <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="40 20" /></svg>}
            {isLoading ? "Calculating…" : "Suggest settlements"}
          </button>
          {suggestions.length > 0 ? (
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="p-3 bg-[#2d2d33] border border-[#4d4d55] rounded-lg flex items-center justify-between">
                  <span><strong>{s.from}</strong> → <strong>{s.to}</strong></span>
                  <span className="text-[#f5b342] font-semibold">${s.amount?.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={c.muted}>Tap above for the shortest payment plan.</p>
          )}
        </section>
      </main>
    </div>
  )
}