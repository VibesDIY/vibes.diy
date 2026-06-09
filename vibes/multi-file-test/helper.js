export function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function sortByCreated(docs) {
  return [...docs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function filterActive(docs) {
  return docs.filter((d) => !d.completed);
}

export function filterCompleted(docs) {
  return docs.filter((d) => d.completed);
}