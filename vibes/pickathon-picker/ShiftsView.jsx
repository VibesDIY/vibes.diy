import React from "react";
import { fmtTime } from "./festival-utils.js";

export default function ShiftsView({
  shifts,
  shiftForm,
  mergeShift,
  submitShift,
  displayDays,
  getDateForDay,
  shiftStartRaw,
  shiftEndRaw,
  canWrite,
  deleteShift,
  database,
  c,
}) {
  return (
    <div>
      <h2 className={`text-2xl font-black mb-6 ${c.bodyText}`}>Manage Your Extras</h2>
      {canWrite && (
        <div className={c.shiftForm}>
          <h3 className={`text-xl font-black mb-4 ${c.bodyText}`}>Add Extra Events</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select value={shiftForm.day} onChange={(e) => mergeShift({ day: e.target.value })} className={c.input}>
              {displayDays.map((day) => (
                <option key={day} value={day}>
                  {day} ({getDateForDay(day)})
                </option>
              ))}
            </select>
            <input
              type="time"
              value={shiftForm.startTime}
              onChange={(e) => mergeShift({ startTime: e.target.value })}
              className={c.input}
            />
            <input
              type="time"
              value={shiftForm.endTime}
              onChange={(e) => mergeShift({ endTime: e.target.value })}
              className={c.input}
            />
            <input
              type="text"
              placeholder="Shift, Meal, Break, …"
              value={shiftForm.kind || ""}
              onChange={(e) => mergeShift({ kind: e.target.value })}
              className={c.input}
            />
          </div>
          <label className={`mt-4 flex items-center gap-2 font-bold ${c.bodyText}`}>
            <input
              type="checkbox"
              checked={!!shiftForm.shareWithFriends}
              onChange={(e) => mergeShift({ shareWithFriends: e.target.checked })}
              className="w-5 h-5"
            />
            Show in friends view
          </label>
          <button onClick={submitShift} className={`mt-4 ${c.btnCyan}`}>
            Add Extra
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {shifts.map((shift) => {
          const shiftStart = shiftStartRaw(shift);
          const shiftEnd = shiftEndRaw(shift);
          return (
            <div key={shift._id} className={c.shiftCard}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-xl font-black ${c.bodyText}`}>{shift.kind || shift.title || "Shift"}</h3>
                  <p className={`font-bold ${c.bodyText}`}>
                    {shift.day} ({getDateForDay(shift.day)}) — {fmtTime(shiftStart)} to {fmtTime(shiftEnd)}
                  </p>
                  {canWrite && (
                    <label className={`mt-2 inline-flex items-center gap-2 text-sm font-bold ${c.bodyText}`}>
                      <input
                        type="checkbox"
                        checked={!!shift.shareWithFriends}
                        onChange={(e) => database.put({ ...shift, shareWithFriends: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Show in friends view
                    </label>
                  )}
                </div>
                {canWrite && (
                  <button onClick={() => deleteShift(shift._id)} className={c.deleteBtn} title="Delete shift">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {shifts.length === 0 && (
        <div className="text-center py-12">
          <h3 className={`text-2xl font-black mb-2 ${c.bodyText}`}>No extras scheduled</h3>
          <p className={c.bodyText}>Use the form above to add shifts, meals, breaks, or anything else</p>
        </div>
      )}
    </div>
  );
}
