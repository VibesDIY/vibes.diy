import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function HeaderBar({ ViewerTag, isOwner }) {
  const c = {
    wrap: "flex items-center justify-between px-4 py-3 border-b border-[oklch(0.28_0.03_257)]",
    title: "font-['Archivo_Black'] text-lg tracking-wide text-white",
    badge: "text-[10px] uppercase tracking-widest px-2 py-1 border border-[oklch(0.28_0.03_257)] text-white/70",
  };
  return (
    <header id="app-header" className={c.wrap}>
      <div className="flex items-center gap-3">
        <h1 className={c.title}>SCHEDULE // SYNC</h1>
        {isOwner && <span className={c.badge}>ORGANIZER</span>}
      </div>
      <ViewerTag />
    </header>
  );
}

function MySubmission({ database, viewer, mySubmission }) {
  return (
    <section id="my-submission" className="p-4 border-b border-[oklch(0.28_0.03_257)]">
      <h2 className="font-['Archivo_Black'] text-sm tracking-widest text-white/80 mb-3">YOUR AVAILABILITY</h2>
      {viewer ? (
        <MySubmissionForm database={database} viewer={viewer} mySubmission={mySubmission} />
      ) : (
        <p className="text-white/50 text-sm italic">Sign in to submit your availability.</p>
      )}
    </section>
  );
}

function ConfirmedSlot({ database }) {
  const { useLiveQuery } = useFireproof("scheduleSync");
  const { docs } = useLiveQuery("type", { key: "confirmed" });
  const latest = docs.sort((a, b) => (b.confirmedAt || 0) - (a.confirmedAt || 0))[0];
  return (
    <section id="confirmed-slot" className="p-4 border-b border-[oklch(0.28_0.03_257)]">
      <h2 className="font-['Archivo_Black'] text-sm tracking-widest text-white/80 mb-3">CONFIRMED TIME</h2>
      {latest ? (
        <div className="border border-white p-3">
          <p className="font-['Archivo_Black'] text-white text-base">{latest.slot}</p>
          {latest.note && <p className="text-white/60 text-xs mt-1">{latest.note}</p>}
        </div>
      ) : (
        <p className="text-white/50 text-sm italic">No time confirmed yet.</p>
      )}
    </section>
  );
}

