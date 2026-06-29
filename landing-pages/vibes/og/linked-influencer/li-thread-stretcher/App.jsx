import React, { useState } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "min-h-screen bg-[#f5f2e8] p-6 font-['Space_Grotesk',sans-serif]",
  header: "max-w-3xl mx-auto mb-6",
  title: "text-3xl font-bold uppercase tracking-tight",
  feature: "max-w-3xl mx-auto mb-4 p-4 bg-white border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0px_#1a1a2e]",
  featureTitle: "text-lg font-bold uppercase mb-2",
};

function SeedInput({ seed, setSeed, onStretch, onSuggest, isLoading, isSuggesting }) {
  return (
    <section id="seed-input" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Your Thought</h2>
      <textarea
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        placeholder="e.g. I drank coffee this morning."
        className="w-full p-3 border-[3px] border-[#1a1a2e] rounded font-mono text-sm mb-3 min-h-[80px]"
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onStretch}
          disabled={isLoading || !seed.trim()}
          className="px-4 py-2 bg-[#e63946] text-white font-bold uppercase text-xs tracking-wider border-[3px] border-[#1a1a2e] rounded shadow-[4px_4px_0px_#1a1a2e] disabled:opacity-50"
        >
          {isLoading ? "Stretching..." : "Stretch It"}
        </button>
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          className="px-4 py-2 bg-[#f4d35e] text-[#1a1a2e] font-bold uppercase text-xs tracking-wider border-[3px] border-[#1a1a2e] rounded shadow-[3px_3px_0px_#1a1a2e] disabled:opacity-50"
        >
          {isSuggesting ? "..." : "Suggest Seed"}
        </button>
      </div>
    </section>
  );
}

function CurrentThread({ thread }) {
  if (!thread) {
    return (
      <section id="current-thread" className={classNames.feature}>
        <h2 className={classNames.featureTitle}>The Thread</h2>
        <p className="text-sm text-[#6b6b7b] italic">No thread yet. Feed the machine a thought.</p>
      </section>
    );
  }
  return (
    <section id="current-thread" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>The Thread</h2>
      <p className="text-xs uppercase tracking-[0.15em] text-[#6b6b7b] mb-3">Seed: "{thread.seed}"</p>
      <ol className="space-y-3">
        {thread.parts?.map((p, i) => (
          <li key={i} className="p-3 bg-[#f5f2e8] border-[3px] border-[#1a1a2e] rounded font-mono text-sm whitespace-pre-wrap">
            <span className="font-bold">{i + 1}. </span>{p}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ThreadArchive({ threads, onOpen }) {
  return (
    <section id="thread-archive" className={classNames.feature}>
      <h2 className={classNames.featureTitle}>Past Threads</h2>
      {threads.length === 0 ? (
        <p className="text-sm text-[#6b6b7b] italic">Your archive of wisdom will appear here.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t._id}>
              <button
                onClick={() => onOpen(t)}
                className="w-full text-left p-3 bg-[#f5f2e8] border-[3px] border-[#1a1a2e] rounded hover:bg-[#f4d35e] transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_#1a1a2e]"
              >
                <div className="font-bold text-sm truncate">{t.seed}</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#6b6b7b] mt-1 font-mono">
                  {new Date(t.createdAt).toLocaleString()} · {t.parts?.length || 0} parts
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>

      <SeedInput />
      <CurrentThread />
      <ThreadArchive />
    </main>
  );
}