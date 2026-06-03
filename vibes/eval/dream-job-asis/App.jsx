import React from "react";
import { callAI } from "call-ai";
import { ImgGen } from "img-gen";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ThemeStyles() {
  return (
    <style>{`
      :root {
        --desk: oklch(0.93 0.03 130);
        --paper: oklch(0.97 0.01 80);
        --ink: oklch(0.12 0.01 0);
        --yellow: oklch(0.93 0.12 95);
        --pink: oklch(0.90 0.06 10);
        --blue: oklch(0.90 0.05 240);
        --muted: oklch(0.45 0.01 0);
        --accent: var(--ink);
        --accent-text: var(--paper);
        --card-bg: var(--paper);
        --border: var(--ink);
        --text: var(--ink);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --desk: oklch(0.22 0.02 130);
          --paper: oklch(0.28 0.01 80);
          --ink: oklch(0.95 0.01 80);
          --yellow: oklch(0.55 0.12 95);
          --pink: oklch(0.50 0.08 10);
          --blue: oklch(0.45 0.06 240);
          --muted: oklch(0.70 0.01 0);
          --accent: var(--ink);
          --accent-text: var(--desk);
          --card-bg: var(--paper);
          --border: var(--ink);
          --text: var(--ink);
        }
      }
      body { background: var(--desk); color: var(--text); font-family: 'Inter', sans-serif; }
      .font-display { font-family: 'Caveat', cursive; }
    `}</style>
  );
}

function GalleryHero({ count }) {
  return (
    <section id="gallery-hero" className="px-5 pt-6 pb-4">
      <p className="font-display text-2xl leading-none" style={{ color: "var(--muted)" }}>
        welcome to the
      </p>
      <h2 className="font-display text-5xl leading-tight" style={{ color: "var(--ink)" }}>
        Dream Job Wall
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {count} portrait{count === 1 ? "" : "s"} pinned so far
      </p>
    </section>
  );
}

