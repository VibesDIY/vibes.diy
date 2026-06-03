import React, { useState, useRef, useEffect } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const PAD_COUNT = 16;

const NEON_COLORS = [
  "from-[#f93c94] to-[#ff5bad]",
  "from-[#00f0ff] to-[#4d1558]",
  "from-[#fcee0a] to-[#ffc85c]",
  "from-[#ff5bad] to-[#f93c94]",
];

const KITS = {
  synth: { name: "Synth", freqs: [220, 247, 277, 294, 330, 370, 415, 440, 494, 554, 587, 659, 740, 831, 880, 988] },
  bass: { name: "Bass", freqs: [55, 62, 73, 82, 98, 110, 123, 131, 147, 165, 185, 196, 220, 247, 277, 294] },
  bells: { name: "Bells", freqs: [880, 988, 1109, 1175, 1319, 1480, 1661, 1760, 1976, 2217, 2349, 2637, 2960, 3322, 3520, 3951] },
};

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state !== "running") audioCtx.resume();
  return audioCtx;
}

function playTone(freq, type = "sine") {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  env.gain.setValueAtTime(0.0001, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  osc.connect(env).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.65);
  osc.onended = () => {
    try {
      osc.disconnect();
      env.disconnect();
    } catch {}
  };
}

async function playBuffer(file) {
  const ctx = getCtx();
  const ab = await file.arrayBuffer();
  const buf = await ctx.decodeAudioData(ab);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
}

function Pad({ index, padDoc, kit, isOwner, onUpload, onRename }) {
  const [ripple, setRipple] = useState(0);
  const fileRef = useRef(null);

  const trigger = async () => {
    setRipple((r) => r + 1);
    if (padDoc?._files?.sample) {
      try {
        const f = await padDoc._files.sample.file();
        await playBuffer(f);
      } catch {}
    } else {
      const freq = KITS[kit]?.freqs[index] || 440;
      const type = kit === "bass" ? "sawtooth" : kit === "bells" ? "triangle" : "sine";
      playTone(freq, type);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onUpload(index, f);
    e.target.value = "";
  };

  const label = padDoc?.label || `Pad ${index + 1}`;
  const colorClass = NEON_COLORS[index % NEON_COLORS.length];
  const hasSample = !!padDoc?._files?.sample;

  return (
    <div className="relative aspect-square">
      <button
        onPointerDown={trigger}
        className={`relative w-full h-full rounded-xl bg-gradient-to-br ${colorClass} shadow-[0_0_20px_rgba(249,60,148,0.5)] active:scale-95 transition-transform overflow-hidden border-2 border-[#fcee0a]/40`}
      >
        <span className="absolute inset-0 flex items-center justify-center text-[#2a0a2e] font-bold text-xs px-1 text-center [font-family:Orbitron,sans-serif] drop-shadow">
          {label}
        </span>
        {hasSample && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />}
        {[...Array(ripple)].slice(-3).map((_, i) => (
          <span
            key={`${ripple}-${i}`}
            className="absolute inset-0 rounded-xl border-2 border-white pointer-events-none"
            style={{ animation: "pad-ripple 0.6s ease-out forwards" }}
          />
        ))}
      </button>
      {isOwner && (
        <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[10px] px-1.5 py-0.5 bg-[#2a0a2e] text-[#00f0ff] rounded border border-[#00f0ff]/50"
          >
            load
          </button>
          <button
            onClick={() => {
              const n = prompt("Pad name?", label);
              if (n) onRename(index, n);
            }}
            className="text-[10px] px-1.5 py-0.5 bg-[#2a0a2e] text-[#fcee0a] rounded border border-[#fcee0a]/50"
          >
            name
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("neonPads");

  const { docs: pads } = useLiveQuery("padIndex");
  const { docs: settings } = useLiveQuery("type", { key: "settings" });
  const kit = settings[0]?.kit || "synth";

  const padByIndex = {};
  pads.forEach((p) => {
    padByIndex[p.padIndex] = p;
  });

  const setKit = async (k) => {
    const existing = settings[0];
    await database.put({ ...(existing || { type: "settings" }), kit: k });
  };

  const uploadSample = async (index, file) => {
    const existing = padByIndex[index];
    await database.put({
      ...(existing || { padIndex: index, type: "pad" }),
      _files: { sample: file },
    });
  };

  const renamePad = async (index, label) => {
    const existing = padByIndex[index];
    await database.put({
      ...(existing || { padIndex: index, type: "pad" }),
      label,
    });
  };

  const clearPad = async (index) => {
    const existing = padByIndex[index];
    if (existing) await database.del(existing._id);
  };

  if (isViewerPending) return null;

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] [font-family:Rajdhani,sans-serif]",
    header:
      "sticky top-0 z-10 bg-[#2a0a2e]/95 backdrop-blur border-b-2 border-[#f93c94] px-4 py-3 flex items-center justify-between",
    title: "text-xl text-[#fcee0a] [font-family:Orbitron,sans-serif] font-bold tracking-widest drop-shadow-[0_0_8px_#f93c94]",
    main: "p-4 max-w-md mx-auto",
    kitBar: "flex gap-2 mb-4 justify-center flex-wrap",
    kitBtn: "px-3 py-2 rounded-lg [font-family:Orbitron,sans-serif] text-xs font-bold border-2 min-h-[44px]",
    kitActive: "bg-[#f93c94] text-white border-[#fcee0a] shadow-[0_0_12px_#f93c94]",
    kitIdle: "bg-[#2a0a2e]/80 text-[#00f0ff] border-[#00f0ff]/40",
    grid: "grid grid-cols-4 gap-2",
    foot: "mt-6 text-center text-xs text-[#2a0a2e] [font-family:'Share Tech Mono',monospace]",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=optional');
        @keyframes pad-ripple {
          0% { opacity: 0.8; transform: scale(0.4); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
      <main id="app" className={c.page}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>NEON PADS</h1>
          <ViewerTag />
        </header>

        <div className={c.main}>
          {isOwner && (
            <section id="kit-switcher" aria-label="Kit switcher" className={c.kitBar}>
              {Object.entries(KITS).map(([key, k]) => (
                <button key={key} onClick={() => setKit(key)} className={`${c.kitBtn} ${kit === key ? c.kitActive : c.kitIdle}`}>
                  {k.name}
                </button>
              ))}
            </section>
          )}
          {!isOwner && (
            <p className={`${c.kitBar} text-[#2a0a2e] [font-family:Orbitron,sans-serif] text-sm`}>kit: {KITS[kit].name}</p>
          )}

          <section id="pad-grid" aria-label="Sound pads" className={c.grid}>
            {[...Array(PAD_COUNT)].map((_, i) => (
              <Pad
                key={i}
                index={i}
                padDoc={padByIndex[i]}
                kit={kit}
                isOwner={isOwner}
                onUpload={uploadSample}
                onRename={renamePad}
              />
            ))}
          </section>

          {isOwner && (
            <section id="clear-controls" className="mt-4 flex flex-wrap gap-1 justify-center">
              {pads.map((p) => (
                <button
                  key={p._id}
                  onClick={() => clearPad(p.padIndex)}
                  className="text-[10px] px-2 py-1 bg-[#2a0a2e] text-[#ff5bad] rounded border border-[#ff5bad]/50"
                >
                  clear {p.label || `pad ${p.padIndex + 1}`}
                </button>
              ))}
            </section>
          )}

          <p className={c.foot}>tap pads to play · {isOwner ? "long-tap a pad to load or rename" : "view-only mode"}</p>
        </div>
      </main>
    </>
  );
}
