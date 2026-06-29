import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f5f3ea] p-4 font-['Space_Grotesk',sans-serif] text-[#1a1a2e]",
  header: "max-w-3xl mx-auto mb-6 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0px_#1a1a2e] overflow-hidden",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-sm font-bold uppercase tracking-widest mb-3",
  accentBar: "flex h-[6px]",
  tagline: "text-[0.7rem] uppercase tracking-[0.15em] text-[#6b6b80] mt-1",
  btnPrimary: "px-4 py-2 bg-[#d94d3a] text-white font-bold uppercase tracking-wider text-sm border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50",
  textarea: "w-full p-3 border-[3px] border-[#1a1a2e] rounded font-['Space_Grotesk',sans-serif] text-sm focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#1a1a2e] transition-all",
};

const FALLBACK_PROMPTS = [
  { prompt: "I cried in a Zoom call today. Here's what it taught me about Q4 synergy.", coach: "You're a parody TITAN. I believe in you. NOW WRITE." },
  { prompt: "My 4-year-old closed a $2M deal. Here's what YOU can learn.", coach: "Unleash the beast. The algorithm fears your greatness." },
  { prompt: "I fired my top performer. The reason will inspire you.", coach: "Type like your rent depends on it. Because spiritually, it does." },
];

const Spinner = () => (
  <svg className="inline animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="42 42" strokeLinecap="round"/></svg>
);

