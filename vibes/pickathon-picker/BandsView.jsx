import React from "react";
import { fmtDate, fmtTime } from "./festival-utils.js";

export default function BandsView({ bandsList, myFavIds, canWrite, toggleFavorite, favCounts, superMode, c, database, userId }) {
  const toggleAllBand = async (band) => {
    const allFaved = band.events.every((e) => myFavIds.has(e.eventId));
    if (allFaved) {
      for (const e of band.events) {
        const favId = `favorite-${userId}-${e.eventId}`;
        await database.del(favId).catch(() => {});
      }
    } else {
      for (const e of band.events) {
        if (!myFavIds.has(e.eventId)) {
          await database.put({
            _id: `favorite-${userId}-${e.eventId}`,
            type: "favorite",
            eventId: e.eventId,
            userId,
          });
        }
      }
    }
  };

  return (
    <div>
      <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Bands ({bandsList.length})</h2>
      <div className="grid gap-3">
        {bandsList.map((band) => {
          const allFaved = band.events.every((e) => myFavIds.has(e.eventId));
          const anyFav = band.events.some((e) => myFavIds.has(e.eventId));
          const lineupLabel = band.lineup?.id || "music";
          const lineupColor = band.lineup?.color || "#d7c57d";
          const lineupText = band.lineup?.textColor || "#000";
          return (
            <div key={band.title} className={anyFav ? c.favCard : c.eventCard}>
              <div className="flex items-start gap-3">
                {canWrite && (
                  <button
                    onClick={() => toggleAllBand(band)}
                    className={`shrink-0 text-2xl p-2 rounded-2xl border-4 border-[#4A4A4A] font-bold transition-all ${allFaved ? "bg-[#CD6C0C] text-white hover:opacity-90" : anyFav ? "bg-[#CD6C0C]/40 text-white hover:opacity-90" : "bg-white text-[#4A4A4A] hover:bg-[#BACD32]"}`}
                  >
                    {allFaved ? "♥" : anyFav ? "◐" : "♡"}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className={`text-xl font-black ${anyFav ? "text-white" : c.bodyText}`}>{band.title}</h3>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-black border-2 border-[#4A4A4A] uppercase"
                      style={{ backgroundColor: lineupColor, color: lineupText }}
                    >
                      {lineupLabel}
                    </span>
                    {superMode && band.events.some((e) => favCounts[e.eventId] > 0) && (
                      <span className={c.badge} title="Total picks across sets">
                        ★ {band.events.reduce((n, e) => n + (favCounts[e.eventId] || 0), 0)}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-bold mb-2 ${anyFav ? "text-white/80" : "text-[#4A4A4A]/70"}`}>
                    {band.venueList.join(" · ")} · {band.events.length} set{band.events.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1">
                    {band.events.map((e) => (
                      <div key={e.eventId} className="flex items-center gap-2 flex-wrap">
                        {canWrite && (
                          <button
                            onClick={() => toggleFavorite(e)}
                            className={`text-sm px-2 py-0.5 rounded-lg border-2 border-[#4A4A4A] font-bold transition-all ${myFavIds.has(e.eventId) ? "bg-[#CD6C0C] text-white" : "bg-white text-[#4A4A4A] hover:bg-[#BACD32]"}`}
                          >
                            {myFavIds.has(e.eventId) ? "♥" : "♡"}
                          </button>
                        )}
                        <span className={`text-sm font-bold ${anyFav ? "text-white" : c.bodyText}`}>
                          {fmtDate(e.start)} · {fmtTime(e.start)}–{fmtTime(e.end)} · {e.venueTitle}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <a href={band.url} target="_blank" rel="noopener noreferrer" className={c.linkBtn} title="View on pickathon.com">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4A4A4A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
