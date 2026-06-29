import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#9b5de5", "#0077b6"];

function physics({ v, angle, g }) {
  const rad = (angle * Math.PI) / 180;
  const vx = v * Math.cos(rad);
  const vy = v * Math.sin(rad);
  const T = (2 * vy) / g;
  const R = (v * v * Math.sin(2 * rad)) / g;
  const H = (vy * vy) / (2 * g);
  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = (T * i) / N;
    pts.push([vx * t, vy * t - 0.5 * g * t * t]);
  }
  return { T, R, H, pts, vx, vy };
}

const classNames = {
  page: "min-h-[100vh] bg-[#f5f1e8] p-4 font-['Space_Grotesk',sans-serif] text-[#0f172a]",
  shell: "max-w-[920px] mx-auto",
  header: "bg-white border-[3px] border-[#0f172a] rounded-[4px] p-4 mb-4 shadow-[4px_4px_0px_#0f172a]",
  title: "text-2xl font-bold uppercase tracking-tight",
  subtitle: "text-xs uppercase tracking-[0.15em] text-[#64748b] mt-1",
  card: "bg-white border-[3px] border-[#0f172a] rounded-[4px] p-4 mb-4 shadow-[4px_4px_0px_#0f172a]",
  cardTitle: "text-xs uppercase tracking-[0.15em] font-bold mb-3",
};

function Slider({ label, value, min, max, step, unit, onChange, color }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[0.7rem] uppercase tracking-[0.1em] font-bold mb-1">
        <span>{label}</span>
        <span className="font-mono" style={{ color }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#e63946]" />
    </div>
  );
}

function Controls({ params, setParams, addShot, shots }) {
  const full = shots.length >= 6;
  const onAdd = () => {
    const p = physics(params);
    addShot({ ...params, R: p.R, H: p.H, T: p.T, color: COLORS[shots.length % 6] });
  };
  return (
    <section id="controls" className={classNames.card}>
      <h2 className={classNames.cardTitle}>Launch Controls</h2>
      <Slider label="Velocity v₀" value={params.v} min={5} max={100} step={1} unit=" m/s"
        onChange={(v) => setParams({ ...params, v })} color="#e63946" />
      <Slider label="Angle θ" value={params.angle} min={5} max={85} step={1} unit="°"
        onChange={(angle) => setParams({ ...params, angle })} color="#2a9d8f" />
      <Slider label="Gravity g" value={params.g} min={1} max={25} step={0.1} unit=" m/s²"
        onChange={(g) => setParams({ ...params, g })} color="#0077b6" />
      <button onClick={onAdd} disabled={full}
        className="mt-2 w-full bg-[#e63946] text-white font-bold uppercase tracking-[0.08em] text-sm py-2 border-[3px] border-[#0f172a] rounded-[4px] shadow-[4px_4px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {full ? "Canvas Full (6/6)" : `+ Add Shot (${shots.length}/6)`}
      </button>
    </section>
  );
}

