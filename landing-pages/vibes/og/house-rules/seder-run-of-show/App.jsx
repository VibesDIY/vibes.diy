import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-['Space_Grotesk',sans-serif]",
  header: "max-w-2xl mx-auto mb-5 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  title: "text-2xl font-bold uppercase tracking-tight text-[#1a1625]",
  subtitle: "text-xs uppercase tracking-[0.15em] text-[#7a7687] mt-1",
  feature: "max-w-2xl mx-auto mb-4 bg-white border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]",
  featureTitle: "text-sm font-bold uppercase tracking-[0.08em] text-[#1a1625] mb-3",
};

function UpNextBanner({ show }) {
  if (!show || !show.steps || show.steps.length === 0) return null;
  const steps = [...show.steps].sort((a, b) => a.order - b.order);
  const next = steps.find(s => !s.done);
  const done = steps.filter(s => s.done).length;

  if (!next) {
    return (
      <section id="up-next" className="max-w-2xl mx-auto mb-4 bg-[#4a8a4e] border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white mb-1">All Done</h2>
        <p className="text-lg font-bold text-white">The meal is served. Rest easy.</p>
      </section>
    );
  }

  return (
    <section id="up-next" className="max-w-2xl mx-auto mb-4 bg-[#e8c547] border-[3px] border-[#1a1625] rounded p-4 shadow-[4px_4px_0px_#1a1625]">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a1625]">Up Next</h2>
        <span className="font-mono text-xs text-[#1a1625]">{done}/{steps.length} done</span>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        {next.time && <span className="font-mono text-xl font-bold text-[#1a1625]">{next.time}</span>}
        <span className="text-lg font-bold text-[#1a1625]">{next.action}</span>
      </div>
      {next.who && <div className="mt-1 text-sm text-[#1a1625]"><span className="uppercase tracking-[0.08em] text-xs font-bold">Who:</span> {next.who}</div>}
      {next.notes && <div className="text-xs text-[#1a1625] italic mt-0.5">{next.notes}</div>}
    </section>
  );
}

function AddStep({ database, show, useDocument }) {
  const { doc, merge, submit } = useDocument({
    type: "step-draft",
    time: "",
    action: "",
    who: "",
    notes: "",
  });

  if (!show) {
    return (
      <section id="add-step" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Name the Meal</h2>
        <NewShowForm database={database} />
      </section>
    );
  }

  async function addStep(e) {
    e.preventDefault();
    if (!doc.action.trim()) return;
    const nextOrder = (show.steps?.length || 0) + 1;
    const step = {
      order: nextOrder,
      time: doc.time,
      action: doc.action,
      who: doc.who,
      notes: doc.notes,
      done: false,
    };
    await database.put({ ...show, steps: [...(show.steps || []), step] });
    merge({ time: "", action: "", who: "", notes: "" });
  }

  return (
    <section id="add-step" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Add Step</h2>
      <form onSubmit={addStep} className="grid grid-cols-[90px_1fr] gap-2">
        <input value={doc.time} onChange={e => merge({ time: e.target.value })} placeholder="5:45" className="px-2 py-2 border-[3px] border-[#1a1625] rounded font-mono text-sm" />
        <input value={doc.action} onChange={e => merge({ action: e.target.value })} placeholder="start the brisket" className="px-2 py-2 border-[3px] border-[#1a1625] rounded text-sm" />
        <input value={doc.who} onChange={e => merge({ who: e.target.value })} placeholder="who" className="px-2 py-2 border-[3px] border-[#1a1625] rounded text-sm" />
        <input value={doc.notes} onChange={e => merge({ notes: e.target.value })} placeholder="notes (optional)" className="px-2 py-2 border-[3px] border-[#1a1625] rounded text-sm" />
        <button type="submit" className="col-span-2 px-4 py-2 bg-[#d4422f] text-white border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] font-bold uppercase tracking-[0.08em] text-sm hover:shadow-[5px_5px_0px_#1a1625] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
          Add to Timeline
        </button>
      </form>
    </section>
  );
}

function NewShowForm({ database }) {
  const [name, setName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await database.put({ type: "show", name, steps: [], createdAt: Date.now() });
    setName("");
  }
  async function suggest() {
    setIsLoading(true);
    try {
      const r = await callAI("Suggest one warm holiday meal name like 'Passover Seder 2025' or 'Thanksgiving Dinner'", {
        schema: { properties: { name: { type: "string" } } }
      });
      setName(JSON.parse(r).name);
    } finally { setIsLoading(false); }
  }
  return (
    <form onSubmit={create} className="flex flex-col gap-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Thanksgiving Dinner" className="px-3 py-2 border-[3px] border-[#1a1625] rounded text-sm" />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 px-4 py-2 bg-[#4a8a4e] text-white border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] font-bold uppercase tracking-[0.08em] text-sm">Start Planning</button>
        <button type="button" onClick={suggest} disabled={isLoading} className="px-3 py-2 bg-[#e8c547] border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] font-bold uppercase tracking-[0.08em] text-xs">
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#1a1625" strokeWidth="3" strokeDasharray="30" strokeLinecap="round" /></svg>
          ) : "Suggest"}
        </button>
      </div>
    </form>
  );
}

