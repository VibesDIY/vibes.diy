import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const DIETS = ["Vegan","GF","Nut-free","Dairy-free"];

const classNames = {
  page: "min-h-screen bg-[#faf4e8] p-4 font-['Space_Grotesk',sans-serif]",
  header: "max-w-6xl mx-auto mb-6 text-center",
  title: "text-4xl font-bold uppercase tracking-tight",
  count: "mt-2 text-sm uppercase tracking-widest text-[#50505080]",
  board: "max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4",
};

const CAT_COLORS = {
  Appetizer: "bg-[#e85c3d] text-white",
  Main: "bg-[#d9a441] text-[#15151f]",
  Side: "bg-[#6fa85a] text-[#15151f]",
  Dessert: "bg-[#4a7ec9] text-white",
  Drink: "bg-[#c9658a] text-white",
};

function Column({ category, claims, database }) {
  const mine = claims.filter(c => c.category === category);
  const [name, setName] = useState("");
  const [dish, setDish] = useState("");
  const [diet, setDiet] = useState([]);

  const toggle = (d) => setDiet(diet.includes(d) ? diet.filter(x=>x!==d) : [...diet, d]);

  const add = async () => {
    if (!name.trim() || !dish.trim()) return;
    await database.put({ type:"claim", category, name: name.trim(), dish: dish.trim(), diet, createdAt: Date.now() });
    setName(""); setDish(""); setDiet([]);
  };

  return (
    <section className="bg-white border-[3px] border-[#15151f] rounded-[4px] shadow-[4px_4px_0_#15151f] flex flex-col">
      <div className={`px-3 py-2 border-b-[3px] border-[#15151f] ${CAT_COLORS[category]}`}>
        <h2 className="text-lg font-bold uppercase tracking-wide">{category}</h2>
      </div>
      <div className="p-3 flex-1 min-h-[120px] space-y-2">
        {mine.length === 0 && <p className="italic text-[#50505080] text-sm">needs claimer</p>}
        {mine.map(c => (
          <div key={c._id} className="relative border-[2px] border-[#15151f] rounded-[4px] p-2 bg-[#faf4e8] shadow-[3px_3px_0_#15151f]">
            <button onClick={() => database.del(c._id)} className="absolute top-1 right-1 w-5 h-5 text-xs font-bold hover:bg-[#e85c3d] hover:text-white border-[2px] border-[#15151f] rounded-[4px] leading-none">×</button>
            <div className="font-bold text-sm pr-6">{c.dish}</div>
            <div className="text-xs text-[#505050]">by {c.name}</div>
            {c.diet?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {c.diet.map(d => <span key={d} className="text-[0.6rem] uppercase tracking-wider px-1 py-0.5 bg-white border-[1px] border-[#15151f] rounded-[2px]">{d}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t-[3px] border-[#15151f] bg-[#faf4e8]">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="w-full mb-2 px-2 py-1 border-[3px] border-[#15151f] rounded-[4px] text-sm" />
        <input value={dish} onChange={e=>setDish(e.target.value)} placeholder="What dish?" className="w-full mb-2 px-2 py-1 border-[3px] border-[#15151f] rounded-[4px] text-sm" />
        <div className="flex flex-wrap gap-1 mb-2">
          {DIETS.map(d => (
            <button key={d} type="button" onClick={()=>toggle(d)} className={`text-[0.65rem] uppercase tracking-wider px-2 py-1 border-[2px] border-[#15151f] rounded-[4px] ${diet.includes(d) ? "bg-[#6fa85a] text-[#15151f]" : "bg-white"}`}>{d}</button>
          ))}
        </div>
        <button onClick={add} className="w-full bg-[#15151f] text-white text-xs uppercase tracking-widest py-2 border-[3px] border-[#15151f] rounded-[4px] font-bold hover:bg-[#e85c3d]">Add</button>
      </div>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("potluck-board");
  const { docs: claims } = useLiveQuery("type", { key: "claim" });

  return (
    <main className={classNames.page}>
      <header className={classNames.header}>
        <h1 className={classNames.title}>Potluck Board</h1>
        <div className={classNames.count}>{claims.length} {claims.length === 1 ? "dish" : "dishes"} claimed</div>
      </header>
      <div className={classNames.board}>
        {["Appetizer","Main","Side","Dessert","Drink"].map(cat => (
          <Column key={cat} category={cat} claims={claims} database={database} />
        ))}
      </div>
    </main>
  );
}