function PromptToday({ database, entries }) {
  const today = new Date().toISOString().slice(0,10);
  const todayEntry = entries?.find(e => e.date === today);
  const [promptDoc, setPromptDoc] = React.useState(null);
  const [response, setResponse] = React.useState("");
  const [loadingPrompt, setLoadingPrompt] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (todayEntry) {
      setPromptDoc({ prompt: todayEntry.prompt, coach: todayEntry.coach });
      setResponse(todayEntry.response);
    } else if (!promptDoc) {
      setPromptDoc(FALLBACK_PROMPTS[Math.floor(Math.random()*FALLBACK_PROMPTS.length)]);
    }
  }, [todayEntry]);

  const generatePrompt = async () => {
    setLoadingPrompt(true);
    try {
      const raw = await callAI("Generate one insufferable LinkedIn-style humblebrag post opener (1-2 sentences, cringe corporate flex) and a deranged-but-encouraging coach pep talk to the parody writer (1 sentence, ALL CAPS energy).", {
        schema: { properties: { prompt: { type: "string" }, coach: { type: "string" } } }
      });
      setPromptDoc(JSON.parse(raw));
    } catch {
      setPromptDoc(FALLBACK_PROMPTS[Math.floor(Math.random()*FALLBACK_PROMPTS.length)]);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const submit = async () => {
    if (!response.trim() || !promptDoc) return;
    setSaving(true);
    try {
      const existing = todayEntry;
      await database.put({
        ...(existing || {}),
        date: today,
        prompt: promptDoc.prompt,
        coach: promptDoc.coach,
        response,
        createdAt: Date.now(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="prompt-today" className={c.feature}>
      <h2 className={c.featureTitle}>Today's Cringe · {today}</h2>
      <div className="p-3 mb-3 bg-[#e8c547] border-[3px] border-[#1a1a2e] rounded">
        <p className="text-[0.65rem] uppercase tracking-widest font-bold mb-1">Prompt</p>
        <p className="text-base font-semibold">{promptDoc?.prompt || "Loading..."}</p>
      </div>
      <div className="p-3 mb-3 bg-[#3a6dc4] text-white border-[3px] border-[#1a1a2e] rounded">
        <p className="text-[0.65rem] uppercase tracking-widest font-bold mb-1">Coach Says</p>
        <p className="text-sm italic">"{promptDoc?.coach || "..."}"</p>
      </div>
      <textarea
        className={c.textarea}
        rows="4"
        placeholder="Agreed? 👇 Thoughts? Drop a 🙏 if this resonates..."
        value={response}
        onChange={e => setResponse(e.target.value)}
      />
      <div className="flex gap-2 mt-3 flex-wrap">
        <button className={c.btnPrimary} onClick={submit} disabled={saving || !response.trim()}>
          {saving ? <><Spinner /> Saving</> : todayEntry ? "Update Cringe" : "Post Cringe"}
        </button>
        <button
          className="px-3 py-2 bg-white text-[#1a1a2e] font-bold uppercase tracking-wider text-xs border-[3px] border-[#1a1a2e] rounded hover:shadow-[3px_3px_0px_#1a1a2e] transition-all disabled:opacity-50"
          onClick={generatePrompt}
          disabled={loadingPrompt}
        >
          {loadingPrompt ? <><Spinner /> Cooking</> : "AI Prompt"}
        </button>
      </div>
      {todayEntry && <p className="text-xs text-[#5ca85c] font-bold uppercase tracking-widest mt-2">✓ Today logged</p>}
    </section>
  );
}

function Heatmap({ entries = [] }) {
  const days = 140;
  const today = new Date();
  today.setHours(0,0,0,0);
  const dateSet = new Set(entries.map(e => e.date));
  const squares = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    squares.push({ key, active: dateSet.has(key) });
  }
  const streak = (() => {
    let s = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (dateSet.has(d.toISOString().slice(0,10))) s++;
      else break;
    }
    return s;
  })();
  const badges = [
    { n: 3, label: "Sparkplug" },
    { n: 7, label: "Weekly Warrior" },
    { n: 14, label: "Fortnight Freak" },
    { n: 30, label: "Cringe Lord" },
  ];
  return (
    <section id="heatmap" className={c.feature}>
      <h2 className={c.featureTitle}>Your Streak · {streak} days</h2>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] mb-4 overflow-x-auto">
        {squares.map(s => (
          <div key={s.key} title={s.key} className={`w-[14px] h-[14px] border-[2px] border-[#1a1a2e] rounded-[2px] ${s.active ? 'bg-[#5ca85c]' : 'bg-[#f5f3ea]'}`}></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {badges.map(b => {
          const unlocked = streak >= b.n;
          return (
            <div key={b.n} className={`px-2 py-1 border-[3px] border-[#1a1a2e] rounded text-[0.65rem] uppercase tracking-widest font-bold ${unlocked ? 'bg-[#e8c547] shadow-[3px_3px_0px_#1a1a2e]' : 'bg-[#d4d4d4] text-[#8a8a8a]'}`}>
              {b.n}d · {b.label}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Archive({ entries = [] }) {
  if (!entries.length) {
    return (
      <section id="archive" className={c.feature}>
        <h2 className={c.featureTitle}>Past Masterpieces</h2>
        <p className="text-sm text-[#6b6b80] italic">No entries yet. Your coach is patient. (Lying.)</p>
      </section>
    );
  }
  return (
    <section id="archive" className={c.feature}>
      <h2 className={c.featureTitle}>Past Masterpieces · {entries.length}</h2>
      <ul className="space-y-3">
        {entries.map(e => (
          <li key={e._id} className="p-3 border-[3px] border-[#1a1a2e] rounded hover:bg-[#e8c547] transition-colors">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-mono text-xs font-bold">{e.date}</span>
              <span className="text-[0.6rem] uppercase tracking-widest text-[#6b6b80]">Posted</span>
            </div>
            <p className="text-[0.7rem] uppercase tracking-wider text-[#6b6b80] mb-1">Prompt: {e.prompt}</p>
            <p className="text-sm">{e.response}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex h-[6px] mb-3 -mx-4 -mt-4">
          <div className="flex-1 bg-[#d94d3a]"></div>
          <div className="flex-1 bg-[#e8c547]"></div>
          <div className="flex-1 bg-[#5ca85c]"></div>
          <div className="flex-1 bg-[#3a6dc4]"></div>
        </div>
        <div className="px-4 pt-2">
          <h1 className={c.title}>CringeStreak</h1>
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[#6b6b80] mt-1">Daily parody reps · Your deranged coach is watching</p>
        </div>
      </header>
      <PromptToday />
      <Heatmap />
      <Archive />
    </main>
  );
}