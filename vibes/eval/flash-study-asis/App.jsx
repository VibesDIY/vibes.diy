import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function GenerateDeck({ database, isOwner, viewer }) {
  const [topic, setTopic] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function generate() {
    if (!topic.trim() || !viewer) return;
    setLoading(true);
    try {
      const res = await callAI(`Create 8 flashcards for studying: ${topic}. Each card has a clear question and concise answer.`, {
        schema: {
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                },
              },
            },
          },
        },
      });
      const { cards } = JSON.parse(res);
      const deckRes = await database.put({
        type: "deck",
        topic: topic.trim(),
        createdAt: Date.now(),
        order: cards.map((_, i) => i),
      });
      await Promise.all(
        cards.map((card, i) =>
          database.put({ type: "card", deckId: deckRes.id, question: card.question, answer: card.answer, index: i })
        )
      );
      setTopic("");
    } finally {
      setLoading(false);
    }
  }

  async function suggest() {
    setLoading(true);
    try {
      const res = await callAI("Suggest one interesting study topic for flashcards. Just the topic name.", {
        schema: { properties: { topic: { type: "string" } } },
      });
      setTopic(JSON.parse(res).topic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="generate" className="bg-[oklch(1.00_0_0)] rounded-[32px] p-5 border border-[oklch(0_0_0/0.10)]">
      <h2 className="text-lg font-semibold mb-3">New deck</h2>
      {isOwner ? (
        <div className="space-y-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis"
            className="w-full px-4 py-3 min-h-[44px] rounded-[100px] border border-[oklch(0_0_0/0.10)] bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={loading || !topic.trim()}
              className="flex-1 min-h-[44px] bg-[oklch(0_0_0)] text-[oklch(1_0_0)] rounded-[100px] font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg
                  className="animate-spin"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
              ) : (
                "Generate deck"
              )}
            </button>
            <button
              onClick={suggest}
              disabled={loading}
              className="px-4 min-h-[44px] rounded-[100px] border border-[oklch(0_0_0/0.10)] text-sm"
            >
              Suggest
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[oklch(0_0_0/0.50)]">Only the owner can create decks.</p>
      )}
    </section>
  );
}

