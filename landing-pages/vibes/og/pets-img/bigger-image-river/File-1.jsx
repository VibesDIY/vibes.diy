<<<<<<< SEARCH
const classNames = {
  page: "",
  header: "",
  uploader: "",
  costumePicker: "",
  tryOn: "",
  gallery: "",
};
=======
const classNames = {
  page: "min-h-screen font-['Space_Grotesk',sans-serif] bg-[#f5f3ee] relative",
  header: "max-w-[920px] mx-auto px-8 pt-10 pb-4",
  uploader: "max-w-[920px] mx-auto px-8 py-4",
  costumePicker: "max-w-[920px] mx-auto px-8 py-4",
  tryOn: "max-w-[920px] mx-auto px-8 py-4",
  gallery: "max-w-[920px] mx-auto px-8 py-8",
};

const COSTUMES = [
  { id: "pirate", label: "PIRATE", color: "bg-[#c0392b]", text: "text-white" },
  { id: "astronaut", label: "ASTRONAUT", color: "bg-[#2980b9]", text: "text-white" },
  { id: "dinosaur", label: "DINOSAUR", color: "bg-[#27ae60]", text: "text-[#0f172a]" },
  { id: "wizard", label: "WIZARD", color: "bg-[#8e44ad]", text: "text-white" },
  { id: "superhero", label: "SUPERHERO", color: "bg-[#e67e22]", text: "text-[#0f172a]" },
  { id: "princess", label: "PRINCESS", color: "bg-[#e91e8c]", text: "text-white" },
  { id: "chef", label: "CHEF", color: "bg-[#ecf0f1]", text: "text-[#0f172a]" },
  { id: "ninja", label: "NINJA", color: "bg-[#1a1a2e]", text: "text-white" },
];
>>>>>>> REPLACE
<<<<<<< SEARCH
function PhotoUploader() {
  return (
    <section id="photo-uploader" className={classNames.uploader}>
      <h2>Upload Pet Photo</h2>
      {/* drag and drop upload */}
    </section>
  );
}
=======
function PhotoUploader({ petFile, onFile }) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onFile(file);
  }

  const previewUrl = petFile ? URL.createObjectURL(petFile) : null;

  const c = {
    zone: `border-[3px] border-[#0f172a] rounded-[4px] bg-white cursor-pointer transition-all duration-150
      ${dragging ? "shadow-[6px_6px_0px_#0f172a] -translate-x-1 -translate-y-1 bg-[#fef9c3]" : "shadow-[4px_4px_0px_#0f172a]"}
      flex flex-col items-center justify-center p-8 gap-3 min-h-[180px]`,
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#50507a] font-semibold mb-2",
    hint: "text-[0.75rem] text-[#50507a] uppercase tracking-wide",
  };

  return (
    <section id="photo-uploader" className={classNames.uploader}>
      <p className={c.label}>Step 1 — Upload Your Pet</p>
      <div
        className={c.zone}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        role="button"
        aria-label="Upload pet photo"
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
        {previewUrl ? (
          <img src={previewUrl} alt="Pet preview" className="max-h-48 max-w-full rounded-[4px] border-[3px] border-[#0f172a] object-cover" />
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p className={c.hint}>Drag & drop or click to upload</p>
          </>
        )}
        {previewUrl && <p className={c.hint}>{petFile.name} — click to change</p>}
      </div>
    </section>
  );
}
>>>>>>> REPLACE
<<<<<<< SEARCH
function CostumePicker() {
  return (
    <section id="costume-picker" className={classNames.costumePicker}>
      <h2>Pick a Costume</h2>
      {/* costume grid */}
    </section>
  );
}
=======
function CostumePicker({ selected, onSelect, disabled }) {
  const c = {
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#50507a] font-semibold mb-3",
    grid: "grid grid-cols-4 gap-3",
    card: (id) => {
      const cos = COSTUMES.find(c => c.id === id);
      const isSelected = selected === id;
      return `border-[3px] border-[#0f172a] rounded-[4px] cursor-pointer select-none
        font-bold text-[0.7rem] uppercase tracking-[0.06em] py-3 px-2 text-center
        transition-all duration-150
        ${cos.color} ${cos.text}
        ${isSelected
          ? "shadow-none translate-x-[2px] translate-y-[2px]"
          : "shadow-[3px_3px_0px_#0f172a] hover:shadow-[6px_6px_0px_#0f172a] hover:-translate-x-[2px] hover:-translate-y-[2px]"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
    },
  };

  return (
    <section id="costume-picker" className={classNames.costumePicker}>
      <p className={c.label}>Step 2 — Pick a Costume</p>
      <div className={c.grid}>
        {COSTUMES.map(cos => (
          <button
            key={cos.id}
            className={c.card(cos.id)}
            onClick={() => !disabled && onSelect(cos.id)}
            aria-pressed={selected === cos.id}
            disabled={disabled}
          >
            {cos.label}
          </button>
        ))}
      </div>
    </section>
  );
}
>>>>>>> REPLACE
<<<<<<< SEARCH
function TryOnResult() {
  return (
    <section id="try-on" className={classNames.tryOn}>
      <h2>Try-On Result</h2>
      {/* imgvibes result */}
    </section>
  );
}
=======
function TryOnResult({ petFile, costume, onSave }) {
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => { setSaved(false); }, [petFile, costume]);

  if (!petFile || !costume) {
    return (
      <section id="try-on" className={classNames.tryOn}>
        <div className="border-[3px] border-[#0f172a] rounded-[4px] bg-white shadow-[4px_4px_0px_#0f172a] p-8 text-center text-[#50507a] text-[0.82rem] uppercase tracking-wide">
          Upload a photo and pick a costume to see your pet transformed
        </div>
      </section>
    );
  }

  const cos = COSTUMES.find(c => c.id === costume);
  const prompt = `Transform this pet into a ${costume} costume outfit, full body, photorealistic, cute, high quality, studio lighting`;

  const c2 = {
    card: "border-[3px] border-[#0f172a] rounded-[4px] bg-white shadow-[4px_4px_0px_#0f172a] p-6",
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#50507a] font-semibold mb-3",
    bar: `h-2 w-full rounded-[2px] mb-4 ${cos.color}`,
    saveBtn: `border-[3px] border-[#0f172a] rounded-[4px] font-bold text-[0.75rem] uppercase tracking-[0.06em]
      px-5 py-2 mt-4 transition-all duration-150 cursor-pointer
      ${saved
        ? "bg-[#27ae60] text-[#0f172a] shadow-none translate-x-[2px] translate-y-[2px]"
        : "bg-[#c0392b] text-white shadow-[4px_4px_0px_#0f172a] hover:shadow-[6px_6px_0px_#0f172a] hover:-translate-x-[2px] hover:-translate-y-[2px]"}`,
  };

  return (
    <section id="try-on" className={classNames.tryOn}>
      <p className={c2.label}>Step 3 — Your Pet in a {cos.label} Costume</p>
      <div className={c2.card}>
        <div className={c2.bar} />
        <ImgVibes
          prompt={prompt}
          images={[petFile]}
          model="prodia/flux-2.klein.9b"
          className="w-full rounded-[4px] border-[3px] border-[#0f172a]"
          alt={`Pet dressed as ${costume}`}
        />
        <div className="flex gap-3 mt-4">
          <button
            className={c2.saveBtn}
            onClick={() => { if (!saved) { onSave(costume, prompt); setSaved(true); } }}
          >
            {saved ? (
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                SAVED
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                SAVE FAVORITE
              </span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
>>>>>>> REPLACE
<<<<<<< SEARCH
function FavoritesGallery() {
  return (
    <section id="gallery" className={classNames.gallery}>
      <h2>Favorites</h2>
      {/* saved gallery */}
    </section>
  );
}
=======
function FavoritesGallery({ favorites }) {
  const c = {
    label: "text-[0.65rem] uppercase tracking-[0.15em] text-[#50507a] font-semibold mb-3",
    grid: "grid grid-cols-2 gap-4 sm:grid-cols-3",
    card: "border-[3px] border-[#0f172a] rounded-[4px] bg-white shadow-[4px_4px_0px_#0f172a] overflow-hidden",
    tag: (id) => {
      const cos = COSTUMES.find(c => c.id === id);
      return `${cos?.color || "bg-gray-200"} ${cos?.text || "text-[#0f172a]"} text-[0.6rem] font-bold uppercase tracking-[0.1em] px-2 py-1`;
    },
  };

  if (!favorites.length) return null;

  return (
    <section id="gallery" className={classNames.gallery}>
      <p className={c.label}>Favorites Gallery — {favorites.length} saved</p>
      <div className={c.grid}>
        {favorites.map(fav => (
          <div key={fav._id} className={c.card}>
            <ImgVibes
              _id={fav.imgId}
              className="w-full aspect-square object-cover"
              alt={`Saved ${fav.costume} costume`}
              showControls={false}
            />
            <div className={c.tag(fav.costume)}>{fav.costume}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
>>>>>>> REPLACE
<<<<<<< SEARCH
export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Pet Costume Try-On</h1>
      </header>
      <PhotoUploader />
      <CostumePicker />
      <TryOnResult />
      <FavoritesGallery />
    </main>
  );
}
=======
export default function App() {
  const { database, useLiveQuery } = useFireproof("pet-costume-tryonv1");
  const [petFile, setPetFile] = React.useState(null);
  const [costume, setCostume] = React.useState(null);

  const { docs: favorites } = useLiveQuery("type", { key: "favorite", descending: true });

  async function handleSave(costumeId, prompt) {
    await database.put({ type: "favorite", costume: costumeId, prompt, savedAt: Date.now() });
  }

  const c = {
    headerInner: "flex items-center gap-3 mb-2",
    squares: "flex gap-1",
    sq: (col) => `w-3 h-3 rounded-[2px] ${col}`,
    title: "text-[1.6rem] font-bold uppercase tracking-[-0.02em] text-[#0f172a]",
    subtitle: "text-[0.7rem] uppercase tracking-[0.1em] text-[#50507a] ml-1",
    divider: "border-t-[3px] border-[#0f172a] my-2",
  };

  return (
    <main id="app" className={classNames.page}>
      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.15 0.02 280 / 0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />
      <header id="app-header" className={classNames.header}>
        <div className={c.headerInner}>
          <div className={c.squares}>
            <div className={c.sq("bg-[#c0392b]")} />
            <div className={c.sq("bg-[#e6b800]")} />
            <div className={c.sq("bg-[#27ae60]")} />
          </div>
          <h1 className={c.title}>Pet Costume Try-On</h1>
          <span className={c.subtitle}>AI-Powered</span>
        </div>
        <div className={c.divider} />
      </header>
      <PhotoUploader petFile={petFile} onFile={setPetFile} />
      <CostumePicker selected={costume} onSelect={setCostume} disabled={!petFile} />
      <TryOnResult petFile={petFile} costume={costume} onSave={handleSave} />
      <FavoritesGallery favorites={favorites} />
    </main>
  );
}
>>>>>>> REPLACE