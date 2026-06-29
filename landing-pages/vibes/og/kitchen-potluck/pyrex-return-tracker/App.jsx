import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#faf6ee] p-4 font-['Space_Grotesk',sans-serif] text-[#1a1a2e]",
  header: "max-w-4xl mx-auto mb-6 bg-white border-[3px] border-[#1a1a2e] rounded-[4px] p-5 shadow-[6px_6px_0px_#1a1a2e] relative overflow-hidden",
  accentBar: "absolute top-0 left-0 right-0 h-[6px] flex",
  title: "text-3xl md:text-4xl font-bold uppercase tracking-tight mt-2",
  subtitle: "text-xs uppercase tracking-[0.15em] text-[#6b6b7a] mt-1",
  feature: "max-w-4xl mx-auto mb-6 bg-white border-[3px] border-[#1a1a2e] rounded-[4px] p-5 shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-base font-bold uppercase tracking-[0.08em] mb-4",
};

function AddForm({ database }) {
  const { useDocument } = useFireproof("pyrex-tracker");
  const { doc, merge, submit } = useDocument({
    type: "pyrex",
    desc: "",
    owner: "",
    returned: false,
    createdAt: Date.now(),
    _files: {},
  });

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) merge({ _files: { photo: file }, createdAt: Date.now() });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!doc.owner.trim() || !doc.desc.trim()) return;
    submit();
  };

  const inputCls = "w-full px-3 py-2 border-[3px] border-[#1a1a2e] rounded-[4px] bg-white text-sm focus:outline-none focus:shadow-[3px_3px_0px_#1a1a2e] focus:-translate-x-[2px] focus:-translate-y-[2px] transition-all";
  const labelCls = "block text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6b7a] mb-1 font-semibold";
  return (
    <section id="add-form" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Log a container</h2>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <div>
          <label className={labelCls}>Photo</label>
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} className={inputCls} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Owner</label>
            <input type="text" value={doc.owner} onChange={(e) => merge({ owner: e.target.value })} placeholder="Aunt Linda" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>What is it</label>
            <input type="text" value={doc.desc} onChange={(e) => merge({ desc: e.target.value })} placeholder="lasagna pan, glass lid" className={inputCls} />
          </div>
        </div>
        <button type="submit" className="mt-1 px-4 py-3 bg-[#d64141] text-white font-bold uppercase tracking-[0.08em] text-sm border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[4px_4px_0px_#1a1a2e] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
          Add to fridge
        </button>
      </form>
    </section>
  );
}

function PolaroidCard({ item, onReturn }) {
  const [photoUrl, setPhotoUrl] = React.useState(null);
  React.useEffect(() => {
    let url;
    const f = item._files?.photo;
    if (f && typeof f.file === "function") {
      f.file().then(file => {
        url = URL.createObjectURL(file);
        setPhotoUrl(url);
      }).catch(() => {});
    } else if (f instanceof Blob) {
      url = URL.createObjectURL(f);
      setPhotoUrl(url);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [item._files]);

  return (
    <article className="bg-white border-[3px] border-[#1a1a2e] rounded-[4px] p-3 shadow-[4px_4px_0px_#1a1a2e] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_#1a1a2e] transition-all">
      <div className="w-full aspect-square bg-[#f1ecd9] border-[3px] border-[#1a1a2e] rounded-[2px] mb-3 overflow-hidden flex items-center justify-center">
        {photoUrl ? (
          <img src={photoUrl} alt={item.desc} className="w-full h-full object-cover" />
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b6b7a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        )}
      </div>
      <p className="font-bold text-base leading-tight">{item.owner}</p>
      <p className="text-sm text-[#6b6b7a] mb-3">{item.desc}</p>
      <button onClick={() => onReturn && onReturn(item)} className="w-full px-3 py-2 bg-[#5ba150] text-white font-bold uppercase tracking-[0.08em] text-xs border-[3px] border-[#1a1a2e] rounded-[4px] shadow-[3px_3px_0px_#1a1a2e] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0px_#1a1a2e] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
        Mark returned
      </button>
    </article>
  );
}

function UnreturnedGrid({ items = [], onReturn }) {
  return (
    <section id="unreturned" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>In the fridge ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[#6b6b7a] italic">Nothing stranded. A miracle.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {items.map(item => (
            <PolaroidCard key={item._id} item={item} onReturn={onReturn} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReturnedArchive({ items = [], open, onToggle, onRestore }) {
  return (
    <section id="returned" className={classNames.feature}>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <h2 className={classNames.featureTitle + " mb-0"}>Returned ✓ ({items.length})</h2>
        <span className="text-xl font-bold">{open ? "−" : "+"}</span>
      </button>
      {open && (
        items.length === 0 ? (
          <p className="text-sm text-[#6b6b7a] italic mt-3">The graveyard is empty.</p>
        ) : (
          <ul className="mt-4 divide-y-[2px] divide-[#1a1a2e]">
            {items.map(item => (
              <li key={item._id} className="py-2 flex items-center justify-between gap-3">
                <div className="line-through text-[#6b6b7a] text-sm">
                  <span className="font-bold">{item.owner}</span> — {item.desc}
                </div>
                <button onClick={() => onRestore && onRestore(item)} className="text-[0.65rem] uppercase tracking-[0.15em] px-2 py-1 border-[2px] border-[#1a1a2e] rounded-[4px] hover:bg-[#e8c547] transition-colors">Undo</button>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("pyrex-tracker");
  const { docs } = useLiveQuery("type", { key: "pyrex", descending: true });
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const unreturned = docs.filter(d => !d.returned);
  const returned = docs.filter(d => d.returned);

  const markReturned = (item) => database.put({ ...item, returned: true, returnedAt: Date.now() });
  const restore = (item) => database.put({ ...item, returned: false });

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className={classNames.accentBar} aria-hidden="true">
          <div className="w-1/4 bg-[#d64141]" />
          <div className="w-1/4 bg-[#e8c547]" />
          <div className="w-1/4 bg-[#5ba150]" />
          <div className="w-1/4 bg-[#3d6fd1]" />
        </div>
        <h1 className={classNames.title}>Pyrex Return Tracker</h1>
        <p className={classNames.subtitle}>the fridge graveyard solver</p>
      </header>
      <AddForm database={database} />
      <UnreturnedGrid items={unreturned} onReturn={markReturned} />
      <ReturnedArchive items={returned} open={archiveOpen} onToggle={() => setArchiveOpen(o => !o)} onRestore={restore} />
    </main>
  );
}