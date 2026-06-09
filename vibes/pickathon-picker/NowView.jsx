import React from "react";
import { FESTIVAL_TZ, fmtTime, fmtDate } from "./festival-utils.js";

export default function NowView({ nowSets, nextSets, nowTick, myFavIds, friendFavIds, canWrite, toggleFavorite, c }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className={`text-2xl font-black ${c.bodyText}`}>Right Now</h2>
        <p className={`text-sm font-bold ${c.bodyText}`}>
          {new Date(nowTick).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: FESTIVAL_TZ })} festival
          time
        </p>
      </div>

      <h3 className={`text-xl font-black mb-3 ${c.bodyText}`}>Playing Now ({nowSets.length})</h3>
      {nowSets.length === 0 ? (
        <div className="mb-6 p-4 bg-white rounded-2xl border-4 border-[#4A4A4A]">
          <p className={`font-bold ${c.bodyText}`}>Nothing is on stage right now.</p>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {nowSets.map((event) => {
            const isMine = myFavIds.has(event.eventId);
            const isFriendPick = friendFavIds.has(event.eventId);
            return (
              <div
                key={event.eventId}
                className={
                  isMine
                    ? c.favCard
                    : isFriendPick
                      ? "bg-[#FFE680] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg"
                      : c.eventCard
                }
              >
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className={`text-lg font-black ${isMine ? "text-white" : c.bodyText}`}>{event.title}</h4>
                      {isFriendPick && !isMine && (
                        <span className={c.badge} title="A friend favorited this">
                          friend pick
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-bold ${isMine ? "text-white" : c.bodyText}`}>
                      {event.venueTitle} · {fmtTime(event.start)}–{fmtTime(event.end)}
                    </p>
                  </div>
                  {canWrite && (
                    <button onClick={() => toggleFavorite(event)} className={isMine ? c.favToggleOn : c.favToggleOff}>
                      {isMine ? "♥" : "♡"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className={`text-xl font-black mb-3 ${c.bodyText}`}>Up Next ({nextSets.length})</h3>
      {nextSets.length === 0 ? (
        <div className="p-4 bg-white rounded-2xl border-4 border-[#4A4A4A]">
          <p className={`font-bold ${c.bodyText}`}>No more sets scheduled.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {nextSets.map((event) => {
            const isMine = myFavIds.has(event.eventId);
            const isFriendPick = friendFavIds.has(event.eventId);
            return (
              <div
                key={event.eventId}
                className={
                  isMine
                    ? c.favCard
                    : isFriendPick
                      ? "bg-[#FFE680] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg"
                      : c.eventCard
                }
              >
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className={`text-lg font-black ${isMine ? "text-white" : c.bodyText}`}>{event.title}</h4>
                      {isFriendPick && !isMine && (
                        <span className={c.badge} title="A friend favorited this">
                          friend pick
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-bold ${isMine ? "text-white" : c.bodyText}`}>
                      {event.venueTitle} · {fmtDate(event.start)} {fmtTime(event.start)}–{fmtTime(event.end)}
                    </p>
                  </div>
                  {canWrite && (
                    <button onClick={() => toggleFavorite(event)} className={isMine ? c.favToggleOn : c.favToggleOff}>
                      {isMine ? "♥" : "♡"}
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
