import React, { useState, useEffect } from "react"
import { useFireproof } from "use-fireproof"

function NotebookInner({ reservoirs, ppm, fossilEm, deforest, years }) {
  const { useDocument, useLiveQuery, database } = useFireproof("carbon-cycle-lab");
  const { doc, merge, save, reset } = useDocument({ label: "", type: "scenario" });
  const { docs } = useLiveQuery("type", { key: "scenario", descending: true });

  const handleSave = async () => {
    if (!doc.label.trim()) return;
    await database.put({
      type: "scenario",
      label: doc.label,
      fossilEm, deforest, years,
      ppm: parseFloat(ppm),
      reservoirs: { ...reservoirs },
      createdAt: Date.now(),
    });
    reset();
  };

  return (
    <>
      <div className="flex gap-2 mb-4">
        <input value={doc.label} onChange={e => merge({ label: e.target.value })} placeholder="Scenario label (e.g. 'Business as usual')" className="flex-1 px-3 py-2 border-[3px] border-[#15151f] rounded font-mono text-sm focus:outline-none focus:shadow-[3px_3px_0px_#15151f]" />
        <button onClick={handleSave} className="px-4 py-2 bg-[#c63030] text-white border-[3px] border-[#15151f] rounded font-bold uppercase text-xs tracking-[0.1em] shadow-[3px_3px_0px_#15151f] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#15151f] transition-all">Save Scenario</button>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-[#6b6b7a] uppercase tracking-wider">No scenarios saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d._id} className="flex items-center justify-between border-[2px] border-[#15151f] rounded p-3 bg-[#fafaf4]">
              <div>
                <div className="font-bold">{d.label}</div>
                <div className="text-xs font-mono text-[#6b6b7a]">fossil {d.fossilEm} · defor {d.deforest} · +{d.years}yr</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-lg">{d.ppm} <span className="text-xs text-[#6b6b7a]">ppm</span></div>
                <button onClick={() => database.del(d._id)} className="text-[10px] uppercase tracking-wider text-[#c63030] hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const c = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-['Space_Grotesk',sans-serif] text-[#15151f]",
  header: "max-w-5xl mx-auto mb-6 bg-white border-[3px] border-[#15151f] rounded p-4 shadow-[4px_4px_0px_#15151f]",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-5xl mx-auto mb-6 bg-white border-[3px] border-[#15151f] rounded p-4 shadow-[4px_4px_0px_#15151f]",
  featureTitle: "text-xs font-bold uppercase tracking-[0.15em] text-[#6b6b7a] mb-3",
};

const INITIAL = { atm: 870, plants: 550, soil: 1500, oceanS: 900, oceanD: 37000, fossil: 5000 };
const PPM_PER_GTC = 0.47;

export default function App() {
  const [fossilEm, setFossilEm] = useState(10);
  const [deforest, setDeforest] = useState(1.5);
  const [years, setYears] = useState(0);
  const [reservoirs, setReservoirs] = useState(INITIAL);

  useEffect(() => {
    let r = { ...INITIAL };
    for (let y = 0; y < years; y++) {
      const photo = 120, resp = 120, decomp = 60, soilResp = 60;
      const oceanUp = 92 + (r.atm - 870) * 0.01;
      const oceanRel = 90;
      r = {
        atm: r.atm - photo + resp + soilResp - oceanUp + oceanRel + fossilEm + deforest,
        plants: r.plants + photo - resp - decomp - deforest,
        soil: r.soil + decomp - soilResp,
        oceanS: r.oceanS + oceanUp - oceanRel,
        oceanD: r.oceanD,
        fossil: r.fossil - fossilEm,
      };
    }
    setReservoirs(r);
  }, [fossilEm, deforest, years]);

  const ppm = (reservoirs.atm * PPM_PER_GTC).toFixed(1);
  const fluxes = { photo: 120, resp: 120, decomp: 60, soilResp: 60, oceanUp: 92, oceanRel: 90, fossilEm, deforest };

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Carbon Cycle Lab</h1>
        <p className="text-xs uppercase tracking-[0.1em] text-[#6b6b7a] mt-1">Earth Science · Reservoirs & Fluxes</p>
      </header>
      <Diagram reservoirs={reservoirs} fluxes={fluxes} ppm={ppm} years={years} />
      <Controls fossilEm={fossilEm} setFossilEm={setFossilEm} deforest={deforest} setDeforest={setDeforest} years={years} setYears={setYears} />
      <Notebook reservoirs={reservoirs} ppm={ppm} fossilEm={fossilEm} deforest={deforest} years={years} />
    </main>
  );
}

function Reservoir({ x, y, w, h, fill, textFill, name, value }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#15151f" strokeWidth="3" rx="4" />
      <text x={x + w/2} y={y + 22} textAnchor="middle" fill={textFill} fontSize="13" fontWeight="700" style={{textTransform:"uppercase",letterSpacing:"0.05em"}}>{name}</text>
      <text x={x + w/2} y={y + h - 12} textAnchor="middle" fill={textFill} fontSize="16" fontFamily="JetBrains Mono, monospace" fontWeight="700">{Math.round(value)} GtC</text>
    </g>
  );
}

function Diagram({ reservoirs, fluxes, ppm, years }) {
  return (
    <section id="diagram" className={c.feature}>
      <h2 className={c.featureTitle}>Reservoir Diagram</h2>
      <div className="mb-3 flex gap-6 items-baseline">
        <div className="font-mono text-sm">Atmospheric CO₂: <span className="font-bold text-2xl">{ppm}</span> <span className="text-xs uppercase tracking-wider text-[#6b6b7a]">ppm</span></div>
        <div className="font-mono text-sm">Year: <span className="font-bold">+{years}</span></div>
      </div>
      <svg viewBox="0 0 800 520" className="w-full border-[3px] border-[#15151f] rounded bg-[#fafaf4]">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#15151f" />
          </marker>
        </defs>
        {/* atm <-> plants */}
        <line x1="290" y1="90" x2="160" y2="180" stroke="#15151f" strokeWidth="2" markerEnd="url(#arr)" />
        <text x="195" y="130" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#15151f">photo {fluxes.photo}</text>
        <line x1="180" y1="180" x2="310" y2="90" stroke="#15151f" strokeWidth="2" markerEnd="url(#arr)" />
        <text x="225" y="155" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#15151f">resp {fluxes.resp}</text>
        {/* plants -> soil */}
        <line x1="140" y1="260" x2="140" y2="340" stroke="#15151f" strokeWidth="2" markerEnd="url(#arr)" />
        <text x="150" y="305" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#15151f">decomp {fluxes.decomp}</text>
        {/* soil -> atm */}
        <line x1="200" y1="340" x2="300" y2="90" stroke="#15151f" strokeWidth="2" strokeDasharray="4,2" markerEnd="url(#arr)" />
        <text x="230" y="230" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#15151f">soil-resp {fluxes.soilResp}</text>
        {/* atm <-> ocean */}
        <line x1="510" y1="90" x2="640" y2="180" stroke="#15151f" strokeWidth="2" markerEnd="url(#arr)" />
        <text x="545" y="130" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#15151f">uptake {fluxes.oceanUp.toFixed(0)}</text>
        <line x1="660" y1="180" x2="490" y2="90" stroke="#15151f" strokeWidth="2" markerEnd="url(#arr)" />
        <text x="580" y="155" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#15151f">release {fluxes.oceanRel}</text>
        {/* ocean surface <-> deep */}
        <line x1="660" y1="260" x2="660" y2="340" stroke="#15151f" strokeWidth="2" />
        <line x1="680" y1="340" x2="680" y2="260" stroke="#15151f" strokeWidth="2" />
        {/* fossil -> atm (red) */}
        <line x1="400" y1="440" x2="400" y2="90" stroke="#c63030" strokeWidth="3" markerEnd="url(#arr)" />
        <text x="410" y="270" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700" fill="#c63030">fossil {fluxes.fossilEm.toFixed(1)}</text>
        {/* deforestation plants -> atm (red dashed) */}
        <line x1="160" y1="180" x2="290" y2="60" stroke="#c63030" strokeWidth="2" strokeDasharray="5,3" markerEnd="url(#arr)" />
        <text x="165" y="110" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" fill="#c63030">defor {fluxes.deforest.toFixed(1)}</text>

        <Reservoir x={280} y={20} w={240} h={70} fill="#b8bcc4" textFill="#15151f" name="Atmosphere" value={reservoirs.atm} />
        <Reservoir x={40} y={180} w={200} h={80} fill="#2d7a3d" textFill="#ffffff" name="Plants & Forests" value={reservoirs.plants} />
        <Reservoir x={560} y={180} w={200} h={80} fill="#2b6ca8" textFill="#ffffff" name="Ocean Surface" value={reservoirs.oceanS} />
        <Reservoir x={40} y={340} w={200} h={80} fill="#7a4a28" textFill="#ffffff" name="Soil" value={reservoirs.soil} />
        <Reservoir x={560} y={340} w={200} h={80} fill="#1a3d5c" textFill="#ffffff" name="Deep Ocean" value={reservoirs.oceanD} />
        <Reservoir x={280} y={440} w={240} h={70} fill="#15151f" textFill="#ffffff" name="Fossil Fuels" value={reservoirs.fossil} />
      </svg>
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange, unit }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-xs font-bold uppercase tracking-[0.1em]">{label}</label>
        <span className="font-mono font-bold text-lg">{value}<span className="text-xs text-[#6b6b7a] ml-1">{unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-[#c63030]" />
      <div className="flex justify-between text-[10px] font-mono text-[#6b6b7a]"><span>{min}</span><span>{max}</span></div>
    </div>
  );
}

function Controls({ fossilEm, setFossilEm, deforest, setDeforest, years, setYears }) {
  return (
    <section id="controls" className={c.feature}>
      <h2 className={c.featureTitle}>Simulation Controls</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <Slider label="Fossil Emissions" value={fossilEm} min={0} max={15} step={0.1} onChange={setFossilEm} unit="GtC/yr" />
        <Slider label="Deforestation" value={deforest} min={0} max={5} step={0.1} onChange={setDeforest} unit="GtC/yr" />
        <Slider label="Years Forward" value={years} min={0} max={100} step={1} onChange={setYears} unit="yr" />
      </div>
    </section>
  );
}

function Notebook(props) {
  return (
    <section id="notebook" className={c.feature}>
      <h2 className={c.featureTitle}>Lab Notebook</h2>
      <NotebookInner {...props} />
    </section>
  );
}