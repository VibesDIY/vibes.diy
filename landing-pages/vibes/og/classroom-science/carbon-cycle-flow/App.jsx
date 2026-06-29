import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

// Simple pedagogical model — not climate-accurate, just directionally right.
function computePpm(year, emissions, forest) {
  const yearsSince1850 = year - 1850;
  // baseline ~285ppm 1850, emissions knob drives rate, forest knob removes
  const emitRate = 0.005 * (emissions / 50); // ppm/yr at 50% = 0.005 (low); scales up
  const cumulativeEmit = yearsSince1850 * yearsSince1850 * emitRate;
  const forestSink = (forest - 50) * 0.4; // more forest = less ppm
  return Math.max(280, Math.round(285 + cumulativeEmit - forestSink));
}

function computeStocks(year, emissions, forest) {
  const ppm = computePpm(year, emissions, forest);
  const atm = Math.round(ppm * 2.13); // GtC
  const plants = Math.round(550 + (forest - 50) * 2);
  const soil = Math.round(1500 + (forest - 50) * 1);
  const surfOcean = Math.round(900 + (ppm - 285) * 0.3);
  const deepOcean = Math.round(37000 + (ppm - 285) * 0.5);
  const fossil = Math.max(100, Math.round(5000 - (year - 1850) * (emissions / 50) * 8));
  return { atm, plants, soil, surfOcean, deepOcean, fossil };
}

const classNames = {
  page: "min-h-screen bg-[#faf7f0] p-4 font-['Space_Grotesk',sans-serif]",
  header: "max-w-4xl mx-auto mb-4 bg-white border-[3px] border-[#1a1a2e] rounded p-4 shadow-[4px_4px_0px_#1a1a2e]",
  title: "text-3xl font-bold uppercase tracking-tight text-[#1a1a2e]",
  feature: "max-w-4xl mx-auto mb-4 bg-white border-[3px] border-[#1a1a2e] rounded p-4 shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-sm font-bold uppercase tracking-widest text-[#1a1a2e] mb-3",
};

function YearControls({ year, setYear, playing, setPlaying, ppm }) {
  const c = {
    box: "flex flex-wrap items-center gap-4",
    year: "font-['JetBrains_Mono',monospace] text-6xl font-bold text-[#1a1a2e]",
    ppmBox: "ml-auto bg-[#a8dadc] border-[3px] border-[#1a1a2e] rounded px-4 py-2 shadow-[3px_3px_0px_#1a1a2e]",
    ppmNum: "font-['JetBrains_Mono',monospace] text-3xl font-bold text-[#1a1a2e]",
    ppmLabel: "text-[0.6rem] uppercase tracking-widest text-[#1a1a2e]",
    btn: "px-3 py-2 border-[3px] border-[#1a1a2e] rounded font-bold text-xs uppercase tracking-widest shadow-[3px_3px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    play: "bg-[#84cc16] text-[#1a1a2e]",
    pause: "bg-[#fbbf24] text-[#1a1a2e]",
    reset: "bg-white text-[#1a1a2e]",
    slider: "w-full mt-3 accent-[#1a1a2e]",
  };
  return (
    <section id="year-controls" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Year</h2>
      <div className={c.box}>
        <div className={c.year}>{year}</div>
        <button className={`${c.btn} ${playing ? c.pause : c.play}`} onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className={`${c.btn} ${c.reset}`} onClick={() => { setPlaying(false); setYear(1850); }}>Reset</button>
        <div className={c.ppmBox}>
          <div className={c.ppmNum}>{ppm}</div>
          <div className={c.ppmLabel}>ppm CO₂</div>
        </div>
      </div>
      <input type="range" min="1850" max="2100" value={year} onChange={e => setYear(+e.target.value)} className={c.slider} />
    </section>
  );
}

const RESERVOIRS = [
  { key: "atm",       name: "Atmosphere",    color: "#a8dadc", angle: -90 },
  { key: "plants",    name: "Plants",        color: "#86efac", angle: -30 },
  { key: "soil",      name: "Soil",          color: "#b08968", angle:  30 },
  { key: "deepOcean", name: "Deep Ocean",    color: "#3b82f6", angle:  90 },
  { key: "surfOcean", name: "Surface Ocean", color: "#7dd3fc", angle: 150 },
  { key: "fossil",    name: "Fossil Fuels",  color: "#525252", angle: 210 },
];

function bubblePos(angle, cx, cy, r) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function curvedPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const nx = -dy, ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  const bend = 40;
  const cxp = mx + (nx / len) * bend;
  const cyp = my + (ny / len) * bend;
  return { d: `M ${x1} ${y1} Q ${cxp} ${cyp} ${x2} ${y2}`, cxp, cyp };
}

