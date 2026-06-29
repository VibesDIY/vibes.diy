import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-6 font-sans",
  header: "max-w-3xl mx-auto mb-8 p-4 bg-white border-[3px] border-[#15141c] rounded shadow-[4px_4px_0px_#15141c] flex items-center gap-3",
  logo: "flex gap-1",
  logoSq: "w-3 h-3 border-[2px] border-[#15141c]",
  title: "text-2xl font-bold uppercase tracking-tight text-[#15141c]",
  feature: "max-w-3xl mx-auto mb-6 p-5 bg-white border-[3px] border-[#15141c] rounded shadow-[4px_4px_0px_#15141c]",
  featureTitle: "text-base font-bold uppercase mb-4 tracking-tight text-[#15141c]",
  label: "block text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6976] mb-2 font-semibold",
  input: "w-full px-3 py-2 bg-white border-[3px] border-[#15141c] rounded text-[#15141c] focus:outline-none focus:shadow-[4px_4px_0px_#15141c] transition",
  btnPrimary: "px-5 py-2 bg-[#d94a3d] text-white border-[3px] border-[#15141c] rounded font-bold uppercase tracking-wider text-sm shadow-[4px_4px_0px_#15141c] hover:shadow-[6px_6px_0px_#15141c] active:shadow-none disabled:opacity-60 transition",
  btnSecondary: "px-4 py-2 bg-[#f0c545] text-[#15141c] border-[3px] border-[#15141c] rounded font-bold uppercase tracking-wider text-xs shadow-[3px_3px_0px_#15141c] hover:shadow-[5px_5px_0px_#15141c] active:shadow-none transition",
  btnGhost: "px-3 py-1 bg-white text-[#15141c] border-[3px] border-[#15141c] rounded font-bold uppercase tracking-wider text-xs hover:shadow-[3px_3px_0px_#15141c] transition",
  postBody: "whitespace-pre-wrap text-[#15141c] text-sm leading-relaxed",
  barRed: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#d94a3d] border-b-[3px] border-[#15141c]",
  barBlue: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#3a6dd6] border-b-[3px] border-[#15141c]",
  barGreen: "h-[6px] -mx-5 -mt-5 mb-4 bg-[#4ca85f] border-b-[3px] border-[#15141c]",
  archiveItem: "p-3 border-[3px] border-[#15141c] rounded bg-[#f5f1e8] mb-3 cursor-pointer hover:bg-[#f0c545] transition",
  archiveCompany: "font-bold uppercase tracking-tight text-[#15141c]",
  archiveDate: "text-[0.65rem] uppercase tracking-[0.15em] text-[#6b6976] font-mono",
};

function Generator({ company, setCompany, onGenerate, isLoading }) {
  return (
    <section id="generator" className={classNames.feature}>
      <div className={classNames.barRed}/>
      <h2 className={classNames.featureTitle}>Begin Your Dramatic Exit</h2>
      <label className={classNames.label}>Company You're Leaving</label>
      <input
        className={classNames.input}
        placeholder="e.g. Goldman Sachs"
        value={company}
        onChange={e => setCompany(e.target.value)}
      />
      <div className="mt-4 flex items-center gap-3">
        <button onClick={onGenerate} disabled={isLoading || !company.trim()} className={classNames.btnPrimary}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20"/></svg>
              Writing...
            </span>
          ) : "Generate Farewell"}
        </button>
        <SuggestBtn setCompany={setCompany}/>
      </div>
    </section>
  );
}

function SuggestBtn({ setCompany }) {
  const [loading, setLoading] = React.useState(false);
  async function suggest() {
    setLoading(true);
    try {
      const r = await callAI("Suggest one real well-known company name for a parody resignation post. Just the name.", {
        schema: { properties: { name: { type: "string" } } }
      });
      const { name } = JSON.parse(r);
      if (name) setCompany(name);
    } finally { setLoading(false); }
  }
  return (
    <button onClick={suggest} disabled={loading} className={classNames.btnSecondary}>
      {loading ? "..." : "Suggest"}
    </button>
  );
}

function CurrentPost({ post, company, onSave, saved }) {
  if (!post) return null;
  return (
    <section id="current-post" className={classNames.feature}>
      <div className={classNames.barBlue}/>
      <h2 className={classNames.featureTitle}>Farewell, {company}</h2>
      <div className={classNames.postBody}>{post}</div>
      <div className="mt-4 flex gap-2">
        <button onClick={onSave} disabled={saved} className={classNames.btnSecondary}>
          {saved ? "Saved" : "Save To Archive"}
        </button>
      </div>
    </section>
  );
}

function Archive({ docs, database, openId, setOpenId }) {
  return (
    <section id="archive" className={classNames.feature}>
      <div className={classNames.barGreen}/>
      <h2 className={classNames.featureTitle}>Past Departures ({docs.length})</h2>
      {docs.length === 0 && <p className="text-[#6b6976] text-sm">No exits yet. Burn a bridge above.</p>}
      {docs.map(d => (
        <div key={d._id} className={classNames.archiveItem} onClick={() => setOpenId(openId === d._id ? null : d._id)}>
          <div className="flex items-center justify-between">
            <span className={classNames.archiveCompany}>← {d.company}</span>
            <span className={classNames.archiveDate}>{new Date(d.createdAt).toLocaleDateString()}</span>
          </div>
          {openId === d._id && (
            <>
              <div className={classNames.postBody + " mt-3"}>{d.post}</div>
              <button onClick={(e)=>{e.stopPropagation(); database.del(d._id);}} className={classNames.btnGhost + " mt-3"}>Delete</button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("exit-chronicles-db");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const [company, setCompany] = React.useState("");
  const [post, setPost] = React.useState("");
  const [postCompany, setPostCompany] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);

  async function generate() {
    setIsLoading(true);
    setSaved(false);
    setPost("");
    try {
      const prompt = `Write a cringe, melodramatic, overly earnest parody LinkedIn "Why I Left ${company}" resignation announcement post. It should be 200-280 words, feature sweeping revelations about purpose/authenticity/the universe, name-drop vague spiritual awakenings, include at least one humble-brag, one reference to a sunrise or mountain, one "as I told my CEO", and end with a list of buzzword hashtags. Make it deeply embarrassing but keep it PG.`;
      const r = await callAI(prompt, { schema: { properties: { post: { type: "string" } } } });
      const { post: text } = JSON.parse(r);
      setPost(text);
      setPostCompany(company);
    } finally { setIsLoading(false); }
  }

  async function save() {
    await database.put({ company: postCompany, post, createdAt: Date.now() });
    setSaved(true);
  }

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <div className={classNames.logo}>
          <div className={classNames.logoSq} style={{background:'#d94a3d'}}/>
          <div className={classNames.logoSq} style={{background:'#f0c545'}}/>
          <div className={classNames.logoSq} style={{background:'#4ca85f'}}/>
        </div>
        <h1 className={classNames.title}>Exit Chronicles</h1>
      </header>
      <Generator company={company} setCompany={setCompany} onGenerate={generate} isLoading={isLoading}/>
      <CurrentPost post={post} company={postCompany} onSave={save} saved={saved}/>
      <Archive docs={docs} database={database} openId={openId} setOpenId={setOpenId}/>
    </main>
  );
}