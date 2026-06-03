import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const LEGENDS = [
  {
    id: "cleopatra",
    name: "Cleopatra VII",
    era: "69–30 BCE",
    realm: "Egypt",
    persona: "the last pharaoh of Ptolemaic Egypt, shrewd, multilingual, politically cunning",
  },
  {
    id: "socrates",
    name: "Socrates",
    era: "470–399 BCE",
    realm: "Athens",
    persona: "the Athenian philosopher who answers questions with questions, probing assumptions",
  },
  {
    id: "davinci",
    name: "Leonardo da Vinci",
    era: "1452–1519",
    realm: "Florence",
    persona: "the Renaissance polymath, curious about anatomy, flight, water, and light",
  },
  {
    id: "ada",
    name: "Ada Lovelace",
    era: "1815–1852",
    realm: "London",
    persona: "the mathematician who envisioned computing as poetical science, precise yet imaginative",
  },
  {
    id: "marcus",
    name: "Marcus Aurelius",
    era: "121–180 CE",
    realm: "Rome",
    persona: "the stoic emperor-philosopher, reflective, austere, focused on duty and virtue",
  },
  {
    id: "tubman",
    name: "Harriet Tubman",
    era: "1822–1913",
    realm: "America",
    persona: "the conductor of the Underground Railroad, fearless, devout, plainspoken",
  },
];

