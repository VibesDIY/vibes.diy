import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function MoodSubmit({ viewer, database }) {
  const [mood, setMood] = React.useState("");
  const [loading, setLoading] = React.useState("");

  async function submit(e) {
    e.preventDefault();
    if (!mood.trim() || !viewer) return;
    setLoading(true);
    try {
      const moodText = mood.trim();
      const moodDoc = await database.put({
        type: "mood",
        text: moodText,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
      const response = await callAI(`Suggest 3 songs that match this party mood: "${moodText}". Return real artists and titles.`, {
        schema: {
          properties: {
            songs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  artist: { type: "string" },
                  title: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      });
      const { songs } = JSON.parse(response);
      for (const s of songs) {
        await database.put({
          type: "suggestion",
          moodId: moodDoc.id,
          moodText,
          artist: s.artist,
          title: s.title,
          reason: s.reason,
          status: "pending",
          authorHandle: viewer.userHandle,
          createdAt: Date.now(),
        });
      }
      setMood("");
    } finally {
      setLoading(false);
    }
  }

  async function suggestMood() {
    setLoading(true);
    try {
      const response = await callAI(
        "Give one short, evocative party mood description (5-8 words, like 'late night neon rooftop energy').",
        { schema: { properties: { mood: { type: "string" } } } }
      );
      const { mood: ai } = JSON.parse(response);
      setMood(ai);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="mood-submit"
      className="rounded-2xl bg-[#2a0a2e]/80 border-2 border-[#f93c94] p-4 shadow-[0_0_20px_rgba(249,60,148,0.4)]"
    >
      <h2 className="font-['Orbitron'] text-[#00f0ff] text-lg font-bold mb-3 tracking-wider">DROP YOUR MOOD</h2>
      {!viewer && <p className="text-[#fcee0a]/70 text-sm font-['Rajdhani']">Sign in to submit a mood.</p>}
      {viewer && (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="sweaty basement disco..."
            rows={2}
            className="w-full bg-[#4d1558] border-2 border-[#f93c94] rounded-lg p-3 text-white placeholder-white/40 font-['Rajdhani'] focus:outline-none focus:border-[#00f0ff]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !mood.trim()}
              className="flex-1 min-h-[44px] bg-[#f93c94] text-[#2a0a2e] font-['Orbitron'] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg
                  className="animate-spin"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                "GET TRACKS"
              )}
            </button>
            <button
              type="button"
              onClick={suggestMood}
              disabled={loading}
              className="min-h-[44px] px-3 bg-[#00f0ff] text-[#2a0a2e] font-['Share_Tech_Mono'] text-xs rounded-lg disabled:opacity-50"
            >
              ✨ IDEA
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Suggestions({ isOwner, database, useLiveQuery, ViewerTag }) {
  const { docs } = useLiveQuery("type", { key: "suggestion", descending: true });
  const pending = docs.filter((d) => d.status === "pending");

  async function approve(s) {
    await database.put({
      type: "queueItem",
      artist: s.artist,
      title: s.title,
      moodText: s.moodText,
      requestedBy: s.authorHandle,
      createdAt: Date.now(),
    });
    await database.put({ ...s, status: "approved" });
  }

  async function reject(s) {
    await database.put({ ...s, status: "rejected" });
  }

  return (
    <section
      id="suggestions"
      className="rounded-2xl bg-[#4d1558]/70 border-2 border-[#fcee0a] p-4 shadow-[0_0_20px_rgba(252,238,10,0.3)]"
    >
      <h2 className="font-['Orbitron'] text-[#fcee0a] text-lg font-bold mb-3 tracking-wider">PENDING SUGGESTIONS</h2>
      {pending.length === 0 && (
        <p className="text-white/60 text-sm font-['Rajdhani']">No pending tracks. Drop a mood to get some.</p>
      )}
      <ul className="space-y-2">
        {pending.map((s) => (
          <li key={s._id} className="bg-[#2a0a2e]/80 border border-[#fcee0a]/40 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-['Orbitron'] text-[#fcee0a] text-sm truncate">{s.title}</p>
                <p className="font-['Rajdhani'] text-white/80 text-sm truncate">{s.artist}</p>
                <p className="font-['Share_Tech_Mono'] text-[#00f0ff]/70 text-xs mt-1 truncate">mood: {s.moodText}</p>
                <div className="mt-1 flex items-center gap-1 text-xs text-white/50 font-['Rajdhani']">
                  <span>via</span>
                  <ViewerTag userHandle={s.authorHandle} />
                </div>
              </div>
              {isOwner && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => approve(s)}
                    className="min-h-[44px] px-3 bg-[#00f0ff] text-[#2a0a2e] font-['Orbitron'] text-xs font-bold rounded"
                  >
                    ADD
                  </button>
                  <button
                    onClick={() => reject(s)}
                    className="min-h-[36px] px-3 bg-[#4d1558] text-white/70 font-['Share_Tech_Mono'] text-xs rounded border border-white/20"
                  >
                    SKIP
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Queue({ isOwner, database, useLiveQuery }) {
  const { docs: queue } = useLiveQuery("createdAt", { descending: false });
  const items = queue.filter((d) => d.type === "queueItem");

  return (
    <section id="queue" className="rounded-2xl bg-[#2a0a2e]/80 border-2 border-[#00f0ff] p-4 shadow-[0_0_20px_rgba(0,240,255,0.4)]">
      <h2 className="font-['Orbitron'] text-[#00f0ff] text-lg font-bold mb-3 tracking-wider">THE QUEUE</h2>
      {items.length === 0 && <p className="text-white/60 text-sm font-['Rajdhani']">Queue is empty. Waiting on the DJ.</p>}
      <ol className="space-y-2">
        {items.map((q, i) => (
          <li key={q._id} className="flex items-center gap-3 bg-[#4d1558]/60 border border-[#00f0ff]/30 rounded-lg p-3">
            <span className="font-['Orbitron'] text-[#fcee0a] text-lg font-bold w-6 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-['Orbitron'] text-[#00f0ff] text-sm truncate">{q.title}</p>
              <p className="font-['Rajdhani'] text-white/80 text-sm truncate">{q.artist}</p>
            </div>
            {isOwner && (
              <button
                onClick={() => database.del(q._id)}
                className="text-[#f93c94] font-['Share_Tech_Mono'] text-xs px-2 py-1 border border-[#f93c94]/40 rounded"
              >
                DEL
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("moodMixer");

  const c = {
    page: "min-h-screen bg-gradient-to-br from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] p-4",
    inner: "max-w-2xl mx-auto space-y-4",
    header:
      "rounded-2xl bg-[#2a0a2e] border-2 border-[#f93c94] p-4 flex items-center justify-between shadow-[0_0_30px_rgba(249,60,148,0.5)]",
    title: "font-['Orbitron'] text-2xl font-bold text-[#fcee0a] tracking-widest drop-shadow-[0_0_8px_rgba(252,238,10,0.6)]",
    badge: "font-['Share_Tech_Mono'] text-xs px-2 py-1 rounded bg-[#f93c94] text-[#2a0a2e]",
  };

  return (
    <main id="app" className={c.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@400;600&family=Share+Tech+Mono&display=optional"
        rel="stylesheet"
      />
      <div className={c.inner}>
        <header id="app-header" className={c.header}>
          <div>
            <h1 className={c.title}>MOOD MIXER</h1>
            {isOwner && <span className={c.badge}>DJ MODE</span>}
          </div>
          {!isViewerPending && <ViewerTag />}
        </header>
        <MoodSubmit viewer={viewer} database={database} />
        <Suggestions isOwner={isOwner} database={database} useLiveQuery={useLiveQuery} ViewerTag={ViewerTag} />
        <Queue isOwner={isOwner} database={database} useLiveQuery={useLiveQuery} />
      </div>
    </main>
  );
}
