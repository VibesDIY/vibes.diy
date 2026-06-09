import React from "react";
import { fmtTime, fmtDate } from "./festival-utils.js";

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
      <div className="mb-6 p-4 bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A]">
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
              className={`flex items-center gap-2 p-1 rounded-full border-2 border-[#4A4A4A] transition-all ${viewingUser === u.userId || (!viewingUser && u.userId === userId) ? "bg-[#CD6C0C]" : "bg-white hover:bg-[#71AD44]"}`}
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
          {favoriteEvents.map((event) => (
            <div key={event.eventId} className={c.favCard}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-black text-white mb-1">{event.title}</h3>
                  <div className="space-y-1 text-sm font-bold text-white">
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
                  <button
                    onClick={() => toggleFavorite(event)}
                    className="p-2 bg-white rounded-2xl border-2 border-[#4A4A4A] hover:bg-[#BACD32] transition-all ml-3"
                  >
                    <span className="text-[#CD6C0C] font-black text-lg">♥</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
