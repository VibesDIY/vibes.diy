import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function Dashboard({ c, useLiveQuery }) {
  const { docs: groups } = useLiveQuery("type", { key: "group" });
  const { docs: posts } = useLiveQuery("type", { key: "post" });
  const { docs: memberships } = useLiveQuery("type", { key: "membership" });
  const { docs: speakers } = useLiveQuery("type", { key: "speaker" });
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const data = groups.map(g => ({
      topic: g.topic,
      posts: posts.filter(p => p.groupId === g._id).length,
      members: memberships.filter(m => m.groupId === g._id).length,
    }));
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    if (data.length === 0) return;
    const width = ref.current.clientWidth || 320;
    const height = 220;
    const margin = { top: 10, right: 10, bottom: 60, left: 30 };
    const x = d3.scaleBand().domain(data.map(d => d.topic)).range([margin.left, width - margin.right]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => Math.max(d.posts, d.members)) || 1]).range([height - margin.bottom, margin.top]);
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll(".bar-m").data(data).enter().append("rect")
      .attr("x", d => x(d.topic)).attr("y", d => y(d.members))
      .attr("width", x.bandwidth() / 2).attr("height", d => y(0) - y(d.members)).attr("fill", "#fed7aa");
    svg.selectAll(".bar-p").data(data).enter().append("rect")
      .attr("x", d => x(d.topic) + x.bandwidth() / 2).attr("y", d => y(d.posts))
      .attr("width", x.bandwidth() / 2).attr("height", d => y(0) - y(d.posts)).attr("fill", "#c2410c");
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x))
      .selectAll("text").attr("transform", "rotate(-30)").style("text-anchor", "end").style("font-size", "10px");
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4)).selectAll("text").style("font-size", "10px");
  }, [groups, posts, memberships]);

  return (
    <section id="dashboard" className={c.section}>
      <h2 className={c.h2}>Participation Dashboard</h2>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 bg-[#fafaf9] rounded-lg text-center">
          <div className="text-2xl font-bold text-[#c2410c]">{memberships.length}</div>
          <div className="text-xs text-[#78716c]">signups</div>
        </div>
        <div className="p-2 bg-[#fafaf9] rounded-lg text-center">
          <div className="text-2xl font-bold text-[#c2410c]">{posts.length}</div>
          <div className="text-xs text-[#78716c]">posts</div>
        </div>
        <div className="p-2 bg-[#fafaf9] rounded-lg text-center">
          <div className="text-2xl font-bold text-[#c2410c]">{speakers.length}</div>
          <div className="text-xs text-[#78716c]">speakers</div>
        </div>
      </div>
      <div className="flex gap-3 text-xs mb-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#fed7aa] inline-block rounded" />members</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#c2410c] inline-block rounded" />posts</span>
      </div>
      <svg ref={ref} className="w-full" style={{ height: 220 }} />
    </section>
  );
}

