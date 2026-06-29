import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-[Space_Grotesk,sans-serif]",
  header: "max-w-3xl mx-auto mb-6",
  title: "text-4xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#18181b] rounded shadow-[4px_4px_0px_#18181b]",
  featureTitle: "text-lg font-bold uppercase mb-2 tracking-wide",
};

function PasteInput({ onGenerate, isLoading }) {
  const [text, setText] = useState("");
  return (
    <section id="paste-input" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Paste Profile</h2>
      <p className="text-xs uppercase tracking-widest text-[#52525b] mb-2">Select all + copy on any profile</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste raw LinkedIn text here..."
        className="w-full p-3 border-[3px] border-[#18181b] rounded font-mono text-sm mb-3 focus:outline-none focus:shadow-[4px_4px_0px_#18181b]"
      />
      <div className="flex gap-3 flex-wrap">
        <button
          disabled={isLoading || !text.trim()}
          onClick={() => onGenerate(text)}
          className="px-4 py-2 bg-[#dc2626] text-white font-bold uppercase tracking-wide border-[3px] border-[#18181b] rounded shadow-[4px_4px_0px_#18181b] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#18181b] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42 100" />
              </svg>
              Cringing...
            </span>
          ) : "Generate Parody"}
        </button>
        <button
          onClick={() => setText(SAMPLE)}
          disabled={isLoading}
          className="px-4 py-2 bg-[#fde047] font-bold uppercase tracking-wide border-[3px] border-[#18181b] rounded shadow-[3px_3px_0px_#18181b] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#18181b] transition-all text-sm"
        >
          Load Sample
        </button>
      </div>
    </section>
  );
}

const SAMPLE = `Jane Smith
Senior Product Manager at TechCorp | Driving Innovation
San Francisco Bay Area
500+ connections

About
Passionate product leader with 8 years of experience building user-centric solutions. Previously at BigCo and StartupXYZ.

Experience
Senior Product Manager - TechCorp
2021 - Present
Leading cross-functional teams to ship products used by millions.`;

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "??";
}

function Preview({ profile }) {
  if (!profile) {
    return (
      <section id="preview" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Latest Parody</h2>
        <p className="text-sm text-[#52525b]">Paste a profile above to generate your first cringe masterpiece.</p>
      </section>
    );
  }
  return (
    <section id="preview" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Latest Parody</h2>
      <div className="flex items-center gap-4 mb-4 pb-4 border-b-[3px] border-[#18181b]">
        <div className="w-20 h-20 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-2xl font-bold border-[3px] border-[#18181b] shadow-[4px_4px_0px_#18181b]">
          {initials(profile.realName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-[#52525b]">Formerly</div>
          <div className="font-bold text-lg truncate">{profile.realName}</div>
          <div className="text-sm text-[#52525b] truncate">{profile.realRole}</div>
        </div>
      </div>
      <div className="bg-[#fde047] border-[3px] border-[#18181b] rounded p-3 mb-3">
        <div className="text-xs uppercase tracking-widest mb-1">New Headline</div>
        <div className="font-bold text-lg leading-tight">{profile.parodyHeadline}</div>
      </div>
      <div className="mb-3">
        <div className="text-xs uppercase tracking-widest text-[#52525b] mb-2">Accomplishments</div>
        <ul className="space-y-2">
          {profile.absurdAccomplishments?.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="font-mono font-bold text-[#dc2626]">0{i+1}</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-[#f5f1e8] border-[3px] border-[#18181b] rounded p-3">
        <div className="text-xs uppercase tracking-widest text-[#52525b] mb-1">Pinned Post</div>
        <p className="text-sm italic leading-relaxed">"{profile.humblebragPost}"</p>
      </div>
    </section>
  );
}

function Gallery({ docs, onSelect, onDelete }) {
  return (
    <section id="gallery" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Saved Parodies ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-[#52525b]">Nothing cringe yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d._id} className="flex items-center gap-3 p-2 border-[3px] border-[#18181b] rounded bg-[#f5f1e8] hover:bg-[#fde047] transition-colors">
              <button onClick={() => onSelect(d._id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full bg-[#16a34a] text-white flex items-center justify-center text-sm font-bold border-[3px] border-[#18181b] shrink-0">
                  {initials(d.realName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate">{d.realName}</div>
                  <div className="text-xs text-[#52525b] truncate">{d.parodyHeadline}</div>
                </div>
              </button>
              <button
                onClick={() => onDelete(d._id)}
                className="px-2 py-1 bg-[#dc2626] text-white text-xs font-bold uppercase border-[3px] border-[#18181b] rounded hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              >
                Del
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("cringeleader-db");
  const { docs } = useLiveQuery("type", { key: "parody", descending: true });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const latest = selectedId ? docs.find(d => d._id === selectedId) : docs[0];

  async function handleGenerate(raw) {
    setIsLoading(true);
    try {
      const prompt = `From this LinkedIn profile text, extract the real name, headline, and current role. Then generate an absurd parody "thought leader" version with a ridiculous inflated headline, 3 completely absurd accomplishments, and one cringe-worthy humblebrag post (2-3 sentences). Keep it satirical but not mean.\n\nPROFILE:\n${raw}`;
      const resp = await callAI(prompt, {
        schema: {
          properties: {
            realName: { type: "string" },
            realHeadline: { type: "string" },
            realRole: { type: "string" },
            parodyHeadline: { type: "string", description: "Absurd buzzword-heavy thought leader headline" },
            absurdAccomplishments: { type: "array", items: { type: "string" } },
            humblebragPost: { type: "string" },
          }
        }
      });
      const data = JSON.parse(resp);
      const ok = await database.put({ type: "parody", createdAt: Date.now(), ...data });
      setSelectedId(ok.id);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>CringeLeader</h1>
        <p className="text-sm uppercase tracking-widest text-[#52525b] mt-1">Parody Profile Generator</p>
      </header>
      <PasteInput onGenerate={handleGenerate} isLoading={isLoading} />
      <Preview profile={latest} />
      <Gallery docs={docs} onSelect={setSelectedId} onDelete={(id) => database.del(id)} />
    </main>
  );
}