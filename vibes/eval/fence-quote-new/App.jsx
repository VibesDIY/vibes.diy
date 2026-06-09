import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function StyleBuilder() {
  return (
    <section id="style-builder" className="p-5 bg-white border-2 border-black rounded-lg">
      <h2 className="text-xl font-bold mb-3">1. Choose your fence</h2>
      <p className="text-sm text-neutral-600">Pick a style and enter measurements.</p>
    </section>
  );
}

function QuoteForm({ viewer, name, setName, phone, setPhone, submit, isSubmitting, submitted, setSubmitted, ViewerTag }) {
  if (submitted) {
    return (
      <section id="quote-form" className="p-5 bg-[#eaff5a] border-2 border-black rounded-lg space-y-3">
        <h2 className="text-xl font-bold">Thanks — we got it!</h2>
        <p className="text-sm">Our sales team will reach out shortly.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="min-h-[44px] px-4 bg-black text-[#eaff5a] font-semibold rounded border-2 border-black"
        >
          Submit another
        </button>
      </section>
    );
  }
  return (
    <section id="quote-form" className="p-5 bg-[#eaff5a] border-2 border-black rounded-lg space-y-3">
      <h2 className="text-xl font-bold">2. Request your quote</h2>
      {!viewer ? (
        <div className="space-y-2">
          <p className="text-sm">Sign in to submit a quote request.</p>
          <ViewerTag />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-sm font-semibold">Your name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 border-2 border-black rounded bg-white"
              placeholder="Jane Smith"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 border-2 border-black rounded bg-white"
              placeholder="(555) 123-4567"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[52px] bg-black text-[#eaff5a] font-bold uppercase tracking-wide rounded border-2 border-black disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg
                className="animate-spin"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {isSubmitting ? "Submitting..." : "Send request"}
          </button>
        </form>
      )}
    </section>
  );
}

const STATUSES = ["new", "contacted", "quoted", "closed"];

function SalesDashboard({ requests, database, ViewerTag }) {
  return (
    <section id="sales-dashboard" className="p-5 bg-black text-white border-2 border-black rounded-lg space-y-3">
      <h2 className="text-xl font-bold">Sales Dashboard ({requests.length})</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-neutral-300">No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r._id} className="p-3 bg-neutral-900 border border-neutral-700 rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold">{r.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded font-semibold ${r.enrichment?.priority === "high" ? "bg-red-500 text-white" : r.enrichment?.priority === "low" ? "bg-neutral-600" : "bg-[#eaff5a] text-black"}`}
                >
                  {r.enrichment?.priority || "normal"}
                </span>
              </div>
              <div className="text-sm">
                <a href={`tel:${r.phone}`} className="text-[#eaff5a] underline">
                  {r.phone}
                </a>
              </div>
              <div className="text-sm text-neutral-300">
                {r.style} · {r.feet} ft · {r.gates} gate{r.gates === 1 ? "" : "s"} ·{" "}
                <span className="font-bold text-white">${r.estimate.toLocaleString()}</span>
              </div>
              {r.enrichment?.priceRange && <div className="text-xs text-neutral-400">Range: {r.enrichment.priceRange}</div>}
              {r.enrichment?.materialNotes && <div className="text-xs text-neutral-400 italic">{r.enrichment.materialNotes}</div>}
              <div className="flex gap-1 flex-wrap pt-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => database.put({ ...r, status: s })}
                    className={`text-xs px-2 py-1 rounded border ${r.status === s ? "bg-[#eaff5a] text-black border-[#eaff5a] font-bold" : "bg-transparent text-neutral-300 border-neutral-600"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <ViewerTag userHandle={r.authorHandle} />
                <span>· {new Date(r.createdAt).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database, useLiveQuery } = useFireproof("fenceQuotes");
  const [style, setStyle] = React.useState("wood");
  const [feet, setFeet] = React.useState("");
  const [gates, setGates] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [name, setName] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const selectedStyle = STYLES.find((s) => s.id === style);
  const ft = Math.max(0, parseFloat(feet) || 0);
  const gt = Math.max(0, parseInt(gates) || 0);
  const estimate = Math.round(ft * selectedStyle.perFoot + gt * GATE_COST);

  const { docs: requests } = useLiveQuery("type", { key: "quoteRequest", descending: true });

  async function submitQuote() {
    if (!viewer || !phone.trim() || !name.trim() || ft <= 0) return;
    setIsSubmitting(true);
    try {
      let enrichment = { priceRange: `$${estimate}`, materialNotes: "", priority: "normal" };
      try {
        const res = await callAI(
          `Fence quote: ${selectedStyle.label}, ${ft} linear feet, ${gt} gates, base estimate $${estimate}. Give a price range, material notes, and priority tag (low/normal/high).`,
          {
            schema: {
              properties: {
                priceRange: { type: "string" },
                materialNotes: { type: "string" },
                priority: { type: "string" },
              },
            },
          }
        );
        enrichment = JSON.parse(res);
      } catch (e) {}
      await database.put({
        type: "quoteRequest",
        authorHandle: viewer.userHandle,
        name: name.trim(),
        phone: phone.trim(),
        style: selectedStyle.label,
        feet: ft,
        gates: gt,
        estimate,
        enrichment,
        status: "new",
        createdAt: Date.now(),
      });
      setSubmitted(true);
      setPhone("");
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const c = {
    page: "min-h-screen bg-[#e0e0e0] text-black",
    header: "sticky top-0 z-10 bg-black text-white px-4 py-3 flex items-center justify-between border-b-4 border-[#eaff5a]",
    title: "text-lg font-bold tracking-tight uppercase",
    main: "max-w-2xl mx-auto p-4 space-y-4 pb-24",
  };

  if (isViewerPending) return null;

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <h1 className={c.title}>Slab Fence Co.</h1>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        <StyleBuilder
          style={style}
          setStyle={setStyle}
          feet={feet}
          setFeet={setFeet}
          gates={gates}
          setGates={setGates}
          estimate={estimate}
        />
        <QuoteForm
          viewer={viewer}
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          submit={submitQuote}
          isSubmitting={isSubmitting}
          submitted={submitted}
          setSubmitted={setSubmitted}
          ViewerTag={ViewerTag}
        />
        {isOwner && <SalesDashboard requests={requests} database={database} ViewerTag={ViewerTag} />}
      </main>
    </div>
  );
}
