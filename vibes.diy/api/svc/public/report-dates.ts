// Shared date helper for the growth/activity reports: the last 30 calendar
// days as UTC YYYY-MM-DD strings, oldest first. Single source so the report
// queries bucket on identical day boundaries.
export function last30DaysUTC(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