function Timeline({ database, show, shows }) {
  const [dragIdx, setDragIdx] = React.useState(null);
  const [savingTpl, setSavingTpl] = React.useState(false);

  if (!show) {
    return (
      <section id="timeline" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Run of Show</h2>
        <p className="text-xs text-[#7a7687] uppercase tracking-[0.15em]">No show yet · name the meal above</p>
        {shows.filter(s => s.templateOf).length > 0 && (
          <div className="mt-4 pt-4 border-t-2 border-[#1a1625]">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[#7a7687] mb-2">Templates</h3>
            <div className="flex flex-col gap-2">
              {shows.filter(s => s.templateOf).map(t => (
                <button key={t._id} onClick={async () => {
                  await database.put({ type: "show", name: t.name.replace(/ template$/i, ""), steps: t.steps.map(s => ({...s, done: false})), createdAt: Date.now() });
                }} className="text-left px-3 py-2 bg-[#f5f1e8] border-[3px] border-[#1a1625] rounded text-sm hover:bg-[#e8c547]">
                  Use "{t.name}" ({t.steps.length} steps)
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  const steps = [...(show.steps || [])].sort((a, b) => a.order - b.order);

  async function toggle(idx) {
    const next = steps.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    await database.put({ ...show, steps: next });
  }
  async function remove(idx) {
    const next = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    await database.put({ ...show, steps: next });
  }
  async function onDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const next = [...steps];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    const reordered = next.map((s, i) => ({ ...s, order: i + 1 }));
    await database.put({ ...show, steps: reordered });
    setDragIdx(null);
  }
  async function saveTemplate() {
    setSavingTpl(true);
    try {
      await database.put({
        type: "show",
        name: show.name + " Template",
        steps: steps.map(s => ({ ...s, done: false })),
        templateOf: show._id,
        createdAt: Date.now(),
      });
    } finally { setSavingTpl(false); }
  }

  const firstPending = steps.findIndex(s => !s.done);

  return (
    <section id="timeline" className={classNames.feature}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={classNames.featureTitle + " mb-0"}>Run of Show</h2>
        <button onClick={saveTemplate} disabled={savingTpl || steps.length === 0} className="px-3 py-1.5 bg-[#3a6fb0] text-white border-[3px] border-[#1a1625] rounded shadow-[3px_3px_0px_#1a1625] font-bold uppercase tracking-[0.08em] text-[0.65rem] disabled:opacity-40">
          {savingTpl ? "Saving..." : "Save Template"}
        </button>
      </div>
      {steps.length === 0 && <p className="text-xs text-[#7a7687] uppercase tracking-[0.15em]">Add your first step above</p>}
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const accent = i === firstPending ? "#e8c547" : s.done ? "#4a8a4e" : "#f5f1e8";
          return (
            <li key={i}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="flex items-start gap-2 p-2 border-[3px] border-[#1a1625] rounded bg-white"
              style={{ borderLeftWidth: "10px", borderLeftColor: accent }}>
              <input type="checkbox" checked={!!s.done} onChange={() => toggle(i)} className="mt-1 w-5 h-5 accent-[#4a8a4e]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {s.time && <span className="font-mono text-sm font-bold text-[#1a1625]">{s.time}</span>}
                  <span className={`text-sm ${s.done ? "line-through text-[#7a7687]" : "text-[#1a1625]"}`}>{s.action}</span>
                </div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {s.who && <span className="text-[0.65rem] uppercase tracking-[0.12em] px-1.5 py-0.5 bg-[#e8c547] border-2 border-[#1a1625] rounded">{s.who}</span>}
                  {s.notes && <span className="text-xs text-[#7a7687] italic">{s.notes}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[#7a7687] cursor-grab select-none text-sm leading-none">⋮⋮</span>
                <button onClick={() => remove(i)} className="text-[#d4422f] text-xs font-bold">✕</button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery, useDocument } = useFireproof("run-of-show");
  const { docs: shows } = useLiveQuery("type", { key: "show", descending: true });
  const activeShow = shows.find(s => !s.templateOf) || shows[0];
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Run of Show</h1>
        <p className={classNames.subtitle}>{activeShow ? activeShow.name : "Host clipboard · shared live"}</p>
      </header>
      <UpNextBanner show={activeShow} />
      <AddStep database={database} show={activeShow} useDocument={useDocument} />
      <Timeline database={database} show={activeShow} shows={shows} />
    </main>
  );
}