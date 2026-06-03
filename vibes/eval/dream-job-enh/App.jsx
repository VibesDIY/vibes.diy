import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "use-vibes";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function CaptureSection({ viewer, database }) {
  // Owner-only capture: selfie + dream job → callAI prompt → ImgGen
  const c = {
    card: "bg-[oklch(0.97_0.01_80)] border-2 border-[oklch(0.12_0.01_0)] rounded-lg p-4 shadow-[4px_4px_0_oklch(0.12_0.01_0)]",
    label: "block text-sm font-semibold text-[oklch(0.12_0.01_0)] mb-2",
    input:
      "w-full px-3 py-3 min-h-[44px] border-2 border-[oklch(0.12_0.01_0)] rounded bg-[oklch(0.93_0.12_95)] text-[oklch(0.12_0.01_0)] font-medium",
    btn: "w-full min-h-[44px] py-3 bg-[oklch(0.90_0.06_10)] border-2 border-[oklch(0.12_0.01_0)] rounded font-bold text-[oklch(0.12_0.01_0)] shadow-[3px_3px_0_oklch(0.12_0.01_0)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50",
    suggest: "text-xs px-3 py-2 bg-[oklch(0.90_0.05_240)] border-2 border-[oklch(0.12_0.01_0)] rounded font-semibold",
    preview:
      "w-full aspect-square bg-[oklch(0.93_0.03_130)] border-2 border-dashed border-[oklch(0.12_0.01_0)] rounded flex items-center justify-center text-[oklch(0.45_0.01_0)]",
    heading: "text-3xl mb-3 text-[oklch(0.12_0.01_0)]",
  };
  const [dreamJob, setDreamJob] = React.useState("");
  const [selfieFile, setSelfieFile] = React.useState(null);
  const [selfiePreview, setSelfiePreview] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [generated, setGenerated] = React.useState(null); // { prompt, caption }
  const fileRef = React.useRef(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelfieFile(f);
    setSelfiePreview(URL.createObjectURL(f));
  };

  const suggestJob = async () => {
    setIsLoading(true);
    try {
      const r = await callAI("Suggest one whimsical, party-friendly dream job in 2-5 words. Be creative and a bit absurd.", {
        schema: { properties: { job: { type: "string" } } },
      });
      setDreamJob(JSON.parse(r).job);
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!dreamJob.trim() || !selfieFile || !viewer) return;
    setIsLoading(true);
    try {
      const r = await callAI(
        `Compose a vivid, humorous image-generation prompt for a caricature portrait of a person whose dream job is: "${dreamJob}". Describe their exaggerated features, costume, props, and setting. Also write a witty one-line caption (under 80 chars).`,
        { schema: { properties: { imagePrompt: { type: "string" }, caption: { type: "string" } } } }
      );
      const { imagePrompt, caption } = JSON.parse(r);
      await database.put({
        type: "portrait",
        dreamJob: dreamJob.trim(),
        imagePrompt,
        caption,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
        _files: { selfie: selfieFile },
      });
      setGenerated({ prompt: imagePrompt, caption });
      setDreamJob("");
      setSelfieFile(null);
      setSelfiePreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="capture" className={c.card}>
      <h2 className={c.heading} style={{ fontFamily: "Caveat, cursive" }}>
        Your turn!
      </h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={c.label}>1. Snap a selfie</label>
          <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={onFile} className="block w-full text-sm" />
          {selfiePreview && (
            <img
              src={selfiePreview}
              alt="selfie preview"
              className="mt-2 w-32 h-32 object-cover border-2 border-[oklch(0.12_0.01_0)] rounded"
            />
          )}
        </div>
        <div>
          <label className={c.label}>2. Your dream job</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={dreamJob}
              onChange={(e) => setDreamJob(e.target.value)}
              placeholder="Astronaut chef..."
              className={c.input}
            />
            <button type="button" onClick={suggestJob} disabled={isLoading} className={c.suggest}>
              {isLoading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
                </svg>
              ) : (
                "Surprise me"
              )}
            </button>
          </div>
        </div>
        <button type="submit" disabled={isLoading || !dreamJob.trim() || !selfieFile} className={c.btn}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
              </svg>
              Cooking up your portrait...
            </span>
          ) : (
            "Make my caricature!"
          )}
        </button>
      </form>
      {generated && (
        <div className="mt-4 p-3 bg-[oklch(0.90_0.05_240)] border-2 border-[oklch(0.12_0.01_0)] rounded">
          <p className="text-sm font-semibold">
            Generating: <em>{generated.caption}</em>
          </p>
        </div>
      )}
    </section>
  );
}

