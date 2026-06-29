import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

const CATEGORIES = {
  alkali: { name: "Alkali metal", bg: "bg-[#e63946]", text: "text-white" },
  alkaline: { name: "Alkaline earth", bg: "bg-[#f4845f]", text: "text-[#15151f]" },
  transition: { name: "Transition metal", bg: "bg-[#d4a017]", text: "text-[#15151f]" },
  post: { name: "Post-transition", bg: "bg-[#c8c8c8]", text: "text-[#15151f]" },
  metalloid: { name: "Metalloid", bg: "bg-[#b5c441]", text: "text-[#15151f]" },
  nonmetal: { name: "Nonmetal", bg: "bg-[#52b788]", text: "text-white" },
  halogen: { name: "Halogen", bg: "bg-[#20b2aa]", text: "text-white" },
  noble: { name: "Noble gas", bg: "bg-[#9b5de5]", text: "text-white" },
  lanthanide: { name: "Lanthanide", bg: "bg-[#c8a2c8]", text: "text-[#15151f]" },
  actinide: { name: "Actinide", bg: "bg-[#f4a6c0]", text: "text-[#15151f]" },
  unknown: { name: "Unknown", bg: "bg-[#e8e8e8]", text: "text-[#15151f]" },
};

const ELEMENTS = [
  {n:1,s:"H",name:"Hydrogen",m:1.008,cat:"nonmetal",col:1,row:1,cfg:"1s¹",g:1,p:1,state:"gas",year:1766,fact:"The most abundant element in the universe, making up about 75% of all normal matter."},
  {n:2,s:"He",name:"Helium",m:4.003,cat:"noble",col:18,row:1,cfg:"1s²",g:18,p:1,state:"gas",year:1868,fact:"First detected in the Sun's spectrum before being found on Earth. It can make your voice sound squeaky."},
  {n:3,s:"Li",name:"Lithium",m:6.94,cat:"alkali",col:1,row:2,cfg:"1s² 2s¹",g:1,p:2,state:"solid",year:1817,fact:"The lightest metal. Used in rechargeable batteries that power phones and electric cars."},
  {n:4,s:"Be",name:"Beryllium",m:9.012,cat:"alkaline",col:2,row:2,cfg:"1s² 2s²",g:2,p:2,state:"solid",year:1798,fact:"Transparent to X-rays, so it's used in X-ray equipment windows."},
  {n:5,s:"B",name:"Boron",m:10.81,cat:"metalloid",col:13,row:2,cfg:"1s² 2s² 2p¹",g:13,p:2,state:"solid",year:1808,fact:"Essential for plant cell walls. Borax, a boron compound, has been used as a cleaner for over 4,000 years."},
  {n:6,s:"C",name:"Carbon",m:12.01,cat:"nonmetal",col:14,row:2,cfg:"1s² 2s² 2p²",g:14,p:2,state:"solid",year:-3750,fact:"The backbone of all known life. Exists as diamond, graphite, and graphene — vastly different forms of the same element."},
  {n:7,s:"N",name:"Nitrogen",m:14.01,cat:"nonmetal",col:15,row:2,cfg:"1s² 2s² 2p³",g:15,p:2,state:"gas",year:1772,fact:"Makes up 78% of Earth's atmosphere. Liquid nitrogen boils at -196°C and is used to freeze things rapidly."},
  {n:8,s:"O",name:"Oxygen",m:16.00,cat:"nonmetal",col:16,row:2,cfg:"1s² 2s² 2p⁴",g:16,p:2,state:"gas",year:1774,fact:"Essential for respiration in most life forms. About 21% of the air we breathe."},
  {n:9,s:"F",name:"Fluorine",m:19.00,cat:"halogen",col:17,row:2,cfg:"1s² 2s² 2p⁵",g:17,p:2,state:"gas",year:1886,fact:"The most reactive element. Added to toothpaste (as fluoride) to strengthen tooth enamel."},
  {n:10,s:"Ne",name:"Neon",m:20.18,cat:"noble",col:18,row:2,cfg:"1s² 2s² 2p⁶",g:18,p:2,state:"gas",year:1898,fact:"Glows bright orange-red when electricity passes through it — the classic 'neon sign' color."},
  {n:11,s:"Na",name:"Sodium",m:22.99,cat:"alkali",col:1,row:3,cfg:"[Ne] 3s¹",g:1,p:3,state:"solid",year:1807,fact:"So reactive it explodes in water. Combined with chlorine it becomes table salt."},
  {n:12,s:"Mg",name:"Magnesium",m:24.31,cat:"alkaline",col:2,row:3,cfg:"[Ne] 3s²",g:2,p:3,state:"solid",year:1755,fact:"Burns with a blindingly bright white flame. Central atom in chlorophyll, which makes plants green."},
  {n:13,s:"Al",name:"Aluminum",m:26.98,cat:"post",col:13,row:3,cfg:"[Ne] 3s² 3p¹",g:13,p:3,state:"solid",year:1825,fact:"The most abundant metal in Earth's crust. Once so hard to refine it was more valuable than gold."},
  {n:14,s:"Si",name:"Silicon",m:28.09,cat:"metalloid",col:14,row:3,cfg:"[Ne] 3s² 3p²",g:14,p:3,state:"solid",year:1824,fact:"The foundation of all modern computer chips. Silicon Valley is named after it."},
  {n:15,s:"P",name:"Phosphorus",m:30.97,cat:"nonmetal",col:15,row:3,cfg:"[Ne] 3s² 3p³",g:15,p:3,state:"solid",year:1669,fact:"White phosphorus glows faintly in the dark. Essential for DNA and energy storage in cells (ATP)."},
  {n:16,s:"S",name:"Sulfur",m:32.07,cat:"nonmetal",col:16,row:3,cfg:"[Ne] 3s² 3p⁴",g:16,p:3,state:"solid",year:-2000,fact:"Known since ancient times as 'brimstone.' Gives rotten eggs and skunks their smell."},
  {n:17,s:"Cl",name:"Chlorine",m:35.45,cat:"halogen",col:17,row:3,cfg:"[Ne] 3s² 3p⁵",g:17,p:3,state:"gas",year:1774,fact:"A greenish-yellow toxic gas. Added in tiny amounts to pool and drinking water to kill bacteria."},
  {n:18,s:"Ar",name:"Argon",m:39.95,cat:"noble",col:18,row:3,cfg:"[Ne] 3s² 3p⁶",g:18,p:3,state:"gas",year:1894,fact:"Fills incandescent light bulbs so the filament doesn't burn up. About 1% of our atmosphere."},
  {n:19,s:"K",name:"Potassium",m:39.10,cat:"alkali",col:1,row:4,cfg:"[Ar] 4s¹",g:1,p:4,state:"solid",year:1807,fact:"Essential for nerve signals and muscle contractions. Bananas are famously rich in potassium."},
  {n:20,s:"Ca",name:"Calcium",m:40.08,cat:"alkaline",col:2,row:4,cfg:"[Ar] 4s²",g:2,p:4,state:"solid",year:1808,fact:"Makes up your bones and teeth. Also the main ingredient in chalk and limestone."},
  {n:21,s:"Sc",name:"Scandium",m:44.96,cat:"transition",col:3,row:4,cfg:"[Ar] 3d¹ 4s²",g:3,p:4,state:"solid",year:1879,fact:"Used in aerospace alloys and stadium lights. Named after Scandinavia where it was discovered."},
  {n:22,s:"Ti",name:"Titanium",m:47.87,cat:"transition",col:4,row:4,cfg:"[Ar] 3d² 4s²",g:4,p:4,state:"solid",year:1791,fact:"As strong as steel but 45% lighter. Used in jet engines, spacecraft, and medical implants."},
  {n:23,s:"V",name:"Vanadium",m:50.94,cat:"transition",col:5,row:4,cfg:"[Ar] 3d³ 4s²",g:5,p:4,state:"solid",year:1801,fact:"Its compounds come in many colors — purple, green, blue, yellow. Added to steel to make it tougher."},
  {n:24,s:"Cr",name:"Chromium",m:52.00,cat:"transition",col:6,row:4,cfg:"[Ar] 3d⁵ 4s¹",g:6,p:4,state:"solid",year:1797,fact:"Gives stainless steel its shine and rust resistance. Rubies get their red color from chromium."},
  {n:25,s:"Mn",name:"Manganese",m:54.94,cat:"transition",col:7,row:4,cfg:"[Ar] 3d⁵ 4s²",g:7,p:4,state:"solid",year:1774,fact:"Essential in steel making. Your body needs tiny amounts for bone health and metabolism."},
  {n:26,s:"Fe",name:"Iron",m:55.85,cat:"transition",col:8,row:4,cfg:"[Ar] 3d⁶ 4s²",g:8,p:4,state:"solid",year:-5000,fact:"The core of Earth is mostly iron. Hemoglobin in your blood uses iron to carry oxygen."},
  {n:27,s:"Co",name:"Cobalt",m:58.93,cat:"transition",col:9,row:4,cfg:"[Ar] 3d⁷ 4s²",g:9,p:4,state:"solid",year:1735,fact:"Gives a deep blue color to glass and ceramics — used by artists for over 2,000 years."},
  {n:28,s:"Ni",name:"Nickel",m:58.69,cat:"transition",col:10,row:4,cfg:"[Ar] 3d⁸ 4s²",g:10,p:4,state:"solid",year:1751,fact:"The US five-cent coin is only 25% nickel. The rest is copper."},
  {n:29,s:"Cu",name:"Copper",m:63.55,cat:"transition",col:11,row:4,cfg:"[Ar] 3d¹⁰ 4s¹",g:11,p:4,state:"solid",year:-9000,fact:"One of the oldest metals used by humans. Statue of Liberty's green color is oxidized copper."},
  {n:30,s:"Zn",name:"Zinc",m:65.38,cat:"transition",col:12,row:4,cfg:"[Ar] 3d¹⁰ 4s²",g:12,p:4,state:"solid",year:1746,fact:"Your immune system depends on zinc. Also used to coat iron to prevent rust (galvanization)."},
  {n:31,s:"Ga",name:"Gallium",m:69.72,cat:"post",col:13,row:4,cfg:"[Ar] 3d¹⁰ 4s² 4p¹",g:13,p:4,state:"solid",year:1875,fact:"Melts in your hand — its melting point is just 30°C. Used as a prank metal spoon that dissolves in hot tea."},
  {n:32,s:"Ge",name:"Germanium",m:72.63,cat:"metalloid",col:14,row:4,cfg:"[Ar] 3d¹⁰ 4s² 4p²",g:14,p:4,state:"solid",year:1886,fact:"Used in the very first transistor in 1947, before silicon took over."},
  {n:33,s:"As",name:"Arsenic",m:74.92,cat:"metalloid",col:15,row:4,cfg:"[Ar] 3d¹⁰ 4s² 4p³",g:15,p:4,state:"solid",year:1250,fact:"Famously poisonous — called 'inheritance powder' in medieval times. Still used in some semiconductors."},
  {n:34,s:"Se",name:"Selenium",m:78.97,cat:"nonmetal",col:16,row:4,cfg:"[Ar] 3d¹⁰ 4s² 4p⁴",g:16,p:4,state:"solid",year:1817,fact:"Its electrical conductivity changes with light — used in old photocopiers and light meters."},
  {n:35,s:"Br",name:"Bromine",m:79.90,cat:"halogen",col:17,row:4,cfg:"[Ar] 3d¹⁰ 4s² 4p⁵",g:17,p:4,state:"liquid",year:1826,fact:"One of only two elements that are liquid at room temperature. Smells awful — its name means 'stench' in Greek."},
  {n:36,s:"Kr",name:"Krypton",m:83.80,cat:"noble",col:18,row:4,cfg:"[Ar] 3d¹⁰ 4s² 4p⁶",g:18,p:4,state:"gas",year:1898,fact:"Not Superman's home planet, sadly. Used in high-performance light bulbs and lasers."},
];

