import React from "react"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[oklch(0.96_0.01_90)] p-4 font-['Space_Grotesk',sans-serif] text-[oklch(0.15_0.02_280)]",
  header: "max-w-3xl mx-auto mb-4",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)]",
  featureTitle: "text-lg font-bold uppercase tracking-tight mb-3",
};

function Setup({ game, database }) {
  const [name, setName] = React.useState("");
  const addPlayer = () => {
    if (!name.trim() || game.players.length >= 6) return;
    database.put({ ...game, players: [...game.players, { name: name.trim(), total: 0, rounds: [] }] });
    setName("");
  };
  const removePlayer = (i) => {
    database.put({ ...game, players: game.players.filter((_, idx) => idx !== i), currentTurn: 0 });
  };
  const suggest = async () => {
    const names = ["Grandma Pearl", "Uncle Ray", "Cousin Mae", "Pop-Pop", "Aunt Sue", "Little Jo"];
    const available = names.filter(n => !game.players.some(p => p.name === n));
    if (available.length) { setName(available[Math.floor(Math.random()*available.length)]); }
  };
  return (
    <section id="setup" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Who's Playing? ({game.players.length}/6)</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {game.players.map((p, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] ${i === game.currentTurn ? 'bg-[oklch(0.85_0.18_85)]' : 'bg-white'}`}>
            <span className="font-bold uppercase text-sm">{p.name}</span>
            <button onClick={() => removePlayer(i)} className="text-[oklch(0.55_0.24_28)] font-bold text-lg leading-none">×</button>
          </div>
        ))}
      </div>
      {game.players.length < 6 && (
        <div className="flex gap-2 flex-wrap">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Player name" className="flex-1 min-w-[140px] px-3 py-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] focus:outline-none focus:shadow-[4px_4px_0px_oklch(0.15_0.02_280)] focus:-translate-x-0.5 focus:-translate-y-0.5 transition-all" />
          <button onClick={addPlayer} className="px-4 py-2 bg-[oklch(0.62_0.19_145)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs uppercase tracking-wider font-bold shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">Add</button>
          <button onClick={suggest} className="px-3 py-2 bg-[oklch(0.52_0.18_255)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs uppercase tracking-wider font-bold shadow-[3px_3px_0px_oklch(0.15_0.02_280)]">Suggest</button>
        </div>
      )}
    </section>
  );
}

