import React, { useState, useEffect, useRef } from "react"
import { useFireproof } from "use-fireproof"

// [number, symbol, name, row, col, category]
const ELEMENTS = [
  [1,"H","Hydrogen",1,1,"nonmetal"],[2,"He","Helium",1,18,"noble"],
  [3,"Li","Lithium",2,1,"alkali"],[4,"Be","Beryllium",2,2,"alkaline"],
  [5,"B","Boron",2,13,"metalloid"],[6,"C","Carbon",2,14,"nonmetal"],
  [7,"N","Nitrogen",2,15,"nonmetal"],[8,"O","Oxygen",2,16,"nonmetal"],
  [9,"F","Fluorine",2,17,"halogen"],[10,"Ne","Neon",2,18,"noble"],
  [11,"Na","Sodium",3,1,"alkali"],[12,"Mg","Magnesium",3,2,"alkaline"],
  [13,"Al","Aluminum",3,13,"postmetal"],[14,"Si","Silicon",3,14,"metalloid"],
  [15,"P","Phosphorus",3,15,"nonmetal"],[16,"S","Sulfur",3,16,"nonmetal"],
  [17,"Cl","Chlorine",3,17,"halogen"],[18,"Ar","Argon",3,18,"noble"],
  [19,"K","Potassium",4,1,"alkali"],[20,"Ca","Calcium",4,2,"alkaline"],
  [21,"Sc","Scandium",4,3,"transition"],[22,"Ti","Titanium",4,4,"transition"],
  [23,"V","Vanadium",4,5,"transition"],[24,"Cr","Chromium",4,6,"transition"],
  [25,"Mn","Manganese",4,7,"transition"],[26,"Fe","Iron",4,8,"transition"],
  [27,"Co","Cobalt",4,9,"transition"],[28,"Ni","Nickel",4,10,"transition"],
  [29,"Cu","Copper",4,11,"transition"],[30,"Zn","Zinc",4,12,"transition"],
  [31,"Ga","Gallium",4,13,"postmetal"],[32,"Ge","Germanium",4,14,"metalloid"],
  [33,"As","Arsenic",4,15,"metalloid"],[34,"Se","Selenium",4,16,"nonmetal"],
  [35,"Br","Bromine",4,17,"halogen"],[36,"Kr","Krypton",4,18,"noble"],
];

const CAT_COLORS = {
  alkali: "bg-[#e63946] text-white",
  alkaline: "bg-[#f4a261] text-[#111118]",
  transition: "bg-[#e9c46a] text-[#111118]",
  postmetal: "bg-[#a8dadc] text-[#111118]",
  metalloid: "bg-[#8ecae6] text-[#111118]",
  nonmetal: "bg-[#90be6d] text-[#111118]",
  halogen: "bg-[#277da1] text-white",
  noble: "bg-[#6a4c93] text-white",
};

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-['Space_Grotesk',sans-serif] text-[#111118]",
  header: "max-w-5xl mx-auto mb-6 bg-white border-[3px] border-[#111118] rounded p-4 shadow-[4px_4px_0px_#111118]",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-5xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#111118] rounded shadow-[4px_4px_0px_#111118]",
  featureTitle: "text-lg font-bold uppercase tracking-wide mb-3",
};

