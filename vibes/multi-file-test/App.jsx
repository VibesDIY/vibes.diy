import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"
import ListItem from "./ListItem.jsx"
import { formatDate, sortByCreated } from "./helper.js"

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useLiveQuery, useDocument } = useFireproof("todo-flow");
  const { doc, merge, submit } = useDocument({ text: "", completed: false, createdAt: Date.now(), type: "todo" });
  const { docs: allTodos } = useLiveQuery("type", { key: "todo" });
  const todos = sortByCreated(allTodos);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  async function suggestNext() {
    setIsSuggesting(true);
    try {
      const existing = todos.map(t => t.text).join(", ") || "nothing yet";
      const response = await callAI(
        `Existing todos: ${existing}. Suggest ONE short follow-up task (under 8 words).`,
        { schema: { properties: { task: { type: "string" } } } }
      );
      const { task } = JSON.parse(response);
      if (task) merge({ text: task });
    } finally {
      setIsSuggesting(false);
    }
  }

  const c = {
    page: "min-h-screen bg-[#f5efe6] text-[#2a2418] font-sans pb-24",
    header: "bg-[#2a2418] text-[#f5efe6] px-5 py-6 shadow-md",
    title: "text-3xl font-bold tracking-tight",
    tagline: "text-sm text-[#d4b886] mt-1",
    main: "max-w-xl mx-auto px-4 py-6 space-y-6",
    section: "bg-white rounded-2xl border border-[#e8dcc4] shadow-sm p-5",
    h2: "text-lg font-semibold text-[#2a2418] mb-3",
    input: "w-full px-4 py-3 rounded-xl border border-[#e8dcc4] bg-[#fdfaf3] focus:outline-none focus:border-[#c9a35e] min-h-[44px]",
    btn: "px-4 py-3 rounded-xl bg-[#c9a35e] text-white font-medium min-h-[44px] hover:bg-[#b08d4a] disabled:opacity-50",
    btnGhost: "px-3 py-2 rounded-lg border border-[#e8dcc4] text-sm text-[#6b5d42] hover:bg-[#fdfaf3]",
    row: "flex items-center gap-3 py-3 border-b border-[#f0e6d2] last:border-0",
    empty: "text-sm text-[#9b8b6a] italic py-4 text-center",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Todo Flow</h1>
        <p className={c.tagline}>Real-time tasks with AI suggestions</p>
      </header>
      <main id="app" className={c.main}>
        <section id="add-task" className={c.section}>
          <h2 className={c.h2}>Create busywork</h2>
          {can("write") ? (
            <form className="space-y-3" onSubmit={submit}>
              <input
                className={c.input}
                placeholder="What needs doing?"
                value={doc.text}
                onChange={(e) => merge({ text: e.target.value })}
              />
              <div className="flex gap-2">
                <button type="submit" className={c.btn} disabled={!doc.text.trim()}>Add</button>
                <button type="button" className={c.btnGhost} onClick={suggestNext} disabled={isSuggesting}>
                  {isSuggesting ? (
                    <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                    </svg>
                  ) : "Suggest"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[#9b8b6a]">Read-only view — contact the owner for write access.</p>
          )}
        </section>
        <section id="task-list" className={c.section}>
          <h2 className={c.h2}>Your tasks ({todos.length})</h2>
          {todos.length === 0 ? (
            <p className={c.empty}>No tasks yet — add one above.</p>
          ) : (
            <ul>
              {todos.map((todo) => (
                <ListItem
                  key={todo._id}
                  todo={todo}
                  canWrite={can("write")}
                  onToggle={() => database.put({ ...todo, completed: !todo.completed })}
                  onDelete={() => database.del(todo._id)}
                  formatDate={formatDate}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}