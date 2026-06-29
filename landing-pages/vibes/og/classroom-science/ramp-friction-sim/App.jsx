import React, { useState, useEffect, useRef } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const G = 9.81;

const c = {
  page: "min-h-screen bg-[#f5f3ec] p-6 font-['Space_Grotesk',sans-serif] text-[#15131f]",
  wrap: "max-w-5xl mx-auto",
  header: "mb-4 p-4 bg-white border-[3px] border-[#15131f] rounded shadow-[4px_4px_0_#15131f]",
  title: "text-2xl font-bold uppercase tracking-tight",
  card: "mb-4 p-4 bg-white border-[3px] border-[#15131f] rounded shadow-[4px_4px_0_#15131f]",
  label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6878] font-semibold",
  mono: "font-['JetBrains_Mono',monospace]",
  btn: "px-4 py-2 border-[3px] border-[#15131f] rounded bg-[#d94a2f] text-white uppercase text-xs font-bold tracking-wider shadow-[4px_4px_0_#15131f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  btn2: "px-4 py-2 border-[3px] border-[#15131f] rounded bg-[#ecc94b] uppercase text-xs font-bold tracking-wider shadow-[3px_3px_0_#15131f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
};

function Slider({ label, unit, min, max, step, value, onChange, color }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className={c.label}>{label}</span>
        <span className={`${c.mono} text-sm font-bold px-2 py-0.5 border-[2px] border-[#15131f] rounded`} style={{background: color}}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#d94a2f]" />
    </div>
  );
}

function Arrow({ x1, y1, x2, y2, color, label, id }) {
  const dx = x2 - x1, dy = y2 - y1;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  return (
    <g>
      <defs>
        <marker id={`ah-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="3" markerEnd={`url(#ah-${id})`} />
      <text x={mx + (dy/len)*12} y={my - (dx/len)*12} fill={color} fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700">{label}</text>
    </g>
  );
}

function SceneSVG({ s, p }) {
  const W = 700, H = 360;
  const floorY = 300;
  const rampLen = 260;
  const baseX = 80;
  const topX = baseX + rampLen * p.cos;
  const topY = floorY - rampLen * p.sin;
  // block position along ramp (0=top, 1=bottom)
  const bx = topX + (baseX + rampLen * p.cos - topX) * s.pos;
  const by = topY + (floorY - topY) * s.pos;
  // but block should slide to bottom of ramp: param along ramp from top to base-corner
  const bottomX = baseX + rampLen * p.cos;
  const blockX = topX + (bottomX - topX) * s.pos;
  const blockY = topY + (floorY - topY) * s.pos;
  // perpendicular unit (outward normal)
  const nx = -p.sin, ny = -p.cos;
  // along-ramp unit (down-slope)
  const ax = p.cos, ay = p.sin;
  const cx = blockX + nx * 14;
  const cy = blockY + ny * 14;
  const scale = 2.2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border-[3px] border-[#15131f] rounded bg-white">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d8d4c4" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {/* floor */}
      <line x1={0} y1={floorY} x2={W} y2={floorY} stroke="#15131f" strokeWidth="3" />
      {/* ramp */}
      <polygon points={`${baseX},${floorY} ${bottomX},${floorY} ${topX},${topY}`} fill="#ecc94b" stroke="#15131f" strokeWidth="3" />
      <text x={baseX + 30} y={floorY - 8} fontSize="12" fontFamily="JetBrains Mono, monospace">θ = {s.theta}°</text>
      {/* block: rotate rect to sit flat on ramp */}
      <g transform={`translate(${cx},${cy}) rotate(${-s.theta})`}>
        <rect x={-14} y={-14} width={28} height={28} fill="#d94a2f" stroke="#15131f" strokeWidth="3" />
      </g>
      {/* arrows */}
      <Arrow id="g"  x1={cx} y1={cy} x2={cx} y2={cy + p.Fg*scale} color="#15131f" label={`mg=${p.Fg.toFixed(1)}N`} />
      <Arrow id="n"  x1={cx} y1={cy} x2={cx + nx*p.N*scale} y2={cy + ny*p.N*scale} color="#4a90d9" label={`N=${p.N.toFixed(1)}N`} />
      <Arrow id="f"  x1={cx} y1={cy} x2={cx - ax*p.Ffric*scale} y2={cy - ay*p.Ffric*scale} color="#5fb85f" label={`f=${p.Ffric.toFixed(1)}N`} />
      <Arrow id="net" x1={cx} y1={cy} x2={cx + ax*p.Fnet*scale} y2={cy + ay*p.Fnet*scale} color="#d94a2f" label={`Fnet=${p.Fnet.toFixed(1)}N`} />
    </svg>
  );
}

function Controls({ s }) {
  return (
    <section className={c.card}>
      <h2 className={c.label + " mb-3"}>Controls</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <Slider label="Angle θ" unit="°" min={0} max={60} step={1} value={s.theta} onChange={s.setTheta} color="#ecc94b" />
        <Slider label="Friction μ" unit="" min={0} max={1} step={0.01} value={s.mu} onChange={s.setMu} color="#4a90d9" />
        <Slider label="Mass m" unit=" kg" min={1} max={20} step={0.5} value={s.mass} onChange={s.setMass} color="#5fb85f" />
      </div>
    </section>
  );
}

function Scene() {
  return <section className={c.card}><h2 className={c.label}>Scene</h2></section>;
}

function Notebook() {
  return <section className={c.card}><h2 className={c.label}>Lab Notebook</h2></section>;
}

export default function App() {
  const [theta, setTheta] = useState(30);
  const [mu, setMu] = useState(0.3);
  const [mass, setMass] = useState(5);
  const [pos, setPos] = useState(0); // 0..1 along ramp, 0=top
  const [vel, setVel] = useState(0);
  const [running, setRunning] = useState(false);
  const [finalVel, setFinalVel] = useState(null);
  const shared = { theta, setTheta, mu, setMu, mass, setMass, pos, setPos, vel, setVel, running, setRunning, finalVel, setFinalVel };
  return (
    <main className={c.page}>
      <div className={c.wrap}>
        <header className={c.header}>
          <h1 className={c.title}>Inclined Plane Lab</h1>
          <p className={c.label + " mt-1"}>Friction · Forces · Motion</p>
        </header>
        <Controls s={shared} />
        <Scene s={shared} />
        <Notebook s={shared} />
      </div>
    </main>
  );
}