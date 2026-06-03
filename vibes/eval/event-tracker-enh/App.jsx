import React from "react";
import { callAI } from "call-ai";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

function Header({ ViewerTag, c }) {
  return (
    <header
      id="app-header"
      className={`sticky top-0 z-10 ${c.headerBg} ${c.headerBorder} border-b-4 px-4 py-3 flex items-center justify-between`}
    >
      <h1 className={`${c.brand} text-2xl tracking-widest`}>NEON FEST</h1>
      <ViewerTag />
    </header>
  );
}

function DayChips({ c }) {
  return (
    <section
      id="day-chips"
      className={`${c.chipsBg} px-3 py-3 flex gap-2 overflow-x-auto sticky top-[60px] z-10 border-b ${c.headerBorder}`}
    >
      {/* day + stage filter chips render here */}
      <div className={`${c.chipIdle} px-4 py-2 rounded-full text-sm whitespace-nowrap`}>Loading days…</div>
    </section>
  );
}

function ActList({ c }) {
  return (
    <section id="act-list" className="px-3 py-4 space-y-3 pb-32">
      <h2 className={`${c.sectionTitle} text-sm uppercase tracking-wider mb-2`}>Lineup</h2>
      <div className={`${c.cardBg} ${c.cardBorder} border-2 rounded-xl p-4`}>
        <p className={c.muted}>Acts will appear here.</p>
      </div>
    </section>
  );
}

function CrewBar({ c }) {
  return (
    <section id="crew-bar" className={`fixed bottom-0 inset-x-0 ${c.crewBg} ${c.headerBorder} border-t-4 p-3`}>
      {/* crew-only add form lands here */}
      <p className={`${c.muted} text-center text-xs`}>Sign in as crew to manage the lineup.</p>
    </section>
  );
}

export default function App() {
  const { viewer, isOwner, isViewerPending, ViewerTag } = useViewer();
  const { useLiveQuery, database, access } = useFireproof("festival");
  const isCrew = isOwner || access.hasRole("crew");

  const { docs: acts } = useLiveQuery((d) => (d.type === "act" ? [d.day, d.time] : undefined));
  const { docs: stars } = useLiveQuery("type", { key: "star" });
  const starredIds = new Set(stars.map((s) => s.actId));

  const [activeDay, setActiveDay] = React.useState("all");
  const days = Array.from(new Set(acts.map((a) => a.day).filter(Boolean))).sort();
  const shown = activeDay === "all" ? acts : acts.filter((a) => a.day === activeDay);

  async function toggleStar(actId) {
    if (!viewer) return;
    const existing = stars.find((s) => s.actId === actId);
    if (existing) await database.del(existing._id);
    else await database.put({ type: "star", actId, userHandle: viewer.userHandle, createdAt: Date.now() });
  }

  async function deleteAct(id) {
    if (!isCrew) return;
    await database.del(id);
  }

  const c = {
    page: "min-h-screen bg-gradient-to-b from-[#ff5bad] via-[#ffc85c] to-[#fcee0a] font-[Rajdhani,sans-serif]",
    headerBg: "bg-[#2a0a2e]",
    headerBorder: "border-[#f93c94]",
    brand: "font-[Orbitron,sans-serif] text-[#fcee0a]",
    chipsBg: "bg-[#4d1558]",
    chipIdle: "bg-[#2a0a2e] text-[#00f0ff] border border-[#00f0ff]",
    chipActive: "bg-[#f93c94] text-[#2a0a2e] border border-[#fcee0a]",
    sectionTitle: "text-[#2a0a2e] font-[Orbitron,sans-serif]",
    cardBg: "bg-[#2a0a2e]",
    cardBorder: "border-[#f93c94]",
    muted: "text-[#fcee0a]/70",
    crewBg: "bg-[#2a0a2e]",
    accentBtn: "bg-[#f93c94] text-[#2a0a2e] font-[Orbitron,sans-serif]",
    starOn: "text-[#fcee0a]",
    starOff: "text-[#fcee0a]/30",
  };

  if (isViewerPending) return <div className={c.page} />;

  return (
    <div className={c.page}>
      <Header ViewerTag={ViewerTag} c={c} />
      <section
        id="day-chips"
        className={`${c.chipsBg} px-3 py-3 flex gap-2 overflow-x-auto sticky top-[60px] z-10 border-b ${c.headerBorder}`}
      >
        <button
          onClick={() => setActiveDay("all")}
          className={`${activeDay === "all" ? c.chipActive : c.chipIdle} px-4 py-2 rounded-full text-sm whitespace-nowrap min-h-[44px]`}
        >
          All Days
        </button>
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(d)}
            className={`${activeDay === d ? c.chipActive : c.chipIdle} px-4 py-2 rounded-full text-sm whitespace-nowrap min-h-[44px]`}
          >
            {d}
          </button>
        ))}
      </section>
      <main id="app">
        <section id="act-list" className="px-3 py-4 space-y-3 pb-40">
          <h2 className={`${c.sectionTitle} text-sm uppercase tracking-wider mb-2`}>Lineup ({shown.length})</h2>
          {shown.length === 0 && (
            <div className={`${c.cardBg} ${c.cardBorder} border-2 rounded-xl p-4`}>
              <p className={c.muted}>No acts yet. {isCrew ? "Add the first one below." : "Check back soon!"}</p>
            </div>
          )}
          {shown.map((act) => (
            <article key={act._id} className={`${c.cardBg} ${c.cardBorder} border-2 rounded-xl p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className={`${c.brand} text-lg`}>{act.name}</h3>
                  <p className="text-[#00f0ff] text-sm">
                    {act.stage} · {act.day} {act.time}
                  </p>
                  {act.genre && <p className={`${c.muted} text-xs mt-1 uppercase tracking-wider`}>{act.genre}</p>}
                  {act.blurb && <p className="text-[#fcee0a]/90 text-sm mt-2">{act.blurb}</p>}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <button
                    onClick={() => toggleStar(act._id)}
                    disabled={!viewer}
                    className={`${starredIds.has(act._id) ? c.starOn : c.starOff} min-h-[44px] min-w-[44px] flex items-center justify-center text-3xl disabled:opacity-40`}
                    aria-label="Star act"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="28"
                      height="28"
                      fill={starredIds.has(act._id) ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
                    </svg>
                  </button>
                  {isCrew && (
                    <button onClick={() => deleteAct(act._id)} className="text-[#f93c94] text-xs underline">
                      delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
      <CrewBar c={c} viewer={viewer} isCrew={isCrew} database={database} />
    </div>
  );
}