function Canvas({ shots, target }) {
  const W = 860, H = 400, PAD = 40;
  const trajectories = shots.map((s) => ({ ...s, ...physics(s) }));
  const maxX = Math.max(100, ...trajectories.map((t) => t.R), target ? target.x : 0);
  const maxY = Math.max(60, ...trajectories.map((t) => t.H), target ? target.y : 0);
  const sx = (x) => PAD + (x / maxX) * (W - 2 * PAD);
  const sy = (y) => H - PAD - (y / maxY) * (H - 2 * PAD);

  return (
    <section id="canvas" className={classNames.card}>
      <h2 className={classNames.cardTitle}>Trajectory Canvas</h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-[#fafaf5] border-[3px] border-[#0f172a] rounded-[4px]">
          {/* grid */}
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f}>
              <line x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="#0f172a" strokeOpacity="0.08" />
              <line y1={PAD} y2={H - PAD} x1={PAD + f * (W - 2 * PAD)} x2={PAD + f * (W - 2 * PAD)} stroke="#0f172a" strokeOpacity="0.08" />
            </g>
          ))}
          {/* axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#0f172a" strokeWidth="2" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#0f172a" strokeWidth="2" />
          <text x={W - PAD} y={H - PAD + 20} textAnchor="end" fontSize="10" fontFamily="JetBrains Mono, monospace">x (m) →</text>
          <text x={PAD - 6} y={PAD - 6} fontSize="10" fontFamily="JetBrains Mono, monospace">y (m) ↑</text>
          {/* axis ticks */}
          <text x={W - PAD} y={H - PAD + 34} textAnchor="end" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#64748b">{maxX.toFixed(0)}</text>
          <text x={PAD - 6} y={PAD + 4} textAnchor="end" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#64748b">{maxY.toFixed(0)}</text>

          {/* target */}
          {target && (
            <g>
              <circle cx={sx(target.x)} cy={sy(target.y)} r="14" fill="none" stroke="#e63946" strokeWidth="3" strokeDasharray="4 3" />
              <circle cx={sx(target.x)} cy={sy(target.y)} r="4" fill="#e63946" />
              <text x={sx(target.x) + 18} y={sy(target.y) + 4} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#e63946" fontWeight="700">
                TARGET ({target.x.toFixed(0)}, {target.y.toFixed(0)})
              </text>
            </g>
          )}

          {/* trajectories */}
          {trajectories.map((t, i) => {
            const d = t.pts.map((p, j) => `${j === 0 ? "M" : "L"}${sx(p[0])},${sy(p[1])}`).join(" ");
            const peak = t.pts.reduce((a, b) => (b[1] > a[1] ? b : a), t.pts[0]);
            return (
              <g key={t.id}>
                <path d={d} fill="none" stroke={t.color} strokeWidth="3" />
                <circle cx={sx(peak[0])} cy={sy(peak[1])} r="4" fill={t.color} stroke="#0f172a" strokeWidth="1.5" />
                <text x={sx(peak[0])} y={sy(peak[1]) - 8} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" fill="#0f172a">
                  {t.v}m/s · {t.angle}° · g{t.g}
                </text>
              </g>
            );
          })}

          {shots.length === 0 && !target && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fontFamily="Space Grotesk" fill="#94a3b8" fontWeight="700">
              ADD A SHOT TO BEGIN
            </text>
          )}
        </svg>
      </div>
    </section>
  );
}

function Presets({ setShots, setTarget, setParams }) {
  const compareAngles = () => {
    setTarget(null);
    const mk = (angle, i) => ({ v: 40, angle, g: 9.8, color: COLORS[i], id: Date.now() + Math.random() + i });
    setShots([mk(30, 0), mk(45, 1), mk(60, 2)]);
  };
  const compareGravities = () => {
    setTarget(null);
    const mk = (g, i) => ({ v: 40, angle: 45, g, color: COLORS[i], id: Date.now() + Math.random() + i });
    setShots([mk(9.8, 0), mk(3.7, 1), mk(1.6, 2)]);
  };
  const matchTarget = () => {
    setShots([]);
    const tx = 80 + Math.random() * 100;
    const ty = 20 + Math.random() * 40;
    setTarget({ x: tx, y: ty });
    setParams({ v: 40, angle: 45, g: 9.8 });
  };

  const btn = "flex-1 min-w-[140px] bg-white text-[#0f172a] font-bold uppercase tracking-[0.06em] text-xs py-2 px-3 border-[3px] border-[#0f172a] rounded-[4px] shadow-[3px_3px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#0f172a] hover:bg-[#f4d35e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all";

  return (
    <section id="presets" className={classNames.card}>
      <h2 className={classNames.cardTitle}>Explorations</h2>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={compareAngles}>◢ Compare Angles<div className="text-[0.6rem] font-normal text-[#64748b] mt-0.5">30° / 45° / 60°</div></button>
        <button className={btn} onClick={compareGravities}>◉ Compare Gravities<div className="text-[0.6rem] font-normal text-[#64748b] mt-0.5">Earth / Mars / Moon</div></button>
        <button className={btn} onClick={matchTarget}>✕ Match the Target<div className="text-[0.6rem] font-normal text-[#64748b] mt-0.5">Tune to hit it</div></button>
      </div>
    </section>
  );
}