function CreateSurface({ viewer, ViewerTag, onCreate }) {
  if (!viewer) {
    return (
      <section
        id="create-surface"
        className="mx-5 mb-4 p-4 rounded-2xl border-2 border-dashed"
        style={{ borderColor: "var(--ink)", background: "var(--yellow)" }}
      >
        <p className="font-display text-2xl" style={{ color: "var(--ink)" }}>
          Sign in to pin your dream
        </p>
        <div className="mt-2">
          <ViewerTag />
        </div>
      </section>
    );
  }
  return (
    <section id="create-surface" className="mx-5 mb-4">
      <button
        onClick={onCreate}
        className="w-full min-h-[56px] rounded-2xl border-2 font-display text-3xl flex items-center justify-center gap-3 shadow-[4px_4px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--ink)] transition-transform"
        style={{ borderColor: "var(--ink)", background: "var(--pink)", color: "var(--ink)" }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        Snap your dream
      </button>
    </section>
  );
}

function CreateModal({ open, onClose, viewer, database }) {
  const [step, setStep] = React.useState("camera");
  const [photoFile, setPhotoFile] = React.useState(null);
  const [photoPreview, setPhotoPreview] = React.useState(null);
  const [job, setJob] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [composed, setComposed] = React.useState(null);
  const [suggesting, setSuggesting] = React.useState(false);
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) {
      setStep("camera");
      setPhotoFile(null);
      setPhotoPreview(null);
      setJob("");
      setComposed(null);
      setIsLoading(false);
    }
  }, [open]);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
    setStep("job");
  };

  const suggestJob = async () => {
    setSuggesting(true);
    try {
      const r = await callAI("Suggest one whimsical, specific dream job title (3-5 words). Be playful.", {
        schema: { properties: { job: { type: "string" } } },
      });
      const parsed = JSON.parse(r);
      setJob(parsed.job || "");
    } finally {
      setSuggesting(false);
    }
  };

  const compose = async () => {
    if (!job.trim()) return;
    setIsLoading(true);
    try {
      const r = await callAI(
        `Compose a whimsical caricature portrait scene for someone whose dream job is "${job.trim()}". Return a vivid image prompt (exaggerated cartoon style, playful setting, props, costume) and a short witty caption.`,
        { schema: { properties: { imagePrompt: { type: "string" }, caption: { type: "string" } } } }
      );
      const parsed = JSON.parse(r);
      setComposed(parsed);
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  const post = async () => {
    if (!composed || !viewer) return;
    await database.put({
      type: "portrait",
      authorHandle: viewer.userHandle,
      job: job.trim(),
      imagePrompt: composed.imagePrompt,
      caption: composed.caption,
      createdAt: Date.now(),
      _files: photoFile ? { selfie: photoFile } : {},
    });
    onClose();
  };

  if (!open) return null;

  const c = {
    overlay: "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4",
    sheet: "w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border-2 shadow-[6px_6px_0_var(--ink)] overflow-hidden",
    head: "flex items-center justify-between px-5 py-4 border-b-2",
    body: "p-5 space-y-4",
    label: "font-display text-2xl",
    input: "w-full min-h-[48px] px-4 rounded-xl border-2 bg-transparent",
    btnPrimary: "w-full min-h-[48px] rounded-xl border-2 font-display text-2xl flex items-center justify-center gap-2",
    btnGhost: "min-h-[44px] px-4 rounded-xl border-2 text-sm",
  };

  return (
    <div className={c.overlay} style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        className={c.sheet}
        style={{ borderColor: "var(--ink)", background: "var(--paper)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={c.head} style={{ borderColor: "var(--ink)", background: "var(--blue)" }}>
          <h3 className="font-display text-3xl" style={{ color: "var(--ink)" }}>
            {step === "camera" && "Step 1 · Selfie"}
            {step === "job" && "Step 2 · Dream job"}
            {step === "preview" && "Step 3 · Pin it"}
          </h3>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={c.body}>
          {step === "camera" && (
            <>
              <p style={{ color: "var(--muted)" }}>Snap a selfie — we'll turn you into a caricature.</p>
              <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={onPick} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className={c.btnPrimary}
                style={{ borderColor: "var(--ink)", background: "var(--yellow)", color: "var(--ink)" }}
              >
                Open camera
              </button>
            </>
          )}
          {step === "job" && (
            <>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="selfie"
                  className="w-32 h-32 rounded-2xl object-cover border-2 mx-auto"
                  style={{ borderColor: "var(--ink)" }}
                />
              )}
              <label className={c.label} style={{ color: "var(--ink)" }}>
                Your dream job?
              </label>
              <input
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="e.g. deep-sea jellyfish DJ"
                className={c.input}
                style={{ borderColor: "var(--ink)", color: "var(--ink)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={suggestJob}
                  disabled={suggesting}
                  className={c.btnGhost}
                  style={{ borderColor: "var(--ink)", background: "var(--pink)", color: "var(--ink)" }}
                >
                  {suggesting ? (
                    <svg
                      className="animate-spin inline"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                    </svg>
                  ) : (
                    "Suggest one"
                  )}
                </button>
                <button
                  onClick={compose}
                  disabled={isLoading || !job.trim()}
                  className="flex-1 min-h-[44px] rounded-xl border-2 font-display text-xl"
                  style={{ borderColor: "var(--ink)", background: "var(--yellow)", color: "var(--ink)" }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                      </svg>
                      Composing…
                    </span>
                  ) : (
                    "Compose →"
                  )}
                </button>
              </div>
            </>
          )}
          {step === "preview" && composed && (
            <>
              <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: "var(--ink)" }}>
                <ImgGen prompt={composed.imagePrompt} />
              </div>
              <p className="font-display text-2xl" style={{ color: "var(--ink)" }}>
                "{composed.caption}"
              </p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Job: {job}
              </p>
              <button
                onClick={post}
                className={c.btnPrimary}
                style={{ borderColor: "var(--ink)", background: "var(--pink)", color: "var(--ink)" }}
              >
                Pin to the wall
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PortraitCard({ doc, ViewerTag }) {
  const rotations = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2", "rotate-0"];
  const tints = ["var(--yellow)", "var(--pink)", "var(--blue)", "var(--paper)"];
  const rot = rotations[(doc._id?.charCodeAt(0) || 0) % rotations.length];
  const tint = tints[(doc._id?.charCodeAt(1) || 0) % tints.length];
  return (
    <article
      className={`break-inside-avoid mb-4 p-3 border-2 shadow-[4px_4px_0_var(--ink)] ${rot}`}
      style={{ borderColor: "var(--ink)", background: tint }}
    >
      <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: "var(--ink)" }}>
        {doc.imagePrompt && <ImgGen prompt={doc.imagePrompt} _id={`portrait-${doc._id}`} />}
      </div>
      <p className="font-display text-2xl mt-3 leading-tight" style={{ color: "var(--ink)" }}>
        "{doc.caption}"
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
        dreams of being a {doc.job}
      </p>
      <div className="mt-2">
        <ViewerTag userHandle={doc.authorHandle} />
      </div>
    </article>
  );
}

function Gallery({ docs, ViewerTag }) {
  if (docs.length === 0) {
    return (
      <section id="gallery" className="px-5 pb-24">
        <div className="p-8 rounded-2xl border-2 border-dashed text-center" style={{ borderColor: "var(--muted)" }}>
          <p className="font-display text-3xl" style={{ color: "var(--muted)" }}>
            The wall is empty
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Be the first to pin a dream
          </p>
        </div>
      </section>
    );
  }
  return (
    <section id="gallery" className="px-5 pb-24 columns-2 md:columns-3 gap-4">
      {docs.map((d) => (
        <PortraitCard key={d._id} doc={d} ViewerTag={ViewerTag} />
      ))}
    </section>
  );
}

export default function App() {
  const { viewer, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("dreamJobs");
  const { docs } = useLiveQuery("type", { key: "portrait", descending: true });
  const [modalOpen, setModalOpen] = React.useState(false);

  if (isViewerPending) return null;

  return (
    <main id="app" className="min-h-screen" style={{ background: "var(--desk)" }}>
      <ThemeStyles />
      <header
        id="app-header"
        className="px-5 py-4 flex items-center justify-between border-b-2"
        style={{ borderColor: "var(--ink)", background: "var(--paper)" }}
      >
        <h1 className="font-display text-4xl" style={{ color: "var(--ink)" }}>
          Dream Jobs
        </h1>
        <ViewerTag />
      </header>
      <GalleryHero count={docs.length} />
      <CreateSurface viewer={viewer} ViewerTag={ViewerTag} onCreate={() => setModalOpen(true)} />
      <Gallery docs={docs} ViewerTag={ViewerTag} />
      <CreateModal open={modalOpen} onClose={() => setModalOpen(false)} viewer={viewer} database={database} />
    </main>
  );
}
