import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-4 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  wrap: "max-w-2xl mx-auto",
  header: "mb-6 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] p-4",
  title: "text-3xl font-bold uppercase tracking-tight",
  sub: "text-xs uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mt-1",
  card: "mb-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] p-4",
  cardTitle: "text-sm uppercase tracking-[0.1em] font-bold mb-3",
};

function PostForm() {
  const { useDocument } = useFireproof("leftover-board");
  const { doc, merge, submit } = useDocument({
    type: "leftover", dish: "", size: "", claims: [], thumbsUp: [], resolved: false, createdAt: Date.now(),
  });
  const inp = "w-full p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white text-sm mb-2 focus:outline-none focus:shadow-[3px_3px_0_oklch(0.15_0.02_280)]";
  const onSubmit = (e) => {
    e.preventDefault();
    if (!doc.dish.trim()) return;
    merge({ createdAt: Date.now() });
    submit();
  };
  return (
    <form onSubmit={onSubmit} className={c.card}>
      <h2 className={c.cardTitle}>Got extras? Share 'em</h2>
      <input className={inp} placeholder="Dish (e.g. lasagna)" value={doc.dish} onChange={e => merge({ dish: e.target.value })} />
      <input className={inp} placeholder="How much? (half a tray, ~3 cups)" value={doc.size} onChange={e => merge({ size: e.target.value })} />
      <button type="submit" className="w-full p-2 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] text-xs uppercase tracking-[0.08em] font-bold hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_oklch(0.15_0.02_280)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
        Post Leftover
      </button>
    </form>
  );
}

function LeftoverCard({ doc, database }) {
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const resolved = doc.resolved;
  const thumbs = doc.thumbsUp || [];
  const claims = doc.claims || [];

  const toggleThumb = () => {
    const who = (name || prompt("Your name?") || "").trim();
    if (!who) return;
    const has = thumbs.includes(who);
    database.put({ ...doc, thumbsUp: has ? thumbs.filter(n => n !== who) : [...thumbs, who] });
  };
  const addClaim = (e) => {
    e.preventDefault();
    if (!name.trim() || !portion.trim()) return;
    database.put({ ...doc, claims: [...claims, { name: name.trim(), portion: portion.trim() }] });
    setPortion("");
  };
  const toggleResolved = () => database.put({ ...doc, resolved: !resolved });

  const inp = "flex-1 p-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] bg-white text-sm focus:outline-none";
  const pill = "px-2 py-1 border-[2px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs font-mono bg-[oklch(0.85_0.18_85)]";

  return (
    <div className={c.card + (resolved ? " opacity-50" : "")}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-tight">{doc.dish}</h3>
          <p className="text-xs uppercase tracking-[0.1em] text-[oklch(0.50_0.02_280)]">{doc.size}</p>
        </div>
        <button onClick={toggleThumb} className="shrink-0 px-3 py-2 bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)] text-sm font-bold active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          👍 <span className="font-mono">{thumbs.length}</span>
        </button>
      </div>

      {thumbs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {thumbs.map((n, i) => <span key={i} className={pill}>{n}</span>)}
        </div>
      )}

      <div className="mb-3">
        <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[oklch(0.50_0.02_280)] mb-1">Claimed so far</p>
        {claims.length === 0 ? (
          <p className="text-sm italic text-[oklch(0.50_0.02_280)]">Nobody yet — first come, first served!</p>
        ) : (
          <ul className="space-y-1">
            {claims.map((cl, i) => (
              <li key={i} className="text-sm flex justify-between border-b-[2px] border-[oklch(0.15_0.02_280)] pb-1">
                <span className="font-bold">{cl.name}</span>
                <span className="font-mono text-[oklch(0.52_0.18_255)]">{cl.portion}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!resolved && (
        <form onSubmit={addClaim} className="flex flex-col gap-2 mb-2">
          <div className="flex gap-2">
            <input className={inp} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            <input className={inp} placeholder="How much?" value={portion} onChange={e => setPortion(e.target.value)} />
          </div>
          <button type="submit" className="p-2 bg-[oklch(0.62_0.19_145)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[3px_3px_0_oklch(0.15_0.02_280)] text-xs uppercase tracking-[0.08em] font-bold active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
            Claim a portion
          </button>
        </form>
      )}

      <button onClick={toggleResolved} className="w-full p-2 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs uppercase tracking-[0.08em] font-bold hover:shadow-[3px_3px_0_oklch(0.15_0.02_280)] transition-all">
        {resolved ? "Unmark resolved" : "Mark resolved"}
      </button>
    </div>
  );
}

function Board() {
  const { useLiveQuery, database } = useFireproof("leftover-board");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const leftovers = docs.filter(d => d.type === "leftover");
  return (
    <section>
      <h2 className={c.cardTitle}>Up for grabs ({leftovers.filter(d => !d.resolved).length})</h2>
      {leftovers.length === 0 ? (
        <div className={c.card}><p className="text-sm italic text-[oklch(0.50_0.02_280)]">No leftovers posted yet. Host, tell us what's on the table!</p></div>
      ) : leftovers.map(d => <LeftoverCard key={d._id} doc={d} database={database} />)}
    </section>
  );
}

export default function App() {
  return (
    <main className={c.page}>
      <div className={c.wrap}>
        <header className={c.header}>
          <h1 className={c.title}>Leftover Board</h1>
          <p className={c.sub}>Who wants the rest of the pasta?</p>
        </header>
        <PostForm />
        <Board />
      </div>
    </main>
  );
}