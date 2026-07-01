// Calendar data + day-model helpers for the shift2bikes Bike Summer feed.
const API = "https://www.shift2bikes.org/api/events.php";

export const AUDIENCE_LABEL = { G: "General", F: "Family-Friendly", A: "21+ Only" };
export const AREA_LABEL = { P: "Portland", V: "Vancouver", W: "Westside", E: "East PDX", C: "Clackamas" };

// ---- day helpers ----------------------------------------------------------
export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function prettyDate(s) {
  const d = parseYmd(s);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
// Stable per-occurrence key. The feed's `id` is the *series* id for recurring rides;
// `caldaily_id` is the individual dated occurrence. Favorites/notes must key by the
// occurrence, or favoriting one weekly ride would mark every date in the series.
export const rideKey = (e) => String(e.caldaily_id != null ? e.caldaily_id : e.id);

export function pretty12(hhmmss) {
  if (!hhmmss) return "";
  const [h, m] = hhmmss.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ---- per-day calendar cache (localStorage) --------------------------------
const DAY_TTL = 10 * 60 * 1000;
export function readDayCache(date) {
  try {
    const raw = localStorage.getItem(`rt-day-${date}`);
    if (!raw) return null;
    const { events, ts } = JSON.parse(raw);
    if (!Array.isArray(events)) return null;
    return { events, stale: Date.now() - ts > DAY_TTL };
  } catch (e) {
    return null;
  }
}
function writeDayCache(date, events) {
  try {
    localStorage.setItem(`rt-day-${date}`, JSON.stringify({ events, ts: Date.now() }));
  } catch (e) {}
}

export async function fetchDay(date) {
  const r = await fetch(`${API}?startdate=${date}&enddate=${date}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`shift2bikes ${r.status}`);
  const data = await r.json();
  const list = (data.events || []).filter((e) => !e.cancelled);
  list.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  writeDayCache(date, list);
  return list;
}
// Cache-aware fetch: fresh cache short-circuits the network (keeps the empty-day
// skip search cheap). Empty days rarely gain rides mid-session.
async function fetchDayCached(date) {
  const cached = readDayCache(date);
  if (cached && !cached.stale) return cached.events;
  return fetchDay(date);
}
// Walk forward (dir=+1) / backward (dir=-1) to the first day with rides. Cap is a
// safety bound on network work, not a navigation limit — the user can keep stepping.
export async function findNextRideDay(startDate, dir, maxDays = 365) {
  let cursor = startDate;
  for (let i = 0; i < maxDays; i++) {
    const events = await fetchDayCached(cursor);
    if (events.length > 0) return { date: cursor, events };
    cursor = addDays(cursor, dir);
  }
  return { date: startDate, events: [] };
}
