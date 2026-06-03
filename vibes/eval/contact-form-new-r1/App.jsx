function OwnerDashboard({ database }) {
  const { useLiveQuery } = useFireproof("greenleaf");
  const { docs } = useLiveQuery("createdAt", { descending: true });
  const requests = docs.filter((d) => d.type === "request");

  const priorityColor = (p) => (p === "high" ? "var(--danger)" : p === "medium" ? "var(--accent-gold)" : "var(--accent-green)");

  return (
    <section
      id="owner-dashboard"
      className="rounded-2xl p-5 backdrop-blur-sm"
      style={{ background: "var(--card-bg)", borderColor: "var(--border)", borderWidth: 1 }}
    >
      <h2 className="text-2xl font-semibold mb-3" style={{ fontFamily: "Fredoka" }}>
        Incoming Requests <span className="text-sm opacity-60 font-normal">({requests.length})</span>
      </h2>
      {requests.length === 0 && <p className="text-sm opacity-70 py-6 text-center">No requests yet — they'll appear here live.</p>}
      <ul className="space-y-3">
        {requests.map((r) => (
          <li
            key={r._id}
            className="rounded-xl p-4"
            style={{ background: "oklch(0.25 0.16 295 / 0.5)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3 className="font-semibold text-lg" style={{ fontFamily: "Fredoka" }}>
                  {r.name}
                </h3>
                <a href={`tel:${r.phone}`} className="text-sm underline opacity-90">
                  {r.phone}
                </a>
              </div>
              <div className="flex flex-col items-end gap-1">
                {r.priority && (
                  <span
                    className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: priorityColor(r.priority), color: "oklch(0.18 0.10 300)" }}
                  >
                    {r.priority}
                  </span>
                )}
                {r.serviceType && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--primary-light)" }}>
                    {r.serviceType}
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm opacity-90 mt-2">{r.description}</p>
            <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs opacity-60">{new Date(r.createdAt).toLocaleString()}</span>
              <button onClick={() => database.del(r._id)} className="text-xs opacity-70 hover:opacity-100 underline">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