function HomeScreen({ setView }) {
  const { useLiveQuery } = useFireproof("element-arcade");
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true });

  const bestByKey = {};
  sessions.forEach(s => {
    const k = `${s.mode}|${s.difficulty}`;
    if (!bestByKey[k] || s.score > bestByKey[k].score || (s.score === bestByKey[k].score && s.time < bestByKey[k].time)) {
      bestByKey[k] = s;
    }
  });
  const pbIds = new Set(Object.values(bestByKey).map(s => s._id));

  return (
    <section id="home" className={classNames.feature}>
      <div className="flex gap-3 mb-4 flex-wrap">
        <button onClick={() => setView({ name: "config" })}
          className="px-4 py-3 bg-[#e63946] text-white font-bold uppercase tracking-wide border-[3px] border-[#111118] rounded shadow-[4px_4px_0px_#111118] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111118] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          Start Quiz
        </button>
        <button onClick={() => setView({ name: "study" })}
          className="px-4 py-3 bg-[#e9c46a] text-[#111118] font-bold uppercase tracking-wide border-[3px] border-[#111118] rounded shadow-[3px_3px_0px_#111118] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#111118] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          Study Mode
        </button>
      </div>
      <h3 className="text-xs uppercase tracking-widest text-[#555] mb-2">Past Sessions</h3>
      {sessions.length === 0 && <p className="text-sm text-[#666]">No sessions yet — start your first quiz!</p>}
      <ul className="space-y-2">
        {sessions.slice(0, 10).map(s => (
          <li key={s._id} className={`p-2 border-[2px] border-[#111118] rounded flex justify-between items-center text-sm ${pbIds.has(s._id) ? "bg-[#e9c46a]" : "bg-[#f5f1e8]"}`}>
            <span className="font-mono">{s.score}/10</span>
            <span className="uppercase text-xs">{s.mode} · {s.difficulty}</span>
            <span className="font-mono text-xs">{s.time}s</span>
            {pbIds.has(s._id) && <span className="text-[10px] font-bold uppercase bg-[#111118] text-[#e9c46a] px-2 py-0.5 rounded">PB</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuizConfig({ setView }) {
  const [mode, setMode] = useState("mixed");
  const [difficulty, setDifficulty] = useState(20);
  const modes = [["name","Find by Name"],["symbol","Find by Symbol"],["number","Find by Number"],["mixed","Mixed"]];
  const diffs = [[20,"First 20"],[36,"First 36"]];

  const btn = (active) => `px-3 py-2 border-[3px] border-[#111118] rounded font-bold uppercase text-xs tracking-wide transition-all ${active ? "bg-[#e63946] text-white shadow-[3px_3px_0px_#111118]" : "bg-white text-[#111118] hover:bg-[#f5f1e8]"}`;

  return (
    <section id="quiz-config" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>New Quiz</h2>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-[#555] mb-2">Mode</p>
        <div className="flex flex-wrap gap-2">
          {modes.map(([k,l]) => <button key={k} onClick={() => setMode(k)} className={btn(mode===k)}>{l}</button>)}
        </div>
      </div>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-[#555] mb-2">Difficulty</p>
        <div className="flex flex-wrap gap-2">
          {diffs.map(([k,l]) => <button key={k} onClick={() => setDifficulty(k)} className={btn(difficulty===k)}>{l} Elements</button>)}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setView({ name: "play", config: { mode, difficulty } })}
          className="px-4 py-3 bg-[#90be6d] text-[#111118] font-bold uppercase tracking-wide border-[3px] border-[#111118] rounded shadow-[4px_4px_0px_#111118] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#111118] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          Start
        </button>
        <button onClick={() => setView({ name: "home" })}
          className="px-4 py-3 bg-white font-bold uppercase tracking-wide border-[3px] border-[#111118] rounded hover:bg-[#f5f1e8] transition-all">
          Back
        </button>
      </div>
    </section>
  );
}

function PeriodicTable({ pool, renderCell, onClick, flashId, revealedIds }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-[3px] min-w-[560px]" style={{ gridTemplateColumns: "repeat(18, minmax(28px,1fr))", gridAutoRows: "minmax(40px,auto)" }}>
        {pool.map(el => {
          const [num, sym, name, row, col, cat] = el;
          const revealed = revealedIds && revealedIds.has(num);
          const flashing = flashId === num;
          const base = `border-[2px] border-[#111118] rounded flex flex-col items-center justify-center cursor-pointer select-none transition-all p-1`;
          const color = revealed ? "bg-[#90be6d] text-[#111118]" : flashing ? "bg-[#e63946] text-white animate-pulse" : CAT_COLORS[cat] || "bg-white";
          return (
            <div key={num}
              onClick={() => onClick && onClick(el)}
              style={{ gridRow: row, gridColumn: col }}
              className={`${base} ${color} hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_#111118]`}>
              {renderCell(el, revealed)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuizPlay({ setView, config }) {
  const pool = ELEMENTS.filter(e => e[0] <= config.difficulty);

  const [questions] = useState(() => {
    const qs = [];
    const used = new Set();
    while (qs.length < 10) {
      const el = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(el[0]) && used.size < pool.length) continue;
      used.add(el[0]);
      const mode = config.mode === "mixed" ? ["name","symbol","number"][Math.floor(Math.random()*3)] : config.mode;
      qs.push({ el, mode });
      if (used.size >= pool.length) used.clear();
    }
    return qs;
  });

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(new Set());
  const [flashId, setFlashId] = useState(null);
  const [results, setResults] = useState([]);
  const [startTime] = useState(Date.now());

  const current = questions[idx];
  const promptText = !current ? "" :
    current.mode === "name" ? `Click ${current.el[2]} (${current.el[1]})` :
    current.mode === "symbol" ? `Click ${current.el[1]}` :
    `Click element ${current.el[0]}`;

  const handleClick = (el) => {
    if (!current) return;
    if (el[0] === current.el[0]) {
      setRevealed(prev => new Set([...prev, el[0]]));
      setResults(prev => [...prev, { q: current, correct: true, guess: el }]);
      setTimeout(() => {
        if (idx + 1 >= questions.length) {
          const time = Math.round((Date.now() - startTime)/1000);
          const score = results.filter(r=>r.correct).length + 1;
          const session = {
            type: "session", mode: config.mode, difficulty: config.difficulty,
            score, time, date: Date.now(),
            breakdown: [...results, { q: current, correct: true, guess: el }].map(r => ({
              num: r.q.el[0], sym: r.q.el[1], name: r.q.el[2], mode: r.q.mode, correct: r.correct,
              guessNum: r.guess[0], guessSym: r.guess[1],
            })),
          };
          setView({ name: "results", session });
        } else {
          setIdx(i => i + 1);
        }
      }, 400);
    } else {
      setFlashId(el[0]);
      setResults(prev => [...prev, { q: current, correct: false, guess: el }]);
      setTimeout(() => {
        setFlashId(null);
        if (idx + 1 >= questions.length) {
          const time = Math.round((Date.now() - startTime)/1000);
          const score = results.filter(r=>r.correct).length;
          const session = {
            type: "session", mode: config.mode, difficulty: config.difficulty,
            score, time, date: Date.now(),
            breakdown: [...results, { q: current, correct: false, guess: el }].map(r => ({
              num: r.q.el[0], sym: r.q.el[1], name: r.q.el[2], mode: r.q.mode, correct: r.correct,
              guessNum: r.guess[0], guessSym: r.guess[1],
            })),
          };
          setView({ name: "results", session });
        } else {
          setIdx(i => i + 1);
        }
      }, 600);
    }
  };

  return (
    <section id="quiz-play" className={classNames.feature}>
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <span className="text-xs uppercase tracking-widest text-[#555] font-mono">Q {idx+1}/10</span>
        <span className="text-xs uppercase tracking-widest text-[#555] font-mono">Score {results.filter(r=>r.correct).length}</span>
        <button onClick={() => setView({ name: "home" })} className="text-xs uppercase border-[2px] border-[#111118] px-2 py-1 rounded hover:bg-[#f5f1e8]">Quit</button>
      </div>
      <div className="mb-4 p-3 bg-[#111118] text-[#e9c46a] border-[3px] border-[#111118] rounded text-center font-bold uppercase tracking-wide text-lg shadow-[4px_4px_0px_#e63946]">
        {promptText}
      </div>
      <PeriodicTable pool={pool} onClick={handleClick} flashId={flashId} revealedIds={revealed}
        renderCell={(el, rev) => rev ? (
          <>
            <div className="text-[9px] font-mono">{el[0]}</div>
            <div className="text-sm font-bold">{el[1]}</div>
          </>
        ) : <div className="text-transparent text-sm">·</div>}
      />
    </section>
  );
}

function Results({ setView, session }) {
  const { database } = useFireproof("element-arcade");
  const savedRef = useRef(false);
  useEffect(() => {
    if (!savedRef.current) {
      savedRef.current = true;
      database.put(session);
    }
  }, []);

  const msg = session.score === 10 ? "Perfect!" : session.score >= 7 ? "Great job!" : session.score >= 4 ? "Keep practicing!" : "Try again!";

  return (
    <section className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Results</h2>
      <div className="text-center mb-4 p-4 bg-[#e9c46a] border-[3px] border-[#111118] rounded shadow-[4px_4px_0px_#111118]">
        <div className="text-5xl font-bold font-mono">{session.score}/10</div>
        <div className="text-xs uppercase tracking-widest mt-1">{msg} · {session.time}s</div>
      </div>
      <ul className="space-y-1 mb-4">
        {session.breakdown.map((r, i) => (
          <li key={i} className={`p-2 border-[2px] border-[#111118] rounded text-sm flex justify-between ${r.correct ? "bg-[#90be6d]" : "bg-[#e63946] text-white"}`}>
            <span className="font-mono text-xs">{i+1}.</span>
            <span className="uppercase text-xs">{r.mode}: {r.name} ({r.sym})</span>
            <span className="text-xs">{r.correct ? "✓" : `✗ got ${r.guessSym}`}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button onClick={() => setView({ name: "config" })} className="px-4 py-2 bg-[#e63946] text-white font-bold uppercase text-xs border-[3px] border-[#111118] rounded shadow-[3px_3px_0px_#111118]">Play Again</button>
        <button onClick={() => setView({ name: "home" })} className="px-4 py-2 bg-white font-bold uppercase text-xs border-[3px] border-[#111118] rounded hover:bg-[#f5f1e8]">Home</button>
      </div>
    </section>
  );
}

function StudyMode({ setView }) {
  const [selected, setSelected] = useState(null);
  return (
    <section className={classNames.feature}>
      <div className="flex justify-between items-center mb-3">
        <h2 className={classNames.featureTitle}>Study Mode</h2>
        <button onClick={() => setView({ name: "home" })} className="text-xs uppercase border-[2px] border-[#111118] px-2 py-1 rounded hover:bg-[#f5f1e8]">Home</button>
      </div>
      <PeriodicTable pool={ELEMENTS} onClick={(el) => setSelected(el)}
        renderCell={(el) => (
          <>
            <div className="text-[8px] font-mono">{el[0]}</div>
            <div className="text-xs font-bold">{el[1]}</div>
          </>
        )}
      />
      {selected && (
        <div className="mt-4 p-3 bg-[#111118] text-[#e9c46a] border-[3px] border-[#111118] rounded">
          <div className="text-2xl font-bold">{selected[2]} ({selected[1]})</div>
          <div className="text-xs uppercase tracking-widest mt-1">Atomic #{selected[0]} · {selected[5]}</div>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [view, setView] = useState({ name: "home" });
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Element Arcade</h1>
        <p className="text-xs uppercase tracking-widest text-[#555] mt-1">Periodic Table Quiz</p>
      </header>
      {view.name === "home" && <HomeScreen setView={setView} />}
      {view.name === "config" && <QuizConfig setView={setView} />}
      {view.name === "play" && <QuizPlay setView={setView} config={view.config} />}
      {view.name === "results" && <Results setView={setView} session={view.session} />}
      {view.name === "study" && <StudyMode setView={setView} />}
    </main>
  );
}