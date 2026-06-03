import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const MOODS = [
  { key: "radiant", label: "Radiant" },
  { key: "calm", label: "Calm" },
  { key: "meh", label: "Meh" },
  { key: "tense", label: "Tense" },
  { key: "heavy", label: "Heavy" },
];

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ComposeSection() {
  const { viewer, isViewerPending } = useViewer();
  const { database } = useFireproof("hearthJournal");
  const [mood, setMood] = React.useState("calm");
  const [notes, setNotes] = React.useState("");
  const [reflection, setReflection] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  async function generate() {
    if (!viewer) return;
    setIsLoading(true);
    try {
      const raw = await callAI(
        `The journaler is feeling "${mood}". Their notes: "${notes || "(none yet)"}". Generate one thoughtful reflection question and one brief warm affirmation.`,
        { schema: { properties: { question: { type: "string" }, affirmation: { type: "string" } } } }
      );
      setReflection(JSON.parse(raw));
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestStarter() {
    if (!viewer) return;
    setIsLoading(true);
    try {
      const raw = await callAI(`Suggest a one-sentence journal opener for someone feeling "${mood}".`, {
        schema: { properties: { opener: { type: "string" } } },
      });
      setNotes(JSON.parse(raw).opener);
    } finally {
      setIsLoading(false);
    }
  }

  async function save() {
    if (!viewer || !notes.trim()) return;
    setIsSaving(true);
    try {
      await database.put({
        type: "entry",
        mood,
        notes: notes.trim(),
        reflection,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
      setNotes("");
      setReflection(null);
    } finally {
      setIsSaving(false);
    }
  }

  if (isViewerPending) return null;

  if (!viewer) {
    return (
      <section id="compose" className="rounded-2xl p-5 border border-white/10 bg-[oklch(0.38_0.17_295/0.4)]">
        <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Tonight's entry
        </h2>
        <p className="text-sm opacity-80">Sign in above to begin your journal.</p>
      </section>
    );
  }

  return (
    <section id="compose" className="rounded-2xl p-5 border border-white/10 bg-[oklch(0.38_0.17_295/0.4)]">
      <h2 className="text-xl font-semibold mb-3" style={{ fontFamily: "Fredoka, sans-serif" }}>
        Tonight's entry
      </h2>

      <label className="block text-sm font-medium mb-2 opacity-90">How are you feeling?</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {MOODS.map((m) => {
          const active = mood === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMood(m.key)}
              className={`px-3 py-2 rounded-full text-sm min-h-[44px] border transition ${
                active
                  ? "bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)] border-[oklch(0.88_0.18_95)] font-semibold"
                  : "bg-transparent border-white/15 text-white"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium opacity-90">What's on your mind?</label>
        <button
          type="button"
          onClick={suggestStarter}
          disabled={isLoading}
          className="text-xs px-2 py-1 rounded-md border border-white/15 opacity-80 hover:opacity-100 disabled:opacity-40"
        >
          Suggest opener
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Let it spill..."
        rows={5}
        className="w-full rounded-xl px-3 py-3 text-white placeholder-white/50 border border-white/15 bg-[oklch(0.18_0.10_300/0.5)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.88_0.18_95)] min-h-[120px]"
      />

      {reflection && (
        <div className="mt-4 rounded-xl p-4 border border-[oklch(0.88_0.18_95/0.4)] bg-[oklch(0.88_0.18_95/0.15)]">
          <p className="font-semibold mb-1">{reflection.question}</p>
          <p className="text-sm opacity-90">{reflection.affirmation}</p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={generate}
          disabled={isLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold min-h-[44px] border border-white/15 bg-[oklch(0.47_0.18_295)] text-white disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Spinner /> Reflecting...
            </>
          ) : (
            "Generate reflection"
          )}
        </button>
        <button
          onClick={save}
          disabled={isSaving || !notes.trim()}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold min-h-[44px] bg-[oklch(0.70_0.15_155)] text-[oklch(0.15_0.10_155)] disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Spinner /> Saving...
            </>
          ) : (
            "Save entry"
          )}
        </button>
      </div>
    </section>
  );
}

function FeedSection() {
  const { ViewerTag, isOwner } = useViewer();
  const { useLiveQuery, database } = useFireproof("hearthJournal");
  const { docs } = useLiveQuery("createdAt", { descending: true, limit: 50 });
  const entries = docs.filter((d) => d.type === "entry");

  return (
    <section id="feed" className="rounded-2xl p-5 border border-white/10 bg-[oklch(0.38_0.17_295/0.4)]">
      <h2 className="text-xl font-semibold mb-3" style={{ fontFamily: "Fredoka, sans-serif" }}>
        Past entries
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm opacity-70">No entries yet — your journal will grow here.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((d) => (
            <li key={d._id} className="rounded-xl p-4 border border-white/10 bg-[oklch(0.18_0.10_300/0.4)]">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <ViewerTag userHandle={d.authorHandle} />
                <span className="text-xs px-2 py-1 rounded-full bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)] font-semibold">
                  {MOODS.find((m) => m.key === d.mood)?.label || d.mood}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-2">{d.notes}</p>
              {d.reflection && (
                <div className="mt-2 rounded-lg p-3 text-sm bg-[oklch(0.88_0.18_95/0.12)]">
                  <p className="font-semibold mb-1">{d.reflection.question}</p>
                  <p className="opacity-90">{d.reflection.affirmation}</p>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-70">{new Date(d.createdAt).toLocaleString()}</span>
                {isOwner && (
                  <button
                    onClick={() => database.del(d._id)}
                    className="text-xs px-2 py-1 rounded-md border border-white/15 opacity-80 hover:opacity-100"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { ViewerTag } = useViewer();

  return (
    <div
      className="min-h-screen text-white pb-12"
      style={{
        background: "linear-gradient(160deg, oklch(0.18 0.10 300), oklch(0.12 0.09 300))",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700&display=optional"
      />
      <header
        id="app-header"
        className="sticky top-0 z-10 backdrop-blur-md px-5 py-4 flex items-center justify-between border-b border-white/10"
        style={{ background: "oklch(0.18 0.10 300 / 0.7)" }}
      >
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Hearth Journal
        </h1>
        <ViewerTag />
      </header>
      <main id="app" className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <ComposeSection />
        <FeedSection />
      </main>
    </div>
  );
}
