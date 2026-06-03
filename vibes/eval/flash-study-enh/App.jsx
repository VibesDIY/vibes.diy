import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function DeckList({ c }) {
  return (
    <section id="deck-list" className={`${c.card} ${c.border} border rounded-2xl p-4`}>
      <h2 className={`${c.heading} text-lg font-semibold mb-3`}>Shared decks</h2>
      {/* deck list goes here */}
      <p className={`${c.muted} text-sm`}>Loading decks…</p>
    </section>
  );
}

function DeckCreator({ c, viewer, database, onCreated }) {
  const [title, setTitle] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [drafts, setDrafts] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  async function suggest() {
    if (!topic.trim()) return;
    setIsLoading(true);
    try {
      const res = await callAI(`Generate 5 flashcards (question + answer) for topic: ${topic}`, {
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
      const parsed = JSON.parse(res);
      setDrafts(parsed.cards || []);
      if (!title) setTitle(topic);
    } finally {
      setIsLoading(false);
    }
  }

  function updateDraft(i, field, val) {
    setDrafts(drafts.map((d, idx) => (idx === i ? { ...d, [field]: val } : d)));
  }
  function removeDraft(i) {
    setDrafts(drafts.filter((_, idx) => idx !== i));
  }

  async function createDeck(e) {
    e.preventDefault();
    if (!viewer || !title.trim()) return;
    const deckRes = await database.put({
      type: "deck",
      title: title.trim(),
      topic: topic.trim(),
      authorHandle: viewer.userHandle,
      createdAt: Date.now(),
    });
    for (const card of drafts) {
      if (!card.question?.trim()) continue;
      await database.put({
        type: "card",
        deckId: deckRes.id,
        question: card.question,
        answer: card.answer || "",
        authorHandle: viewer.userHandle,
        createdAt: Date.now(),
      });
    }
    setTitle("");
    setTopic("");
    setDrafts([]);
    onCreated && onCreated(deckRes.id);
  }

  if (!viewer) {
    return (
      <section id="deck-creator" className={`${c.card} ${c.border} border rounded-2xl p-4`}>
        <h2 className={`${c.heading} text-lg font-semibold mb-3`}>New deck</h2>
        <p className={`${c.muted} text-sm`}>Sign in to create a deck.</p>
      </section>
    );
  }

  return (
    <section id="deck-creator" className={`${c.card} ${c.border} border rounded-2xl p-4`}>
      <h2 className={`${c.heading} text-lg font-semibold mb-3`}>New deck</h2>
      <form onSubmit={createDeck} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deck title"
          className={`w-full border ${c.border} rounded-xl px-3 py-3 min-h-[44px]`}
        />
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (e.g. Spanish verbs)"
            className={`flex-1 border ${c.border} rounded-xl px-3 py-3 min-h-[44px]`}
          />
          <button
            type="button"
            onClick={suggest}
            disabled={isLoading || !topic.trim()}
            className={`${c.accent} px-3 py-3 rounded-xl text-sm font-medium min-h-[44px] disabled:opacity-50 flex items-center gap-1`}
          >
            {isLoading ? (
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 3 a9 9 0 1 1 -9 9" />
              </svg>
            ) : (
              "AI"
            )}
            <span>Suggest</span>
          </button>
        </div>
        {drafts.length > 0 && (
          <ul className="space-y-2">
            {drafts.map((d, i) => (
              <li key={i} className={`border ${c.border} rounded-xl p-2 space-y-1`}>
                <input
                  value={d.question}
                  onChange={(e) => updateDraft(i, "question", e.target.value)}
                  className="w-full text-sm font-medium bg-transparent outline-none"
                  placeholder="Question"
                />
                <input
                  value={d.answer}
                  onChange={(e) => updateDraft(i, "answer", e.target.value)}
                  className={`w-full text-sm bg-transparent outline-none ${c.muted}`}
                  placeholder="Answer"
                />
                <button type="button" onClick={() => removeDraft(i)} className={`${c.muted} text-xs`}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={!title.trim()}
          className={`w-full ${c.accent} rounded-xl py-3 font-medium min-h-[44px] disabled:opacity-50`}
        >
          Create deck{drafts.length ? ` with ${drafts.filter((d) => d.question?.trim()).length} cards` : ""}
        </button>
      </form>
    </section>
  );
}

function StudyMode({ c, viewer, deck, cards }) {
  const scoresDbName = viewer ? `flashsync-scores-${viewer.userHandle}` : "flashsync-scores-anon";
  const { useLiveQuery, database: scoresDb } = useFireproof(scoresDbName);
  const { docs: scores } = useLiveQuery("type", { key: "score" });
  const [idx, setIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);

  React.useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [deck?._id]);

  if (!deck) {
    return (
      <section id="study-mode" className={`${c.card} ${c.border} border rounded-2xl p-4`}>
        <h2 className={`${c.heading} text-lg font-semibold mb-3`}>Study</h2>
        <p className={`${c.muted} text-sm`}>Pick a deck below to start studying.</p>
      </section>
    );
  }

  const card = cards[idx];
  const deckScores = scores.filter((s) => s.deckId === deck._id);
  const rightCount = deckScores.filter((s) => s.result === "right").length;
  const wrongCount = deckScores.filter((s) => s.result === "wrong").length;

  async function record(result) {
    if (!card) return;
    await scoresDb.put({
      type: "score",
      deckId: deck._id,
      cardId: card._id,
      result,
      at: Date.now(),
    });
    setFlipped(false);
    setIdx((i) => (i + 1) % Math.max(cards.length, 1));
  }

  return (
    <section id="study-mode" className={`${c.card} ${c.border} border rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`${c.heading} text-lg font-semibold`}>{deck.title}</h2>
        <div className="text-xs flex gap-2">
          <span className="text-green-600">✓ {rightCount}</span>
          <span className="text-[#e63946]">✗ {wrongCount}</span>
        </div>
      </div>
      {cards.length === 0 ? (
        <p className={`${c.muted} text-sm`}>This deck has no cards yet.</p>
      ) : (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className={`w-full border-2 ${c.border} rounded-2xl p-6 min-h-[180px] text-center flex flex-col items-center justify-center mb-3 bg-white active:scale-[0.99]`}
          >
            <div className={`${c.muted} text-xs uppercase tracking-wide mb-2`}>
              {flipped ? "Answer" : "Question"} · {idx + 1}/{cards.length}
            </div>
            <div className="text-lg font-medium">{flipped ? card.answer : card.question}</div>
            {!flipped && <div className={`${c.muted} text-xs mt-3`}>tap to flip</div>}
          </button>
          {flipped ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => record("wrong")}
                className="bg-[#fde8ea] text-[#e63946] rounded-xl py-3 font-medium min-h-[44px]"
              >
                Got it wrong
              </button>
              <button
                onClick={() => record("right")}
                className="bg-green-100 text-green-700 rounded-xl py-3 font-medium min-h-[44px]"
              >
                Got it right
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIdx((i) => (i - 1 + cards.length) % cards.length);
                  setFlipped(false);
                }}
                className={`flex-1 border ${c.border} rounded-xl py-3 min-h-[44px]`}
              >
                Prev
              </button>
              <button
                onClick={() => {
                  setIdx((i) => (i + 1) % cards.length);
                  setFlipped(false);
                }}
                className={`flex-1 border ${c.border} rounded-xl py-3 min-h-[44px]`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("flashsync");
  const { docs: decks } = useLiveQuery("type", { key: "deck", descending: true });
  const { docs: cards } = useLiveQuery("type", { key: "card" });
  const [selectedDeckId, setSelectedDeckId] = React.useState(null);

  const cardsByDeck = React.useMemo(() => {
    const m = {};
    for (const card of cards) {
      if (!m[card.deckId]) m[card.deckId] = [];
      m[card.deckId].push(card);
    }
    return m;
  }, [cards]);

  async function handleDeleteDeck(deck) {
    if (!confirm(`Delete deck "${deck.title}"?`)) return;
    const deckCards = cardsByDeck[deck._id] || [];
    for (const card of deckCards) await database.del(card._id);
    await database.del(deck._id);
    if (selectedDeckId === deck._id) setSelectedDeckId(null);
  }

  const c = {
    page: "bg-[#fafafa] text-[#212121]",
    card: "bg-white",
    border: "border-[#ededed]",
    heading: "text-[#212121]",
    muted: "text-[#a8a8a8]",
    accent: "bg-[#e63946] text-white",
    accentText: "text-[#e63946]",
    chip: "bg-[#fde8ea] text-[#e63946]",
  };

  if (isViewerPending) return null;

  return (
    <main id="app" className={`${c.page} min-h-screen pb-24`}>
      <header
        id="app-header"
        className={`${c.card} ${c.border} border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between`}
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight">FlashSync</h1>
          <p className={`${c.muted} text-xs`}>Study together, score privately</p>
        </div>
        <ViewerTag />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <StudyMode
          c={c}
          viewer={viewer}
          deck={decks.find((d) => d._id === selectedDeckId)}
          cards={cardsByDeck[selectedDeckId] || []}
        />
        <DeckList
          c={c}
          decks={decks}
          cardsByDeck={cardsByDeck}
          selectedDeckId={selectedDeckId}
          onSelect={setSelectedDeckId}
          onDelete={handleDeleteDeck}
          viewer={viewer}
          isOwner={isOwner}
        />
        <DeckCreator c={c} viewer={viewer} database={database} onCreated={setSelectedDeckId} />
      </div>
    </main>
  );
}
