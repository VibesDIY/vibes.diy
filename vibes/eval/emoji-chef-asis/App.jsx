import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ComposeRecipe({ viewer, database }) {
  const [title, setTitle] = React.useState("");
  const [emojis, setEmojis] = React.useState("");
  const [suggesting, setSuggesting] = React.useState(false);

  async function suggest() {
    setSuggesting(true);
    try {
      const res = await callAI(
        "Invent one absurd recipe. Return a short whimsical title and an ingredient string made of 5-8 food emoji only (no text).",
        {
          schema: { properties: { title: { type: "string" }, emojis: { type: "string" } } },
        }
      );
      const parsed = JSON.parse(res);
      setTitle(parsed.title || "");
      setEmojis(parsed.emojis || "");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!viewer || !title.trim() || !emojis.trim()) return;
    await database.put({
      type: "recipe",
      title: title.trim(),
      emojis: emojis.trim(),
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    });
    setTitle("");
    setEmojis("");
  }

  const inp =
    "w-full bg-[oklch(0.17_0.000_0)] border border-[oklch(0.37_0.03_260)] rounded px-3 py-3 min-h-[44px] text-[oklch(0.93_0.006_265)] focus:outline-none focus:border-[oklch(0.71_0.02_261)]";
  const btn =
    "min-h-[44px] px-4 py-2 rounded border border-[oklch(0.37_0.03_260)] bg-[oklch(0.25_0.01_260)] hover:bg-[oklch(0.30_0.01_260)] disabled:opacity-50";

  return (
    <section
      id="compose"
      className="border border-[oklch(0.37_0.03_260)] rounded-lg p-4 bg-[oklch(0.20_0.005_260)]"
      style={{ fontFamily: "'Cormorant Garamond', serif" }}
    >
      <h2 className="text-2xl mb-3">Craft a Recipe</h2>
      {!viewer && <p className="italic text-[oklch(0.71_0.02_261)]">Sign in to publish your culinary nonsense.</p>}
      {viewer && (
        <form onSubmit={submit} className="space-y-3">
          <input className={inp} placeholder="Recipe title…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inp} placeholder="🍅🧄🌶️🍝…" value={emojis} onChange={(e) => setEmojis(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className={btn + " flex-1"}>
              Publish
            </button>
            <button type="button" onClick={suggest} disabled={suggesting} className={btn} title="AI suggestion">
              {suggesting ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
              ) : (
                "✨ Inspire"
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function RecipeFeed({ recipes, roasts, viewer, database, ViewerTag }) {
  const [roastingId, setRoastingId] = React.useState(null);
  const roastByRecipe = React.useMemo(() => {
    const m = {};
    for (const r of roasts) m[r.recipeId] = r;
    return m;
  }, [roasts]);

  async function roast(recipe) {
    if (!viewer) return;
    setRoastingId(recipe._id);
    try {
      const res = await callAI(
        `You are an acerbic, witty food critic. Roast this recipe brutally but cleverly. Title: "${recipe.title}". Ingredients: ${recipe.emojis}. Return a snarky verdict paragraph, scores 0-10 for creativity, plausibility, and deliciousness, and an overall rating out of 10.`,
        {
          schema: {
            properties: {
              verdict: { type: "string" },
              creativity: { type: "number" },
              plausibility: { type: "number" },
              deliciousness: { type: "number" },
              overall: { type: "number" },
            },
          },
        }
      );
      const parsed = JSON.parse(res);
      await database.put({ type: "roast", recipeId: recipe._id, ...parsed, createdAt: Date.now() });
    } finally {
      setRoastingId(null);
    }
  }

  const btn =
    "min-h-[44px] px-4 py-2 rounded border border-[oklch(0.37_0.03_260)] bg-[oklch(0.25_0.01_260)] hover:bg-[oklch(0.30_0.01_260)] disabled:opacity-50";

  return (
    <section id="feed" className="space-y-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
      <h2 className="text-2xl">The Kitchen</h2>
      {recipes.length === 0 && <p className="italic text-[oklch(0.71_0.02_261)]">No recipes yet. The kitchen is cold.</p>}
      <ul className="space-y-3">
        {recipes.map((r) => {
          const roastDoc = roastByRecipe[r._id];
          return (
            <li key={r._id} className="border border-[oklch(0.37_0.03_260)] rounded-lg p-4 bg-[oklch(0.20_0.005_260)]">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-xl">{r.title}</h3>
                  <ViewerTag userHandle={r.authorHandle} />
                </div>
                {roastDoc && (
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {roastDoc.overall}
                      <span className="text-base text-[oklch(0.71_0.02_261)]">/10</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-2xl tracking-wider my-2">{r.emojis}</p>
              {roastDoc ? (
                <div className="mt-3 pt-3 border-t border-[oklch(0.37_0.03_260)]">
                  <p className="italic text-[oklch(0.93_0.006_265)] mb-2">"{roastDoc.verdict}"</p>
                  <div className="flex gap-3 text-sm text-[oklch(0.71_0.02_261)]">
                    <span>Creativity {roastDoc.creativity}</span>
                    <span>Plausibility {roastDoc.plausibility}</span>
                    <span>Deliciousness {roastDoc.deliciousness}</span>
                  </div>
                </div>
              ) : viewer ? (
                <button onClick={() => roast(r)} disabled={roastingId === r._id} className={btn + " mt-2"}>
                  {roastingId === r._id ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                      </svg>
                      Critic tasting…
                    </span>
                  ) : (
                    "🔥 Roast This"
                  )}
                </button>
              ) : (
                <p className="text-sm italic text-[oklch(0.71_0.02_261)] mt-2">Sign in to summon the critic.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("emojiKitchen");
  const { docs: recipes } = useLiveQuery("type", { key: "recipe", descending: true });
  const { docs: roasts } = useLiveQuery("type", { key: "roast" });

  const c = {
    page: "min-h-screen bg-[oklch(0.17_0.000_0)] text-[oklch(0.93_0.006_265)]",
    wrap: "max-w-2xl mx-auto px-4 pb-24 pt-6",
    header: "flex items-center justify-between mb-6 pb-4 border-b border-[oklch(0.37_0.03_260)]",
    title: "text-3xl tracking-wide",
    muted: "text-[oklch(0.71_0.02_261)]",
    font: { fontFamily: "'Cormorant Garamond', serif" },
  };

  if (isViewerPending) return <div className={c.page} style={c.font} />;

  return (
    <div className={c.page} style={c.font}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=optional" rel="stylesheet" />
      <main id="app" className={c.wrap}>
        <header id="app-header" className={c.header}>
          <div>
            <h1 className={c.title}>Emoji Kitchen</h1>
            <p className={`text-sm italic ${c.muted}`}>Recipes in pictograms. Critics with teeth.</p>
          </div>
          <ViewerTag />
        </header>

        <div className="space-y-6">
          <ComposeRecipe viewer={viewer} database={database} />
          <RecipeFeed recipes={recipes} roasts={roasts} viewer={viewer} database={database} ViewerTag={ViewerTag} />
        </div>
      </main>
    </div>
  );
}
