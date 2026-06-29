import React, { useState, useMemo } from "react"
import { useFireproof } from "use-fireproof"

const PHRASES = [
  "Day 1 of", "Not gonna lie", "Game-changer", "CEO of", "Buckle up",
  "🧵 1/", "Hot take", "Unpopular opinion", "Quick reminder", "Folks",
  "Hire her", "Humbled to announce", "Big news", "I almost cried", "Excited to share",
  "Onwards and upwards", "Thoughts?", "Let that sink in", "Rockstar", "Crushing it",
  "Synergy", "Circle back", "Move the needle", "At the end of the day", "Wear many hats"
];

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[#18181b] rounded p-4 shadow-[4px_4px_0px_#18181b]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#18181b]",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#18181b] rounded shadow-[4px_4px_0px_#18181b]",
  featureTitle: "text-lg font-bold uppercase tracking-tight mb-3 text-[#18181b]",
};

function Scanner({ text, setText }) {
  return (
    <section id="scanner" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Paste The Cringe</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a LinkedIn post here, folks..."
        className="w-full h-32 p-3 border-[3px] border-[#18181b] rounded font-mono text-sm focus:outline-none focus:shadow-[3px_3px_0px_#18181b]"
      />
    </section>
  );
}

function BingoCard({ hits = [] }) {
  return (
    <section id="bingo-card" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>The Board</h2>
      <div className="grid grid-cols-5 gap-2">
        {PHRASES.map((p, i) => {
          const lit = hits.includes(i);
          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center text-center p-1 border-[3px] border-[#18181b] rounded text-[10px] font-semibold uppercase leading-tight ${lit ? "bg-[#d9f99d] shadow-[3px_3px_0px_#18181b]" : "bg-white text-[#71717a]"}`}
            >
              {p}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function History({ docs = [], database }) {
  return (
    <section id="history" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Hall Of Shame</h2>
      {docs.length === 0 && <p className="text-xs uppercase tracking-widest text-[#71717a]">No offenders yet. Buckle up.</p>}
      <ul className="space-y-2">
        {docs.map(d => (
          <li key={d._id} className="p-3 border-[3px] border-[#18181b] rounded bg-[#f5f1e8]">
            <div className="flex justify-between items-center mb-1">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-[2px] border-[#18181b] rounded ${d.bingo ? "bg-[#ef4444] text-white" : "bg-[#fde047]"}`}>
                {d.bingo ? "BINGO" : `${d.hitCount} hits`}
              </span>
              <button onClick={() => database.del(d._id)} className="text-[10px] uppercase tracking-widest font-bold text-[#71717a] hover:text-[#ef4444]">Delete</button>
            </div>
            <p className="text-xs font-mono line-clamp-3 text-[#18181b]">{d.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function checkBingo(hits) {
  const set = new Set(hits);
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([0,1,2,3,4].map(c => r*5+c));
  for (let c = 0; c < 5; c++) lines.push([0,1,2,3,4].map(r => r*5+c));
  lines.push([0,6,12,18,24]);
  lines.push([4,8,12,16,20]);
  return lines.some(line => line.every(i => set.has(i)));
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("cringe-bingo");
  const [text, setText] = useState("");

  const hits = useMemo(() => {
    const lower = text.toLowerCase();
    return PHRASES.map((p, i) => lower.includes(p.toLowerCase()) ? i : -1).filter(i => i >= 0);
  }, [text]);

  const bingo = checkBingo(hits);
  const { docs } = useLiveQuery("type", { key: "post", descending: true });

  const savePost = () => {
    if (!text.trim()) return;
    database.put({ type: "post", text, hitCount: hits.length, bingo, createdAt: Date.now() });
    setText("");
  };

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>LinkedIn Cringe Bingo</h1>
        <p className="text-xs uppercase tracking-widest text-[#71717a] mt-1">Humbled & excited to announce this app</p>
      </header>
      {bingo && (
        <div className="max-w-3xl mx-auto mb-4 p-4 bg-[#ef4444] border-[3px] border-[#18181b] rounded shadow-[6px_6px_0px_#18181b] text-center">
          <div className="text-4xl font-black uppercase tracking-tight text-white">BINGO!</div>
          <div className="text-xs uppercase tracking-widest text-white mt-1">Peak thought leadership achieved</div>
        </div>
      )}
      <Scanner text={text} setText={setText} />
      <div className="max-w-3xl mx-auto mb-4 flex gap-2 items-center">
        <div className="px-3 py-2 bg-[#fde047] border-[3px] border-[#18181b] rounded font-mono text-sm font-bold">{hits.length}/25 HITS</div>
        <button onClick={savePost} disabled={!text.trim()} className="px-4 py-2 bg-[#18181b] text-white border-[3px] border-[#18181b] rounded font-bold uppercase text-xs tracking-widest disabled:opacity-40 hover:shadow-[4px_4px_0px_#18181b]">Save To Shame Wall</button>
      </div>
      <BingoCard hits={hits} />
      <History docs={docs} database={database} />
    </main>
  );
}