// Placeholder elements 37-118 with symbol and basic positioning
const PLACEHOLDERS = [
  {n:37,s:"Rb",row:5,col:1,cat:"alkali"},{n:38,s:"Sr",row:5,col:2,cat:"alkaline"},
  {n:39,s:"Y",row:5,col:3,cat:"transition"},{n:40,s:"Zr",row:5,col:4,cat:"transition"},
  {n:41,s:"Nb",row:5,col:5,cat:"transition"},{n:42,s:"Mo",row:5,col:6,cat:"transition"},
  {n:43,s:"Tc",row:5,col:7,cat:"transition"},{n:44,s:"Ru",row:5,col:8,cat:"transition"},
  {n:45,s:"Rh",row:5,col:9,cat:"transition"},{n:46,s:"Pd",row:5,col:10,cat:"transition"},
  {n:47,s:"Ag",row:5,col:11,cat:"transition"},{n:48,s:"Cd",row:5,col:12,cat:"transition"},
  {n:49,s:"In",row:5,col:13,cat:"post"},{n:50,s:"Sn",row:5,col:14,cat:"post"},
  {n:51,s:"Sb",row:5,col:15,cat:"metalloid"},{n:52,s:"Te",row:5,col:16,cat:"metalloid"},
  {n:53,s:"I",row:5,col:17,cat:"halogen"},{n:54,s:"Xe",row:5,col:18,cat:"noble"},
  {n:55,s:"Cs",row:6,col:1,cat:"alkali"},{n:56,s:"Ba",row:6,col:2,cat:"alkaline"},
  {n:72,s:"Hf",row:6,col:4,cat:"transition"},{n:73,s:"Ta",row:6,col:5,cat:"transition"},
  {n:74,s:"W",row:6,col:6,cat:"transition"},{n:75,s:"Re",row:6,col:7,cat:"transition"},
  {n:76,s:"Os",row:6,col:8,cat:"transition"},{n:77,s:"Ir",row:6,col:9,cat:"transition"},
  {n:78,s:"Pt",row:6,col:10,cat:"transition"},{n:79,s:"Au",row:6,col:11,cat:"transition"},
  {n:80,s:"Hg",row:6,col:12,cat:"transition"},{n:81,s:"Tl",row:6,col:13,cat:"post"},
  {n:82,s:"Pb",row:6,col:14,cat:"post"},{n:83,s:"Bi",row:6,col:15,cat:"post"},
  {n:84,s:"Po",row:6,col:16,cat:"post"},{n:85,s:"At",row:6,col:17,cat:"halogen"},
  {n:86,s:"Rn",row:6,col:18,cat:"noble"},
  {n:87,s:"Fr",row:7,col:1,cat:"alkali"},{n:88,s:"Ra",row:7,col:2,cat:"alkaline"},
  {n:104,s:"Rf",row:7,col:4,cat:"transition"},{n:105,s:"Db",row:7,col:5,cat:"transition"},
  {n:106,s:"Sg",row:7,col:6,cat:"transition"},{n:107,s:"Bh",row:7,col:7,cat:"transition"},
  {n:108,s:"Hs",row:7,col:8,cat:"transition"},{n:109,s:"Mt",row:7,col:9,cat:"unknown"},
  {n:110,s:"Ds",row:7,col:10,cat:"unknown"},{n:111,s:"Rg",row:7,col:11,cat:"unknown"},
  {n:112,s:"Cn",row:7,col:12,cat:"unknown"},{n:113,s:"Nh",row:7,col:13,cat:"unknown"},
  {n:114,s:"Fl",row:7,col:14,cat:"unknown"},{n:115,s:"Mc",row:7,col:15,cat:"unknown"},
  {n:116,s:"Lv",row:7,col:16,cat:"unknown"},{n:117,s:"Ts",row:7,col:17,cat:"unknown"},
  {n:118,s:"Og",row:7,col:18,cat:"noble"},
];
// Lanthanide/actinide placeholders (row 8 & 9 in display, cols 3-17)
const LANTHANIDES = ["La","Ce","Pr","Nd","Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu"].map((s,i)=>({n:57+i,s,row:9,col:3+i,cat:"lanthanide"}));
const ACTINIDES = ["Ac","Th","Pa","U","Np","Pu","Am","Cm","Bk","Cf","Es","Fm","Md","No","Lr"].map((s,i)=>({n:89+i,s,row:10,col:3+i,cat:"actinide"}));