function DeckList({ decks, selectedId, onSelect }) {
  return (
    <section id="decks" className="bg-[oklch(1.00_0_0)] rounded-[32px] p-5 border border-[oklch(0_0_0/0.10)]">
      <h2 className="text-lg font-semibold mb-3">Your decks</h2>
      {decks.length === 0 ? (
        <p className="text-sm text-[oklch(0_0_0/0.50)]">No decks yet — generate one above.</p>
      ) : (
        <ul className="space-y-2">
          {decks.map((d) => (
            <li key={d._id}>
              <button
                onClick={() => onSelect(d._id)}
                className={`w-full text-left px-4 py-3 min-h-[44px] rounded-[24px] border ${selectedId === d._id ? "bg-[oklch(0.89_0.20_110)] border-[oklch(0_0_0)]" : "border-[oklch(0_0_0/0.10)]"}`}
              >
                <div className="font-medium">{d.topic}</div>
                <div className="text-xs text-[oklch(0_0_0/0.50)]">{new Date(d.createdAt).toLocaleDateString()}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardViewer({ database, deck, cards, isOwner, viewer, progress }) {
  const [idx, setIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);

  React.useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [deck?._id]);

  if (!deck) {
    return (
      <section id="cards" className="bg-[oklch(0.13_0_0)] text-[oklch(1_0_0)] rounded-[32px] p-5 border border-[oklch(1_0_0/0.20)]">
        <h2 className="text-lg font-semibold mb-3">Study</h2>
        <p className="text-sm text-[oklch(1_0_0/0.50)]">Select a deck to start studying.</p>
      </section>
    );
  }

  const order = deck.order || cards.map((_, i) => i);
  const orderedCards = order.map((i) => cards.find((c) => c.index === i)).filter(Boolean);
  const current = orderedCards[idx];
  const learnedIds = new Set(progress.map((p) => p.cardId));
  const isLearned = current && learnedIds.has(current._id);

  async function shuffle() {
    const newOrder = [...order].sort(() => Math.random() - 0.5);
    await database.put({ ...deck, order: newOrder });
    setIdx(0);
    setFlipped(false);
  }

  async function toggleLearned() {
    if (!viewer || !current) return;
    const existing = progress.find((p) => p.cardId === current._id);
    if (existing) {
      await database.del(existing._id);
    } else {
      await database.put({
        type: "progress",
        cardId: current._id,
        deckId: deck._id,
        userHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
    }
  }

  return (
    <section id="cards" className="bg-[oklch(0.13_0_0)] text-[oklch(1_0_0)] rounded-[32px] p-5 border border-[oklch(1_0_0/0.20)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{deck.topic}</h2>
        <span className="text-xs text-[oklch(1_0_0/0.50)]">
          {idx + 1} / {orderedCards.length}
        </span>
      </div>
      {current ? (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="w-full min-h-[180px] bg-[oklch(1_0_0/0.05)] border border-[oklch(1_0_0/0.20)] rounded-[24px] p-6 text-left mb-3 flex items-center justify-center"
          >
            <div>
              <div className="text-xs uppercase tracking-wider text-[oklch(1_0_0/0.50)] mb-2">
                {flipped ? "Answer" : "Question"}
              </div>
              <div className="text-lg">{flipped ? current.answer : current.question}</div>
            </div>
          </button>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                setIdx((i) => Math.max(0, i - 1));
                setFlipped(false);
              }}
              disabled={idx === 0}
              className="flex-1 min-h-[44px] rounded-[100px] border border-[oklch(1_0_0/0.20)] disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => {
                setIdx((i) => Math.min(orderedCards.length - 1, i + 1));
                setFlipped(false);
              }}
              disabled={idx === orderedCards.length - 1}
              className="flex-1 min-h-[44px] rounded-[100px] border border-[oklch(1_0_0/0.20)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
          <div className="flex gap-2">
            {viewer && (
              <button
                onClick={toggleLearned}
                className={`flex-1 min-h-[44px] rounded-[100px] font-medium ${isLearned ? "bg-[oklch(0.89_0.20_110)] text-[oklch(0_0_0)]" : "border border-[oklch(1_0_0/0.20)]"}`}
              >
                {isLearned ? "Learned ✓" : "Mark learned"}
              </button>
            )}
            {isOwner && (
              <button onClick={shuffle} className="px-4 min-h-[44px] rounded-[100px] border border-[oklch(1_0_0/0.20)]">
                Shuffle
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-[oklch(1_0_0/0.50)]">No cards in this deck.</p>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("flipDeck");
  const [selectedId, setSelectedId] = React.useState(null);

  const { docs: decks } = useLiveQuery("type", { key: "deck", descending: true });
  const { docs: allCards } = useLiveQuery("type", { key: "card" });
  const { docs: allProgress } = useLiveQuery("type", { key: "progress" });

  const deck = decks.find((d) => d._id === selectedId) || decks[0];
  const cards = deck ? allCards.filter((c) => c.deckId === deck._id) : [];
  const progress = viewer && deck ? allProgress.filter((p) => p.deckId === deck._id && p.userHandle === viewer.userHandle) : [];

  const c = {
    page: "min-h-screen bg-[oklch(0_0_0)] text-[oklch(0_0_0)] px-4 py-6",
    shell: "max-w-md mx-auto space-y-4",
    header: "flex items-center justify-between bg-[oklch(0.89_0.20_110)] rounded-[100px] px-5 py-3",
    title: "text-xl font-bold tracking-tight",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <main id="app" className={c.shell}>
        <header id="app-header" className={c.header}>
          <h1 className={c.title}>Flip Deck</h1>
          <ViewerTag />
        </header>
        <GenerateDeck database={database} isOwner={isOwner} viewer={viewer} />
        <DeckList decks={decks} selectedId={deck?._id} onSelect={setSelectedId} />
        <CardViewer database={database} deck={deck} cards={cards} isOwner={isOwner} viewer={viewer} progress={progress} />
      </main>
    </div>
  );
}
