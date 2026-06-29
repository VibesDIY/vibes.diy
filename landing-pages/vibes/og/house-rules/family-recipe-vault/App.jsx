import React, { useState, useRef, useEffect } from "react"
import { useFireproof } from "use-fireproof"

const OCCASIONS = ["Thanksgiving", "Hanukkah", "Sunday", "Birthday"];

const classNames = {
  page: "min-h-screen bg-[#f5ecd9] p-4 font-serif text-[#2a1d0f]",
  header: "max-w-6xl mx-auto mb-4 p-5 bg-[#fffaf0] border-[3px] border-[#2a1d0f] rounded shadow-[6px_6px_0px_#2a1d0f]",
  title: "text-4xl font-bold tracking-tight",
  subtitle: "text-sm italic text-[#6b4f2a] mt-1",
  grid: "max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4",
  feature: "p-4 bg-[#fffaf0] border-[3px] border-[#2a1d0f] rounded shadow-[4px_4px_0px_#2a1d0f]",
  featureTitle: "text-xl font-bold mb-3 border-b-2 border-[#2a1d0f] pb-2",
  chip: "inline-block px-3 py-1 mr-1 mb-1 text-xs uppercase tracking-wide border-2 border-[#2a1d0f] rounded cursor-pointer bg-[#f5ecd9]",
  chipActive: "inline-block px-3 py-1 mr-1 mb-1 text-xs uppercase tracking-wide border-2 border-[#2a1d0f] rounded cursor-pointer bg-[#c97a4a] text-white",
  input: "w-full p-2 mb-2 bg-[#fffaf0] border-2 border-[#2a1d0f] rounded font-serif",
  btn: "px-4 py-2 bg-[#c97a4a] text-white border-[3px] border-[#2a1d0f] rounded font-bold uppercase tracking-wide shadow-[3px_3px_0px_#2a1d0f] hover:shadow-[5px_5px_0px_#2a1d0f]",
  btnMic: "w-full p-4 bg-[#e8b04a] border-[3px] border-[#2a1d0f] rounded font-bold uppercase tracking-wide shadow-[3px_3px_0px_#2a1d0f] select-none",
  btnMicActive: "w-full p-4 bg-[#c94a4a] text-white border-[3px] border-[#2a1d0f] rounded font-bold uppercase tracking-wide shadow-[3px_3px_0px_#2a1d0f] select-none",
  railItem: "p-2 mb-1 border-2 border-[#2a1d0f] rounded bg-[#f5ecd9] cursor-pointer hover:bg-[#e8b04a]",
  occasionHeader: "text-xs uppercase tracking-widest text-[#6b4f2a] mt-3 mb-1 font-bold",
};

