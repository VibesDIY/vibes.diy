import React, { useState } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

export default function ViewerSlugTest() {
  const { database, useLiveQuery } = useFireproof("slug-test-db");
  const { viewer, can, ViewerTag } = useViewer();
  const canWrite = can("write");
  const userId = viewer?.userHandle || "anonymous";
  const [lastWrite, setLastWrite] = useState(null);

  const { docs } = useLiveQuery("type", { key: "ping" });

  const writePing = async () => {
    const doc = {
      _id: `ping-${userId}-${Date.now()}`,
      type: "ping",
      userId,
      rawViewerHandle: viewer?.userHandle,
      hasViewer: !!viewer,
      canWrite,
      ts: new Date().toISOString(),
    };
    await database.put(doc);
    setLastWrite(doc);
  };

  return (
    <div style={{ fontFamily: "monospace", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>useViewer handle test</h1>
      <ViewerTag />

      <h2 style={{ marginTop: 24 }}>Viewer state</h2>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["viewer exists", String(!!viewer)],
            ["viewer.userHandle", String(viewer?.userHandle ?? "(undefined)")],
            ["can('write')", String(canWrite)],
            ["resolved userId", userId],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "4px 12px 4px 0", fontWeight: "bold" }}>{k}</td>
              <td style={{ padding: 4, color: v === "anonymous" || v === "(undefined)" ? "red" : "green" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canWrite && (
        <button
          onClick={writePing}
          style={{ marginTop: 16, padding: "8px 16px", fontSize: 16, cursor: "pointer" }}
        >
          Write a ping doc
        </button>
      )}

      {lastWrite && (
        <div style={{ marginTop: 16 }}>
          <h3>Last write</h3>
          <pre style={{ background: "#f0f0f0", padding: 12, borderRadius: 4, overflow: "auto" }}>
            {JSON.stringify(lastWrite, null, 2)}
          </pre>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>All pings ({docs.length})</h2>
      {docs.map((d) => (
        <div key={d._id} style={{ background: "#f8f8f8", padding: 8, marginBottom: 4, borderRadius: 4, fontSize: 13 }}>
          <strong>{d._id}</strong> — handle: {d.rawViewerHandle ?? "null"} — {d.ts}
        </div>
      ))}
    </div>
  );
}