function Rules({ game, database }) {
  const toggle = (key) => database.put({ ...game, rules: { ...game.rules, [key]: !game.rules[key] } });
  const items = [
    { key: "threePairs", label: "Three Pairs = 1500" },
    { key: "straight", label: "Straight 1–6 = 2500" },
    { key: "loseAll", label: "Farkle: Lose It All" },
    { key: "mustOpen", label: "Must Open With 500" },
  ];
  return (
    <section id="rules" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>House Rules</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(it => {
          const on = game.rules[it.key];
          return (
            <button key={it.key} onClick={() => toggle(it.key)} className={`flex items-center justify-between gap-3 px-3 py-2 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-left ${on ? 'bg-[oklch(0.85_0.18_85)]' : 'bg-white'}`}>
              <span className="text-sm font-bold uppercase tracking-tight">{it.label}</span>
              <span className={`w-12 h-6 border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] relative ${on ? 'bg-[oklch(0.62_0.19_145)]' : 'bg-white'}`}>
                <span className={`absolute top-0 w-4 h-4 bg-white border-[2px] border-[oklch(0.15_0.02_280)] rounded-[2px] transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-0'}`} style={{transitionTimingFunction:'cubic-bezier(0.34,1.56,0.64,1)'}} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Scoreboard({ game }) {
  if (!game.players.length) {
    return (
      <section id="scoreboard" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>Scoreboard</h2>
        <p className="text-sm text-[oklch(0.50_0.02_280)] uppercase tracking-wider">Add a couple of players to start a game.</p>
      </section>
    );
  }
  const maxRounds = Math.max(1, ...game.players.map(p => p.rounds.length));
  const headerColors = ["bg-[oklch(0.55_0.24_28)] text-white","bg-[oklch(0.85_0.18_85)]","bg-[oklch(0.52_0.18_255)] text-white","bg-[oklch(0.62_0.19_145)]","bg-[oklch(0.55_0.24_28)] text-white","bg-[oklch(0.85_0.18_85)]"];
  return (
    <section id="scoreboard" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Scoreboard</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[0.6rem] uppercase tracking-widest p-2 border-b-[2px] border-[oklch(0.15_0.02_280)] text-left">Rd</th>
              {game.players.map((p, i) => (
                <th key={i} className={`text-xs uppercase tracking-wider p-2 border-b-[2px] border-[oklch(0.15_0.02_280)] border-l-[2px] ${headerColors[i]} ${i === game.currentTurn ? 'ring-4 ring-inset ring-[oklch(0.15_0.02_280)]' : ''}`}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRounds }).map((_, r) => (
              <tr key={r} className="hover:bg-[oklch(0.85_0.18_85)]">
                <td className="p-2 font-['JetBrains_Mono',monospace] text-sm border-b border-[oklch(0.15_0.02_280)]/20">{r + 1}</td>
                {game.players.map((p, i) => (
                  <td key={i} className="p-2 font-['JetBrains_Mono',monospace] text-base border-b border-l border-[oklch(0.15_0.02_280)]/20">
                    {p.rounds[r] ? (p.rounds[r].score === 0 ? <span className="text-[oklch(0.55_0.24_28)] font-bold">FARKLE</span> : p.rounds[r].score) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-2 text-[0.6rem] uppercase tracking-widest font-bold border-t-[2px] border-[oklch(0.15_0.02_280)]">Total</td>
              {game.players.map((p, i) => (
                <td key={i} className="p-2 font-['JetBrains_Mono',monospace] text-2xl font-bold border-t-[2px] border-l-[2px] border-[oklch(0.15_0.02_280)]">{p.total}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function NumberPad({ game, database, pending, setPending }) {
  if (!game.players.length) return null;
  const active = game.players[game.currentTurn];
  if (!active) return null;
  const winnerExists = game.players.some(p => p.total >= 10000);

  const press = (d) => setPending(p => {
    const n = p * 10 + d;
    return n > 100000 ? p : n;
  });
  const clear = () => setPending(0);
  const quick = (n) => setPending(n);

  const lockIn = (score) => {
    const isFarkle = score === 0;
    let newTotal = active.total;
    const mustOpen = game.rules.mustOpen && active.total === 0;
    if (isFarkle) {
      if (game.rules.loseAll) newTotal = 0;
    } else if (mustOpen && score < 500) {
      // doesn't open, no points
      newTotal = 0;
    } else {
      newTotal = active.total + score;
    }
    const updatedPlayers = game.players.map((p, i) =>
      i === game.currentTurn
        ? { ...p, total: newTotal, rounds: [...p.rounds, { score: isFarkle ? 0 : score, locked: true }] }
        : p
    );
    const nextTurn = (game.currentTurn + 1) % game.players.length;
    database.put({ ...game, players: updatedPlayers, currentTurn: nextTurn });
    setPending(0);
  };

  const keys = [1,2,3,4,5,6,7,8,9];
  return (
    <section id="numpad" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>
        {active.name}'s Turn
        {game.rules.mustOpen && active.total === 0 && <span className="ml-2 text-[0.6rem] tracking-widest text-[oklch(0.55_0.24_28)]">NEEDS 500 TO OPEN</span>}
      </h2>
      <div className="mb-3 p-4 bg-[oklch(0.96_0.01_90)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-center">
        <div className="text-[0.6rem] uppercase tracking-widest text-[oklch(0.50_0.02_280)]">This Turn</div>
        <div className="text-5xl font-bold font-['JetBrains_Mono',monospace]">{pending}</div>
      </div>
      <div className="flex gap-2 mb-2 flex-wrap">
        {[50,100,150,200,300,500,1000].map(n => (
          <button key={n} onClick={() => quick(n)} className="flex-1 min-w-[60px] px-2 py-2 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-sm font-bold font-['JetBrains_Mono',monospace] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-[oklch(0.85_0.18_85)]">+{n}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {keys.map(k => (
          <button key={k} onClick={() => press(k)} className="py-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-2xl font-bold font-['JetBrains_Mono',monospace] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-[oklch(0.85_0.18_85)]">{k}</button>
        ))}
        <button onClick={clear} className="py-4 bg-[oklch(0.85_0.18_85)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-sm font-bold uppercase tracking-wider shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">Clear</button>
        <button onClick={() => press(0)} className="py-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-2xl font-bold font-['JetBrains_Mono',monospace] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-[oklch(0.85_0.18_85)]">0</button>
        <button onClick={() => setPending(p => p*100 > 100000 ? p : p*100)} className="py-4 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-lg font-bold font-['JetBrains_Mono',monospace] shadow-[3px_3px_0px_oklch(0.15_0.02_280)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-[oklch(0.85_0.18_85)]">00</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button disabled={winnerExists} onClick={() => lockIn(0)} className="flex-1 min-w-[120px] py-4 bg-[oklch(0.55_0.24_28)] text-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-base font-bold uppercase tracking-wider shadow-[4px_4px_0px_oklch(0.15_0.02_280)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50">Farkle!</button>
        <button disabled={pending === 0 || winnerExists} onClick={() => lockIn(pending)} className="flex-[2] min-w-[160px] py-4 bg-[oklch(0.62_0.19_145)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-base font-bold uppercase tracking-wider shadow-[4px_4px_0px_oklch(0.15_0.02_280)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50">Lock In {pending > 0 && `(${pending})`}</button>
      </div>
    </section>
  );
}

export default function App() {
  const { database, useLiveQuery } = useFireproof("farkle-kitchen");
  const { docs } = useLiveQuery("type", { key: "game", descending: true, limit: 1 });
  const game = docs[0];
  const [pending, setPending] = React.useState(0);

  React.useEffect(() => {
    if (!docs || docs.length > 0) return;
    database.put({
      type: "game",
      players: [],
      rules: { threePairs: true, straight: true, loseAll: false, mustOpen: true },
      currentTurn: 0,
      createdAt: Date.now(),
    });
  }, [docs, database]);

  if (!game) return <main className={classNames.page}><p>Setting up...</p></main>;

  const winner = game.players.find(p => p.total >= 10000);

  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1 className={classNames.title}>Farkle Kitchen Table</h1>
        <p className="text-sm uppercase tracking-widest text-[oklch(0.50_0.02_280)] mt-1">First to 10,000 Wins</p>
      </header>
      {winner && (
        <div className="max-w-3xl mx-auto mb-4 p-5 bg-[oklch(0.62_0.19_145)] border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] shadow-[4px_4px_0px_oklch(0.15_0.02_280)] text-center">
          <p className="text-xs uppercase tracking-widest">Winner Winner</p>
          <p className="text-3xl font-bold uppercase">{winner.name} wins!</p>
          <button onClick={() => database.put({ ...game, players: game.players.map(p => ({...p, total:0, rounds:[]})), currentTurn:0 })} className="mt-2 px-4 py-2 bg-white border-[3px] border-[oklch(0.15_0.02_280)] rounded-[4px] text-xs uppercase tracking-wider font-bold shadow-[3px_3px_0px_oklch(0.15_0.02_280)]">New Game</button>
        </div>
      )}
      <Setup game={game} database={database} />
      <Rules game={game} database={database} />
      <Scoreboard game={game} />
      <NumberPad game={game} database={database} pending={pending} setPending={setPending} />
    </main>
  );
}