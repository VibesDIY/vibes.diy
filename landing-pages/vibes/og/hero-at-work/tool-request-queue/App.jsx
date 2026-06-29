import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

const classNames = {
  page: "min-h-screen bg-[#f5f3ec] p-6 font-sans",
  header: "max-w-4xl mx-auto mb-6 border-[3px] border-black bg-white p-5 shadow-[4px_4px_0px_#000]",
  title: "text-3xl font-bold uppercase tracking-tight",
  tagline: "text-sm uppercase tracking-widest text-neutral-500 mt-1",
  feature: "max-w-4xl mx-auto mb-5 border-[3px] border-black bg-white p-5 shadow-[4px_4px_0px_#000]",
  featureTitle: "text-lg font-bold uppercase tracking-tight mb-3",
};

const URGENCIES = [
  { key: "nice", label: "Nice to have", bg: "bg-[#3a86ff]", text: "text-white" },
  { key: "needed", label: "Needed", bg: "bg-[#f1c40f]", text: "text-black" },
  { key: "blocking", label: "Blocking", bg: "bg-[#e63946]", text: "text-white" },
];

function AddRequest() {
  const { database } = useFireproof("tool-wishlist");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [name, setName] = useState(() => localStorage.getItem("tw-name") || "");
  const [urgency, setUrgency] = useState("needed");

  const [loadingSuggest, setLoadingSuggest] = useState(false);

  useEffect(() => { localStorage.setItem("tw-name", name); }, [name]);

  async function suggest() {
    setLoadingSuggest(true);
    try {
      const res = await callAI("Invent one realistic internal tool request a coworker might file. Short punchy title and a 1-2 sentence description.", {
        schema: { properties: { title: { type: "string" }, description: { type: "string" } } }
      });
      const data = JSON.parse(res);
      setTitle(data.title || ""); setDesc(data.description || "");
    } finally { setLoadingSuggest(false); }
  }

  async function submit() {
    if (!title.trim() || !name.trim()) return;
    await database.put({
      type: "request",
      title: title.trim(),
      description: desc.trim(),
      requester: name.trim(),
      urgency,
      status: "open",
      createdAt: Date.now(),
    });
    setTitle(""); setDesc("");
  }

  return (
    <section id="add-request" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>File a Wish</h2>
      <input
        value={title} onChange={e => setTitle(e.target.value)}
        placeholder="I wish we had…"
        className="w-full mb-3 p-3 border-[3px] border-black rounded-[4px] font-medium focus:outline-none focus:shadow-[3px_3px_0px_#000]"
      />
      <textarea
        value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="Details (optional — why, what it unblocks, links)"
        rows={3}
        className="w-full mb-3 p-3 border-[3px] border-black rounded-[4px] text-sm focus:outline-none focus:shadow-[3px_3px_0px_#000]"
      />
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className="w-full mb-3 p-3 border-[3px] border-black rounded-[4px] text-sm focus:outline-none focus:shadow-[3px_3px_0px_#000]"
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {URGENCIES.map(u => (
          <button key={u.key} onClick={() => setUrgency(u.key)}
            className={`px-3 py-2 border-[3px] border-black rounded-[4px] text-xs uppercase tracking-wider font-bold ${u.bg} ${u.text} ${urgency === u.key ? "shadow-[3px_3px_0px_#000]" : "opacity-60"}`}>
            {u.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={submit}
          className="px-5 py-3 border-[3px] border-black bg-[#e63946] text-white uppercase tracking-wider font-bold rounded-[4px] shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] active:shadow-none transition-all">
          Submit Wish
        </button>
        <button disabled={loadingSuggest} onClick={suggest}
          className="px-4 py-3 border-[3px] border-black bg-white uppercase tracking-wider font-bold text-xs rounded-[4px] shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:shadow-none transition-all disabled:opacity-50 flex items-center gap-2">
          {loadingSuggest ? (
            <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin">
              <circle cx="8" cy="8" r="6" fill="none" stroke="black" strokeWidth="3" strokeDasharray="24 12"/>
            </svg>
          ) : null}
          Suggest
        </button>
      </div>
    </section>
  );
}

const STATUSES = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "shipped", label: "Shipped" },
];

function urgencyMeta(key) { return URGENCIES.find(u => u.key === key) || URGENCIES[1]; }
function statusMeta(key) {
  if (key === "shipped") return { label: "Shipped", bg: "bg-[#2a9d8f]", text: "text-white" };
  if (key === "in_progress") return { label: "In Progress", bg: "bg-[#f1c40f]", text: "text-black" };
  return { label: "Open", bg: "bg-white", text: "text-black" };
}

function RequestCard({ doc }) {
  const { database } = useFireproof("tool-wishlist");
  const [voted, setVoted] = useState(() => !!localStorage.getItem(`tw-vote-${doc._id}`));
  const [celebrate, setCelebrate] = useState(false);
  const [shipUrl, setShipUrl] = useState("");
  const [showShip, setShowShip] = useState(false);
  const votes = doc.votes || 0;
  const urg = urgencyMeta(doc.urgency);
  const st = statusMeta(doc.status);
  const speedrun = doc.status === "shipped" && doc.shippedAt && (doc.shippedAt - doc.createdAt) < 7*24*3600*1000;

  async function vote() {
    if (voted) return;
    localStorage.setItem(`tw-vote-${doc._id}`, "1");
    setVoted(true);
    const next = votes + 1;
    if (next === 10) { setCelebrate(true); setTimeout(() => setCelebrate(false), 1800); }
    await database.put({ ...doc, votes: next });
  }
  async function claim() {
    const builder = localStorage.getItem("tw-name") || "anon";
    await database.put({ ...doc, status: "in_progress", builder });
  }
  async function ship() {
    const builder = doc.builder || localStorage.getItem("tw-name") || "anon";
    await database.put({ ...doc, status: "shipped", builder, shipUrl: shipUrl.trim(), shippedAt: Date.now() });
    setShowShip(false); setShipUrl("");
  }

  const highlight = doc.status === "in_progress" ? "bg-[#fff8d6]" : "bg-white";

  return (
    <div className={`relative border-[3px] border-black rounded-[4px] p-4 mb-3 shadow-[4px_4px_0px_#000] ${highlight}`}>
      {celebrate && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-5xl animate-bounce">🎉✨🎊</div>}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-base leading-tight">{doc.title}</h3>
        <button onClick={vote} disabled={voted}
          className={`shrink-0 flex flex-col items-center px-3 py-2 border-[3px] border-black rounded-[4px] font-mono font-bold ${voted ? "bg-[#2a9d8f] text-white" : "bg-white shadow-[3px_3px_0px_#000]"}`}>
          <span className="text-xs">▲</span>
          <span className="text-sm">{votes}</span>
        </button>
      </div>
      {doc.description && <p className="text-sm text-neutral-700 mb-3 whitespace-pre-wrap">{doc.description}</p>}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] uppercase tracking-wider font-bold">
        <span className={`px-2 py-1 border-[3px] border-black rounded-[4px] ${urg.bg} ${urg.text}`}>{urg.label}</span>
        <span className={`px-2 py-1 border-[3px] border-black rounded-[4px] ${st.bg} ${st.text}`}>{st.label}</span>
        {votes >= 5 && votes < 10 && <span className="px-2 py-1 border-[3px] border-black rounded-[4px] bg-[#e63946] text-white">Trending 🔥</span>}
        {speedrun && <span className="px-2 py-1 border-[3px] border-black rounded-[4px] bg-[#3a86ff] text-white">Speed-run ⚡</span>}
        <span className="text-neutral-500 normal-case tracking-normal font-medium">by {doc.requester}{doc.builder ? ` · built by ${doc.builder}` : ""}</span>
      </div>
      {doc.shipUrl && <a href={doc.shipUrl} target="_blank" rel="noreferrer" className="inline-block mb-3 text-xs font-bold uppercase underline">Open → {doc.shipUrl}</a>}
      <div className="flex flex-wrap gap-2">
        {doc.status === "open" && (
          <button onClick={claim} className="px-3 py-2 border-[3px] border-black bg-[#f1c40f] rounded-[4px] text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:shadow-none transition-all">I'm building this</button>
        )}
        {doc.status !== "shipped" && !showShip && (
          <button onClick={() => setShowShip(true)} className="px-3 py-2 border-[3px] border-black bg-[#2a9d8f] text-white rounded-[4px] text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:shadow-none transition-all">Mark shipped</button>
        )}
        {showShip && (
          <div className="flex gap-2 flex-1 min-w-[240px]">
            <input value={shipUrl} onChange={e => setShipUrl(e.target.value)} placeholder="https://…" className="flex-1 px-2 py-1 border-[3px] border-black rounded-[4px] text-xs"/>
            <button onClick={ship} className="px-3 py-2 border-[3px] border-black bg-[#2a9d8f] text-white rounded-[4px] text-xs font-bold uppercase">Ship</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestList() {
  const { useLiveQuery } = useFireproof("tool-wishlist");
  const { docs } = useLiveQuery("type", { key: "request" });
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const filtered = docs
    .filter(d => status === "all" ? true : d.status === status)
    .filter(d => {
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (d.title||"").toLowerCase().includes(s) || (d.description||"").toLowerCase().includes(s) || (d.requester||"").toLowerCase().includes(s);
    })
    .sort((a,b) => (b.votes||0) - (a.votes||0));

  return (
    <section id="request-list" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>The Queue</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {STATUSES.map(s => (
          <button key={s.key} onClick={() => setStatus(s.key)}
            className={`px-3 py-2 border-[3px] border-black rounded-[4px] text-xs uppercase tracking-wider font-bold ${status === s.key ? "bg-black text-white shadow-[3px_3px_0px_#000]" : "bg-white"}`}>
            {s.label}
          </button>
        ))}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search wishes…"
        className="w-full mb-4 p-2 border-[3px] border-black rounded-[4px] text-sm focus:outline-none focus:shadow-[3px_3px_0px_#000]"/>
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">No wishes match. Be the first to file one.</p>
      ) : filtered.map(d => <RequestCard key={d._id} doc={d} />)}
    </section>
  );
}

function HallOfFame() {
  const { useLiveQuery } = useFireproof("tool-wishlist");
  const { docs } = useLiveQuery("type", { key: "request" });
  const shipped = docs
    .filter(d => d.status === "shipped")
    .sort((a,b) => (b.shippedAt||0) - (a.shippedAt||0))
    .slice(0, 5);

  return (
    <section id="hall-of-fame" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Hall of Fame</h2>
      {shipped.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">Nothing shipped yet. Go make something.</p>
      ) : (
        <ul className="space-y-2">
          {shipped.map(d => {
            const speedrun = d.shippedAt && (d.shippedAt - d.createdAt) < 7*24*3600*1000;
            return (
              <li key={d._id} className="border-[3px] border-black rounded-[4px] p-3 bg-[#f5f3ec] flex flex-wrap items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-[#2a9d8f] text-white border-[3px] border-black rounded-[4px] text-[10px] uppercase tracking-wider font-bold">Shipped</span>
                {speedrun && <span className="px-2 py-1 bg-[#3a86ff] text-white border-[3px] border-black rounded-[4px] text-[10px] uppercase tracking-wider font-bold">⚡</span>}
                <span className="font-bold">{d.title}</span>
                <span className="text-neutral-600 text-xs">— by {d.builder || "anon"}</span>
                {d.shipUrl && <a href={d.shipUrl} target="_blank" rel="noreferrer" className="text-xs underline font-bold ml-auto">open →</a>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className="flex mb-3 h-[6px] border-[3px] border-black">
          <div className="flex-1 bg-[#e63946]"/>
          <div className="flex-1 bg-[#f1c40f]"/>
          <div className="flex-1 bg-[#2a9d8f]"/>
          <div className="flex-1 bg-[#3a86ff]"/>
        </div>
        <h1 className={classNames.title}>Tool Wishlist</h1>
        <p className={classNames.tagline}>Beats waiting for IT.</p>
      </header>
      <AddRequest />
      <RequestList />
      <HallOfFame />
    </main>
  );
}