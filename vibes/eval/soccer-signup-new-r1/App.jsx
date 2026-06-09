function CoachPanel({ database }) {
  const [date, setDate] = React.useState("");
  const [opponent, setOpponent] = React.useState("");

  async function addGame(e) {
    e.preventDefault();
    if (!date || !opponent.trim()) return;
    await database.put({ type: "game", date, opponent: opponent.trim(), createdAt: Date.now() });
    setDate("");
    setOpponent("");
  }

  return (
    <section id="coach-panel" className="rounded-2xl bg-[oklch(0.30_0.15_295/0.5)] border border-[oklch(0.88_0.18_95/0.3)] p-4">
      <h2 className="font-['Fredoka'] text-lg text-[oklch(0.88_0.18_95)] mb-2">Coach Tools</h2>
      <form onSubmit={addGame} className="space-y-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white min-h-[44px]"
        />
        <input
          type="text"
          placeholder="Opponent (e.g. Tigers)"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white placeholder-white/40 min-h-[44px]"
        />
        <button
          type="submit"
          className="w-full bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)] font-bold py-3 rounded-lg min-h-[44px]"
        >
          Add game
        </button>
      </form>
    </section>
  );
}
