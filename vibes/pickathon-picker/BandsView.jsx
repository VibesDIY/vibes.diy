import React from "react";
import { fmtDate, fmtTime } from "./festival-utils.js";
import { eventCardBg } from "./styles.js";

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

  const LINEUP_ORDER = ["music", "djs", "family"];
  const grouped = {};
  for (const band of bandsList) {
    const key = band.lineup?.id || "music";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(band);
  }
  const LINEUP_LABELS = { music: "Music", djs: "DJs", family: "Family" };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h2 className={`text-2xl font-black ${c.bodyText}`}>Bands ({bandsList.length})</h2>
        {LINEUP_ORDER.filter((key) => grouped[key]?.length > 0).map((key) => (
          <button
            key={`nav-${key}`}
            onClick={() => document.getElementById(`lineup-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="px-8 py-6 rounded-xl m-2  font-black text-sm cursor-pointer hover:opacity-80 transition-all"
            style={{
              backgroundColor: grouped[key][0].lineup?.color || "#d7c57d",
              color: grouped[key][0].lineup?.textColor || "#000",
            }}
          >
            {LINEUP_LABELS[key] || key} ({grouped[key].length})
          </button>
        ))}
      </div>
      {LINEUP_ORDER.filter((key) => grouped[key]?.length > 0).map((key) => (
        <div key={key} id={`lineup-${key}`} className="mb-8 scroll-mt-4">
          <h3
            className="text-lg font-black mb-3 px-8 py-6 rounded-xl m-2  inline-block"
            style={{
              backgroundColor: grouped[key][0].lineup?.color || "#d7c57d",
              color: grouped[key][0].lineup?.textColor || "#000",
            }}
          >
            {LINEUP_LABELS[key] || key} ({grouped[key].length})
          </h3>
          <div className="grid gap-3 mt-3">
            {grouped[key].map((band) => {
              const allFaved = band.events.every((e) => myFavIds.has(e.eventId));
              const anyFav = band.events.some((e) => myFavIds.has(e.eventId));
              const lineupLabel = band.lineup?.id || "music";
              const lineupColor = band.lineup?.color || "#d7c57d";
              const lineupText = band.lineup?.textColor || "#000";
              return (
                <div
                  key={band.title}
                  className={`rounded-2xl m-2 p-8 shadow-lg ${eventCardBg}`}
                  style={{ "--lineup": lineupColor }}
                >
                  <div className="flex items-start gap-3">
                    {canWrite && (
                      <button
                        onClick={() => toggleAllBand(band)}
                        className={`shrink-0 text-2xl p-6 rounded-2xl m-2  font-bold transition-all ${allFaved ? "bg-[#CD6C0C] text-white hover:opacity-90" : anyFav ? "bg-[#CD6C0C]/40 text-white hover:opacity-90" : "bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9] hover:bg-[#BACD32] dark:hover:bg-[#2c3510]"}`}
                      >
                        {allFaved ? "♥" : anyFav ? "◐" : "♡"}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className={`text-xl font-black ${c.bodyText}`}>{band.title}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-black m-2  uppercase bg-[#BACD32] text-[#4A4A4A]">
                          {lineupLabel}
                        </span>
                        {superMode && band.events.some((e) => favCounts[e.eventId] > 0) && (
                          <span className={c.badge} title="Total picks across sets">
                            ★ {band.events.reduce((n, e) => n + (favCounts[e.eventId] || 0), 0)}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-bold mb-2 text-[#4A4A4A]/70 dark:text-[#e9e9e9]/70`}>
                        {band.venueList.join(" · ")} · {band.events.length} set{band.events.length > 1 ? "s" : ""}
                      </p>
                      <div className="space-y-1">
                        {band.events.map((e) => (
                          <div key={e.eventId} className="flex items-center gap-2 flex-wrap">
                            {canWrite && (
                              <button
                                onClick={() => toggleFavorite(e)}
                                className={`text-sm px-2 py-0.5 rounded-lg m-2  font-bold transition-all ${myFavIds.has(e.eventId) ? "bg-[#CD6C0C] text-white" : "bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9] hover:bg-[#BACD32] dark:hover:bg-[#2c3510]"}`}
                              >
                                {myFavIds.has(e.eventId) ? "♥" : "♡"}
                              </button>
                            )}
                            <span className={`text-sm font-bold ${c.bodyText}`}>
                              {fmtDate(e.start)} · {fmtTime(e.start)}–{fmtTime(e.end)} · {e.venueTitle}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <a
                      href={band.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={c.linkBtn}
                      title="View on pickathon.com"
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
      ))}
    </div>
  );
}
