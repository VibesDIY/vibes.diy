import React from "react";
import { toFestivalDate, festivalDayFor, fmtTime as fmtTimeUtil } from "./festival-utils.js";
import { lineupTag, eventCardStyle, eventCardBg } from "./styles.js";

function GapStrip({ startMs, endMs, allDayEvents, fmtTime }) {
  const count = allDayEvents.filter((e) => {
    const es = toFestivalDate(e.start).getTime();
    const ee = toFestivalDate(e.end).getTime();
    return es < endMs && ee > startMs;
  }).length;
  if (count === 0) return null;
  const startStr = fmtTime(new Date(startMs).toISOString());
  const endStr = fmtTime(new Date(endMs).toISOString());
  return (
    <div className="rounded-lg m-2  px-7 py-5 bg-white/40 dark:bg-white/10 flex items-center gap-2">
      <span className="text-xs font-bold text-[#4A4A4A]/60 dark:text-[#e9e9e9]/60">
        {startStr}–{endStr} · {count} act{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

export default function ScheduleView({
  days,
  getDateForDay,
  buildSchedule,
  fmtTime,
  notes,
  c,
  shiftStartRaw,
  shiftEndRaw,
  emptyMessage,
  eventNotes,
  savingNotes,
  onNoteChange,
  onNoteBlur,
  onNoteFocus,
  canWrite,
  focusedNote,
  onToggleFavorite,
  myFavIds,
  allEvents,
  showGaps,
}) {
  const anyContent = days.some((day) => buildSchedule(day).length > 0);
  if (!anyContent) {
    return (
      <div className="text-center py-12">
        <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>{emptyMessage}</h3>
      </div>
    );
  }
  return (
    <>
      {days.map((day) => {
        const daySchedule = buildSchedule(day);
        if (daySchedule.length === 0) return null;

        const allDayEvents = showGaps && allEvents ? allEvents.filter((e) => festivalDayFor(e.start) === day) : [];

        const items = [];
        for (let i = 0; i < daySchedule.length; i++) {
          const item = daySchedule[i];
          const itemStart = item.type === "shift" ? shiftStartRaw(item.data) : item.data.start;
          const itemEnd = item.type === "shift" ? shiftEndRaw(item.data) : item.data.end;
          const itemStartMs = toFestivalDate(itemStart).getTime();
          const itemEndMs = toFestivalDate(itemEnd).getTime();

          if (showGaps && allDayEvents.length > 0 && i === 0) {
            const earliestEvent = allDayEvents.reduce((min, e) => {
              const t = toFestivalDate(e.start).getTime();
              return t < min ? t : min;
            }, Infinity);
            if (earliestEvent < itemStartMs) {
              items.push({ type: "gap", startMs: earliestEvent, endMs: itemStartMs, key: `gap-pre-${day}` });
            }
          }

          items.push({ type: "item", data: item, key: `${item.type}-${item.id}` });

          if (showGaps && allDayEvents.length > 0) {
            const nextItem = daySchedule[i + 1];
            const nextStartMs = nextItem
              ? toFestivalDate(nextItem.type === "shift" ? shiftStartRaw(nextItem.data) : nextItem.data.start).getTime()
              : null;

            if (nextStartMs && nextStartMs > itemEndMs) {
              items.push({ type: "gap", startMs: itemEndMs, endMs: nextStartMs, key: `gap-${i}` });
            }

            if (!nextItem) {
              const latestEvent = allDayEvents.reduce((max, e) => {
                const t = toFestivalDate(e.end).getTime();
                return t > max ? t : max;
              }, 0);
              if (latestEvent > itemEndMs) {
                items.push({ type: "gap", startMs: itemEndMs, endMs: latestEvent, key: `gap-post-${day}` });
              }
            }
          }
        }

        return (
          <div key={day} className={c.schedDay}>
            <h3 className="text-xl font-black mb-4 text-white">
              {day} — {getDateForDay(day)}
            </h3>
            <div className="space-y-2">
              {items.map((entry) => {
                if (entry.type === "gap") {
                  return (
                    <GapStrip
                      key={entry.key}
                      startMs={entry.startMs}
                      endMs={entry.endMs}
                      allDayEvents={allDayEvents}
                      fmtTime={fmtTime}
                    />
                  );
                }
                const item = entry.data;
                const itemStart = item.type === "shift" ? shiftStartRaw(item.data) : item.data.start;
                const itemEnd = item.type === "shift" ? shiftEndRaw(item.data) : item.data.end;
                const isEvent = item.type === "event";
                const tag = isEvent ? lineupTag(item.data) : null;
                return (
                  <div
                    key={entry.key}
                    className={item.type === "shift" ? c.schedShift : `rounded-xl m-2 p-7 ${eventCardBg}`}
                    style={isEvent ? eventCardStyle(item.data) : undefined}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className={`font-black ${c.bodyText}`}>
                            {item.type === "shift" ? item.data.kind || item.data.title || "Shift" : item.title}
                          </h4>
                          {isEvent && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-black m-2  uppercase bg-[#BACD32] text-[#4A4A4A]">
                              {tag.label}
                            </span>
                          )}
                          {isEvent && onToggleFavorite && (
                            <button
                              onClick={() => onToggleFavorite(item.data)}
                              className={`p-1 rounded-lg m-2  text-xs font-bold px-2 ${myFavIds && myFavIds.has(item.data.eventId) ? "bg-[#CD6C0C] text-white" : "bg-white dark:bg-[#22252d] text-[#4A4A4A] dark:text-[#e9e9e9]"}`}
                            >
                              {myFavIds && myFavIds.has(item.data.eventId) ? "♥" : "♡"}
                            </button>
                          )}
                        </div>
                        <p className={`text-sm font-bold ${c.bodyText}`}>
                          {fmtTime(itemStart)} – {fmtTime(itemEnd)}
                          {isEvent && ` · ${item.venue}`}
                        </p>
                        {isEvent &&
                          (canWrite && onNoteChange ? (
                            (() => {
                              const val = (eventNotes && eventNotes[item.data.eventId]) || "";
                              const expanded = focusedNote === item.data.eventId || val.length > 0;
                              return (
                                <div className="mt-2 flex items-center gap-2">
                                  <textarea
                                    placeholder="Add note..."
                                    value={val}
                                    style={expanded ? undefined : { width: "8em" }}
                                    onChange={(e) => onNoteChange(item.data.eventId, e.target.value)}
                                    onBlur={() => onNoteBlur && onNoteBlur(item.data.eventId)}
                                    onFocus={() => onNoteFocus && onNoteFocus(item.data.eventId)}
                                    className={c.noteArea}
                                    rows={expanded ? 2 : 1}
                                  />
                                  {savingNotes && savingNotes[item.data.eventId] && <div className={c.spinner}></div>}
                                </div>
                              );
                            })()
                          ) : notes && notes[item.data.eventId] ? (
                            <div className={`mt-2 p-6 bg-[#EEE] dark:bg-[#22252d] rounded-lg m-2 `}>
                              <p className={`text-sm font-bold ${c.bodyText}`}>{notes[item.data.eventId]}</p>
                            </div>
                          ) : null)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
