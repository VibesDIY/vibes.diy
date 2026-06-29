import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-2xl mx-auto mb-6 p-5 bg-white border-[3px] border-[#15141c] rounded-[4px] shadow-[6px_6px_0px_#15141c]",
  title: "text-3xl md:text-4xl font-bold uppercase tracking-tight text-[#15141c]",
  subtitle: "text-xs uppercase tracking-[0.15em] text-[#7a7580] mt-1",
  feature: "max-w-2xl mx-auto mb-5 p-5 bg-white border-[3px] border-[#15141c] rounded-[4px] shadow-[4px_4px_0px_#15141c]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] mb-3 text-[#15141c]",
  label: "block text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#7a7580] mb-2",
  input: "w-full p-3 border-[3px] border-[#15141c] rounded-[4px] bg-white text-[#15141c] font-medium focus:outline-none focus:shadow-[3px_3px_0px_#15141c] transition-all",
  btnPrimary: "px-5 py-3 bg-[#d94a2e] text-white border-[3px] border-[#15141c] rounded-[4px] font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#15141c] hover:shadow-[6px_6px_0px_#15141c] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-60",
  btnSecondary: "px-3 py-2 bg-[#e8c547] text-[#15141c] border-[3px] border-[#15141c] rounded-[4px] font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_#15141c] hover:shadow-[5px_5px_0px_#15141c] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all",
  btnGhost: "px-3 py-2 bg-white text-[#15141c] border-[3px] border-[#15141c] rounded-[4px] font-bold uppercase tracking-wider text-xs hover:shadow-[3px_3px_0px_#15141c] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all",
  card: "p-4 bg-white border-[3px] border-[#15141c] rounded-[4px] shadow-[3px_3px_0px_#15141c] mb-3",


function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin inline-block align-middle">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeDasharray="42 20" strokeLinecap="round"/>
    </svg>
  );
}
function ForgeInput({ topic, setTopic, onForge, onSuggest, isForging, isSuggesting }) {
  return (
    <section id="forge" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Forge New Bait</h2>
      <label className={classNames.label}>Your Topic</label>
      <input
        className={classNames.input}
        placeholder="e.g. waking up at 4am"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onForge(); }}
      />
      <div className="flex gap-2 mt-3 flex-wrap">
        <button onClick={onForge} disabled={isForging || !topic.trim()} className={classNames.btnPrimary}>
          {isForging ? <><Spinner /> Forging...</> : "Forge 5 Questions"}
        </button>
        <button onClick={onSuggest} disabled={isSuggesting} className={classNames.btnGhost}>
          {isSuggesting ? <><Spinner /> ...</> : "Suggest Topic"}
        </button>
      </div>
    </section>
  );
}

function LatestBatch({ questions, topic, onSave }) {
  if (!questions || questions.length === 0) {
    return (
      <section id="latest" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Latest Batch</h2>
        <p className="text-sm text-[#7a7580]">Enter a topic above to manifest your next viral moment.</p>
      </section>
    );
  }
  return (
    <section id="latest" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Latest Batch · {topic}</h2>
      {questions.map((q, i) => (
        <div key={i} className={classNames.card}>
          <div className="flex items-start gap-3">
            <span className="font-mono text-lg font-bold text-[#d94a2e]">0{i+1}</span>
            <p className="flex-1 text-[0.95rem] leading-snug text-[#15141c]">{q}</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => onSave(q, topic)} className={classNames.btnSecondary}>Save to Archive</button>
            <button onClick={() => navigator.clipboard?.writeText(q)} className={classNames.btnGhost}>Copy</button>
          </div>
        </div>
      ))}
    </section>
  );
}

function Archive({ saved, onDelete }) {
  return (
    <section id="archive" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Cringe Archive ({saved.length})</h2>
      {saved.length === 0 ? (
        <p className="text-sm text-[#7a7580]">No saved bait yet. The feed awaits.</p>
      ) : (
        saved.map(doc => (
          <div key={doc._id} className={classNames.card}>
            <span className={`${classNames.tag} bg-[#4a9d5e] text-white mb-2`}>{doc.topic}</span>
            <p className="text-[0.9rem] leading-snug text-[#15141c] mt-2">{doc.question}</p>
            <button onClick={() => onDelete(doc)} className={`${classNames.btnGhost} mt-3`}>Delete</button>
          </div>
        ))
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("cringe-post-forge");
  const [topic, setTopic] = React.useState("");
  const [questions, setQuestions] = React.useState([]);
  const [lastTopic, setLastTopic] = React.useState("");
  const [isForging, setIsForging] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const { docs: saved } = useLiveQuery("_id", { descending: true });

  async function forge() {
    if (!topic.trim() || isForging) return;
    setIsForging(true);
    try {
      const res = await callAI(
        `Generate 5 maximally cringe, self-important LinkedIn "thought leader" engagement-bait questions about: "${topic}". Each must sound like a humblebrag wrapped in fake vulnerability, reference a vague life lesson, and END with exactly one of: "Agree? 👇", "Thoughts?", or "Who else?". Keep each under 280 chars. Be parody-level cringe.`,
        { schema: { properties: { questions: { type: "array", items: { type: "string" } } } } }
      );
      const parsed = JSON.parse(res);
      setQuestions(parsed.questions || []);
      setLastTopic(topic);
    } catch (e) { console.error(e); } finally { setIsForging(false); }
  }

  async function suggestTopic() {
    if (isSuggesting) return;
    setIsSuggesting(true);
    try {
      const res = await callAI(
        `Suggest one short, specific, cringe-worthy LinkedIn topic (3-6 words) a thought leader would post about. Examples: "waking up at 4am", "firing my best friend", "cold showers changed me".`,
        { schema: { properties: { topic: { type: "string" } } } }
      );
      setTopic(JSON.parse(res).topic || "");
    } catch (e) { console.error(e); } finally { setIsSuggesting(false); }
  }

  async function saveQ(question, t) {
    await database.put({ type: "cringe", question, topic: t, createdAt: Date.now() });
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className="flex h-[6px] mb-3 -mx-5 -mt-5">
          <div className="flex-1 bg-[#d94a2e]"></div>
          <div className="flex-1 bg-[#e8c547]"></div>
          <div className="flex-1 bg-[#4a9d5e]"></div>
          <div className="flex-1 bg-[#3a6ec7]"></div>
        </div>
        <h1 className={classNames.title}>Cringe Post Forge</h1>
        <p className={classNames.subtitle}>Professional Thought Leader Simulator</p>
      </header>
      <ForgeInput
        topic={topic} setTopic={setTopic}
        onForge={forge} onSuggest={suggestTopic}
        isForging={isForging} isSuggesting={isSuggesting}
      />
      <LatestBatch questions={questions} topic={lastTopic} onSave={saveQ} />
      <Archive saved={saved.filter(d => d.type === "cringe")} onDelete={(d) => database.del(d._id)} />
    </main>
  );
}