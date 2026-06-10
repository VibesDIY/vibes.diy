import React from "react";
import { fmtTime, fmtDate } from "./festival-utils.js";
import { lineupTag, eventCardStyle, eventCardBg } from "./styles.js";

export default function FavoritesView({
  favoriteEvents,
  favUsers,
  viewingUser,
  setViewingUser,
  userId,
  myFavIds,
  canWrite,
  toggleFavorite,
  notes,
  ViewerTag,
  c,
}) {
  return (
    <div>
      <div className="mb-6 p-8 bg-[#BACD32] dark:bg-[#2c3510] rounded-2xl m-2 ">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className={`text-lg font-black ${c.bodyText}`}>
            {viewingUser ? `Viewing ${viewingUser}'s picks` : "Pickers (tap to view their picks)"}
          </h3>
          {viewingUser && (
            <button onClick={() => setViewingUser(null)} className={c.btnCyan}>
              Back to my picks
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {favUsers.map((u) => (
            <button
              key={u.userId}
              onClick={() => setViewingUser(u.userId === userId ? null : u.userId)}
              className={`flex items-center gap-2 p-1 rounded-full m-2  transition-all ${viewingUser === u.userId || (!viewingUser && u.userId === userId) ? "bg-[#CD6C0C]" : "bg-white dark:bg-[#22252d] hover:bg-[#71AD44] dark:hover:bg-[#1d3015]"}`}
              title={`${u.count} pick${u.count === 1 ? "" : "s"}`}
            >
              <ViewerTag userHandle={u.userId} />
              <span className={`pr-3 font-bold text-sm ${c.bodyText}`}>{u.count}</span>
            </button>
          ))}
        </div>
      </div>

      <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Favorite Events</h2>
      {favoriteEvents.length === 0 ? (
        <div className="text-center py-12">
          <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No favorites yet!</h3>
        </div>
      ) : (
        <div className="grid gap-4">
          {favoriteEvents.map((event) => {
            const tag = lineupTag(event);
            return (
              <div key={event.eventId} className={`rounded-2xl m-2 p-8 shadow-lg ${eventCardBg}`} style={eventCardStyle(event)}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`text-xl font-black ${c.bodyText}`}>{event.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black m-2  uppercase bg-[#BACD32] text-[#4A4A4A]">
                        {tag.label}
                      </span>
                    </div>
                    <div className={`space-y-1 text-sm font-bold ${c.bodyText}`}>
                      <p>{event.venueTitle}</p>
                      <p>{fmtDate(event.start)}</p>
                      <p>
                        {fmtTime(event.start)} – {fmtTime(event.end)}
                      </p>
                    </div>
                    {notes[event.eventId] && (
                      <div className={c.noteBox}>
                        <p className={`text-sm font-bold ${c.bodyText}`}>{notes[event.eventId]}</p>
                      </div>
                    )}
                  </div>
                  {canWrite && (
                    <button onClick={() => toggleFavorite(event)} className={c.favToggleOn}>
                      <span className="font-black text-lg">♥</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