function CompareTable({ shots, delShot, clearAll }) {
  const rows = shots.map((s) => ({ ...s, ...physics(s) }));
  return (
    <section id="compare" className={classNames.card}>
      <div className="flex justify-between items-center mb-3">
        <h2 className={classNames.cardTitle + " mb-0"}>Comparison Table</h2>
        {shots.length > 0 && (
          <button onClick={clearAll} className="text-[0.65rem] uppercase tracking-[0.08em] font-bold bg-[#0f172a] text-white px-3 py-1 border-[3px] border-[#0f172a] rounded-[4px] hover:bg-[#e63946] transition-colors">
            Clear All
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-[#64748b] italic py-4 text-center">No shots yet — add one or try a preset.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.1em] border-b-[2px] border-[#0f172a]">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">v₀</th>
                <th className="py-2 pr-2">θ</th>
                <th className="py-2 pr-2">g</th>
                <th className="py-2 pr-2">Range</th>
                <th className="py-2 pr-2">Height</th>
                <th className="py-2 pr-2">Time</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="font-['JetBrains_Mono',monospace] text-[0.78rem]">
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-[#0f172a]/10 hover:bg-[#f4d35e] transition-colors">
                  <td className="py-2 pr-2"><span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ background: r.color }} />{i + 1}</td>
                  <td className="py-2 pr-2">{r.v}</td>
                  <td className="py-2 pr-2">{r.angle}°</td>
                  <td className="py-2 pr-2">{r.g}</td>
                  <td className="py-2 pr-2">{r.R.toFixed(1)}m</td>
                  <td className="py-2 pr-2">{r.H.toFixed(1)}m</td>
                  <td className="py-2 pr-2">{r.T.toFixed(2)}s</td>
                  <td className="py-2 text-right">
                    <button onClick={() => delShot(r.id)} className="text-[0.65rem] font-bold uppercase text-[#e63946] hover:underline">del</button>
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

function Sessions({ shots, setShots, target, setTarget }) {
  const { useLiveQuery, database } = useFireproof("projectile-lab-db");
  const { docs: sessions } = useLiveQuery("type", { key: "session", descending: true });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");

  const save = async () => {
    if (shots.length === 0) return;
    const label = name.trim() || `Session ${new Date().toLocaleString()}`;
    await database.put({ type: "session", label, shots, target, createdAt: Date.now() });
    setName("");
  };
  const restore = (id) => {
    setSelected(id);
    if (!id) return;
    const s = sessions.find((d) => d._id === id);
    if (s) { setShots(s.shots || []); setTarget(s.target || null); }
  };
  const del = async () => {
    if (!selected) return;
    await database.del(selected);
    setSelected("");
  };

  const inp = "flex-1 min-w-[140px] px-3 py-2 text-sm border-[3px] border-[#0f172a] rounded-[4px] bg-white focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#0f172a] transition-all";
  const btn = "bg-[#2a9d8f] text-white font-bold uppercase tracking-[0.06em] text-xs py-2 px-4 border-[3px] border-[#0f172a] rounded-[4px] shadow-[3px_3px_0px_#0f172a] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-40";

  return (
    <section id="sessions" className={classNames.card}>
      <h2 className={classNames.cardTitle}>Lab Sessions</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Session name…" className={inp} />
        <button onClick={save} disabled={shots.length === 0} className={btn}>Save</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={selected} onChange={(e) => restore(e.target.value)} className={inp}>
          <option value="">— Restore a session —</option>
          {sessions.map((s) => (
            <option key={s._id} value={s._id}>{s.label} ({s.shots?.length || 0} shots)</option>
          ))}
        </select>
        <button onClick={del} disabled={!selected} className={btn + " !bg-[#e63946]"}>Delete</button>
      </div>
    </section>
  );
}

export default function App() {
  const [shots, setShots] = useState([]);
  const [target, setTarget] = useState(null);
  const [params, setParams] = useState({ v: 40, angle: 45, g: 9.8 });

  const addShot = (s) => setShots((prev) => prev.length >= 6 ? prev : [...prev, { ...s, id: Date.now() + Math.random() }]);
  const delShot = (id) => setShots((prev) => prev.filter((s) => s.id !== id));
  const clearAll = () => setShots([]);

  return (
    <main id="app" className={classNames.page}>
      <div className={classNames.shell}>
        <header id="app-header" className={classNames.header}>
          <h1 className={classNames.title}>Projectile Lab</h1>
          <div className={classNames.subtitle}>Sandbox // Multi-Shot Comparator</div>
        </header>
        <Controls params={params} setParams={setParams} addShot={addShot} shots={shots} />
        <Canvas shots={shots} target={target} />
        <Presets setShots={setShots} setTarget={setTarget} setParams={setParams} />
        <CompareTable shots={shots} delShot={delShot} clearAll={clearAll} />
        <Sessions shots={shots} setShots={setShots} target={target} setTarget={setTarget} />
      </div>
    </main>
  );
}