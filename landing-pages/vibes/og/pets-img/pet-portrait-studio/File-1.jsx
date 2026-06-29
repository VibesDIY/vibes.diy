import React, { useState, useRef, useCallback } from "react"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const STYLES = [
  { id: "watercolor", label: "Watercolor", color: "bg-[#4a90d9]", text: "text-white", prompt: "A beautiful watercolor painting portrait of this pet, soft washes of color, delicate brush strokes, artistic watercolor illustration style" },
  { id: "renaissance", label: "Renaissance", color: "bg-[#8b5a2b]", text: "text-white", prompt: "A Renaissance oil painting portrait of this pet, dramatic lighting, rich warm tones, classical European painting style, 16th century master artwork" },
  { id: "cyberpunk", label: "Cyberpunk", color: "bg-[#7b2fff]", text: "text-white", prompt: "A sci-fi cyberpunk portrait of this pet, neon lights, futuristic city background, glowing implants, dark moody atmosphere, digital art" },
  { id: "anime", label: "Anime", color: "bg-[#e63f6e]", text: "text-white", prompt: "A cute anime style portrait of this pet, big expressive eyes, vibrant colors, Japanese animation art style, kawaii illustration" },
  { id: "oil", label: "Oil Painting", color: "bg-[#2d6a4f]", text: "text-white", prompt: "A classical oil painting portrait of this pet, thick impasto brush strokes, rich deep colors, museum quality fine art, painterly texture" },
];

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="8" cy="8" r="6" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function PawIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/>
      <path d="M12 18c-3 0-7-2-7-6 0-2 2-3 4-3s3 1 3 1 1-1 3-1 4 1 4 3c0 4-4 6-7 6z"/>
    </svg>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("pet-portrait-studio-v1");
  const { docs: portraits } = useLiveQuery("type", { key: "portrait", descending: true });

  const [petFile, setPetFile] = useState(null);
  const [petPreview, setPetPreview] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activePortrait, setActivePortrait] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPetFile(file);
    setPetPreview(URL.createObjectURL(file));
    setSelectedStyle(null);
    setActivePortrait(null);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const pickStyle = async (style) => {
    if (!petFile) return;
    setSelectedStyle(style.id);
    setGenerating(true);
    setActivePortrait(null);
    // Save a pending doc; ImgVibes will update once it generates
    const doc = await database.put({
      type: "portrait",
      styleId: style.id,
      styleLabel: style.label,
      prompt: style.prompt,
      petName: petFile.name,
      createdAt: Date.now(),
    });
    setGenerating(false);
    setActivePortrait(doc.id);
  };

  const c = {
    page: "min-h-screen font-[Space_Grotesk,sans-serif] bg-[oklch(0.96_0.01_90)] relative",
    header: "border-b-[3px] border-[oklch(0.15_0.02_280)] bg-white shadow-[0_4px_0_oklch(0.15_0.02_280)] sticky top-0 z-30",
    headerInner: "max-w-[920px] mx-auto px-6 py-4 flex items-center gap-3",
    logoBlocks: "flex gap-1",
    logoSq: (color) => `w-3 h-3 border-[2px] border-[oklch(0.15_0.02_280)] ${color}`,
    brandText: "text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-[-0.02em] text-lg",
    main: "max-w-[920px] mx-auto px-6 py-8 flex flex-col gap-8",

    // Uploader
    dropzone: (active) => `border-[3px] border-dashed border-[oklch(0.15_0.02_280)] rounded-[4px] p-10 flex flex-col items-center gap-4 cursor-pointer transition-all duration-150 ${active ? "bg-[oklch(0.85_0.18_85)/0.3] shadow-[4px_4px_0_oklch(0.15_0.02_280)] translate-x-[-2px] translate-y-[-2px]" : "bg-white hover:bg-[oklch(0.85_0.18_85)/0.15]"}`,
    dropLabel: "text-[oklch(0.15_0.02_280)] font-bold uppercase tracking-[0.05em] text-sm",
    dropSub: "text-[oklch(0.50_0.02_280)] text-xs uppercase tracking-[0.1em]",
    previewWrap: "border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden shadow-[4px_4px_0_oklch(0.15_0.02_280)] w-48 h-48 flex-shrink-0",
    previewImg: "w-full h-full object-cover",

    // Style grid
    sectionLabel: "text-[oklch(0.50_0.02_280)] text-[0.65rem] uppercase tracking-[0.15em] font-semibold mb-3",
    card: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0_oklch(0.15_0.02_280)] p-6",
    styleGrid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3",
    styleBtn: (active, color, text) => `${color} ${text} border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] px-3 py-3 font-bold uppercase tracking-[0.05em] text-xs cursor-pointer transition-all duration-150 ${active ? "shadow-none translate-x-[2px] translate-y-[2px]" : "shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:shadow-[5px_5px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px]"} disabled:opacity-40 disabled:cursor-not-allowed`,

    // Portrait result
    portraitCard: "bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[6px_6px_0_oklch(0.15_0.02_280)] overflow-hidden",
    accentBar: "h-[6px] w-full flex",
    accentSeg: (color) => `flex-1 ${color}`,

    // Gallery
    galleryGrid: "grid grid-cols-2 sm:grid-cols-3 gap-4",
    galleryItem: (active) => `border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] overflow-hidden cursor-pointer transition-all duration-150 ${active ? "shadow-none translate-x-[2px] translate-y-[2px]" : "shadow-[3px_3px_0_oklch(0.15_0.02_280)] hover:shadow-[5px_5px_0_oklch(0.15_0.02_280)] hover:translate-x-[-2px] hover:translate-y-[-2px]"}`,
    galleryLabel: "bg-[oklch(0.15_0.02_280)] text-white text-[0.6rem] uppercase tracking-[0.1em] px-2 py-1 font-bold",

    noFile: "text-[oklch(0.50_0.02_280)] text-sm uppercase tracking-[0.1em] text-center py-6",
  };

  const currentStyle = STYLES.find(s => s.id === selectedStyle);

  return (
    <main className={c.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional" rel="stylesheet" />

      {/* Header */}
      <header id="app-header" className={c.header}>
        <div className={c.headerInner}>
          <div className={c.logoBlocks}>
            <div className={c.logoSq("bg-[oklch(0.55_0.24_28)]")} />
            <div className={c.logoSq("bg-[oklch(0.85_0.18_85)]")} />
            <div className={c.logoSq("bg-[oklch(0.62_0.19_145)]")} />
          </div>
          <span className={c.brandText}>Pet Portrait Studio</span>
          <div className="ml-auto flex items-center gap-1 text-[oklch(0.50_0.02_280)]">
            <PawIcon />
          </div>
        </div>
      </header>

      <div className={c.main}>

        {/* Upload Section */}
        <section id="uploader">
          <p className={c.sectionLabel}>Step 1 — Upload Your Pet</p>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div
              className={c.dropzone(dragging)}
              style={{ flex: 1 }}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-[oklch(0.50_0.02_280)]"><UploadIcon /></div>
              <span className={c.dropLabel}>Drop your pet photo here</span>
              <span className={c.dropSub}>or click to browse</span>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
            {petPreview && (
              <div className={c.previewWrap}>
                <img src={petPreview} alt="Your pet" className={c.previewImg} />
              </div>
            )}
          </div>
        </section>

        {/* Style Picker */}
        <section id="style-picker">
          <p className={c.sectionLabel}>Step 2 — Choose an Art Style</p>
          <div className={c.card}>
            {!petFile && <p className={c.noFile}>Upload a pet photo first to unlock styles</p>}
            {petFile && (
              <div className={c.styleGrid}>
                {STYLES.map(style => (
                  <button
                    key={style.id}
                    className={c.styleBtn(selectedStyle === style.id, style.color, style.text)}
                    disabled={generating}
                    onClick={() => pickStyle(style)}
                  >
                    {generating && selectedStyle === style.id ? <Spinner /> : style.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Portrait Result */}
        {activePortrait && currentStyle && petFile && (
          <section id="portrait-result">
            <p className={c.sectionLabel}>Your Portrait — {currentStyle.label}</p>
            <div className={c.portraitCard}>
              <div className={c.accentBar}>
                <div className={c.accentSeg("bg-[oklch(0.55_0.24_28)]")} />
                <div className={c.accentSeg("bg-[oklch(0.85_0.18_85)]")} />
                <div className={c.accentSeg("bg-[oklch(0.62_0.19_145)]")} />
                <div className={c.accentSeg("bg-[oklch(0.52_0.18_255)]")} />
              </div>
              <div className="p-4">
                <ImgVibes
                  key={activePortrait}
                  _id={activePortrait}
                  database={database}
                  prompt={currentStyle.prompt}
                  images={[petFile]}
                  style={{ width: "100%", borderRadius: "2px", display: "block" }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Gallery */}
        <section id="gallery">
          <p className={c.sectionLabel}>Portrait Gallery — {portraits.length} saved</p>
          {portraits.length === 0 && (
            <div className={c.card}>
              <p className={c.noFile}>No portraits yet — generate your first one above</p>
            </div>
          )}
          {portraits.length > 0 && (
            <div className={c.galleryGrid}>
              {portraits.map(doc => (
                <div
                  key={doc._id}
                  className={c.galleryItem(activePortrait === doc._id)}
                  onClick={() => { setActivePortrait(doc._id); setSelectedStyle(doc.styleId); }}
                >
                  <div className={c.galleryLabel}>{doc.styleLabel}</div>
                  <ImgVibes
                    _id={doc._id}
                    database={database}
                    showControls={false}
                    style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}