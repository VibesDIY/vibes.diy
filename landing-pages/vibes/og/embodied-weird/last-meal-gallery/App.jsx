import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

export default function App() {
  const [handle, setHandle] = React.useState("");
  const [activeHandle, setActiveHandle] = React.useState("");
  const [preview, setPreview] = React.useState(null);
  const [photoFile, setPhotoFile] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const { useLiveQuery, database } = useFireproof("last-meal-gallery");
  const { docs: photos } = useLiveQuery("type", { key: "meal-photo", descending: true });

  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const hasPostedToday = activeHandle && photos.some(d => d.member === activeHandle && isToday(d.ts));

  // Inject fonts to DOM
  React.useEffect(() => {
    if (!document.getElementById("rune-fonts")) {
      const link = document.createElement("link");
      link.id = "rune-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cormorant+Garamond:wght@400;600&display=optional";
      document.head.appendChild(link);
    }
  }, []);

  const c = {
    page: "min-h-screen py-12 px-4 flex flex-col items-center bg-[#020406] text-[#b0c4cc] font-serif transition-colors duration-1000",
    header: "w-full max-w-2xl flex flex-col items-center mb-16 space-y-4",
    title: "text-4xl md:text-5xl text-center uppercase font-bold tracking-[0.15em] text-[#00ffcc] font-[Cinzel] drop-shadow-[0_0_12px_rgba(0,255,204,0.6)]",
    subtitle: "text-sm text-center uppercase tracking-[0.15em] text-[#4a6070] font-[Cinzel]",
    handleForm: "flex flex-col items-center mt-8 space-y-4",
    handleInput: "w-64 text-center pb-1 outline-none bg-transparent border-b border-[#005f52] text-[#ccfffa] focus:border-[#00ffcc] focus:drop-shadow-[0_0_8px_rgba(0,255,204,0.4)] transition-all font-[Cinzel] tracking-widest placeholder:text-[#1c2b38]",
    mainArea: "w-full max-w-3xl flex flex-col space-y-24",
    uploadSection: "flex flex-col items-center p-8 border-t border-b border-[#1c2b38] bg-[#05101a] space-y-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
    uploadBox: "w-full max-w-md aspect-square flex flex-col items-center justify-center p-4 border border-dashed border-[#1c2b38] hover:border-[#005f52] transition-colors bg-[#0d161f]",
    uploadBtn: "px-6 py-2 text-sm uppercase tracking-[0.15em] cursor-pointer font-[Cinzel] hover:bg-[#00ffcc] hover:text-[#020406] transition-colors border-none bg-transparent text-[#b0c4cc] font-bold shadow-none focus:outline-none",
    timelineSection: "w-full flex flex-col space-y-16",
    timelineItem: "w-full flex flex-col space-y-2",
    photoFrame: "w-full border border-[#1c2b38] p-2 bg-[#0d161f]",
    img: "w-full h-auto block object-cover max-h-[70vh] grayscale hover:grayscale-0 transition-all duration-700",
    metaRow: "flex justify-between items-center w-full px-3 pt-3 pb-2 text-xs uppercase font-[Cinzel] text-[#9d4eff] tracking-[0.1em]",
    divider: "w-full flex items-center justify-center space-x-4 py-8 text-[#00ffcc]",
    dividerLine: "h-px w-16 md:w-32 bg-[#1c2b38]",
    archiveSection: "w-full border border-[#1c2b38] p-6 flex flex-col space-y-6 bg-[#05101a]",
    archiveGrid: "grid grid-cols-2 md:grid-cols-4 gap-2"
  };

  const handleSetIdentity = (e) => {
    e.preventDefault();
    if (handle.trim()) setActiveHandle(handle.trim());
  };

  const handleSelectFile = (e) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!photoFile || !activeHandle) return;
    
    setIsLoading(true);
    try {
      await database.put({
        type: "meal-photo",
        member: activeHandle,
        ts: Date.now(),
        _files: {
          image: photoFile
        }
      });
      setPhotoFile(null);
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={c.page}>
      <header className={c.header}>
        <h1 className={c.title}>Last Meal</h1>
        <div className={c.divider}>
          <div className={c.dividerLine}></div>
          <span>ᚠ</span>
          <div className={c.dividerLine}></div>
        </div>
        <p className={c.subtitle}>A Silent Offering</p>
        
        {!activeHandle ? (
          <form onSubmit={handleSetIdentity} className={c.handleForm}>
            <input
              type="text"
              placeholder="ENTER IDENTITY"
              className={c.handleInput}
              value={handle}
              onChange={(e) => setHandle(e.target.value.toUpperCase())}
            />
            <button type="submit" className={c.uploadBtn} disabled={!handle.trim()}>
              [ BIND ]
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center mt-8 space-y-2 text-[#ccfffa] font-[Cinzel]">
            <span className="text-xs text-[#00ffcc] tracking-[0.2em]">BOUND ENTITY</span>
            <span className="tracking-widest">{activeHandle}</span>
            <button onClick={() => setActiveHandle("")} className="text-[10px] text-[#4a6070] mt-4 uppercase tracking-widest hover:text-[#00ffcc]">Sever Binding</button>
          </div>
        )}
      </header>

      <main className={c.mainArea}>
        <section id="upload" className={c.uploadSection}>
          <p className={c.subtitle}>Today's Offering</p>
          
          {!activeHandle ? (
            <div className="text-[#4a6070] text-sm text-center py-12">
              BIND IDENTITY TO OFFER SECRETS
            </div>
          ) : hasPostedToday ? (
            <div className="flex flex-col items-center space-y-4 py-8">
              <span className="text-3xl text-[#9d4eff] drop-shadow-[0_0_8px_rgba(157,78,255,0.6)]">ᛒ</span>
              <p className="text-[#ccfffa] text-center tracking-widest font-[Cinzel]">OFFERING RECEIVED.</p>
              <p className="text-xs text-[#4a6070] font-[Cinzel] tracking-widest">RETURN UPON THE MORROW.</p>
            </div>
          ) : (
            <>
              <div className={c.uploadBox}>
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover grayscale max-h-full" />
                ) : (
                  <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center space-y-4 text-[#4a6070] hover:text-[#00ffcc] transition-colors group">
                    <span className="text-4xl group-hover:drop-shadow-[0_0_8px_rgba(0,255,204,0.6)]">ᛗ</span>
                    <input type="file" className="hidden" onChange={handleSelectFile} accept="image/*" />
                    <span className="font-[Cinzel] tracking-[0.15em] text-xs">SELECT RELIC</span>
                  </label>
                )}
              </div>
              
              {preview && (
                 <div className="flex items-center space-x-4">
                    <button onClick={() => { setPreview(null); setPhotoFile(null); }} className="text-[#4a6070] text-xs font-[Cinzel] uppercase tracking-widest hover:text-[#00ffcc]">
                      [ DISCARD ]
                    </button>
                    <button onClick={handleUpload} disabled={isLoading} className={c.uploadBtn}>
                      {isLoading ? (
                        <svg className="animate-spin h-4 w-4 mx-auto text-[#00ffcc]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        "[ ATTUNE ]"
                      )}
                    </button>
                 </div>
              )}
            </>
          )}
        </section>

        <section id="timeline" className={c.timelineSection}>
          {photos.length === 0 ? (
            <div className="w-full text-center text-[#4a6070] italic py-12">
              The gallery lies barren.
            </div>
          ) : (
            photos.map(doc => (
              <div key={doc._id} className={c.timelineItem}>
                <div className={c.photoFrame}>
                  {doc._files?.image?.url ? (
                     <img src={doc._files.image.url} alt="Offering" className={c.img} loading="lazy" />
                  ) : (
                     <div className="w-full aspect-square flex items-center justify-center bg-[#05101a] text-[#1c2b38]">
                        VOID
                     </div>
                  )}
                </div>
                <div className={c.metaRow}>
                  <span>{doc.member}</span>
                  <span className="text-[#4a6070]">{new Date(doc.ts).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </section>

        <section id="archive" className={c.archiveSection}>
          <div className="flex items-center justify-between w-full mb-4">
            <span className="text-[#1c2b38]">ᚱ</span>
            <h2 className="text-center uppercase tracking-[0.15em] text-xs font-[Cinzel] text-[#b0c4cc]">The Archives</h2>
            <span className="text-[#1c2b38]">ᚱ</span>
          </div>
          <div className={c.archiveGrid}>
            {photos.slice(5, 13).map(doc => (
              <div key={doc._id} className="aspect-square bg-[#020406] border border-[#1c2b38] w-full relative group overflow-hidden">
                {doc._files?.image?.url && (
                   <img src={doc._files.image.url} alt="Archive" className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500" loading="lazy" />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#020406] to-transparent p-2 text-[10px] text-[#00ffcc] opacity-0 group-hover:opacity-100 transition-opacity font-[Cinzel]">
                  {doc.member}
                </div>
              </div>
            ))}
            {photos.length <= 5 && (
              <div className="col-span-full text-center text-[10px] text-[#4a6070] font-serif py-8 uppercase tracking-widest">
                Time has yet to accumulate sufficient dust.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}