function OrganizerDashboard({ database }) {
  const { useLiveQuery } = useFireproof("scheduleSync");
  const { docs: subs } = useLiveQuery("type", { key: "submission" });
  const [analyzing, setAnalyzing] = React.useState(false);
  const [windows, setWindows] = React.useState([]);
  const [confirming, setConfirming] = React.useState(null);

  async function analyze() {
    if (subs.length === 0) return;
    setAnalyzing(true);
    try {
      const prompt = `These participants submitted availability. Find the top 3 meeting windows ranked by how many participants are free.\n\n${subs.map((s) => `${s.displayName || s.authorHandle}: ${s.availability}`).join("\n")}`;
      const raw = await callAI(prompt, {
        schema: {
          properties: {
            windows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slot: { type: "string", description: "e.g. 'Tue 3:00–4:00 PM'" },
                  coverage: { type: "number", description: "number of participants free" },
                  participants: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse(raw);
      setWindows(parsed.windows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirm(w) {
    setConfirming(w.slot);
    try {
      await database.put({
        type: "confirmed",
        slot: w.slot,
        note: `${w.coverage}/${subs.length} available`,
        confirmedAt: Date.now(),
      });
    } finally {
      setConfirming(null);
    }
  }

  const c = {
    item: "border border-[oklch(0.28_0.03_257)] p-3 mb-2",
    name: "font-['Archivo_Black'] text-xs tracking-wider text-white/70",
    avail: "text-sm text-white/90 mt-1 whitespace-pre-wrap",
    btn: "w-full min-h-[44px] bg-white text-black font-['Archivo_Black'] tracking-wider text-sm disabled:opacity-40 my-3",
    win: "border border-white/40 p-3 mb-2 flex items-center justify-between gap-3",
    confirmBtn:
      "min-h-[44px] px-3 border border-white text-white text-xs font-['Archivo_Black'] tracking-wider hover:bg-white hover:text-black disabled:opacity-40",
  };

  return (
    <section id="organizer-dashboard" className="p-4 border-b border-[oklch(0.28_0.03_257)]">
      <h2 className="font-['Archivo_Black'] text-sm tracking-widest text-white/80 mb-3">ALL SUBMISSIONS ({subs.length})</h2>
      {subs.length === 0 ? (
        <p className="text-white/50 text-sm italic">No submissions yet.</p>
      ) : (
        <>
          <ul>
            {subs.map((s) => (
              <li key={s._id} className={c.item}>
                <p className={c.name}>{s.displayName || s.authorHandle}</p>
                <p className={c.avail}>{s.availability}</p>
              </li>
            ))}
          </ul>
          <button onClick={analyze} disabled={analyzing} className={c.btn}>
            {analyzing ? (
              <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
              </svg>
            ) : (
              "ANALYZE OVERLAP"
            )}
          </button>
          {windows.length > 0 && (
            <div>
              <h3 className="font-['Archivo_Black'] text-xs tracking-widest text-white/70 mb-2 mt-4">TOP WINDOWS</h3>
              {windows.map((w, i) => (
                <div key={i} className={c.win}>
                  <div className="flex-1">
                    <p className="font-['Archivo_Black'] text-white text-sm">{w.slot}</p>
                    <p className="text-white/50 text-xs mt-1">
                      {w.coverage}/{subs.length} free
                    </p>
                  </div>
                  <button onClick={() => confirm(w)} disabled={confirming === w.slot} className={c.confirmBtn}>
                    {confirming === w.slot ? "..." : "CONFIRM"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MySubmissionForm({ database, viewer, mySubmission }) {
  const [text, setText] = React.useState(mySubmission?.availability || "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setText(mySubmission?.availability || "");
  }, [mySubmission?._id]);

  async function save(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await database.put({
        ...(mySubmission || {}),
        _id: mySubmission?._id || `sub:${viewer.userHandle}`,
        type: "submission",
        authorHandle: viewer.userHandle,
        displayName: viewer.displayName || viewer.userHandle,
        availability: text.trim(),
        updatedAt: Date.now(),
      });
    } finally {
      setSaving(false);
    }
  }

  const c = {
    input: "w-full bg-black border border-[oklch(0.28_0.03_257)] text-white p-3 min-h-[120px] font-['Roboto_Mono'] text-sm",
    btn: "min-h-[44px] px-4 bg-white text-black font-['Archivo_Black'] tracking-wider text-sm disabled:opacity-40",
    hint: "text-xs text-white/40 mb-2",
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <p className={c.hint}>e.g. "Mon 2–5pm, Tue after 3pm, Thu morning"</p>
      <textarea className={c.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your free times..." />
      <button type="submit" disabled={saving || !text.trim()} className={c.btn}>
        {saving ? (
          <svg className="animate-spin inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
          </svg>
        ) : mySubmission ? (
          "UPDATE"
        ) : (
          "SUBMIT"
        )}
      </button>
    </form>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("scheduleSync");
  const { docs: mySubs } = useLiveQuery("authorHandle", { key: viewer?.userHandle || "__none__" });
  const mySubmission = mySubs.find((d) => d.type === "submission");

  const c = {
    page: "min-h-screen bg-[oklch(0.16_0_0)] text-white font-['Roboto_Mono']",
    main: "max-w-2xl mx-auto",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Roboto+Mono:wght@400;500&display=optional');`}</style>
      <HeaderBar ViewerTag={ViewerTag} isOwner={isOwner} />
      <main id="app" className={c.main}>
        <ConfirmedSlot database={database} />
        <MySubmission database={database} viewer={viewer} mySubmission={mySubmission} />
        {isOwner && <OrganizerDashboard database={database} />}
      </main>
    </div>
  );
}
