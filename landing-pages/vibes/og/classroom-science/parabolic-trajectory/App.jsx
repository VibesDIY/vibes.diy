import React from "react"
import { useFireproof } from "use-fireproof"

const c = {
  page: "min-h-screen bg-[#f1f5f9] p-6 font-['Space_Grotesk',sans-serif] text-[#0f172a]",
  header: "max-w-5xl mx-auto mb-6 bg-white border-[3px] border-[#0f172a] rounded-[4px] p-4 shadow-[4px_4px_0px_#0f172a]",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-5xl mx-auto mb-4 bg-white border-[3px] border-[#0f172a] rounded-[4px] p-4 shadow-[4px_4px_0px_#0f172a]",
  featureTitle: "text-sm font-bold uppercase tracking-[0.15em] mb-3",
  mono: "font-['JetBrains_Mono',monospace]",
};

function Slider({ label, unit, min, max, step, value, setValue }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs uppercase tracking-[0.15em] font-bold">{label}</span>
        <span className={`${c.mono} text-sm font-bold`}>{value.toFixed(2)} <span className="text-[#50525a] text-xs">{unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        className="w-full accent-[#dc2626]" />
    </div>
  );
}

function Controls({ v0, setV0, theta, setTheta, g, setG }) {
  const planets = [
    { name: "Moon", g: 1.62 },
    { name: "Mars", g: 3.71 },
    { name: "Earth", g: 9.81 },
    { name: "Jupiter", g: 24.79 },
  ];
  return (
    <section id="controls" className={c.feature}>
      <h2 className={c.featureTitle}>Parameters</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <Slider label="Velocity v₀" unit="m/s" min={1} max={100} step={0.5} value={v0} setValue={setV0} />
        <Slider label="Angle θ" unit="°" min={0} max={90} step={1} value={theta} setValue={setTheta} />
        <Slider label="Gravity g" unit="m/s²" min={0.1} max={25} step={0.01} value={g} setValue={setG} />
      </div>
      <div className="mt-2">
        <div className="text-xs uppercase tracking-[0.15em] font-bold mb-2">Quick-pick gravity</div>
        <div className="flex flex-wrap gap-2">
          {planets.map((p) => (
            <button key={p.name} onClick={() => setG(p.g)}
              className={`${c.mono} text-xs px-3 py-2 border-[3px] border-[#0f172a] rounded-[4px] bg-[#fcd34d] shadow-[3px_3px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#0f172a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all`}>
              {p.name.toUpperCase()} · {p.g}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Canvas({ v0, theta, g, t, setT, vx, vy, range, maxH, flightTime }) {
  const W = 800, H = 420, pad = 40;
  const worldW = Math.max(range * 1.15, 20);
  const worldH = Math.max(maxH * 1.3, 10);
  const sx = (x) => pad + (x / worldW) * (W - pad * 2);
  const sy = (y) => H - pad - (y / worldH) * (H - pad * 2);

  const N = 80;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const tt = (i / N) * flightTime;
    pts.push([vx * tt, vy * tt - 0.5 * g * tt * tt]);
  }
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${sx(x)} ${sy(y)}`).join(" ");

  const ballX = t !== null ? vx * t : null;
  const ballY = t !== null ? vy * t - 0.5 * g * t * t : null;
  const curVx = vx;
  const curVy = t !== null ? vy - g * t : 0;

  const gridX = [];
  for (let x = 0; x <= worldW; x += 10) gridX.push(x);
  const gridY = [];
  for (let y = 0; y <= worldH; y += 10) gridY.push(y);

  const eqX = `x(t) = ${v0.toFixed(1)}·cos(${theta.toFixed(0)}°)·t = ${vx.toFixed(2)}·t`;
  const eqY = `y(t) = ${v0.toFixed(1)}·sin(${theta.toFixed(0)}°)·t − ½·${g.toFixed(2)}·t² = ${vy.toFixed(2)}·t − ${(0.5*g).toFixed(3)}·t²`;

  React.useEffect(() => {
    if (t === null) return;
    let raf, start;
    const tick = (ts) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      const simT = elapsed * 1.0;
      if (simT >= flightTime) { setT(null); return; }
      setT(simT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [t === null, flightTime]);

  return (
    <section id="canvas" className={c.feature}>
      <h2 className={c.featureTitle}>Trajectory</h2>
      <div className={`${c.mono} text-xs bg-[#0f172a] text-white p-3 rounded-[4px] mb-3 space-y-1`}>
        <div>{eqX}</div>
        <div>{eqY}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border-[3px] border-[#0f172a] rounded-[4px] bg-white">
        {gridX.map((x) => (
          <g key={`gx${x}`}>
            <line x1={sx(x)} y1={pad} x2={sx(x)} y2={H - pad} stroke="#e2e8f0" strokeWidth="1" />
            <text x={sx(x)} y={H - pad + 14} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" fill="#50525a">{x}</text>
          </g>
        ))}
        {gridY.map((y) => (
          <g key={`gy${y}`}>
            <line x1={pad} y1={sy(y)} x2={W - pad} y2={sy(y)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad - 6} y={sy(y) + 3} fontSize="10" fontFamily="JetBrains Mono" textAnchor="end" fill="#50525a">{y}</text>
          </g>
        ))}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#0f172a" strokeWidth="2" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#0f172a" strokeWidth="2" />
        <text x={W - pad} y={H - pad - 6} fontSize="10" fontFamily="JetBrains Mono" textAnchor="end" fill="#0f172a">x (m)</text>
        <text x={pad + 6} y={pad + 10} fontSize="10" fontFamily="JetBrains Mono" fill="#0f172a">y (m)</text>
        <path d={path} stroke="#1e3a8a" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        {ballX !== null && (
          <g>
            <line x1={sx(ballX)} y1={sy(ballY)} x2={sx(ballX) + curVx * 2} y2={sy(ballY)} stroke="#16a34a" strokeWidth="2" markerEnd="url(#arrH)" />
            <line x1={sx(ballX)} y1={sy(ballY)} x2={sx(ballX)} y2={sy(ballY) - curVy * 2} stroke="#2563eb" strokeWidth="2" markerEnd="url(#arrV)" />
            <line x1={sx(ballX)} y1={sy(ballY)} x2={sx(ballX) + curVx * 2} y2={sy(ballY) - curVy * 2} stroke="#dc2626" strokeWidth="2.5" markerEnd="url(#arrR)" />
            <circle cx={sx(ballX)} cy={sy(ballY)} r="7" fill="#dc2626" stroke="#0f172a" strokeWidth="2" />
          </g>
        )}
        <defs>
          {["arrH","arrV","arrR"].map((id, i) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={["#16a34a","#2563eb","#dc2626"][i]} />
            </marker>
          ))}
        </defs>
      </svg>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {[
          { label: "Max Height", val: maxH, unit: "m", bg: "bg-[#dc2626]", fg: "text-white" },
          { label: "Range", val: range, unit: "m", bg: "bg-[#fcd34d]", fg: "text-[#0f172a]" },
          { label: "Flight Time", val: flightTime, unit: "s", bg: "bg-[#16a34a]", fg: "text-[#0f172a]" },
        ].map((s) => (
          <div key={s.label} className="border-[3px] border-[#0f172a] rounded-[4px] shadow-[3px_3px_0px_#0f172a] overflow-hidden">
            <div className={`${s.bg} ${s.fg} px-3 py-1 text-[0.65rem] uppercase tracking-[0.15em] font-bold border-b-[3px] border-[#0f172a]`}>{s.label}</div>
            <div className={`${c.mono} text-2xl font-bold p-3`}>{s.val.toFixed(2)} <span className="text-xs text-[#50525a]">{s.unit}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => setT(0)} disabled={t !== null}
          className={`${c.mono} text-xs px-4 py-2 border-[3px] border-[#0f172a] rounded-[4px] bg-[#dc2626] text-white font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0f172a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50`}>
          {t !== null ? `Flying · t=${t.toFixed(2)}s` : "Launch"}
        </button>
      </div>
    </section>
  );
}

function Notebook({ v0, theta, g, range, maxH, flightTime, label, setLabel, restore }) {
  const { useLiveQuery, database } = useFireproof("projectile-lab");
  const { docs } = useLiveQuery("_id", { descending: true });

  const save = () => {
    database.put({
      label: label || `Shot ${new Date().toISOString().slice(11,19)}`,
      v0, theta, g, range, maxH, flightTime,
      createdAt: Date.now(),
    });
    setLabel("");
  };

  return (
    <section id="notebook" className={c.feature}>
      <h2 className={c.featureTitle}>Lab Notebook</h2>
      <div className="flex gap-2 mb-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Shot label (e.g. Moon test 1)"
          className={`${c.mono} text-sm flex-1 px-3 py-2 border-[3px] border-[#0f172a] rounded-[4px] focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#0f172a] transition-all`} />
        <button onClick={save}
          className={`${c.mono} text-xs px-4 py-2 border-[3px] border-[#0f172a] rounded-[4px] bg-[#16a34a] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0f172a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all`}>
          Save Shot
        </button>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-[#50525a] uppercase tracking-[0.15em]">No shots logged yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-[2px] border-[#0f172a]">
                {["Label","v₀","θ","g","Range","Height","Time",""].map((h) => (
                  <th key={h} className="text-left text-[0.6rem] uppercase tracking-[0.15em] py-2 px-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d._id} className="border-b border-[#e2e8f0] hover:bg-[#fcd34d]">
                  <td className="py-2 px-2">{d.label}</td>
                  <td className={`${c.mono} py-2 px-2`}>{d.v0?.toFixed(1)}</td>
                  <td className={`${c.mono} py-2 px-2`}>{d.theta?.toFixed(0)}°</td>
                  <td className={`${c.mono} py-2 px-2`}>{d.g?.toFixed(2)}</td>
                  <td className={`${c.mono} py-2 px-2`}>{d.range?.toFixed(2)}</td>
                  <td className={`${c.mono} py-2 px-2`}>{d.maxH?.toFixed(2)}</td>
                  <td className={`${c.mono} py-2 px-2`}>{d.flightTime?.toFixed(2)}</td>
                  <td className="py-2 px-2 flex gap-1">
                    <button onClick={() => restore(d)}
                      className={`${c.mono} text-[0.65rem] px-2 py-1 border-[2px] border-[#0f172a] rounded-[4px] bg-[#2563eb] text-white font-bold uppercase hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#0f172a] transition-all`}>
                      Replay
                    </button>
                    <button onClick={() => database.del(d._id)}
                      className={`${c.mono} text-[0.65rem] px-2 py-1 border-[2px] border-[#0f172a] rounded-[4px] bg-white font-bold uppercase hover:bg-[#dc2626] hover:text-white transition-all`}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [v0, setV0] = React.useState(30);
  const [theta, setTheta] = React.useState(45);
  const [g, setG] = React.useState(9.81);
  const [label, setLabel] = React.useState("");
  const [t, setT] = React.useState(null); // animation time (null = not flying)

  const rad = (theta * Math.PI) / 180;
  const vx = v0 * Math.cos(rad);
  const vy = v0 * Math.sin(rad);
  const flightTime = (2 * vy) / g;
  const range = (v0 * v0 * Math.sin(2 * rad)) / g;
  const maxH = (vy * vy) / (2 * g);

  const restore = (s) => { setV0(s.v0); setTheta(s.theta); setG(s.g); setT(null); };

  return (
    <main id="app" className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Projectile Lab</h1>
        <p className={`${c.mono} text-xs mt-1 text-[#50525a]`}>HS PHYSICS · KINEMATICS MODULE</p>
      </header>
      <Controls v0={v0} setV0={setV0} theta={theta} setTheta={setTheta} g={g} setG={setG} />
      <Canvas v0={v0} theta={theta} g={g} t={t} setT={setT} vx={vx} vy={vy} range={range} maxH={maxH} flightTime={flightTime} />
      <Notebook v0={v0} theta={theta} g={g} range={range} maxH={maxH} flightTime={flightTime} label={label} setLabel={setLabel} restore={restore} />
    </main>
  );
}