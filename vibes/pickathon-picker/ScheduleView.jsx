import React from "react";

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
        return (
          <div key={day} className={c.schedDay}>
            <h3 className="text-xl font-black mb-4 text-white">
              {day} — {getDateForDay(day)}
            </h3>
            <div className="space-y-3">
              {daySchedule.map((item) => {
                const itemStart = item.type === "shift" ? shiftStartRaw(item.data) : item.data.start;
                const itemEnd = item.type === "shift" ? shiftEndRaw(item.data) : item.data.end;
                return (
                  <div key={`${item.type}-${item.id}`} className={item.type === "shift" ? c.schedShift : c.schedEvent}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className={`font-black ${c.bodyText}`}>
                            {item.type === "shift" ? item.data.kind || item.data.title || "Shift" : item.title}
                          </h4>
                          {item.type === "event" && onToggleFavorite && (
                            <button
                              onClick={() => onToggleFavorite(item.data)}
                              className="p-1 bg-[#CD6C0C] text-white rounded-lg border-2 border-[#4A4A4A] text-xs font-bold px-2"
                            >
                              {myFavIds && myFavIds.has(item.data.eventId) ? "♥" : "♡"}
                            </button>
                          )}
                        </div>
                        <p className={`text-sm font-bold ${c.bodyText}`}>
                          {fmtTime(itemStart)} – {fmtTime(itemEnd)}
                          {item.type === "event" && ` · ${item.venue}`}
                        </p>
                        {item.type === "event" &&
                          (canWrite && onNoteChange ? (
                            (() => {
                              const val = (eventNotes && eventNotes[item.data.eventId]) || "";
                              const expanded = focusedNote === item.data.eventId || val.length > 0;
                              return (
                                <div className="mt-2 flex items-center gap-2">
                                  <textarea
                                    placeholder="Add note..."
                                    value={val}
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
                            <div className={`mt-2 p-2 bg-[#EEE] rounded-lg border border-[#4A4A4A]`}>
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
