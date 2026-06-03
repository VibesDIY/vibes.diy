import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function PinnedWinner({ pinnedRecipe }) {
  if (!pinnedRecipe) return null;
  return (
    <section id="pinned-winner" className="space-y-2">
      <h2 className="text-xl font-semibold text-[oklch(0.93_0.006_265)] px-1">★ Winner of the Week</h2>
      <div className="border border-[oklch(0.93_0.006_265)] rounded-lg p-4 bg-[oklch(0.23_0.01_260)]">
        <h3 className="text-lg font-semibold text-[oklch(0.93_0.006_265)]">{pinnedRecipe.title}</h3>
        <div className="text-2xl mt-2 tracking-wide">{pinnedRecipe.emojis.join(" ")}</div>
        <div className="text-xs text-[oklch(0.71_0.02_261)] italic mt-2">crowned by the club leader</div>
      </div>
    </section>
  );
}

const PALETTE = [
  "🍅",
  "🧄",
  "🧅",
  "🥔",
  "🥕",
  "🌶️",
  "🍄",
  "🥦",
  "🥬",
  "🌽",
  "🥒",
  "🍆",
  "🥑",
  "🍋",
  "🥚",
  "🧀",
  "🥖",
  "🍞",
  "🥩",
  "🍗",
  "🍤",
  "🐟",
  "🍚",
  "🍝",
  "🍜",
  "🥣",
  "🍯",
  "🧈",
  "🧂",
  "🌿",
  "🔥",
  "💧",
  "🥄",
  "🍴",
  "✨",
];

