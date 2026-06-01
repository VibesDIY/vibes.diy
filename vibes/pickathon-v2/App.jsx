import React, { useState, useEffect, useMemo, useRef } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

// ── Festival timezone utilities ──────────────────────────────────────────────

const FESTIVAL_TZ = "America/Los_Angeles";

const hasExplicitTZ = (s) => /([+-]\d\d:\d\d|Z)$/.test(s);
const ensureT = (s = "") => (s.includes("T") ? s : s.replace(" ", "T"));

const tzOffsetMinutes = (date, tz) => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asIfUTC - date.getTime()) / 60000;
};

const parseInTZ = (naive, tz) => {
  const utcGuess = new Date(naive + "Z");
  if (isNaN(utcGuess)) return new Date(NaN);
  const offset = tzOffsetMinutes(utcGuess, tz);
  return new Date(utcGuess.getTime() - offset * 60000);
};

const toFestivalDate = (s) => {
  if (!s) return new Date(NaN);
  const t = ensureT(s);
  return hasExplicitTZ(t) ? new Date(t) : parseInTZ(t, FESTIVAL_TZ);
};

const fmtTime = (s) => toFestivalDate(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: FESTIVAL_TZ });
const fmtDate = (s) =>
  toFestivalDate(s).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: FESTIVAL_TZ });

// ── Festival config ──────────────────────────────────────────────────────────

const FESTIVAL_2026 = {
  dayOrder: ["Thursday", "Friday", "Saturday", "Sunday", "Monday"],
  dates: { Thursday: "2026-07-30", Friday: "2026-07-31", Saturday: "2026-08-01", Sunday: "2026-08-02", Monday: "2026-08-03" },
  fallbackStart: "2026-07-30T00:00:00",
};

