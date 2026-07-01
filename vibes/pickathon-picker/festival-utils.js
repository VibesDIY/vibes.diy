export const FESTIVAL_TZ = "America/Los_Angeles";

const hasExplicitTZ = (s) => /([+-]\d\d:\d\d|Z)$/.test(s);
export const ensureT = (s = "") => (s.includes("T") ? s : s.replace(" ", "T"));

// Intl.DateTimeFormat construction is expensive (tens of µs each). These helpers
// run inside sort comparators and filters over hundreds of events every render,
// so we build each formatter ONCE at module scope and memoize the results by their
// input string — the festival's date strings are a small, stable set parsed
// thousands of times per render. This is the single biggest render-cost win.
const _offsetFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: FESTIVAL_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const tzOffsetMinutes = (date) => {
  const p = Object.fromEntries(_offsetFmt.formatToParts(date).map((x) => [x.type, x.value]));
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asIfUTC - date.getTime()) / 60000;
};

const parseInTZ = (naive) => {
  const utcGuess = new Date(naive + "Z");
  if (isNaN(utcGuess)) return new Date(NaN);
  const offset = tzOffsetMinutes(utcGuess);
  return new Date(utcGuess.getTime() - offset * 60000);
};

// Cached: same date string in → same Date out. Callers treat the Date as immutable
// (they read getTime()/compare or build a *new* Date from it), so sharing is safe.
const _dateCache = new Map();
export const toFestivalDate = (s) => {
  if (!s) return new Date(NaN);
  const hit = _dateCache.get(s);
  if (hit) return hit;
  const t = ensureT(s);
  const d = hasExplicitTZ(t) ? new Date(t) : parseInTZ(t);
  _dateCache.set(s, d);
  return d;
};

export const FESTIVAL_2026 = {
  dayOrder: ["Thursday", "Friday", "Saturday", "Sunday", "Monday"],
  dates: {
    Thursday: "2026-07-30",
    Friday: "2026-07-31",
    Saturday: "2026-08-01",
    Sunday: "2026-08-02",
    Monday: "2026-08-03",
  },
  fallbackStart: "2026-07-30T00:00:00",
};

export const LOGO_URL = "https://pickathon.com/wp-content/themes/pickathon/images/2026/_logo_head.png";

const _dayPartsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: FESTIVAL_TZ,
  weekday: "long",
  hourCycle: "h23",
  hour: "2-digit",
});
const _weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: FESTIVAL_TZ, weekday: "long" });
const _dayForCache = new Map();
export const festivalDayFor = (dateStr) => {
  if (_dayForCache.has(dateStr)) return _dayForCache.get(dateStr);
  const d = toFestivalDate(dateStr);
  let out = null;
  if (!isNaN(d)) {
    const parts = Object.fromEntries(_dayPartsFmt.formatToParts(d).map((p) => [p.type, p.value]));
    if (+parts.hour < 4) {
      out = _weekdayFmt.format(new Date(d.getTime() - 24 * 60 * 60 * 1000));
    } else {
      out = parts.weekday;
    }
  }
  _dayForCache.set(dateStr, out);
  return out;
};

const _timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: FESTIVAL_TZ });
const _dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: FESTIVAL_TZ,
});
const _timeCache = new Map();
const _dateStrCache = new Map();
// Guard invalid dates: Intl.DateTimeFormat.format throws RangeError on an invalid
// Date (unlike the old toLocaleTimeString/DateString, which returned "Invalid Date").
// A malformed shift time (e.g. a cleared time input stored as `2026-07-30T:00`) must
// render a safe placeholder, not crash the Extras / My Faves / friend schedule views.
export const fmtTime = (s) => {
  if (_timeCache.has(s)) return _timeCache.get(s);
  const d = toFestivalDate(s);
  const out = isNaN(d) ? "" : _timeFmt.format(d);
  _timeCache.set(s, out);
  return out;
};
export const fmtDate = (s) => {
  if (_dateStrCache.has(s)) return _dateStrCache.get(s);
  const d = toFestivalDate(s);
  const out = isNaN(d) ? "" : _dateFmt.format(d);
  _dateStrCache.set(s, out);
  return out;
};

// The Pickathon feed returns HTML-entity-encoded strings (e.g. "Skills &amp; Games").
// Decode them once at ingest so titles render as text, not markup.
export const decodeEntities = (s) => {
  if (typeof s !== "string" || !s.includes("&")) return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
};