const ALL_CELLS = [...ELEMENTS, ...PLACEHOLDERS, ...LANTHANIDES, ...ACTINIDES];

const classNames = {
  page: "min-h-screen bg-[#f5f1e8] p-4 font-sans",
  header: "max-w-7xl mx-auto mb-4",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-7xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#15151f] rounded-[4px]",
  featureTitle: "text-sm font-bold uppercase tracking-widest mb-2",
};

function SearchBar({ query, setQuery }) {
  return (
    <section id="search" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Search Elements</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name, symbol, or atomic number..."
          className="flex-1 px-3 py-2 border-[3px] border-[#15151f] rounded-[4px] text-base focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[4px_4px_0px_#15151f] transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="px-4 py-2 bg-[#e63946] text-white border-[3px] border-[#15151f] rounded-[4px] uppercase text-xs font-bold tracking-wider hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#15151f] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

function ElementCell({ el, full, onClick, highlight, dim }) {
  const cat = CATEGORIES[el.cat] || CATEGORIES.unknown;
  const ring = highlight ? "ring-4 ring-[#15151f] z-10" : "";
  const opacity = dim ? "opacity-25" : "";
  return (
    <button
      onClick={() => onClick(el)}
      style={{ gridColumn: el.col, gridRow: el.row }}
      className={`${cat.bg} ${cat.text} ${ring} ${opacity} border-[2px] border-[#15151f] rounded-[3px] p-1 text-left hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0px_#15151f] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-150 min-h-[56px] flex flex-col justify-between`}
      aria-label={full ? `${full.name}, atomic number ${el.n}` : `Element ${el.n}`}
    >
      <div className="text-[9px] font-mono font-bold leading-none">{el.n}</div>
      <div className="text-center font-bold text-base leading-none">{el.s}</div>
      <div className="text-[7px] leading-tight truncate text-center">{full ? full.name : ""}</div>
    </button>
  );
}

function PeriodicTable({ query, onSelect }) {
  const q = query.trim().toLowerCase();
  const matches = (el, full) => {
    if (!q) return null;
    const name = full?.name?.toLowerCase() || "";
    const sym = el.s.toLowerCase();
    const num = String(el.n);
    return name.includes(q) || sym === q || sym.startsWith(q) || num === q;
  };
  const anyQuery = q.length > 0;

  return (
    <section id="table" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Periodic Table</h2>
      <div className="overflow-x-auto">
        <div
          className="grid gap-[3px] min-w-[900px]"
          style={{ gridTemplateColumns: "repeat(18, minmax(48px, 1fr))", gridAutoRows: "56px" }}
        >
          {ALL_CELLS.map((el) => {
            const full = ELEMENTS.find((e) => e.n === el.n);
            const hit = matches(el, full);
            return (
              <ElementCell
                key={el.n}
                el={el}
                full={full}
                onClick={onSelect}
                highlight={hit === true}
                dim={anyQuery && !hit}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(CATEGORIES).filter(([k])=>k!=="unknown").map(([k, c]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <div className={`w-4 h-4 ${c.bg} border-[2px] border-[#15151f] rounded-[2px]`} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailPanel({ element, onClose }) {
  if (!element) return null;
  const cat = CATEGORIES[element.cat] || CATEGORIES.unknown;
  const hasFull = element.name !== undefined && element.cfg !== undefined;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#15151f]/60 z-40"
        aria-hidden
      />
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white border-l-[3px] border-[#15151f] z-50 overflow-y-auto shadow-[-8px_0_0_#15151f] animate-[slideIn_0.2s_ease-out]"
        style={{ animation: "slideIn 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className={`${cat.bg} ${cat.text} p-4 border-b-[3px] border-[#15151f] flex justify-between items-start`}>
          <div>
            <div className="text-xs font-mono">#{element.n}</div>
            <div className="text-5xl font-bold leading-none my-1">{element.s}</div>
            <div className="text-lg font-semibold">{hasFull ? element.name : "Data coming soon"}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-white text-[#15151f] w-8 h-8 border-[2px] border-[#15151f] rounded-[3px] font-bold hover:bg-[#f4d35e]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {hasFull ? (
            <>
              <Row label="Atomic Number" value={element.n} />
              <Row label="Atomic Mass" value={element.m} />
              <Row label="Category" value={cat.name} />
              <Row label="Group / Period" value={`${element.g} / ${element.p}`} />
              <Row label="State at Room Temp" value={element.state} />
              <Row label="Electron Configuration" value={element.cfg} mono />
              <Row label="Discovered" value={element.year < 0 ? `~${Math.abs(element.year)} BCE` : element.year} />
              <div className="pt-2 border-t-[2px] border-[#15151f]">
                <div className="text-xs uppercase tracking-widest font-bold mb-1">Fun Fact</div>
                <p className="text-sm leading-relaxed">{element.fact}</p>
              </div>
            </>
          ) : (
            <p className="text-[#555]">Detailed data for this element is not yet loaded. Hydrogen through Krypton (1–36) have full information available.</p>
          )}
        </div>
      </aside>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between items-baseline gap-3 border-b border-[#ddd] pb-2">
      <span className="text-xs uppercase tracking-wider text-[#555] font-semibold">{label}</span>
      <span className={`text-right ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

function LabNotebook({ visited, onSelect, database }) {
  const unique = [];
  const seen = new Set();
  for (const v of visited) {
    if (!seen.has(v.n)) { seen.add(v.n); unique.push(v); }
  }
  return (
    <section id="notebook" className={classNames.feature}>
      <div className="flex justify-between items-center mb-2">
        <h2 className={classNames.featureTitle}>Lab Notebook — Elements Visited ({unique.length})</h2>
        {unique.length > 0 && (
          <button
            onClick={() => visited.forEach(v => database.del(v._id))}
            className="text-xs px-2 py-1 border-[2px] border-[#15151f] rounded-[3px] hover:bg-[#f4d35e]"
          >
            Clear
          </button>
        )}
      </div>
      {unique.length === 0 ? (
        <p className="text-sm text-[#555]">Click elements in the table above to log them here.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {unique.map((v) => {
            const full = ELEMENTS.find((e) => e.n === v.n);
            const cat = CATEGORIES[full?.cat] || CATEGORIES.unknown;
            return (
              <button
                key={v._id}
                onClick={() => onSelect(full || v)}
                className={`${cat.bg} ${cat.text} px-3 py-1 border-[2px] border-[#15151f] rounded-[3px] text-xs font-semibold hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_#15151f] transition-all`}
              >
                {v.s} · {v.name}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("periodic-table-v1");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const { docs: visited } = useLiveQuery("type", { key: "visit", descending: true });

  const handleSelect = (el) => {
    const full = ELEMENTS.find((e) => e.n === el.n);
    setSelected(full || el);
    if (full) {
      database.put({ type: "visit", n: full.n, s: full.s, name: full.name, at: Date.now() });
    }
  };

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Periodic Table Explorer</h1>
        <p className="text-sm text-[#555] mt-1">Click any element to learn more. Search by name, symbol, or number.</p>
      </header>
      <SearchBar query={query} setQuery={setQuery} />
      <PeriodicTable query={query} onSelect={handleSelect} />
      <LabNotebook visited={visited} onSelect={handleSelect} database={database} />
      <DetailPanel element={selected} onClose={() => setSelected(null)} />
    </main>
  );
}