const LOGO_URL = "https://pickathon.com/wp-content/themes/pickathon/images/2026/_logo_head.png";
const APP_URL = "https://vibes.diy/vibe/jchris/pickathon-v2";

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: "min-h-screen bg-[#EEE] p-4",
  card: "max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl border-8 border-[#4A4A4A] overflow-hidden",
  header: "bg-[#BACD32] border-b-8 border-[#4A4A4A] p-6",
  nav: "bg-[#71AD44] border-b-8 border-[#4A4A4A] p-4",
  body: "text-[#4A4A4A]",
  eventCard: "bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg",
  favCard: "bg-[#71AD44] rounded-2xl border-4 border-[#4A4A4A] p-4 shadow-lg",
  shiftCard: "bg-[#71AD44] rounded-2xl border-4 border-[#4A4A4A] p-4",
  schedDay: "mb-6 bg-[#71AD44] rounded-2xl border-4 border-[#4A4A4A] p-4",
  schedItem: (type) => `rounded-xl border-2 border-[#4A4A4A] p-3 ${type === "shift" ? "bg-[#BACD32]" : "bg-white"}`,
  input: "p-3 border-4 border-[#4A4A4A] rounded-xl font-bold text-[#4A4A4A] bg-white",
  navBtn: (active) =>
    `px-6 py-3 font-bold rounded-2xl border-4 border-[#4A4A4A] transition-all ${active ? "bg-[#4A4A4A] text-white" : "bg-white text-[#4A4A4A] hover:bg-[#BACD32]"}`,
  btn: (bg) => `${bg} text-white font-bold py-3 px-6 rounded-2xl border-4 border-[#4A4A4A] hover:opacity-90 transition-all`,
  badge: "bg-[#CD6C0C] text-white px-3 py-1 rounded-full text-sm font-bold border-2 border-[#4A4A4A]",
  favOn: "p-3 rounded-2xl border-4 border-[#4A4A4A] font-bold bg-[#CD6C0C] text-white hover:opacity-90 transition-all",
  favOff: "p-3 rounded-2xl border-4 border-[#4A4A4A] font-bold bg-white text-[#4A4A4A] hover:bg-[#BACD32] transition-all",
  noteArea: "w-full p-2 border-2 border-[#4A4A4A] rounded-xl resize-none text-sm text-[#4A4A4A] bg-white mt-3",
  deleteBtn: "p-3 bg-[#B22222] text-white rounded-2xl border-2 border-[#4A4A4A] hover:opacity-80 transition-all",
  section: "bg-white rounded-2xl border-4 border-[#4A4A4A] p-6 mb-6",
  friendPill: (active) =>
    `flex items-center gap-2 p-2 rounded-full border-2 border-[#4A4A4A] ${active ? "bg-[#71AD44]" : "bg-[#BACD32]"}`,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function PickathonPicker() {
  const { database, useLiveQuery, useDocument } = useFireproof("pickathon");
  const { viewer, can, ViewerTag } = useViewer();
  const canWrite = can("write");
  const userId = viewer?.userSlug;

  // External schedule
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState("all");
  const [view, setView] = useState("browse");
  const [editingNotes, setEditingNotes] = useState({});

  // Database queries — server returns only docs from channels the user can read
  const { docs: allFavorites } = useLiveQuery("type", { key: "favorite" });
  const { docs: allNotes } = useLiveQuery("type", { key: "note" });
  const { docs: allShifts } = useLiveQuery("type", { key: "shift" });
  const { docs: invites } = useLiveQuery("type", { key: "invite" });

  // ── Derived data ─────────────────────────────────────────────────────────

  const myFavIds = useMemo(
    () => new Set(allFavorites.filter((f) => f.userId === userId).map((f) => f.eventId)),
    [allFavorites, userId]
  );

  const myNotes = useMemo(
    () => Object.fromEntries(allNotes.filter((n) => n.userId === userId).map((n) => [n.eventId, n])),
    [allNotes, userId]
  );

  const myShifts = useMemo(() => allShifts.filter((s) => s.userId === userId), [allShifts, userId]);

  const friendFavsByEvent = useMemo(() => {
    const m = {};
    for (const f of allFavorites) {
      if (f.userId === userId) continue;
      if (!m[f.eventId]) m[f.eventId] = [];
      m[f.eventId].push(f.userId);
    }
    return m;
  }, [allFavorites, userId]);

  const pendingInvites = useMemo(() => invites.filter((i) => i.status === "pending" && i.to === userId), [invites, userId]);

  const acceptedFriends = useMemo(() => invites.filter((i) => i.status === "accepted"), [invites]);

  const myFavoriteEvents = useMemo(
    () => events.filter((e) => myFavIds.has(e.eventId)).sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start)),
    [events, myFavIds]
  );

  // ── Friend link handling ─────────────────────────────────────────────────

  const handledFriendLink = useRef(false);
  useEffect(() => {
    if (handledFriendLink.current || !canWrite || !userId) return;
    if (typeof window === "undefined") return;
    const friendSlug = new URLSearchParams(window.location.search).get("friend");
    if (!friendSlug || friendSlug === userId) return;
    handledFriendLink.current = true;

    const pair = [userId, friendSlug].sort().join("-");
    const inviteId = `invite-${pair}`;

    database
      .get(inviteId)
      .then((existing) => {
        if (existing.status === "pending" && existing.to === userId) {
          database.put({ ...existing, status: "accepted" });
        }
        setView("friends");
      })
      .catch(() => {
        database.put({
          _id: inviteId,
          type: "invite",
          from: userId,
          to: friendSlug,
          status: "pending",
          shareNotes: false,
          shareShifts: false,
        });
        setView("friends");
      });
  }, [canWrite, userId]);

  // ── Schedule fetching ────────────────────────────────────────────────────

  useEffect(() => {
    fetchSchedule();
  }, []);

  const getCached = () => {
    const data = localStorage.getItem("pickathon-schedule-cache");
    const ts = +localStorage.getItem("pickathon-schedule-timestamp");
    if (!data || !ts) return null;
    return { data: JSON.parse(data), isStale: Date.now() - ts > 600_000 };
  };

  const fetchSchedule = async () => {
    const cached = getCached();
    if (cached) {
      ingest(cached.data);
      setLoading(false);
      if (!cached.isStale) return;
    }
    try {
      const res = await fetch("https://pickathon.com/wp-content/plugins/pickathon/schedule.php");
      const data = await res.json();
      localStorage.setItem("pickathon-schedule-cache", JSON.stringify(data));
      localStorage.setItem("pickathon-schedule-timestamp", Date.now().toString());
      ingest(data);
      setError(null);
    } catch (e) {
      if (!cached) setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const ingest = (data) => {
    const list = [];
    for (const vid in data) {
      const v = data[vid];
      for (const e of v.events) {
        const start = ensureT(e.start);
        list.push({
          eventId: e.id,
          title: e.title,
          start,
          end: ensureT(e.end),
          url: e.url,
          venueTitle: v.title,
          lineup: e.lineup || {},
          day: toFestivalDate(start).toLocaleDateString("en-US", { weekday: "long", timeZone: FESTIVAL_TZ }),
        });
      }
    }
    setEvents(list);
  };

  // ── Day helpers ──────────────────────────────────────────────────────────

  const getDateForDay = (day) => {
    const evt = events.find((e) => e.day === day);
    if (evt) return evt.start.split("T")[0];
    return FESTIVAL_2026.dates[day] || FESTIVAL_2026.fallbackStart.split("T")[0];
  };

  const eventDays = [...new Set(events.map((e) => e.day))];
  const shiftDays = [...new Set(myShifts.map((s) => s.day))];
  const displayDays = [...new Set([...FESTIVAL_2026.dayOrder, ...eventDays, ...shiftDays])].sort((a, b) => {
    const o = FESTIVAL_2026.dayOrder;
    return (o.indexOf(a) === -1 ? 999 : o.indexOf(a)) - (o.indexOf(b) === -1 ? 999 : o.indexOf(b));
  });

  // ── Actions ──────────────────────────────────────────────────────────────

  const toggleFavorite = async (event) => {
    const existing = allFavorites.find((f) => f.userId === userId && f.eventId === event.eventId);
    if (existing) {
      await database.del(existing._id);
    } else {
      await database.put({ _id: `fav-${userId}-${event.eventId}`, type: "favorite", userId, eventId: event.eventId });
    }
  };

  const saveNote = async (eventId) => {
    const text = editingNotes[eventId];
    if (text === undefined) return;
    const existing = allNotes.find((n) => n.userId === userId && n.eventId === eventId);
    if (existing) {
      await database.put({ ...existing, notes: text });
    } else if (text.trim()) {
      await database.put({ _id: `note-${userId}-${eventId}`, type: "note", userId, eventId, notes: text });
    }
    setEditingNotes((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const {
    doc: shiftForm,
    merge: mergeShift,
    reset: resetShift,
  } = useDocument({ type: "shift", day: "Thursday", startTime: "09:00", endTime: "17:00", kind: "Shift" });

  const submitShift = async (e) => {
    e?.preventDefault();
    const dayISO = getDateForDay(shiftForm.day);
    await database.put({
      type: "shift",
      userId,
      day: shiftForm.day,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      start: `${dayISO}T${shiftForm.startTime}:00`,
      end: `${dayISO}T${shiftForm.endTime}:00`,
      kind: shiftForm.kind || "Shift",
    });
    resetShift();
  };

  const acceptInvite = async (invite) => {
    await database.put({ ...invite, status: "accepted" });
  };

  const toggleSharing = async (invite, field) => {
    await database.put({ ...invite, [field]: !invite[field] });
  };

  // ── Schedule builder ─────────────────────────────────────────────────────

  const shiftStartRaw = (s) => s.start ?? `${getDateForDay(s.day)}T${s.startTime}:00`;
  const shiftEndRaw = (s) => s.end ?? `${getDateForDay(s.day)}T${s.endTime}:00`;

  const makeSchedule = (day) => {
    const ev = myFavoriteEvents.filter((e) => e.day === day);
    const sh = myShifts.filter((s) => s.day === day);
    return [
      ...ev.map((e) => ({
        type: "event",
        id: e.eventId,
        title: e.title,
        sort: toFestivalDate(e.start),
        venue: e.venueTitle,
        data: e,
      })),
      ...sh.map((s) => ({ type: "shift", id: s._id, sort: toFestivalDate(shiftStartRaw(s)), data: s })),
    ].sort((a, b) => a.sort - b.sort || (a.type === "shift" ? -1 : 1));
  };

  // ── Filtered browse events ───────────────────────────────────────────────

  const filteredEvents = events
    .filter((e) => e.title.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedDay === "all" || e.day === selectedDay))
    .sort((a, b) => toFestivalDate(a.start) - toFestivalDate(b.start));

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading && events.length === 0) {
    return (
      <div className={S.page}>
        <div className={S.card}>
          <div className="p-8 flex items-center justify-center gap-4">
            <div className="w-16 h-16 border-8 border-[#71AD44] rounded-full animate-spin border-t-transparent" />
            <h2 className={`text-3xl font-black ${S.body}`}>Loading Pickathon Schedule...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={S.page}>
        <div className={S.card}>
          <div className="p-8">
            <h2 className={`text-3xl font-black mb-4 ${S.body}`}>Error Loading Schedule</h2>
            <p className={`text-lg ${S.body} mb-4`}>{error}</p>
            <button onClick={fetchSchedule} className={S.btn("bg-[#CD6C0C]")}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const connectUrl = userId ? `${APP_URL}?friend=${userId}` : null;

  return (
    <div className={S.page}>
      <div className={S.card}>
        {/* Header */}
        <div className={S.header}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <a href="https://pickathon.com" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={LOGO_URL} alt="Pickathon" className="h-32 w-auto" />
              </a>
              <div>
                <h1 className={`text-4xl font-black ${S.body} mb-1`}>PICKATHON PICKER</h1>
                <p className={`${S.body} text-base font-bold`}>Jul 30 – Aug 2, 2026 · Pendarvis Farm, OR</p>
                <p className={`${S.body} text-sm mt-1`}>
                  <em>Discover, favorite, and organize your perfect festival experience</em>
                </p>
              </div>
            </div>
            <ViewerTag />
          </div>
          {!canWrite && (
            <div className="mt-2 bg-white text-[#4A4A4A] px-3 py-2 rounded-lg text-sm font-bold border-2 border-[#4A4A4A]">
              Sign in to save your favorites.
            </div>
          )}
        </div>

        {/* Nav */}
        <div className={S.nav}>
          <div className="flex flex-wrap gap-3">
            {[
              ["browse", "Browse Events"],
              ...(canWrite
                ? [
                    ["schedule", "My Schedule"],
                    ["friends", `Friends${pendingInvites.length ? ` (${pendingInvites.length})` : ""}`],
                    ["extras", `Extras (${myShifts.length})`],
                  ]
                : []),
            ].map(([key, label]) => (
              <button key={key} onClick={() => setView(key)} className={S.navBtn(view === key)}>
                {label}
              </button>
            ))}
            <a
              href="https://pickathon.com/wp-content/uploads/2025/07/2025-Pickathon-Festival-Map_Web_Hyperlinks.pdf"
              target="map"
              rel="noopener noreferrer"
              className={S.navBtn(false)}
            >
              Map (PDF)
            </a>
          </div>
        </div>

        <div className="p-6">
          {/* ── BROWSE ── */}
          {view === "browse" && (
            <div>
              <div className="mb-6 flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Search for artists..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`flex-1 min-w-64 p-4 border-4 border-[#4A4A4A] rounded-2xl text-lg font-bold ${S.body}`}
                />
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className={`p-4 border-4 border-[#4A4A4A] rounded-2xl font-bold bg-white ${S.body}`}
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
                  const isFav = myFavIds.has(event.eventId);
                  const friendPicks = friendFavsByEvent[event.eventId];
                  const noteText = editingNotes[event.eventId] ?? myNotes[event.eventId]?.notes ?? "";

                  return (
                    <div key={event.eventId} className={isFav ? S.favCard : S.eventCard}>
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className={`text-xl font-black ${S.body}`}>{event.title}</h3>
                            <span className={S.badge}>{event.lineup?.id || "music"}</span>
                            {friendPicks && (
                              <span className="flex items-center gap-1">
                                {friendPicks.map((slug) => (
                                  <span key={slug} className="inline-block">
                                    <ViewerTag userSlug={slug} />
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          <div className={`space-y-1 text-sm font-bold ${S.body}`}>
                            <p>{event.venueTitle}</p>
                            <p>{fmtDate(event.start)}</p>
                            <p>
                              {fmtTime(event.start)} – {fmtTime(event.end)}
                            </p>
                          </div>
                          {canWrite && (
                            <textarea
                              placeholder="Add your notes..."
                              value={noteText}
                              onChange={(e) => setEditingNotes((prev) => ({ ...prev, [event.eventId]: e.target.value }))}
                              onBlur={() => saveNote(event.eventId)}
                              className={S.noteArea}
                              rows="2"
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          {canWrite && (
                            <button onClick={() => toggleFavorite(event)} className={isFav ? S.favOn : S.favOff}>
                              {isFav ? "♥" : "♡"}
                            </button>
                          )}
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-white text-[#4A4A4A] rounded-2xl border-4 border-[#4A4A4A] hover:bg-[#BACD32] transition-all"
                            title="View artist page"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" strokeWidth="2">
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
                  <h3 className={`text-2xl font-black mb-2 ${S.body}`}>No events found</h3>
                  <p className={S.body}>Try searching for a different artist name</p>
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {view === "schedule" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${S.body}`}>My Festival Schedule</h2>
              {displayDays.map((day) => {
                const items = makeSchedule(day);
                if (items.length === 0) return null;
                return (
                  <div key={day} className={S.schedDay}>
                    <h3 className="text-xl font-black mb-4 text-white">
                      {day} — {getDateForDay(day)}
                    </h3>
                    <div className="space-y-3">
                      {items.map((item) => {
                        const itemStart = item.type === "shift" ? shiftStartRaw(item.data) : item.data.start;
                        const itemEnd = item.type === "shift" ? shiftEndRaw(item.data) : item.data.end;
                        return (
                          <div key={`${item.type}-${item.id}`} className={S.schedItem(item.type)}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h4 className={`font-black ${S.body}`}>
                                    {item.type === "shift" ? item.data.kind || "Shift" : item.title}
                                  </h4>
                                  {item.type === "event" && (
                                    <button
                                      onClick={() => toggleFavorite(item.data)}
                                      className="p-1 bg-[#CD6C0C] text-white rounded-lg border-2 border-[#4A4A4A] text-xs font-bold px-2"
                                    >
                                      ♥
                                    </button>
                                  )}
                                </div>
                                <p className={`text-sm font-bold ${S.body}`}>
                                  {fmtTime(itemStart)} – {fmtTime(itemEnd)}
                                  {item.type === "event" && ` · ${item.venue}`}
                                </p>
                                {item.type === "event" && myNotes[item.data.eventId] && (
                                  <div className="mt-2 p-2 bg-[#EEE] rounded-lg border border-[#4A4A4A]">
                                    <p className={`text-sm font-bold ${S.body}`}>{myNotes[item.data.eventId].notes}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {myFavoriteEvents.length === 0 && myShifts.length === 0 && (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${S.body}`}>No events or shifts scheduled</h3>
                  <p className={S.body}>Browse events and tap the heart to build your schedule</p>
                </div>
              )}
            </div>
          )}

          {/* ── FRIENDS ── */}
          {view === "friends" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${S.body}`}>Friends</h2>

              {/* Pending invites */}
              {pendingInvites.length > 0 && (
                <div className={S.section}>
                  <h3 className={`text-xl font-black mb-4 ${S.body}`}>Pending Requests ({pendingInvites.length})</h3>
                  <div className="space-y-3">
                    {pendingInvites.map((inv) => (
                      <div key={inv._id} className="flex items-center justify-between gap-4 p-3 bg-[#EEE] rounded-xl">
                        <div className="flex items-center gap-3">
                          <ViewerTag userSlug={inv.from} />
                          <span className={`font-bold ${S.body}`}>wants to connect</span>
                        </div>
                        <button onClick={() => acceptInvite(inv)} className={S.btn("bg-[#71AD44]")}>
                          Accept
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted friends */}
              <div className={S.section}>
                <h3 className={`text-xl font-black mb-4 ${S.body}`}>My Friends ({acceptedFriends.length})</h3>
                {acceptedFriends.length === 0 ? (
                  <p className={`font-bold ${S.body}`}>No friends yet — share your QR code below to connect.</p>
                ) : (
                  <div className="space-y-3">
                    {acceptedFriends.map((inv) => {
                      const friendSlug = inv.from === userId ? inv.to : inv.from;
                      return (
                        <div key={inv._id} className="flex items-center justify-between gap-4 p-3 bg-[#EEE] rounded-xl flex-wrap">
                          <div className="flex items-center gap-3">
                            <ViewerTag userSlug={friendSlug} />
                          </div>
                          <div className="flex items-center gap-4 text-sm font-bold">
                            <label className={`flex items-center gap-2 ${S.body}`}>
                              <input type="checkbox" checked disabled className="w-4 h-4" />
                              Faves
                            </label>
                            <label className={`flex items-center gap-2 ${S.body}`}>
                              <input
                                type="checkbox"
                                checked={!!inv.shareNotes}
                                onChange={() => toggleSharing(inv, "shareNotes")}
                                className="w-4 h-4"
                              />
                              Notes
                            </label>
                            <label className={`flex items-center gap-2 ${S.body}`}>
                              <input
                                type="checkbox"
                                checked={!!inv.shareShifts}
                                onChange={() => toggleSharing(inv, "shareShifts")}
                                className="w-4 h-4"
                              />
                              Extras
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connect QR */}
              {connectUrl && (
                <div className="flex flex-col items-center gap-4 p-6 bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A]">
                  <h3 className={`text-xl font-black ${S.body}`}>Share to Connect</h3>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(connectUrl)}`}
                    alt="Connect QR"
                    className="w-60 h-60 bg-white p-2 rounded-2xl border-4 border-[#4A4A4A]"
                  />
                  <a href={connectUrl} target="_blank" rel="noopener noreferrer" className={S.btn("bg-[#CD6C0C]")}>
                    Open Connect Link
                  </a>
                  <p className={`text-xs font-bold ${S.body} break-all text-center max-w-md`}>{connectUrl}</p>
                </div>
              )}
            </div>
          )}

          {/* ── EXTRAS ── */}
          {view === "extras" && (
            <div>
              <h2 className={`text-2xl font-black mb-6 ${S.body}`}>Manage Extras</h2>

              {canWrite && (
                <div className="bg-[#BACD32] rounded-2xl border-4 border-[#4A4A4A] p-6 mb-6">
                  <h3 className={`text-xl font-black mb-4 ${S.body}`}>Add Extra</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select value={shiftForm.day} onChange={(e) => mergeShift({ day: e.target.value })} className={S.input}>
                      {displayDays.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={shiftForm.startTime}
                      onChange={(e) => mergeShift({ startTime: e.target.value })}
                      className={S.input}
                    />
                    <input
                      type="time"
                      value={shiftForm.endTime}
                      onChange={(e) => mergeShift({ endTime: e.target.value })}
                      className={S.input}
                    />
                    <input
                      type="text"
                      placeholder="Shift, Meal, Break, …"
                      value={shiftForm.kind || ""}
                      onChange={(e) => mergeShift({ kind: e.target.value })}
                      className={S.input}
                    />
                  </div>
                  <button onClick={submitShift} className={`mt-4 ${S.btn("bg-[#71AD44]")}`}>
                    Add Extra
                  </button>
                </div>
              )}

              <div className="grid gap-4">
                {myShifts.map((shift) => (
                  <div key={shift._id} className={S.shiftCard}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className={`text-xl font-black ${S.body}`}>{shift.kind || "Shift"}</h3>
                        <p className={`font-bold ${S.body}`}>
                          {shift.day} — {fmtTime(shiftStartRaw(shift))} to {fmtTime(shiftEndRaw(shift))}
                        </p>
                      </div>
                      {canWrite && (
                        <button onClick={() => database.del(shift._id)} className={S.deleteBtn} title="Delete">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {myShifts.length === 0 && (
                <div className="text-center py-12">
                  <h3 className={`text-2xl font-black mb-2 ${S.body}`}>No extras scheduled</h3>
                  <p className={S.body}>Add shifts, meals, breaks, or anything else above</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