function RecipeRail({ recipes, selectedId, setSelectedId, filter, setFilter }) {
  const filtered = filter ? recipes.filter(r => (r.occasions || []).includes(filter)) : recipes;
  const grouped = {};
  OCCASIONS.forEach(o => { grouped[o] = []; });
  grouped["Other"] = [];
  filtered.forEach(r => {
    const occs = (r.occasions || []).filter(o => OCCASIONS.includes(o));
    if (occs.length === 0) grouped["Other"].push(r);
    else occs.forEach(o => grouped[o].push(r));
  });

  return (
    <section id="recipe-rail" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Recipe Box</h2>
      <div className="mb-3">
        <span onClick={() => setFilter(null)} className={filter === null ? classNames.chipActive : classNames.chip}>All</span>
        {OCCASIONS.map(o => (
          <span key={o} onClick={() => setFilter(o)} className={filter === o ? classNames.chipActive : classNames.chip}>{o}</span>
        ))}
      </div>
      {recipes.length === 0 && <div className="text-sm italic text-[#6b4f2a]">No recipes yet — add one below.</div>}
      {Object.entries(grouped).map(([occ, list]) => list.length > 0 && (
        <div key={occ}>
          <div className={classNames.occasionHeader}>{occ}</div>
          {list.map(r => (
            <div key={r._id} onClick={() => setSelectedId(r._id)} className={classNames.railItem} style={selectedId === r._id ? { background: "#e8b04a" } : {}}>
              <div className="font-bold text-sm">{r.title}</div>
              <div className="text-xs italic text-[#6b4f2a]">{r.contributor}</div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function RecipeCard({ recipe, database }) {
  if (!recipe) {
    return (
      <section id="recipe-card" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Recipe Card</h2>
        <div className="text-sm italic text-[#6b4f2a]">Select a recipe from the box, or add a new one below.</div>
      </section>
    );
  }
  return (
    <section id="recipe-card" className={classNames.feature}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-3xl font-bold leading-tight">{recipe.title}</h2>
          <div className="text-sm italic text-[#6b4f2a]">from {recipe.contributor}</div>
        </div>
        <button onClick={() => { if (confirm("Delete this recipe?")) database.del(recipe._id); }} className="text-xs underline text-[#6b4f2a]">delete</button>
      </div>
      <div className="mb-3">
        {(recipe.occasions || []).map(o => <span key={o} className={classNames.chip}>{o}</span>)}
      </div>
      <div className="border-t-2 border-dashed border-[#6b4f2a] pt-3 mb-3">
        <div className={classNames.occasionHeader}>Ingredients</div>
        <ul className="list-disc pl-6 text-base leading-relaxed">
          {(recipe.ingredients || []).map((ing, i) => <li key={i}>{ing}</li>)}
        </ul>
      </div>
      <div className="border-t-2 border-dashed border-[#6b4f2a] pt-3">
        <div className={classNames.occasionHeader}>Steps</div>
        <div className="text-base leading-relaxed whitespace-pre-wrap">{recipe.steps}</div>
      </div>
    </section>
  );
}

function RecipeForm({ database, setSelectedId }) {
  const [title, setTitle] = useState("");
  const [contributor, setContributor] = useState("");
  const [occasions, setOccasions] = useState([]);
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);

  const toggleOccasion = (o) => {
    setOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
  };

  const save = async () => {
    if (!title.trim()) return;
    const ok = await database.put({
      type: "recipe",
      title: title.trim(),
      contributor: contributor.trim() || "Anonymous",
      occasions,
      ingredients: ingredients.split("\n").map(s => s.trim()).filter(Boolean),
      steps: steps.trim(),
      transcript,
      createdAt: Date.now(),
    });
    setSelectedId(ok.id);
    setTitle(""); setContributor(""); setOccasions([]); setIngredients(""); setSteps(""); setTranscript("");
  };

  return (
    <section id="recipe-form" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Add a Recipe</h2>
      <input className={classNames.input} placeholder="Recipe title (e.g. Aunt Ruth's Brisket)" value={title} onChange={e => setTitle(e.target.value)} />
      <input className={classNames.input} placeholder="Contributor (who shared it?)" value={contributor} onChange={e => setContributor(e.target.value)} />
      <div className="mb-2">
        <div className={classNames.occasionHeader}>Occasions</div>
        {OCCASIONS.map(o => (
          <span key={o} onClick={() => toggleOccasion(o)} className={occasions.includes(o) ? classNames.chipActive : classNames.chip}>{o}</span>
        ))}
      </div>
      <div className={classNames.occasionHeader}>Ingredients (one per line)</div>
      <textarea className={classNames.input} rows={4} placeholder="2 cups flour&#10;1 tsp salt&#10;..." value={ingredients} onChange={e => setIngredients(e.target.value)} />
      <div className={classNames.occasionHeader}>Steps</div>
      <textarea className={classNames.input} rows={5} placeholder="Mix, bake, share..." value={steps} onChange={e => setSteps(e.target.value)} />
      <RecordButton recording={recording} setRecording={setRecording} recognitionRef={recognitionRef} transcript={transcript} setTranscript={setTranscript} setSteps={setSteps} />
      {transcript && <div className="mt-2 p-2 bg-[#f5ecd9] border-2 border-dashed border-[#6b4f2a] rounded text-sm italic">Live: {transcript}</div>}
      <button onClick={save} className={classNames.btn + " mt-3"}>Save to Box</button>
    </section>
  );
}

function RecordButton({ recording, setRecording, recognitionRef, transcript, setTranscript, setSteps }) {
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser."); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setTranscript(finalText + interim);
    };
    rec.onend = () => {
      if (finalText.trim()) {
        setSteps(prev => (prev ? prev + "\n" : "") + finalText.trim());
      }
      setRecording(false);
      setTranscript("");
    };
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };
  const stop = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };
  return (
    <button
      onMouseDown={start} onMouseUp={stop} onMouseLeave={() => recording && stop()}
      onTouchStart={(e) => { e.preventDefault(); start(); }} onTouchEnd={(e) => { e.preventDefault(); stop(); }}
      className={recording ? classNames.btnMicActive : classNames.btnMic}
    >
      {recording ? "● Recording — release to save" : "🎙 Hold to Record Steps"}
    </button>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("family-recipe-box");
  const { docs: recipes } = useLiveQuery("type", { key: "recipe" });
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState(null);

  const selected = recipes.find(r => r._id === selectedId) || null;

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Family Recipe Box</h1>
        <div className={classNames.subtitle}>Grandma's index cards, passed around the kitchen</div>
      </header>
      <div className={classNames.grid}>
        <RecipeRail recipes={recipes} selectedId={selectedId} setSelectedId={setSelectedId} filter={filter} setFilter={setFilter} />
        <div>
          <RecipeCard recipe={selected} database={database} />
          <div className="h-4" />
          <RecipeForm database={database} setSelectedId={setSelectedId} />
        </div>
      </div>
    </main>
  );
}