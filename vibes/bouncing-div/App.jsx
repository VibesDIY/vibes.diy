import React from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";
import { useVibe } from "use-vibes";
import { callAI } from "call-ai";

const SETTINGS_ID = "box:settings";

function ThemeStyle() {
  return (
    <style>{`
:root {
  --background: oklch(0.96 0.01 90);
  --surface: rgba(255, 255, 255, 0.85);
  --accent: oklch(0.55 0.24 28);
  --text-primary: rgba(20, 20, 20, 0.92);
  --text-secondary: rgba(20, 20, 20, 0.5);
  --border: rgba(20, 20, 20, 0.14);
  --primary: oklch(0.55 0.24 28);
  --secondary: oklch(0.55 0.24 28);
  --radius: 4px;
  --radius-sm: 0.25rem;
  --radius-lg: 1rem;
  --spacing: 1rem;
  --border-width: 1px;
  --font-family: 'Space Grotesk', sans-serif;
  --font-size-base: 1rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.06 0.01 90);
    --surface: rgba(255, 255, 255, 0.04);
    --text-primary: rgba(255, 255, 255, 0.92);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --border: rgba(255, 255, 255, 0.18);
    --accent: oklch(0.45 0.24 28);
    --primary: oklch(0.45 0.24 28);
    --secondary: oklch(0.45 0.24 28);
  }
}
@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }
`}</style>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function BouncingStage({ settings }) {
  const stageRef = React.useRef(null);
  const [pos, setPos] = React.useState({ x: 20, y: 20 });
  const stateRef = React.useRef({ x: 20, y: 20, vx: 2, vy: 1.6 });

  React.useEffect(() => {
    let raf;
    function tick() {
      const stage = stageRef.current;
      if (!stage) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const size = settings.size;
      const speed = settings.speed / 5;
      const s = stateRef.current;
      const mag = Math.hypot(s.vx, s.vy) || 1;
      s.vx = (s.vx / mag) * speed;
      s.vy = (s.vy / mag) * speed;
      s.x += s.vx;
      s.y += s.vy;
      if (s.x <= 0) {
        s.x = 0;
        s.vx = Math.abs(s.vx);
      }
      if (s.y <= 0) {
        s.y = 0;
        s.vy = Math.abs(s.vy);
      }
      if (s.x + size >= w) {
        s.x = w - size;
        s.vx = -Math.abs(s.vx);
      }
      if (s.y + size >= h) {
        s.y = h - size;
        s.vy = -Math.abs(s.vy);
      }
      setPos({ x: s.x, y: s.y });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [settings.speed, settings.size]);

  const c = {
    stage:
      "relative w-full h-[320px] md:h-[420px] rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] overflow-hidden",
  };

  return (
    <div ref={stageRef} className={c.stage}>
      <div
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          width: settings.size,
          height: settings.size,
          background: settings.color,
          borderRadius: settings.shape === "circle" ? "50%" : "var(--radius)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
        }}
      />
      {settings.presetName && (
        <div className="absolute bottom-2 left-3 text-xs text-[var(--text-secondary)] font-[var(--font-family)]">
          {settings.presetName}
        </div>
      )}
    </div>
  );
}

function Controls({ settings, database, canEdit }) {
  const [saving, setSaving] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);

  async function update(patch) {
    setSaving(true);
    try {
      await database.put({ ...settings, ...patch, _id: SETTINGS_ID });
    } finally {
      setSaving(false);
    }
  }

  async function surprise() {
    setAiLoading(true);
    try {
      const res = await callAI(
        "Suggest a playful bouncing-box preset. Return a fun short name, a CSS hex color, a speed from 1-20, a size from 30-160, and shape 'square' or 'circle'.",
        {
          schema: {
            properties: {
              presetName: { type: "string" },
              color: { type: "string" },
              speed: { type: "number" },
              size: { type: "number" },
              shape: { type: "string" },
            },
          },
        }
      );
      const data = JSON.parse(res);
      await database.put({
        ...settings,
        _id: SETTINGS_ID,
        presetName: data.presetName,
        color: data.color,
        speed: Math.max(1, Math.min(20, data.speed)),
        size: Math.max(30, Math.min(160, data.size)),
        shape: data.shape === "circle" ? "circle" : "square",
      });
    } finally {
      setAiLoading(false);
    }
  }

  const c = {
    panel:
      "p-[var(--spacing)] rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] space-y-3",
    row: "flex items-center justify-between gap-3",
    label: "text-sm text-[var(--text-secondary)] font-[var(--font-family)]",
    value: "text-sm text-[var(--text-primary)] font-[var(--font-family)] tabular-nums",
    btn: "min-h-[44px] px-4 py-2 rounded-[var(--radius)] bg-[var(--primary)] text-white font-[var(--font-family)] flex items-center justify-center gap-2 disabled:opacity-50",
    secondary:
      "min-h-[44px] px-4 py-2 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] font-[var(--font-family)]",
    range: "w-full",
    note: "text-xs text-[var(--text-secondary)] font-[var(--font-family)]",
  };

  if (!canEdit) {
    return (
      <div className={c.panel}>
        <p className={c.note}>You're watching in read-only view. Only the owner can change the box.</p>
        <div className={c.row}>
          <span className={c.label}>Color</span>
          <span className={c.value} style={{ color: settings.color }}>
            {settings.color}
          </span>
        </div>
        <div className={c.row}>
          <span className={c.label}>Speed</span>
          <span className={c.value}>{settings.speed}</span>
        </div>
        <div className={c.row}>
          <span className={c.label}>Size</span>
          <span className={c.value}>{settings.size}px</span>
        </div>
      </div>
    );
  }

  return (
    <div className={c.panel}>
      <div className={c.row}>
        <label className={c.label} htmlFor="color">
          Color
        </label>
        <input
          id="color"
          type="color"
          value={settings.color}
          onChange={(e) => update({ color: e.target.value, presetName: "" })}
          className="h-10 w-16 rounded-[var(--radius)] border-[length:var(--border-width)] border-[var(--border)] bg-transparent"
        />
      </div>

      <div>
        <div className={c.row}>
          <span className={c.label}>Speed</span>
          <span className={c.value}>{settings.speed}</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={settings.speed}
          onChange={(e) => update({ speed: Number(e.target.value) })}
          className={c.range}
        />
      </div>

      <div>
        <div className={c.row}>
          <span className={c.label}>Size</span>
          <span className={c.value}>{settings.size}px</span>
        </div>
        <input
          type="range"
          min="30"
          max="160"
          step="2"
          value={settings.size}
          onChange={(e) => update({ size: Number(e.target.value) })}
          className={c.range}
        />
      </div>

      <div className={c.row}>
        <span className={c.label}>Shape</span>
        <div className="flex gap-2">
          <button
            className={c.secondary}
            style={settings.shape === "square" ? { borderColor: "var(--primary)" } : {}}
            onClick={() => update({ shape: "square" })}
          >
            Square
          </button>
          <button
            className={c.secondary}
            style={settings.shape === "circle" ? { borderColor: "var(--primary)" } : {}}
            onClick={() => update({ shape: "circle" })}
          >
            Circle
          </button>
        </div>
      </div>

      <button className={c.btn} onClick={surprise} disabled={aiLoading}>
        {aiLoading ? (
          <>
            <Spinner /> Thinking...
          </>
        ) : (
          "Surprise me"
        )}
      </button>
      {saving && <p className={c.note}>Saving…</p>}
    </div>
  );
}

export default function App() {
  const { ViewerTag } = useViewer();
  const { database, useDocument } = useFireproof("bouncingBox");
  const { can, ready } = useVibe("bouncingBox");

  const { doc: settings } = useDocument({
    _id: SETTINGS_ID,
    color: "#e63946",
    speed: 6,
    size: 80,
    shape: "square",
    presetName: "",
  });

  const canEdit = ready && can.edit({ ...settings, _id: SETTINGS_ID }).ok;

  const c = {
    page: "min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]",
    header:
      "px-4 py-3 border-b-[length:var(--border-width)] border-[var(--border)] bg-[var(--surface)] flex items-center justify-between",
    title: "text-lg font-semibold",
    main: "max-w-3xl mx-auto p-4 space-y-4",
  };

  return (
    <>
      <ThemeStyle />
      <div className={c.page}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>Bouncing Div</h1>
          <ViewerTag />
        </header>
        <main id="app" className={c.main}>
          <section id="stage">
            <BouncingStage settings={settings} />
          </section>
          <section id="controls">
            <Controls settings={settings} database={database} canEdit={canEdit} />
          </section>
        </main>
      </div>
    </>
  );
}
