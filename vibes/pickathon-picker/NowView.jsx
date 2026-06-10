import React from "react";
import { FESTIVAL_TZ, fmtTime, fmtDate } from "./festival-utils.js";
import { lineupTag, eventCardStyle, eventCardBg } from "./styles.js";

function EventCard({ event, isMine, isFriendPick, canWrite, toggleFavorite, c, showDate }) {
  const tag = lineupTag(event);
  return (
    <div className={`rounded-2xl m-2 p-8 shadow-lg ${eventCardBg}`} style={eventCardStyle(event)}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className={`text-lg font-black ${c.bodyText}`}>{event.title}</h4>
            <span className="px-2 py-0.5 rounded-full text-xs font-black m-2  uppercase bg-[#BACD32] text-[#4A4A4A]">
              {tag.label}
            </span>
            {isFriendPick && (
              <span className={c.badge} title="A friend favorited this">
                friend pick
              </span>
            )}
          </div>
          <p className={`text-sm font-bold ${c.bodyText}`}>
            {event.venueTitle} · {showDate ? `${fmtDate(event.start)} ` : ""}
            {fmtTime(event.start)}–{fmtTime(event.end)}
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
}

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
        <div className="mb-6 p-8 bg-white dark:bg-[#22252d] rounded-2xl m-2 ">
          <p className={`font-bold ${c.bodyText}`}>Nothing is on stage right now.</p>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {nowSets.map((event) => (
            <EventCard
              key={event.eventId}
              event={event}
              isMine={myFavIds.has(event.eventId)}
              isFriendPick={friendFavIds.has(event.eventId)}
              canWrite={canWrite}
              toggleFavorite={toggleFavorite}
              c={c}
              showDate={false}
            />
          ))}
        </div>
      )}

      <h3 className={`text-xl font-black mb-3 ${c.bodyText}`}>Up Next ({nextSets.length})</h3>
      {nextSets.length === 0 ? (
        <div className="p-8 bg-white dark:bg-[#22252d] rounded-2xl m-2 ">
          <p className={`font-bold ${c.bodyText}`}>No more sets scheduled.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {nextSets.map((event) => (
            <EventCard
              key={event.eventId}
              event={event}
              isMine={myFavIds.has(event.eventId)}
              isFriendPick={friendFavIds.has(event.eventId)}
              canWrite={canWrite}
              toggleFavorite={toggleFavorite}
              c={c}
              showDate={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