function pointOnQuad(t, x1, y1, cxp, cyp, x2, y2) {
  const u = 1 - t;
  return {
    x: u*u*x1 + 2*u*t*cxp + t*t*x2,
    y: u*u*y1 + 2*u*t*cyp + t*t*y2,
  };
}

function CycleViz({ stocks, emissions, forest }) {
  const W = 600, H = 500, cx = W/2, cy = H/2, orbit = 180;
  const maxStock = Math.max(...Object.values(stocks));
  const radiusFor = (v) => 18 + 42 * Math.sqrt(v / maxStock);

  const bubbles = RESERVOIRS.map(r => {
    const p = bubblePos(r.angle, cx, cy, orbit);
    return { ...r, ...p, r: radiusFor(stocks[r.key]), stock: stocks[r.key] };
  });
  const byKey = Object.fromEntries(bubbles.map(b => [b.key, b]));

  // Fluxes: from, to, rate (speed multiplier), reversible
  const fluxes = React.useMemo(() => [
    { from: "fossil", to: "atm",       rate: 0.2 + emissions/100 * 1.2, color: "#525252" },
    { from: "atm",    to: "plants",    rate: 0.3 + forest/100 * 0.9,    color: "#22c55e" },
    { from: "plants", to: "soil",      rate: 0.4,                        color: "#a16207" },
    { from: "soil",   to: "atm",       rate: 0.4,                        color: "#b08968" },
    { from: "atm",    to: "surfOcean", rate: 0.5 + (emissions-50)/200,  color: "#7dd3fc" },
    { from: "surfOcean", to: "deepOcean", rate: 0.3,                     color: "#3b82f6" },
  ], [emissions, forest]);

  const paths = fluxes.map(f => {
    const a = byKey[f.from], b = byKey[f.to];
    return { ...f, ...curvedPath(a.x, a.y, b.x, b.y), a, b };
  });

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let raf;
    const loop = () => { setTick(t => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const PARTICLES_PER = 4;

  return (
    <section id="cycle-viz" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>The Cycle</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-[#f0f9ff] border-[3px] border-[#1a1a2e] rounded">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke="#1a1a2e" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.35" />
        ))}
        {paths.map((p, pi) =>
          Array.from({ length: PARTICLES_PER }).map((_, i) => {
            const speed = p.rate * 0.004;
            const t = ((tick * speed) + i / PARTICLES_PER) % 1;
            const pos = pointOnQuad(t, p.a.x, p.a.y, p.cxp, p.cyp, p.b.x, p.b.y);
            return <circle key={`${pi}-${i}`} cx={pos.x} cy={pos.y} r="3.5" fill={p.color} stroke="#1a1a2e" strokeWidth="1" />;
          })
        )}
        {bubbles.map(b => (
          <g key={b.key}>
            <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} stroke="#1a1a2e" strokeWidth="3" />
            <text x={b.x} y={b.y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1a1a2e" fontFamily="Space Grotesk">
              {b.name}
            </text>
            <text x={b.x} y={b.y + 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a1a2e" fontFamily="JetBrains Mono">
              {b.stock}
            </text>
            <text x={b.x} y={b.y + 24} textAnchor="middle" fontSize="8" fill="#1a1a2e" fontFamily="Space Grotesk">
              GtC
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function Knobs({ emissions, setEmissions, forest, setForest }) {
  const c = {
    grid: "grid grid-cols-1 md:grid-cols-2 gap-4",
    knob: "border-[3px] border-[#1a1a2e] rounded p-3 shadow-[3px_3px_0px_#1a1a2e]",
    emit: "bg-[#fecaca]",
    tree: "bg-[#bbf7d0]",
    label: "flex justify-between items-baseline mb-2",
    name: "text-xs font-bold uppercase tracking-widest text-[#1a1a2e]",
    val: "font-['JetBrains_Mono',monospace] text-2xl font-bold text-[#1a1a2e]",
    slide: "w-full accent-[#1a1a2e] h-2",
    hint: "text-[0.65rem] uppercase tracking-wider text-[#6b7280] mt-1",
  };
  return (
    <section id="knobs" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Controls</h2>
      <div className={c.grid}>
        <div className={`${c.knob} ${c.emit}`}>
          <div className={c.label}>
            <span className={c.name}>Human Emissions</span>
            <span className={c.val}>{emissions}%</span>
          </div>
          <input type="range" min="0" max="100" value={emissions} onChange={e => setEmissions(+e.target.value)} className={c.slide} />
          <div className={c.hint}>Burning fossil fuels</div>
        </div>
        <div className={`${c.knob} ${c.tree}`}>
          <div className={c.label}>
            <span className={c.name}>Forest Cover</span>
            <span className={c.val}>{forest}%</span>
          </div>
          <input type="range" min="0" max="100" value={forest} onChange={e => setForest(+e.target.value)} className={c.slide} />
          <div className={c.hint}>Trees absorb carbon</div>
        </div>
      </div>
    </section>
  );
}

function Bookmarks({ year, emissions, forest, ppm, setYear, setEmissions, setForest }) {
  const { database, useLiveQuery } = useFireproof("carbon-cycle-explorer");
  const { docs } = useLiveQuery("type", { key: "bookmark", descending: true });

  const save = () => {
    database.put({
      type: "bookmark",
      year, emissions, forest, ppm,
      createdAt: Date.now(),
    });
  };

  const restore = (d) => {
    setYear(d.year);
    setEmissions(d.emissions);
    setForest(d.forest);
  };

  const c = {
    btn: "px-4 py-2 bg-[#fbbf24] border-[3px] border-[#1a1a2e] rounded font-bold text-xs uppercase tracking-widest shadow-[3px_3px_0px_#1a1a2e] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    grid: "grid grid-cols-2 md:grid-cols-4 gap-3 mt-3",
    card: "bg-white border-[3px] border-[#1a1a2e] rounded p-2 shadow-[3px_3px_0px_#1a1a2e] cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1a1a2e] transition-all text-left",
    cardYear: "font-['JetBrains_Mono',monospace] text-xl font-bold text-[#1a1a2e]",
    cardPpm: "font-['JetBrains_Mono',monospace] text-sm text-[#1a1a2e]",
    cardMeta: "text-[0.6rem] uppercase tracking-wider text-[#6b7280] mt-1",
    del: "text-[0.6rem] text-[#dc2626] uppercase tracking-wider mt-1",
    empty: "text-xs text-[#6b7280] italic mt-3",
  };

  return (
    <section id="bookmarks" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Saved Moments</h2>
      <button className={c.btn} onClick={save}>Bookmark this moment</button>
      {docs.length === 0 ? (
        <p className={c.empty}>No bookmarks yet — press Play, tweak the knobs, then save.</p>
      ) : (
        <div className={c.grid}>
          {docs.map(d => (
            <button key={d._id} className={c.card} onClick={() => restore(d)}>
              <div className={c.cardYear}>{d.year}</div>
              <div className={c.cardPpm}>{d.ppm} ppm</div>
              <div className={c.cardMeta}>E {d.emissions}% · F {d.forest}%</div>
              <div className={c.del} onClick={(e) => { e.stopPropagation(); database.del(d._id); }}>Delete</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [year, setYear] = React.useState(1850);
  const [playing, setPlaying] = React.useState(false);
  const [emissions, setEmissions] = React.useState(50);
  const [forest, setForest] = React.useState(50);

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setYear(y => (y >= 2100 ? (setPlaying(false), 2100) : y + 1));
    }, 120);
    return () => clearInterval(id);
  }, [playing]);

  const ppm = computePpm(year, emissions, forest);
  const stocks = computeStocks(year, emissions, forest);

  return (
    <main id="app" className={classNames.page}>
      <header className={classNames.header}>
        <h1 className={classNames.title}>Carbon Cycle Explorer</h1>
        <p className="text-xs uppercase tracking-widest text-[#6b7280] mt-1">1850 — 2100 · BBC-Earth style sim</p>
      </header>
      <YearControls year={year} setYear={setYear} playing={playing} setPlaying={setPlaying} ppm={ppm} />
      <CycleViz stocks={stocks} emissions={emissions} forest={forest} />
      <Knobs emissions={emissions} setEmissions={setEmissions} forest={forest} setForest={setForest} />
      <Bookmarks year={year} emissions={emissions} forest={forest} ppm={ppm} setYear={setYear} setEmissions={setEmissions} setForest={setForest} />
    </main>
  );
}