function RecipeComposer({ viewer, database }) {
  const [seq, setSeq] = React.useState([]);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);

  async function suggest() {
    setSuggesting(true);
    try {
      const res = await callAI(
        "Invent one playful emoji-only recipe. Return a short title and an emoji sequence (6-10 emojis, no text).",
        {
          schema: { properties: { title: { type: "string" }, emojis: { type: "array", items: { type: "string" } } } },
        }
      );
      const data = JSON.parse(res);
      if (data.title) setTitle(data.title);
      if (Array.isArray(data.emojis)) setSeq(data.emojis.slice(0, 16));
    } finally {
      setSuggesting(false);
    }
  }

  async function post() {
    if (!viewer || seq.length === 0) return;
    setBusy(true);
    try {
      await database.put({
        type: "recipe",
        title: title.trim() || "Untitled",
        emojis: seq,
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
      setSeq([]);
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  const c = {
    wrap: "border border-[oklch(0.37_0.03_260)] rounded-lg p-4 bg-[oklch(0.21_0.005_260)]",
    h: "text-xl font-semibold text-[oklch(0.93_0.006_265)]",
    canvas: "min-h-[56px] text-2xl tracking-wide p-3 rounded border border-[oklch(0.37_0.03_260)] bg-[oklch(0.17_0.000_0)]",
    palette: "grid grid-cols-9 gap-1 mt-3",
    chip: "text-xl min-h-[36px] rounded hover:bg-[oklch(0.27_0.01_260)] active:bg-[oklch(0.31_0.01_260)]",
    input:
      "w-full mt-3 bg-[oklch(0.17_0.000_0)] border border-[oklch(0.37_0.03_260)] rounded px-3 py-2 text-[oklch(0.93_0.006_265)]",
    row: "flex gap-2 mt-3",
    primary: "flex-1 min-h-[44px] rounded bg-[oklch(0.93_0.006_265)] text-[oklch(0.17_0.000_0)] font-semibold disabled:opacity-50",
    ghost:
      "min-h-[44px] px-3 rounded border border-[oklch(0.37_0.03_260)] text-[oklch(0.93_0.006_265)] text-sm disabled:opacity-50",
    spin: "inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin align-middle",
  };

  if (!viewer) {
    return (
      <section id="recipe-composer" className={c.wrap}>
        <h2 className={c.h}>Post a Recipe</h2>
        <p className="text-[oklch(0.71_0.02_261)] text-sm italic mt-2">Sign in to share a creation.</p>
      </section>
    );
  }

  return (
    <section id="recipe-composer" className={c.wrap}>
      <div className="flex items-center justify-between">
        <h2 className={c.h}>Post a Recipe</h2>
        <button onClick={suggest} disabled={suggesting} className={c.ghost}>
          {suggesting ? <span className={c.spin} /> : "✨ Inspire me"}
        </button>
      </div>
      <div className={c.canvas + " mt-3"}>
        {seq.length ? seq.join(" ") : <span className="text-[oklch(0.71_0.02_261)] text-sm italic">tap emoji below…</span>}
      </div>
      <div className={c.palette}>
        {PALETTE.map((e, i) => (
          <button key={i} onClick={() => setSeq((s) => [...s, e])} className={c.chip}>
            {e}
          </button>
        ))}
      </div>
      <div className={c.row}>
        <button onClick={() => setSeq((s) => s.slice(0, -1))} className={c.ghost}>
          ⌫
        </button>
        <button onClick={() => setSeq([])} className={c.ghost}>
          clear
        </button>
      </div>
      <input className={c.input} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className={c.row}>
        <button onClick={post} disabled={busy || seq.length === 0} className={c.primary}>
          {busy ? <span className={c.spin} /> : "Serve it up"}
        </button>
      </div>
    </section>
  );
}

function RecipeCard({ recipe, viewer, isOwner, database, votes, roasts, isPinned, onPin }) {
  const [roasting, setRoasting] = React.useState(false);
  const recipeVotes = votes.filter((v) => v.recipeId === recipe._id);
  const tally = recipeVotes.length;
  const myVote = viewer ? recipeVotes.find((v) => v.authorHandle === viewer.userHandle) : null;
  const roast = roasts.find((r) => r.recipeId === recipe._id);

  async function toggleVote() {
    if (!viewer) return;
    if (myVote) {
      await database.del(myVote._id);
    } else {
      await database.put({ type: "vote", recipeId: recipe._id, authorHandle: viewer.userHandle, createdAt: Date.now() });
    }
  }

  async function roastIt() {
    if (!viewer || roast) return;
    setRoasting(true);
    try {
      const res = await callAI(
        `You are a snarky food critic. Roast this emoji recipe: ${recipe.emojis.join(" ")} (title: "${recipe.title}"). Be witty, not cruel.`,
        {
          schema: {
            properties: {
              dishName: { type: "string", description: "an invented pretentious dish name" },
              roast: { type: "string", description: "1-2 sentence witty roast" },
              flames: { type: "number", description: "drama rating 1-5" },
            },
          },
        }
      );
      const data = JSON.parse(res);
      await database.put({
        type: "roast",
        recipeId: recipe._id,
        dishName: data.dishName || "Untitled Folly",
        roast: data.roast || "Words fail me.",
        flames: Math.max(1, Math.min(5, Math.round(data.flames || 3))),
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
    } finally {
      setRoasting(false);
    }
  }

  const c = {
    card: `border rounded-lg p-4 ${isPinned ? "border-[oklch(0.93_0.006_265)] bg-[oklch(0.23_0.01_260)]" : "border-[oklch(0.37_0.03_260)] bg-[oklch(0.21_0.005_260)]"}`,
    title: "text-lg font-semibold text-[oklch(0.93_0.006_265)]",
    emojis: "text-2xl mt-2 tracking-wide",
    meta: "text-xs text-[oklch(0.71_0.02_261)] italic mt-1 flex items-center gap-2",
    actions: "flex flex-wrap gap-2 mt-3",
    btn: "min-h-[44px] px-3 rounded border border-[oklch(0.37_0.03_260)] text-sm",
    voteOn: "bg-[oklch(0.93_0.006_265)] text-[oklch(0.17_0.000_0)] font-semibold",
    voteOff: "text-[oklch(0.93_0.006_265)]",
    roastBox: "mt-3 p-3 rounded border border-[oklch(0.37_0.03_260)] bg-[oklch(0.17_0.000_0)]",
    spin: "inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin",
  };

  return (
    <article className={c.card}>
      {isPinned && <div className="text-xs uppercase tracking-widest text-[oklch(0.71_0.02_261)] mb-1">★ Pinned winner</div>}
      <h3 className={c.title}>{recipe.title}</h3>
      <div className={c.emojis}>{recipe.emojis.join(" ")}</div>
      <div className={c.meta}>
        <span>by</span>
        <span className="not-italic">
          <ViewerTagInline handle={recipe.authorHandle} />
        </span>
      </div>
      <div className={c.actions}>
        <button onClick={toggleVote} disabled={!viewer} className={`${c.btn} ${myVote ? c.voteOn : c.voteOff}`}>
          👍 {tally}
        </button>
        <button onClick={roastIt} disabled={!viewer || !!roast || roasting} className={`${c.btn} ${c.voteOff}`}>
          {roasting ? <span className={c.spin} /> : roast ? "🔥 Roasted" : "🔥 Roast it"}
        </button>
        {isOwner && (
          <button onClick={() => onPin(recipe._id)} className={`${c.btn} ${c.voteOff}`}>
            {isPinned ? "Unpin" : "Pin as winner"}
          </button>
        )}
      </div>
      {roast && (
        <div className={c.roastBox}>
          <div className="text-sm font-semibold text-[oklch(0.93_0.006_265)]">"{roast.dishName}"</div>
          <div className="text-xs text-[oklch(0.71_0.02_261)] italic mb-1">{"🔥".repeat(roast.flames)}</div>
          <p className="text-sm text-[oklch(0.93_0.006_265)]">{roast.roast}</p>
        </div>
      )}
    </article>
  );
}

function ViewerTagInline({ handle }) {
  const { ViewerTag } = useViewer();
  return <ViewerTag userHandle={handle} />;
}

function RecipeFeed({ viewer, isOwner, database, recipes, votes, roasts, pinnedId }) {
  async function pin(recipeId) {
    if (pinnedId === recipeId) {
      const existing = await database.query("type", { key: "pin" });
      for (const row of existing.rows) await database.del(row.id);
    } else {
      const existing = await database.query("type", { key: "pin" });
      for (const row of existing.rows) await database.del(row.id);
      await database.put({ type: "pin", recipeId, pinnedAt: Date.now() });
    }
  }

  const unpinned = recipes.filter((r) => r._id !== pinnedId);

  return (
    <section id="recipe-feed" className="space-y-3">
      <h2 className="text-xl font-semibold text-[oklch(0.93_0.006_265)] px-1">The Feed</h2>
      {unpinned.length === 0 && (
        <p className="text-[oklch(0.71_0.02_261)] text-sm italic px-1">No recipes yet — be the first cook in.</p>
      )}
      {unpinned.map((r) => (
        <RecipeCard
          key={r._id}
          recipe={r}
          viewer={viewer}
          isOwner={isOwner}
          database={database}
          votes={votes}
          roasts={roasts}
          isPinned={false}
          onPin={pin}
        />
      ))}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("emojiKitchen");
  const { docs: recipes } = useLiveQuery("type", { key: "recipe", descending: true });
  const { docs: votes } = useLiveQuery("type", { key: "vote" });
  const { docs: roasts } = useLiveQuery("type", { key: "roast" });
  const { docs: pins } = useLiveQuery("type", { key: "pin", descending: true });
  const pinnedId = pins[0]?.recipeId;
  const pinnedRecipe = recipes.find((r) => r._id === pinnedId);

  const c = {
    page: "min-h-screen bg-[oklch(0.17_0.000_0)] text-[oklch(0.93_0.006_265)] font-serif",
    header:
      "sticky top-0 z-10 bg-[oklch(0.17_0.000_0)]/95 backdrop-blur border-b border-[oklch(0.37_0.03_260)] px-4 py-3 flex items-center justify-between",
    title: "text-2xl font-semibold tracking-wide",
    sub: "text-xs text-[oklch(0.71_0.02_261)] italic",
    main: "max-w-2xl mx-auto px-4 py-4 space-y-5 pb-24",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&display=optional');`}</style>
      <header id="app-header" className={c.header}>
        <div>
          <h1 className={c.title}>Emoji Kitchen Club</h1>
          <p className={c.sub}>{isOwner ? "you are the club leader" : "a snarky cooking salon"}</p>
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <PinnedWinner pinnedRecipe={pinnedRecipe} roasts={roasts} />
        <RecipeComposer viewer={viewer} database={database} />
        <RecipeFeed
          viewer={viewer}
          isOwner={isOwner}
          database={database}
          recipes={recipes}
          votes={votes}
          roasts={roasts}
          pinnedId={pinnedId}
        />
      </main>
    </div>
  );
}