function Gallery({ legends, selectedId, onSelect, canSelect, c }) {
  return (
    <section id="gallery" className={`${c.frame} p-4`}>
      <h2 className={`${c.heading} text-sm tracking-[0.3em] uppercase mb-3`}>The Gallery</h2>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {legends.map((l) => {
          const active = l.id === selectedId;
          return (
            <li key={l.id}>
              <button
                disabled={!canSelect}
                onClick={() => onSelect(l.id)}
                className={`w-full min-h-[88px] p-3 text-left border ${active ? c.cardActive : c.card} ${canSelect ? "" : "opacity-60 cursor-not-allowed"} transition`}
              >
                <div className={`${c.legendName} text-base leading-tight`}>{l.name}</div>
                <div className={`${c.muted} text-[10px] tracking-widest uppercase mt-1`}>{l.era}</div>
                <div className={`${c.muted} text-[10px] mt-0.5`}>{l.realm}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Conversation({ messages, streaming, c, ViewerTag }) {
  const endRef = React.useRef(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);
  return (
    <section id="conversation" className={`${c.frame} p-4 min-h-[40vh]`}>
      <h2 className={`${c.heading} text-sm tracking-[0.3em] uppercase mb-3`}>The Dialogue</h2>
      {messages.length === 0 && !streaming && (
        <p className={`${c.muted} italic text-sm`}>No words yet have crossed the veil. Choose a voice and speak.</p>
      )}
      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={m._id} className={`p-3 border ${m.role === "user" ? c.userMsg : c.legendMsg}`}>
            <div className="flex items-center gap-2 mb-1">
              {m.role === "user" ? (
                <ViewerTag userHandle={m.authorHandle} />
              ) : (
                <span className={`${c.legendName} text-xs tracking-widest uppercase`}>{m.legendName}</span>
              )}
            </div>
            <p className={`${c.body} text-sm whitespace-pre-wrap`}>
              {m.text}
              {m.streaming ? <span className={c.cursor}>▌</span> : null}
            </p>
          </li>
        ))}
      </ul>
      <div ref={endRef} />
    </section>
  );
}

function Composer({ legend, onSend, onClear, sending, viewer, c }) {
  const [text, setText] = React.useState("");
  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !legend) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <section id="composer" className={`${c.frame} p-4`}>
      <h2 className={`${c.heading} text-sm tracking-[0.3em] uppercase mb-3`}>Your Words</h2>
      {!viewer && <p className={`${c.muted} italic text-sm`}>Sign in to speak with the legends. Others may witness.</p>}
      {viewer && !legend && <p className={`${c.muted} italic text-sm`}>Choose a voice from the gallery above.</p>}
      {viewer && legend && (
        <form onSubmit={handleSend} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Address ${legend.name}…`}
            rows={3}
            disabled={sending}
            className={`w-full p-3 ${c.input} text-sm resize-none`}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className={`flex-1 min-h-[44px] px-4 ${c.primary} disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {sending ? (
                <>
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                  </svg>
                  <span className="text-xs tracking-widest uppercase">Channeling…</span>
                </>
              ) : (
                <span className="text-xs tracking-widest uppercase">Send</span>
              )}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={sending}
              className={`min-h-[44px] px-4 ${c.secondary} disabled:opacity-50 text-xs tracking-widest uppercase`}
            >
              Clear
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database } = useFireproof("chronicleOfVoices");
  const [selectedId, setSelectedId] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  const { docs: messages } = useLiveQuery("createdAt", { descending: false });
  const legend = LEGENDS.find((l) => l.id === selectedId);
  const streaming = messages.some((m) => m.streaming);

  async function sendMessage(text) {
    if (!viewer || !legend) return;
    setSending(true);
    const createdAt = Date.now();
    await database.put({
      role: "user",
      text,
      authorHandle: viewer.userHandle,
      legendId: legend.id,
      createdAt,
    });
    const replyDoc = await database.put({
      role: "legend",
      text: "",
      streaming: true,
      legendId: legend.id,
      legendName: legend.name,
      createdAt: createdAt + 1,
    });
    try {
      const history = messages
        .filter((m) => m.legendId === legend.id)
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      const prompt = [
        {
          role: "system",
          content: `You are ${legend.name} (${legend.era}), ${legend.persona}. Speak in first person, in character, with the cadence and concerns of your era. Keep replies to 2-4 sentences unless asked for more.`,
        },
        ...history,
        { role: "user", content: text },
      ];
      const stream = await callAI(prompt, { stream: true });
      let accumulated = "";
      for await (const chunk of stream) {
        accumulated = chunk;
        const current = await database.get(replyDoc.id);
        await database.put({ ...current, text: accumulated });
      }
      const final = await database.get(replyDoc.id);
      await database.put({ ...final, text: accumulated, streaming: false });
    } catch (err) {
      const current = await database.get(replyDoc.id);
      await database.put({ ...current, text: "The voice falters and fades…", streaming: false });
    } finally {
      setSending(false);
    }
  }

  async function clearAll() {
    for (const m of messages) await database.del(m._id);
  }

  const c = {
    page: "min-h-screen bg-[#0f0f0f] text-[#e5e5e5]",
    header: "border-b border-[#5a4a2a] bg-[#1a1a1a]",
    title: "text-[#f5e9b8]",
    subtitle: "text-[#8a8a8a]",
    frame: "bg-[#1a1a1a] border border-[#3d3d3d]",
    heading: "text-[#c9a857] font-semibold",
    card: "bg-[#262626] border-[#3d3d3d] text-[#e5e5e5] hover:border-[#c9a857]",
    cardActive: "bg-[#3a2a1a] border-[#c9a857] text-[#f5e9b8]",
    legendName: "text-[#c9a857] font-semibold",
    legendMsg: "bg-[#2a1f12] border-[#5a4a2a]",
    userMsg: "bg-[#1f1a14] border-[#3d3d3d]",
    body: "text-[#e5e5e5]",
    muted: "text-[#8a8a8a]",
    input: "bg-[#0f0f0f] border border-[#3d3d3d] text-[#e5e5e5] placeholder-[#6a6a6a] focus:border-[#c9a857] outline-none",
    primary: "bg-[#c9a857] text-[#1a1a1a] hover:bg-[#f5e9b8] font-semibold",
    secondary: "bg-[#3d2a2a] text-[#e5e5e5] hover:bg-[#5a3a3a] border border-[#5a4a2a]",
    cursor: "text-[#c9a857] animate-pulse ml-0.5",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page} style={{ fontFamily: "Cinzel, serif" }}>
      <header id="app-header" className={`${c.header} px-4 py-5 sticky top-0 z-10`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className={`${c.title} text-xl md:text-2xl tracking-[0.25em] uppercase`}>Chronicle of Voices</h1>
            <p className={`${c.subtitle} text-[10px] tracking-widest uppercase mt-1`}>Converse across the centuries</p>
          </div>
          <ViewerTag />
        </div>
      </header>
      <main id="app" className="max-w-3xl mx-auto p-4 space-y-4 pb-24">
        <Gallery legends={LEGENDS} selectedId={selectedId} onSelect={setSelectedId} canSelect={!!viewer && !sending} c={c} />
        <Conversation messages={messages} streaming={streaming} c={c} ViewerTag={ViewerTag} />
        <Composer legend={legend} onSend={sendMessage} onClear={clearAll} sending={sending} viewer={viewer} c={c} />
        {isOwner && messages.length > 0 && (
          <p className={`${c.muted} text-[10px] text-center tracking-widest uppercase`}>
            Owner view — others see this dialogue in read-only
          </p>
        )}
      </main>
    </div>
  );
}
