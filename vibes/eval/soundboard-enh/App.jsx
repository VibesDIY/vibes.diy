import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Recorder({ viewer }) {
  const { database } = useFireproof("soundboard");
  const [recording, setRecording] = React.useState(false);
  const [blob, setBlob] = React.useState(null);
  const [desc, setDesc] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const recRef = React.useRef(null);
  const chunksRef = React.useRef([]);

  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => chunksRef.current.push(e.data);
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: "audio/webm" });
      setBlob(b);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  function stopRec() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function submit() {
    if (!blob || !desc.trim() || !viewer) return;
    setBusy(true);
    try {
      let label = desc.trim().slice(0, 40);
      let category = "misc";
      try {
        const ai = await callAI(
          `Suggest a short label (max 4 words) and one category (intro, sfx, music, voice, misc) for this audio clip described as: "${desc}"`,
          {
            schema: { properties: { label: { type: "string" }, category: { type: "string" } } },
          }
        );
        const parsed = JSON.parse(ai);
        if (parsed.label) label = parsed.label;
        if (parsed.category) category = parsed.category;
      } catch {}
      const file = new File([blob], "clip.webm", { type: "audio/webm" });
      await database.put({
        type: "sample",
        status: "pending",
        label,
        category,
        description: desc.trim(),
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
        _files: { clip: file },
      });
      setBlob(null);
      setDesc("");
    } finally {
      setBusy(false);
    }
  }

  if (!viewer) {
    return (
      <section id="recorder" className="rounded-xl border border-[#d1d4dc] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Record sample</h2>
        <p className="text-sm text-[#6b7280]">Sign in to submit clips.</p>
      </section>
    );
  }

  return (
    <section id="recorder" className="rounded-xl border border-[#d1d4dc] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Record sample</h2>
      <div className="flex flex-col gap-3">
        {!blob ? (
          <button
            onClick={recording ? stopRec : startRec}
            className={`min-h-[44px] rounded-lg font-medium text-white ${recording ? "bg-[#9b1c1c]" : "bg-[#d9531e]"}`}
          >
            {recording ? "■ Stop recording" : "● Start recording"}
          </button>
        ) : (
          <>
            <audio controls src={URL.createObjectURL(blob)} className="w-full" />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe the clip (e.g. crowd cheer)"
              className="min-h-[44px] rounded-lg border border-[#d1d4dc] px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={busy || !desc.trim()}
                className="flex-1 min-h-[44px] rounded-lg bg-[#1f2937] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="50" />
                  </svg>
                )}
                {busy ? "Submitting..." : "Submit for review"}
              </button>
              <button
                onClick={() => {
                  setBlob(null);
                  setDesc("");
                }}
                className="min-h-[44px] px-4 rounded-lg border border-[#d1d4dc]"
              >
                Discard
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ApprovalQueue() {
  const { database, useLiveQuery } = useFireproof("soundboard");
  const { docs: pending } = useLiveQuery("status", { key: "pending" });

  return (
    <section id="approval-queue" className="rounded-xl border border-[#d1d4dc] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Pending review ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-[#6b7280]">Nothing waiting.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((d) => (
            <li key={d._id} className="border border-[#e5e7eb] rounded-lg p-3 bg-[#fafbfc]">
              {d._files?.clip?.url && <audio controls src={d._files.clip.url} className="w-full mb-2" />}
              <input
                value={d.label}
                onChange={(e) => database.put({ ...d, label: e.target.value })}
                className="w-full min-h-[40px] rounded border border-[#d1d4dc] px-2 mb-2 text-sm"
              />
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={d.category}
                  onChange={(e) => database.put({ ...d, category: e.target.value })}
                  className="rounded border border-[#d1d4dc] px-2 py-1 text-sm"
                >
                  {["intro", "sfx", "music", "voice", "misc"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-[#6b7280]">by @{d.authorHandle}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => database.put({ ...d, status: "approved" })}
                  className="flex-1 min-h-[40px] rounded bg-[#15803d] text-white text-sm font-medium"
                >
                  Approve
                </button>
                <button onClick={() => database.del(d._id)} className="min-h-[40px] px-3 rounded border border-[#d1d4dc] text-sm">
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CAT_COLORS = {
  intro: "bg-[#1f2937]",
  sfx: "bg-[#d9531e]",
  music: "bg-[#6b3fa0]",
  voice: "bg-[#15803d]",
  misc: "bg-[#6b7280]",
};

function PlaybackGrid({ isOwner }) {
  const { database, useLiveQuery } = useFireproof("soundboard");
  const { docs: approved } = useLiveQuery("status", { key: "approved" });
  const audioRef = React.useRef(null);

  function play(url) {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const a = new Audio(url);
    audioRef.current = a;
    a.play();
  }

  return (
    <section id="playback-grid" className="rounded-xl border border-[#d1d4dc] bg-[#f4f5f7] p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Live board</h2>
      {approved.length === 0 ? (
        <p className="text-sm text-[#6b7280]">No approved samples yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {approved.map((d) => (
            <div key={d._id} className="relative">
              <button
                onClick={() => d._files?.clip?.url && play(d._files.clip.url)}
                className={`w-full min-h-[80px] rounded-lg ${CAT_COLORS[d.category] || CAT_COLORS.misc} text-white p-2 text-sm font-medium active:scale-95 transition-transform`}
              >
                <div className="truncate">{d.label}</div>
                <div className="text-xs opacity-70 mt-1">{d.category}</div>
              </button>
              {isOwner && (
                <button
                  onClick={() => database.put({ ...d, status: "pending" })}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white text-[#1a1a1a] text-xs"
                  title="Unapprove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen bg-[#e9ebf0] text-[#1a1a1a]",
    header: "sticky top-0 z-10 bg-[#1f2937] text-white px-4 py-3 shadow-md flex items-center justify-between",
    title: "text-xl font-bold tracking-tight",
    main: "max-w-2xl mx-auto p-4 space-y-4 pb-24",
    badge: "text-xs uppercase tracking-wider bg-[#d9531e] text-white px-2 py-1 rounded",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center gap-2">
          <span className={c.title}>Pod Sample Board</span>
          {isOwner && <span className={c.badge}>Producer</span>}
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <Recorder viewer={viewer} />
        {isOwner && <ApprovalQueue />}
        <PlaybackGrid isOwner={isOwner} />
      </main>
    </div>
  );
}
