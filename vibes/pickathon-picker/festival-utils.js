export const FESTIVAL_TZ = "America/Los_Angeles";

const hasExplicitTZ = (s) => /([+-]\d\d:\d\d|Z)$/.test(s);
export const ensureT = (s = "") => (s.includes("T") ? s : s.replace(" ", "T"));

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

export const toFestivalDate = (s) => {
  if (!s) return new Date(NaN);
  const t = ensureT(s);
  return hasExplicitTZ(t) ? new Date(t) : parseInTZ(t, FESTIVAL_TZ);
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

export const festivalDayFor = (dateStr) => {
  const d = toFestivalDate(dateStr);
  if (isNaN(d)) return null;
  const partsFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FESTIVAL_TZ,
    weekday: "long",
    hourCycle: "h23",
    hour: "2-digit",
  });
  const parts = Object.fromEntries(partsFmt.formatToParts(d).map((p) => [p.type, p.value]));
  const hour = +parts.hour;
  if (hour < 4) {
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat("en-US", { timeZone: FESTIVAL_TZ, weekday: "long" }).format(prev);
  }
  return parts.weekday;
};

export const fmtTime = (s) =>
  toFestivalDate(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: FESTIVAL_TZ });

export const fmtDate = (s) =>
  toFestivalDate(s).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: FESTIVAL_TZ });