function PortraitTile({ doc, ViewerTag }) {
  const c = {
    tile: "bg-[oklch(0.97_0.01_80)] border-2 border-[oklch(0.12_0.01_0)] rounded-lg p-3 shadow-[4px_4px_0_oklch(0.12_0.01_0)] rotate-[-1deg] hover:rotate-0 transition-transform",
    caption: "text-sm italic text-[oklch(0.12_0.01_0)] mt-2 leading-tight",
    job: "text-xl text-[oklch(0.12_0.01_0)] mt-1",
    meta: "flex items-center gap-2 mt-2 text-xs text-[oklch(0.45_0.01_0)]",
  };
  const selfie = doc._files?.selfie;
  // Alternate rotation for scrapbook feel
  const tilt = (doc._id.charCodeAt(0) % 5) - 2;
  return (
    <article className={c.tile} style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="relative">
        <ImgGen
          prompt={doc.imagePrompt}
          database="dreamJobs"
          className="w-full aspect-square object-cover border-2 border-[oklch(0.12_0.01_0)] rounded bg-[oklch(0.93_0.03_130)]"
          showControls={false}
        />
        {selfie?.url && (
          <img
            src={selfie.url}
            alt="selfie"
            className="absolute bottom-2 right-2 w-12 h-12 object-cover border-2 border-[oklch(0.12_0.01_0)] rounded shadow-[2px_2px_0_oklch(0.12_0.01_0)]"
          />
        )}
      </div>
      <p className={c.job} style={{ fontFamily: "Caveat, cursive" }}>
        {doc.dreamJob}
      </p>
      <p className={c.caption}>"{doc.caption}"</p>
      <div className={c.meta}>
        <ViewerTag userHandle={doc.authorHandle} />
      </div>
    </article>
  );
}

function WallSection({ database, ViewerTag }) {
  const { useLiveQuery } = useFireproof("dreamJobs");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const portraits = docs.filter((d) => d.type === "portrait");
  const c = {
    heading: "text-4xl text-[oklch(0.12_0.01_0)] mb-3",
    empty: "text-center py-12 text-[oklch(0.45_0.01_0)] italic",
  };
  return (
    <section id="wall">
      <h2 className={c.heading} style={{ fontFamily: "Caveat, cursive" }}>
        The Party Wall ({portraits.length})
      </h2>
      {portraits.length === 0 ? (
        <p className={c.empty}>No portraits yet. Be the first!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {portraits.map((d) => (
            <PortraitTile key={d._id} doc={d} ViewerTag={ViewerTag} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { database } = useFireproof("dreamJobs");

  const c = {
    page: "min-h-screen bg-[oklch(0.93_0.03_130)] text-[oklch(0.12_0.01_0)]",
    header:
      "sticky top-0 z-10 bg-[oklch(0.93_0.12_95)] border-b-4 border-[oklch(0.12_0.01_0)] px-4 py-3 flex items-center justify-between",
    title: "text-3xl font-bold text-[oklch(0.12_0.01_0)]",
    main: "max-w-3xl mx-auto px-4 py-5 space-y-6 pb-20",
    signin: "bg-[oklch(0.97_0.01_80)] border-2 border-dashed border-[oklch(0.12_0.01_0)] rounded-lg p-5 text-center",
  };

  return (
    <div className={c.page} style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;600;700&display=swap');`}</style>
      <header id="app-header" className={c.header}>
        <h1 className={c.title} style={{ fontFamily: "Caveat, cursive" }}>
          Dream Job Wall
        </h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {isViewerPending ? null : viewer ? (
          <CaptureSection viewer={viewer} database={database} />
        ) : (
          <section className={c.signin}>
            <p className="font-semibold mb-1">Sign in to add your portrait</p>
            <p className="text-sm text-[oklch(0.45_0.01_0)]">Browse the wall below either way.</p>
          </section>
        )}
        <WallSection database={database} ViewerTag={ViewerTag} />
      </main>
    </div>
  );
}
