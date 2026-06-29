<<<<<<< SEARCH
import React from "react"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

const classNames = {
  page: "",
  header: "",
  posterCreator: "",
  posterGallery: "",
  aiSuggester: "",
};

function PosterCreator() {
  return (
    <section id="poster-creator" className={classNames.posterCreator}>
      <h2>Poster Creator</h2>
      {/* upload + form fields */}
    </section>
  );
}

function PosterGallery() {
  return (
    <section id="poster-gallery" className={classNames.posterGallery}>
      <h2>Poster Gallery</h2>
      {/* thumbnail strip */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Lost Pet Posters</h1>
      </header>
      <PosterCreator />
      <PosterGallery />
    </main>
  );
}
=======
import React, { useState, useRef } from "react"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

// ── Ambient background decorations ──────────────────────────────
const bgStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional');
  body { margin:0; background: oklch(0.96 0.01 90); font-family: 'Space Grotesk', sans-serif; }
  .fp-btn { transition: transform .15s, box-shadow .15s; }
  .fp-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); }
  .fp-btn:active { transform: translate(2px,2px); box-shadow: none; }
  .fp-input:focus { outline:none; transform: translate(-2px,-2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); }
  .thumb:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0px oklch(0.15 0.02 280); transition:.15s; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }
`;

const c = {
  page: "min-h-screen",
  header: "border-[3px] border-[oklch(0.15_0.02_280)] bg-white rounded-[4px] mb-6",
  card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] p-5",
  shadow: { boxShadow: "4px 4px 0px oklch(0.15 0.02 280)" },
  shadowSm: { boxShadow: "3px 3px 0px oklch(0.15 0.02 280)" },
  btnPrimary: "fp-btn bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-5 py-2 font-bold uppercase tracking-wide text-sm cursor-pointer disabled:opacity-50",
  btnSecondary: "fp-btn bg-[oklch(0.85_0.18_85)] text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-4 py-2 font-bold uppercase tracking-wide text-sm cursor-pointer disabled:opacity-50",
  btnGhost: "fp-btn bg-white text-[oklch(0.15_0.02_280)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-4 py-2 font-bold uppercase tracking-wide text-sm cursor-pointer",
  input: "fp-input w-full border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-2 font-[Space_Grotesk] text-sm bg-white transition-all",
  label: "block text-[0.65rem] uppercase tracking-[0.15em] font-bold text-[oklch(0.50_0.02_280)] mb-1",
  ink: "text-[oklch(0.15_0.02_280)]",
  muted: "text-[oklch(0.50_0.02_280)]",
};

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="spin inline-block">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="3"
        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

// ── Poster Creator ───────────────────────────────────────────────
function PosterCreator({ onSaved }) {
  const { useDocument, database } = useFireproof("lost-pet-posters");
  const { doc, merge, reset } = useDocument({ type: "poster", petName: "", location: "", contact: "", description: "", createdAt: 0 });

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setGenerated(false);
    setSavedId(null);
  }

  async function handleSuggest() {
    if (!doc.petName) return;
    setAiLoading(true);
    try {
      const res = JSON.parse(await callAI(
        `Generate a short, warm missing pet description for a pet named "${doc.petName}" last seen at "${doc.location || "unknown location"}". Include breed guess, markings, and personality in 2 sentences. Return JSON: { description: string }`,
        { schema: { properties: { description: { type: "string" } } } }
      ));
      merge({ description: res.description });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleGenerate() {
    if (!photo || !doc.petName) return;
    setGenerating(true);
    setGenerated(false);
    setSavedId(null);
    // save metadata doc first so ImgVibes can reference it
    const saved = await database.put({
      ...doc,
      createdAt: Date.now(),
      type: "poster",
    });
    setSavedId(saved.id);
    setGenerated(true);
    setGenerating(false);
    if (onSaved) onSaved();
  }

  function handleReset() {
    reset();
    setPhoto(null);
    setPhotoPreview(null);
    setGenerated(false);
    setSavedId(null);
  }

  const prompt = `Vintage 1950s missing pet poster aesthetic. Bold hand-lettered MISSING headline at top in distressed red ink. Below: the pet's photo as the focal point. Pet name: "${doc.petName}". Last seen: "${doc.location}". Contact: "${doc.contact}". ${doc.description} Aged paper texture, sepia tones, worn edges, dramatic typography. Printable poster layout.`;

  return (
    <section id="poster-creator" style={c.shadow}
      className={`${c.card} mb-6`}>
      <div className="h-[6px] -mx-5 -mt-5 mb-5 rounded-t-[2px] flex overflow-hidden">
        <div className="flex-1 bg-[oklch(0.55_0.24_28)]" />
        <div className="flex-1 bg-[oklch(0.85_0.18_85)]" />
        <div className="flex-1 bg-[oklch(0.62_0.19_145)]" />
        <div className="flex-1 bg-[oklch(0.52_0.18_255)]" />
      </div>
      <h2 className="text-xl font-bold uppercase tracking-tight mb-4" style={{ letterSpacing: "-0.02em" }}>
        Create a Poster
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: upload + form */}
        <div className="flex flex-col gap-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            className="border-[3px] border-dashed border-[oklch(0.15_0.02_280)] rounded-[4px] h-40 flex flex-col items-center justify-center cursor-pointer transition-all"
            style={{ background: dragOver ? "oklch(0.85 0.18 85 / 0.3)" : "oklch(0.96 0.01 90)" }}
          >
            {photoPreview
              ? <img src={photoPreview} alt="preview" className="h-36 object-contain rounded" />
              : <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="oklch(0.50 0.02 280)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-xs uppercase tracking-widest mt-2 text-[oklch(0.50_0.02_280)]">Drop photo or click</span>
                </>
            }
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>

          <div>
            <label className={c.label}>Pet Name *</label>
            <input className={c.input} value={doc.petName} onChange={e => merge({ petName: e.target.value })} placeholder="e.g. Biscuit" />
          </div>
          <div>
            <label className={c.label}>Last Seen Location *</label>
            <input className={c.input} value={doc.location} onChange={e => merge({ location: e.target.value })} placeholder="e.g. Riverside Park, Oak St" />
          </div>
          <div>
            <label className={c.label}>Contact Info</label>
            <input className={c.input} value={doc.contact} onChange={e => merge({ contact: e.target.value })} placeholder="Phone or email" />
          </div>
          <div>
            <label className={c.label}>Description</label>
            <div className="relative">
              <textarea className={`${c.input} h-20 resize-none`} value={doc.description} onChange={e => merge({ description: e.target.value })} placeholder="Markings, breed, personality…" />
            </div>
            <button onClick={handleSuggest} disabled={aiLoading || !doc.petName}
              className={`${c.btnSecondary} mt-2 flex items-center gap-2`} style={c.shadowSm}>
              {aiLoading ? <><Spinner /> Suggesting…</> : <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                AI Suggest
              </>}
            </button>
          </div>
        </div>

        {/* Right: generated poster */}
        <div className="flex flex-col gap-4">
          <div className="border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden min-h-[300px] flex items-center justify-center bg-[oklch(0.96_0.01_90)]">
            {generated && savedId && photo
              ? <ImgVibes
                  prompt={prompt}
                  images={[photo]}
                  model="prodia/flux-2.klein.9b"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              : <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="oklch(0.50 0.02 280)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                  <span className="text-xs uppercase tracking-widest text-[oklch(0.50_0.02_280)]">Poster preview appears here</span>
                </div>
            }
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleGenerate}
              disabled={generating || !photo || !doc.petName || !doc.location}
              className={`${c.btnPrimary} flex items-center gap-2 flex-1`} style={c.shadow}>
              {generating ? <><Spinner /> Generating…</> : <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Generate Poster
              </>}
            </button>
            <button onClick={handleReset} className={c.btnGhost} style={c.shadowSm}>Reset</button>
          </div>
          {generated && <p className="text-xs text-[oklch(0.62_0.19_145)] font-bold uppercase tracking-wide">Saved to gallery</p>}
        </div>
      </div>
    </section>
  );
}

