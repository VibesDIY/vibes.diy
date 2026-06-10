import React from "react";
import { fmtTime, fmtDate } from "./festival-utils.js";
import { lineupTag, eventCardStyle, eventCardBg } from "./styles.js";

export default function BrowseView({
  filteredEvents,
  searchTerm,
  setSearchTerm,
  selectedDay,
  setSelectedDay,
  displayDays,
  myFavIds,
  canWrite,
  toggleFavorite,
  eventNotes,
  focusedNote,
  savingNotes,
  notes,
  handleNoteChange,
  handleNoteBlur,
  handleNoteFocus,
  superMode,
  favCounts,
  c,
}) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search for artists..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`flex-1 min-w-64 p-8 m-2 ${c.border} rounded-2xl text-lg font-bold ${c.bodyText}`}
        />
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value)}
          className={`p-8 m-2 ${c.border} rounded-2xl font-bold bg-white dark:bg-[#22252d] ${c.bodyText}`}
        >
          <option value="all">All Days</option>
          {displayDays.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4">
        {filteredEvents.map((event) => {
          const tag = lineupTag(event);
          return (
            <div key={event.eventId} className={`rounded-2xl m-2 p-8 shadow-lg ${eventCardBg}`} style={eventCardStyle(event)}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {superMode && favCounts[event.eventId] > 0 && (
                      <span className={c.badge} title="People who picked this">
                        ★ {favCounts[event.eventId]}
                      </span>
                    )}
                    <h3 className={`text-xl font-black ${c.bodyText}`}>{event.title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black m-2  uppercase bg-[#BACD32] text-[#4A4A4A]">
                      {tag.label}
                    </span>
                    {savingNotes[event.eventId] && <div className={c.spinner}></div>}
                  </div>
                  <div className={`space-y-1 text-sm font-bold ${c.bodyText}`}>
                    <p>{event.venueTitle}</p>
                    <p>{fmtDate(event.start)}</p>
                    <p>
                      {fmtTime(event.start)} – {fmtTime(event.end)}
                    </p>
                  </div>
                  {canWrite ? (
                    (() => {
                      const val = eventNotes[event.eventId] || "";
                      const expanded = focusedNote === event.eventId || val.length > 0;
                      return (
                        <div className="mt-3">
                          <textarea
                            placeholder="Add note..."
                            value={val}
                            onChange={(e) => handleNoteChange(event.eventId, e.target.value)}
                            onBlur={() => handleNoteBlur(event.eventId)}
                            onFocus={() => handleNoteFocus(event.eventId)}
                            className={c.noteArea}
                            rows={expanded ? 2 : 1}
                          />
                        </div>
                      );
                    })()
                  ) : notes[event.eventId] ? (
                    <div className={c.noteBox}>
                      <p className={`text-sm font-bold ${c.bodyText}`}>{notes[event.eventId]}</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {canWrite && (
                    <button
                      onClick={() => toggleFavorite(event)}
                      className={myFavIds.has(event.eventId) ? c.favToggleOn : c.favToggleOff}
                    >
                      {myFavIds.has(event.eventId) ? "♥" : "♡"}
                    </button>
                  )}
                  <a href={event.url} target="_blank" rel="noopener noreferrer" className={c.linkBtn} title="View artist page">
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
            </div>
          );
        })}
      </div>

      {searchTerm && filteredEvents.length === 0 && (
        <div className="text-center py-12">
          <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No events found</h3>
          <p className={c.bodyText}>Try searching for a different artist name</p>
        </div>
      )}
    </div>
  );
}
