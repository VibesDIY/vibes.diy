import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function SubmitSlot() {
  const c = {
    section: "border border-[rgba(255,255,255,0.3)] rounded-lg p-4 bg-black",
    heading: "text-[#D4FF00] font-semibold mb-3 text-lg",
    hint: "text-[#888888] text-sm",
  };
  return (
    <section id="submit-slot" className={c.section}>
      <h2 className={c.heading}>Your availability</h2>
      <p className={c.hint}>{/* form lands here */}Add the windows you're free.</p>
    </section>
  );
}

function MySlots() {
  const c = {
    section: "border border-[rgba(255,255,255,0.3)] rounded-lg p-4 bg-black",
    heading: "text-[#D4FF00] font-semibold mb-3 text-lg",
    hint: "text-[#888888] text-sm",
  };
  return (
    <section id="my-slots" className={c.section}>
      <h2 className={c.heading}>Your submitted slots</h2>
      <p className={c.hint}>{/* list of your own slots */}Nothing yet.</p>
    </section>
  );
}

function OrganizerView() {
  const { useLiveQuery, database } = useFireproof("slotSync");
  const { docs } = useLiveQuery("type", { key: "slot" });
  const { docs: picks } = useLiveQuery("type", { key: "suggestion", descending: true, limit: 1 });
  const [loading, setLoading] = React.useState(false);

  const byPerson = {};
  docs.forEach((d) => {
    if (!byPerson[d.authorHandle]) byPerson[d.authorHandle] = [];
    byPerson[d.authorHandle].push(d);
  });

  const suggest = async () => {
    if (docs.length === 0) return;
    setLoading(true);
    try {
      const summary = docs.map((d) => `${d.authorHandle}: ${d.label} (${d.start} → ${d.end})`).join("\n");
      const res = await callAI(
        `Given these availability windows from multiple people, pick the best overlapping meeting time and explain briefly:\n\n${summary}`,
        {
          schema: { properties: { recommendation: { type: "string" }, rationale: { type: "string" } } },
        }
      );
      const parsed = JSON.parse(res);
      await database.put({
        type: "suggestion",
        recommendation: parsed.recommendation,
        rationale: parsed.rationale,
        createdAt: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  const c = {
    section: "border border-[#D4FF00] rounded-lg p-4 bg-black",
    heading: "text-[#D4FF00] font-semibold mb-3 text-lg",
    hint: "text-[#888888] text-sm",
    button:
      "bg-[#D4FF00] text-black font-semibold px-4 py-3 rounded-md min-h-[44px] w-full disabled:opacity-50 flex items-center justify-center gap-2",
    person: "border border-[#666666] rounded p-3 mb-2",
    name: "text-[#D4FF00] text-sm font-semibold mb-1",
    slot: "text-[#dddddd] text-sm",
    pick: "mt-3 border border-[#D4FF00] rounded p-3 bg-[rgba(212,255,0,0.05)]",
    pickLabel: "text-[#D4FF00] text-xs uppercase tracking-wider mb-1",
    pickText: "text-white font-medium",
    pickWhy: "text-[#888888] text-xs mt-1",
  };

  return (
    <section id="organizer-view" className={c.section}>
      <h2 className={c.heading}>Organizer dashboard</h2>
      {docs.length === 0 && <p className={c.hint}>No submissions yet.</p>}
      {Object.entries(byPerson).map(([handle, slots]) => (
        <div key={handle} className={c.person}>
          <div className={c.name}>{handle}</div>
          {slots.map((s) => (
            <div key={s._id} className={c.slot}>
              {s.label}: {s.start} → {s.end}
            </div>
          ))}
        </div>
      ))}
      <button className={c.button + " mt-3"} onClick={suggest} disabled={loading || docs.length === 0}>
        {loading && (
          <svg
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
          </svg>
        )}
        {loading ? "Thinking..." : "Suggest best time"}
      </button>
      {picks[0] && (
        <div className={c.pick}>
          <div className={c.pickLabel}>AI suggestion</div>
          <div className={c.pickText}>{picks[0].recommendation}</div>
          <div className={c.pickWhy}>{picks[0].rationale}</div>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();

  const c = {
    page: "min-h-screen bg-black text-white font-[Helvetica_Neue,Helvetica,Arial,sans-serif]",
    header: "sticky top-0 z-10 bg-black border-b border-[#666666] px-4 py-3 flex items-center justify-between",
    title: "text-[#D4FF00] font-bold text-xl tracking-tight",
    main: "px-4 py-4 space-y-4 max-w-2xl mx-auto",
    role: "text-[#888888] text-xs uppercase tracking-wider",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div>
          <div className={c.title}>Slot Sync</div>
          <div className={c.role}>{isOwner ? "organizer" : viewer ? "participant" : "guest"}</div>
        </div>
        <ViewerTag />
      </header>
      <main id="app" className={c.main}>
        {viewer && <SubmitSlot viewer={viewer} />}
        {viewer && <MySlots viewer={viewer} />}
        {isOwner && <OrganizerView />}
        {!viewer && (
          <section className="border border-[rgba(255,255,255,0.3)] rounded-lg p-6 text-center">
            <p className="text-[#dddddd]">Sign in to submit your availability.</p>
          </section>
        )}
      </main>
    </div>
  );
}