// ── Poster Gallery ───────────────────────────────────────────────
function PosterGallery() {
  const { useLiveQuery } = useFireproof("lost-pet-posters");
  const { docs } = useLiveQuery("type", { key: "poster", descending: true });
  const [selected, setSelected] = useState(null);

  if (!docs.length) return (
    <section id="poster-gallery" className={`${c.card} mb-6`} style={c.shadow}>
      <h2 className="text-xl font-bold uppercase tracking-tight mb-2" style={{ letterSpacing: "-0.02em" }}>Gallery</h2>
      <p className={`text-sm ${c.muted} uppercase tracking-widest`}>No posters yet — create one above.</p>
    </section>
  );

  return (
    <section id="poster-gallery" className={`${c.card} mb-6`} style={c.shadow}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold uppercase tracking-tight" style={{ letterSpacing: "-0.02em" }}>Gallery</h2>
        <span className="text-xs font-mono font-bold bg-[oklch(0.52_0.18_255)] text-white px-2 py-1 rounded-[4px] border-[2px] border-[oklch(0.15_0.02_280)]">{docs.length} POSTER{docs.length !== 1 ? "S" : ""}</span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {docs.map(doc => (
          <div key={doc._id}
            onClick={() => setSelected(selected?._id === doc._id ? null : doc)}
            className="thumb border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] cursor-pointer overflow-hidden bg-[oklch(0.96_0.01_90)]"
            style={{ ...c.shadowSm, width: 120 }}>
            <div className="bg-[oklch(0.55_0.24_28)] text-white text-[0.55rem] uppercase tracking-widest font-bold px-2 py-1 truncate">{doc.petName || "Unknown"}</div>
            <ImgVibes _id={doc._id} database="lost-pet-posters" showControls={false}
              style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-5 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden" style={{ boxShadow: "6px 6px 0px oklch(0.15 0.02 280)" }}>
          <div className="bg-[oklch(0.52_0.18_255)] text-white px-4 py-2 flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide text-sm">{selected.petName}</span>
            <button onClick={() => setSelected(null)} className="text-white font-bold text-lg leading-none">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white">
            <ImgVibes _id={selected._id} database="lost-pet-posters"
              style={{ width: "100%", borderRadius: 2, border: "2px solid oklch(0.15 0.02 280)" }} />
            <div className="flex flex-col gap-2 text-sm">
              <div><span className={c.label}>Last Seen</span><span className={c.ink}>{selected.location || "—"}</span></div>
              <div><span className={c.label}>Contact</span><span className={c.ink}>{selected.contact || "—"}</span></div>
              <div><span className={c.label}>Description</span><span className={`${c.ink} leading-relaxed`}>{selected.description || "—"}</span></div>
              <div><span className={c.label}>Created</span><span className="font-mono text-xs text-[oklch(0.50_0.02_280)]">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}</span></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── App Shell ────────────────────────────────────────────────────
export default function App() {
  const [galleryKey, setGalleryKey] = useState(0);

  return (
    <>
      <style>{bgStyle}</style>
      {/* Ambient floaters */}
      <div aria-hidden="true" style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:40, left:"8%", width:50, height:50, background:"oklch(0.55 0.24 28)", opacity:0.18, borderRadius:4 }} />
        <div style={{ position:"absolute", top:"20%", right:"5%", width:30, height:30, background:"oklch(0.85 0.18 85)", opacity:0.25, borderRadius:"50%" }} />
        <div style={{ position:"absolute", bottom:"15%", left:"4%", width:70, height:70, background:"oklch(0.62 0.19 145)", opacity:0.15, borderRadius:4 }} />
        <div style={{ position:"absolute", bottom:60, right:"10%", width:40, height:40, background:"oklch(0.52 0.18 255)", opacity:0.2, borderRadius:"50%" }} />
        <div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)", backgroundSize:"60px 60px" }} />
      </div>

      <main id="app" className="relative z-10 max-w-[920px] mx-auto px-4 md:px-8 py-10">
        <header id="app-header" className={`${c.header} px-5 py-4`} style={c.shadow}>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 bg-[oklch(0.55_0.24_28)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[2px]" />
              <div className="w-3 h-3 bg-[oklch(0.85_0.18_85)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[2px]" />
              <div className="w-3 h-3 bg-[oklch(0.62_0.19_145)] border-[2px] border-[oklch(0.15_0.02_280)] rounded-[2px]" />
            </div>
            <h1 className="font-bold uppercase text-lg tracking-tight" style={{ letterSpacing: "-0.02em" }}>Lost Pet Posters</h1>
          </div>
          <p className="text-xs uppercase tracking-[0.12em] text-[oklch(0.50_0.02_280)] mt-1 ml-[1.6rem]">Upload · Describe · Generate · Share</p>
        </header>

        <PosterCreator onSaved={() => setGalleryKey(k => k + 1)} />
        <PosterGallery key={galleryKey} />
      </main>
    </>
  );
}
>>>>>>> REPLACE