function Hearings({ c, viewer, can, database, useDocument, useLiveQuery }) {
  const { docs: hearings } = useLiveQuery("type", { key: "hearing", descending: true });
  const { docs: speakers } = useLiveQuery("type", { key: "speaker" });
  const { docs: posts } = useLiveQuery("type", { key: "post" });
  const { docs: groups } = useLiveQuery("type", { key: "group" });
  const { doc, merge, submit } = useDocument({ type: "hearing", title: "", when: "", groupId: "", createdAt: Date.now() });
  const [generating, setGenerating] = React.useState(null);

  function signup(hearingId) {
    if (!viewer) return;
    const existing = speakers.find(s => s.hearingId === hearingId && s.userSlug === viewer.userSlug);
    if (existing) database.del(existing._id);
    else database.put({ type: "speaker", hearingId, userSlug: viewer.userSlug, displayName: viewer.displayName ?? viewer.userSlug, createdAt: Date.now() });
  }

  async function talkingPoints(hearing) {
    setGenerating(hearing._id);
    try {
      const relevant = posts.filter(p => p.groupId === hearing.groupId).map(p => p.body).join("\n\n");
      const r = await callAI(`Comprehensive plan hearing: "${hearing.title}". Working group discussion:\n${relevant}\n\nGenerate testimony bullets.`, {
        schema: { properties: { summary: { type: "string" }, bullets: { type: "array", items: { type: "string" } } } }
      });
      const parsed = JSON.parse(r);
      database.put({ type: "talkingPoints", hearingId: hearing._id, summary: parsed.summary, bullets: parsed.bullets, createdAt: Date.now() });
    } finally { setGenerating(null); }
  }

  return (
    <section id="hearings" className={c.section}>
      <h2 className={c.h2}>City Hearings <span className={c.badge}>speak up</span></h2>
      <ul className="space-y-3 mb-4">
        {hearings.length === 0 && <li className={c.muted}>No hearings scheduled yet.</li>}
        {hearings.map(h => {
          const mySpeakers = speakers.filter(s => s.hearingId === h._id);
          const iSigned = mySpeakers.some(s => s.userSlug === viewer?.userSlug);
          return (
            <li key={h._id} className="p-3 bg-[#fafaf9] rounded-lg">
              <div className="font-semibold">{h.title}</div>
              <div className={c.muted}>{h.when}</div>
              {mySpeakers.length > 0 && <div className="text-xs mt-1 text-[#7c2d12]">Speakers: {mySpeakers.map(s => s.displayName).join(", ")}</div>}
              {viewer && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button onClick={() => signup(h._id)} className={c.btnGhost}>{iSigned ? "Signed up ✓" : "Sign up to testify"}</button>
                  <button onClick={() => talkingPoints(h)} disabled={generating === h._id} className={c.btnGhost}>
                    {generating === h._id ? <svg className="animate-spin w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="50" /></svg> : "Talking points"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {can("write") && (
        <form onSubmit={submit} className="space-y-2 pt-3 border-t border-[#e7e5e4]">
          <input className={c.input} placeholder="Hearing title..." value={doc.title} onChange={e => merge({ title: e.target.value })} />
          <input className={c.input} placeholder="Date & location..." value={doc.when} onChange={e => merge({ when: e.target.value })} />
          <select className={c.input} value={doc.groupId} onChange={e => merge({ groupId: e.target.value })}>
            <option value="">Link to working group...</option>
            {groups.map(g => <option key={g._id} value={g._id}>{g.topic}</option>)}
          </select>
          <button type="submit" className={c.btn} disabled={!doc.title.trim()}>Add Hearing</button>
        </form>
      )}
    </section>
  );
}

function Discussion({ c, viewer, can, database, useDocument, useLiveQuery }) {
  const { docs: groups } = useLiveQuery("type", { key: "group" });
  const { docs: posts } = useLiveQuery("type", { key: "post", descending: true });
  const [activeGroup, setActiveGroup] = React.useState("");
  const { doc, merge, submit } = useDocument({ type: "post", body: "", groupId: "", createdAt: Date.now() });

  function post(e) {
    e.preventDefault();
    if (!doc.body.trim() || !activeGroup || !viewer) return;
    database.put({
      type: "post",
      body: doc.body.trim(),
      groupId: activeGroup,
      authorSlug: viewer.userSlug,
      authorName: viewer.displayName ?? viewer.userSlug,
      authorAvatar: viewer.avatarUrl,
      createdAt: Date.now(),
    });
    merge({ body: "" });
  }

  const visible = posts.filter(p => p.groupId === activeGroup);

  return (
    <section id="discussion" className={c.sectionAccent}>
      <h2 className={c.h2}>Group Discussion <span className={c.badge}>live</span></h2>
      <select className={c.input + " mb-3"} value={activeGroup} onChange={e => setActiveGroup(e.target.value)}>
        <option value="">Select a working group...</option>
        {groups.map(g => <option key={g._id} value={g._id}>{g.topic}</option>)}
      </select>
      <ul className="space-y-3 mb-3">
        {activeGroup && visible.length === 0 && (
          <li className="flex gap-2"><div className={c.avatar} /><div className="flex-1 bg-[#fafaf9] p-2 rounded-lg"><div className={c.muted}>No posts yet — start the conversation.</div></div></li>
        )}
        {visible.map(p => (
          <li key={p._id} className="flex gap-2">
            <img src={p.authorAvatar} alt={p.authorSlug} className={c.avatar} />
            <div className="flex-1 bg-[#fafaf9] p-2 rounded-lg">
              <div className="font-semibold text-sm">{p.authorName}</div>
              <div className="text-sm whitespace-pre-wrap">{p.body}</div>
            </div>
          </li>
        ))}
      </ul>
      {can("write") && activeGroup ? (
        <form onSubmit={post} className="space-y-2">
          <textarea className={c.input} rows={2} placeholder="Add to the discussion..." value={doc.body} onChange={e => merge({ body: e.target.value })} />
          <button type="submit" className={c.btn} disabled={!doc.body.trim()}>Post</button>
        </form>
      ) : !activeGroup ? (
        <p className={c.muted}>Pick a group to see the conversation.</p>
      ) : (
        <p className={c.muted}>Read-only view.</p>
      )}
    </section>
  );
}

function WorkingGroups({ c, viewer, can, database, useDocument, useLiveQuery }) {
  const { docs: groups } = useLiveQuery("type", { key: "group" });
  const { docs: memberships } = useLiveQuery("type", { key: "membership" });
  const { doc, merge, submit } = useDocument({ type: "group", topic: "", createdAt: Date.now() });
  const [loading, setLoading] = React.useState(false);

  const myGroups = new Set(memberships.filter(m => m.userSlug === viewer?.userSlug).map(m => m.groupId));

  function toggleJoin(groupId) {
    if (!viewer) return;
    const existing = memberships.find(m => m.userSlug === viewer.userSlug && m.groupId === groupId);
    if (existing) database.del(existing._id);
    else database.put({ type: "membership", groupId, userSlug: viewer.userSlug, displayName: viewer.displayName ?? viewer.userSlug, joinedAt: Date.now() });
  }

  async function suggestTopic() {
    setLoading(true);
    try {
      const r = await callAI("Suggest one comprehensive plan working group topic not in this list: " + groups.map(g => g.topic).join(", "), { schema: { properties: { topic: { type: "string" } } } });
      merge({ topic: JSON.parse(r).topic });
    } finally { setLoading(false); }
  }

  return (
    <section id="working-groups" className={c.section}>
      <h2 className={c.h2}>Working Groups <span className={c.badge}>{groups.length} topics</span></h2>
      <ul className="space-y-2 mb-4">
        {groups.length === 0 && <li className={c.muted}>No groups yet — the board will create the first topics.</li>}
        {groups.map(g => {
          const count = memberships.filter(m => m.groupId === g._id).length;
          const joined = myGroups.has(g._id);
          return (
            <li key={g._id} className={c.row}>
              <div>
                <div className="font-semibold">{g.topic}</div>
                <div className={c.muted}>{count} member{count !== 1 ? "s" : ""}</div>
              </div>
              {viewer && <button onClick={() => toggleJoin(g._id)} className={c.btnGhost}>{joined ? "Joined ✓" : "Join"}</button>}
            </li>
          );
        })}
      </ul>
      {can("write") ? (
        <form onSubmit={submit} className="space-y-2 pt-3 border-t border-[#e7e5e4]">
          <input className={c.input} placeholder="New working group topic..." value={doc.topic} onChange={e => merge({ topic: e.target.value })} />
          <div className="flex gap-2">
            <button type="submit" className={c.btn} disabled={!doc.topic.trim()}>Create Group</button>
            <button type="button" onClick={suggestTopic} disabled={loading} className={c.btnGhost}>
              {loading ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="50" /></svg> : "Suggest"}
            </button>
          </div>
        </form>
      ) : (
        <p className={c.muted}>Board members create new working groups.</p>
      )}
    </section>
  );
}

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useDocument, useLiveQuery } = useFireproof("comp-plan-commons");

  const c = {
    page: "min-h-screen bg-[#fafaf9] text-[#1a1a1a] pb-24",
    header: "sticky top-0 z-10 bg-[#1a1a1a] text-[#fafaf9] px-4 py-4 shadow-md",
    title: "text-xl font-bold tracking-tight",
    tagline: "text-xs text-[#a8a29e] mt-0.5",
    main: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    section: "bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-sm",
    sectionAccent: "bg-white border-l-4 border-l-[#c2410c] border-y border-r border-[#e7e5e4] rounded-xl p-4 shadow-sm",
    h2: "text-lg font-bold text-[#1a1a1a] mb-3 flex items-center gap-2",
    badge: "text-[10px] uppercase tracking-wider bg-[#fed7aa] text-[#7c2d12] px-2 py-0.5 rounded-full font-semibold",
    input: "w-full px-3 py-3 border border-[#d6d3d1] rounded-lg text-base focus:outline-none focus:border-[#c2410c] min-h-[44px]",
    btn: "min-h-[44px] px-4 py-3 bg-[#c2410c] text-white rounded-lg font-semibold active:bg-[#9a3412]",
    btnGhost: "min-h-[44px] px-3 py-2 border border-[#d6d3d1] rounded-lg text-sm text-[#44403c]",
    row: "flex items-center justify-between gap-3 py-3 border-b border-[#e7e5e4] last:border-0",
    muted: "text-sm text-[#78716c]",
    avatar: "w-7 h-7 rounded-full bg-[#e7e5e4]",
  }

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={c.title}>Comp Plan Commons</h1>
            <p className={c.tagline}>Neighborhood Association · 2034 Plan Update</p>
          </div>
          {viewer && <img src={viewer.avatarUrl} alt={viewer.userSlug} className="w-9 h-9 rounded-full border-2 border-[#c2410c]" />}
        </div>
      </header>

      <main id="app" className={c.main}>
        <WorkingGroups c={c} viewer={viewer} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <Discussion c={c} viewer={viewer} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <Hearings c={c} viewer={viewer} can={can} database={database} useDocument={useDocument} useLiveQuery={useLiveQuery} />

        <Dashboard c={c} useLiveQuery={useLiveQuery} />
      </main>
    </div>
  )
}