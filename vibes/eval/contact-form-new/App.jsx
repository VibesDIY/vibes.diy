import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function ContactForm() {
  return (
    <section id="contact-form" className="bg-white/95 rounded-2xl p-5 shadow-xl border border-white/20">
      <h2 className="font-[Fredoka] text-2xl text-[oklch(0.25_0.16_295)] mb-1">Request a Quote</h2>
      <p className="text-sm text-[oklch(0.25_0.16_295)]/70 mb-4">Tell us what you need — we'll call you back.</p>
      {/* form lands here */}
    </section>
  );
}

const STATUSES = ["new", "called", "scheduled", "done"];
const PRIORITY_COLORS = {
  urgent: "bg-[oklch(0.55_0.20_25)] text-white",
  high: "bg-[oklch(0.88_0.18_95)] text-[oklch(0.25_0.16_295)]",
  normal: "bg-[oklch(0.70_0.15_155)] text-[oklch(0.25_0.16_295)]",
  low: "bg-white/20 text-white",
};

function OwnerDashboard({ database }) {
  const { useLiveQuery } = useFireproof("greenleaf");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const requests = docs.filter((d) => d.type === "request");

  function cycleStatus(doc) {
    const idx = STATUSES.indexOf(doc.status || "new");
    const next = STATUSES[(idx + 1) % STATUSES.length];
    database.put({ ...doc, status: next });
  }

  return (
    <section id="owner-dashboard" className="mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-[Fredoka] text-2xl text-white">Incoming Requests</h2>
        <span className="text-[oklch(0.70_0.15_155)] text-sm font-semibold">{requests.length}</span>
      </div>
      {requests.length === 0 && (
        <div className="bg-[oklch(0.38_0.17_295_/_0.4)] rounded-2xl p-5 border border-white/10 text-white/70 text-sm">
          No requests yet. They'll show up here in real time.
        </div>
      )}
      <ul className="space-y-3">
        {requests.map((r) => (
          <li key={r._id} className="bg-[oklch(0.38_0.17_295_/_0.4)] rounded-2xl p-4 border border-white/10 text-white">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-[Fredoka] text-lg leading-tight">{r.name}</div>
                <a
                  href={`tel:${r.phone}`}
                  className="text-[oklch(0.70_0.15_155)] text-sm font-semibold inline-flex items-center gap-1 mt-0.5"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {r.phone}
                </a>
              </div>
              <button
                onClick={() => cycleStatus(r)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-[oklch(0.25_0.16_295)] min-h-[32px] capitalize"
              >
                {r.status || "new"}
              </button>
            </div>
            <p className="text-sm text-white/90 mb-3">{r.description}</p>
            <div className="flex flex-wrap gap-2 items-center">
              {r.serviceType && (
                <span className="text-xs px-2 py-1 rounded-full bg-white/15 text-white capitalize">
                  {r.serviceType.replace("-", " ")}
                </span>
              )}
              {r.priority && (
                <span
                  className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.normal}`}
                >
                  {r.priority}
                </span>
              )}
              <span className="text-xs text-white/50 ml-auto">{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContactForm({ database }) {
  const { useDocument } = useFireproof("greenleaf");
  const { doc, merge, save, reset } = useDocument({
    type: "request",
    name: "",
    phone: "",
    description: "",
    status: "new",
    serviceType: "",
    priority: "",
    createdAt: 0,
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!doc.name.trim() || !doc.phone.trim() || !doc.description.trim()) return;
    setIsLoading(true);
    let tags = { serviceType: "general", priority: "normal" };
    try {
      const resp = await callAI(
        `Categorize this landscaping request. Description: "${doc.description}". Return serviceType (one of: mowing, tree-removal, irrigation, hardscaping, cleanup, planting, general) and priority (low, normal, high, urgent).`,
        {
          schema: {
            properties: {
              serviceType: { type: "string" },
              priority: { type: "string" },
            },
          },
        }
      );
      tags = JSON.parse(resp);
    } catch (err) {
      console.error(err);
    }
    try {
      merge({ ...tags, createdAt: Date.now() });
      await save();
      reset();
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestDescription() {
    setIsLoading(true);
    try {
      const resp = await callAI(
        "Suggest a realistic example landscaping request description a homeowner might submit (1-2 sentences).",
        {
          schema: { properties: { example: { type: "string" } } },
        }
      );
      const { example } = JSON.parse(resp);
      merge({ description: example });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const input =
    "w-full px-4 py-3 rounded-xl border border-[oklch(0.25_0.16_295)]/20 bg-white text-[oklch(0.25_0.16_295)] placeholder:text-[oklch(0.25_0.16_295)]/40 focus:outline-none focus:border-[oklch(0.38_0.17_295)] min-h-[44px]";

  return (
    <section id="contact-form" className="bg-white/95 rounded-2xl p-5 shadow-xl border border-white/20">
      <h2 className="font-[Fredoka] text-2xl text-[oklch(0.25_0.16_295)] mb-1">Request a Quote</h2>
      <p className="text-sm text-[oklch(0.25_0.16_295)]/70 mb-4">Tell us what you need — we'll call you back.</p>
      {sent && (
        <div className="mb-4 p-3 rounded-xl bg-[oklch(0.70_0.15_155)]/15 border border-[oklch(0.70_0.15_155)]/40 text-[oklch(0.25_0.16_295)] text-sm">
          Thanks! We got your request and will be in touch soon.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input className={input} placeholder="Your name" value={doc.name} onChange={(e) => merge({ name: e.target.value })} />
        <input
          className={input}
          type="tel"
          placeholder="Phone number"
          value={doc.phone}
          onChange={(e) => merge({ phone: e.target.value })}
        />
        <textarea
          className={input + " resize-none"}
          rows={4}
          placeholder="What do you need done? (e.g. weekly mowing, tree trimming, new patio)"
          value={doc.description}
          onChange={(e) => merge({ description: e.target.value })}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-[oklch(0.38_0.17_295)] hover:bg-[oklch(0.30_0.15_295)] text-white font-semibold py-3 px-4 rounded-xl min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
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
                Sending...
              </>
            ) : (
              "Send Request"
            )}
          </button>
          <button
            type="button"
            onClick={suggestDescription}
            disabled={isLoading}
            title="Suggest example"
            className="px-3 py-3 rounded-xl border border-[oklch(0.38_0.17_295)]/30 text-[oklch(0.38_0.17_295)] hover:bg-[oklch(0.38_0.17_295)]/10 min-h-[44px]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { database } = useFireproof("greenleaf");

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[oklch(0.18_0.10_300)] to-[oklch(0.12_0.09_300)] font-[Nunito]",
    wrap: "max-w-xl mx-auto px-4 py-6",
    headerRow: "flex items-center justify-between mb-6",
    brand: "font-[Fredoka] text-2xl text-white leading-none",
    tagline: "text-[oklch(0.70_0.15_155)] text-xs uppercase tracking-wider",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <main id="app" className={c.wrap}>
        <header id="app-header" className={c.headerRow}>
          <div>
            <h1 className={c.brand}>GreenLeaf</h1>
            <p className={c.tagline}>Landscaping & Lawn Care</p>
          </div>
          <ViewerTag />
        </header>
        <ContactForm database={database} />
        {isOwner && <OwnerDashboard database={database} />}
      </main>
    </div>
  );
}
