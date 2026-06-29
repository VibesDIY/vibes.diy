import React from "react"
import { callAI } from "call-ai"
import * as d3 from "d3"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

function ConfidenceChart({ papers }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current || papers.length === 0) return;
    const grouped = d3.rollup(
      papers,
      (v) => d3.mean(v, (d) => d.confidence || 0),
      (d) => d.modelFamily || "Unknown"
    );
    const data = Array.from(grouped, ([family, avg]) => ({ family, avg })).sort((a, b) => b.avg - a.avg);

    const width = ref.current.clientWidth || 400;
    const height = Math.max(60, data.length * 36 + 20);
    const margin = { top: 10, right: 40, bottom: 10, left: 140 };

    d3.select(ref.current).selectAll("*").remove();
    const svg = d3.select(ref.current).append("svg")
      .attr("width", width).attr("height", height);

    const y = d3.scaleBand().domain(data.map(d => d.family)).range([margin.top, height - margin.bottom]).padding(0.2);
    const x = d3.scaleLinear().domain([0, 5]).range([margin.left, width - margin.right]);

    svg.append("g").selectAll("rect").data(data).enter().append("rect")
      .attr("x", margin.left).attr("y", d => y(d.family))
      .attr("width", d => x(d.avg) - margin.left).attr("height", y.bandwidth())
      .attr("fill", "oklch(0.65 0.18 55)").attr("rx", 4);

    svg.append("g").selectAll("text.label").data(data).enter().append("text")
      .attr("x", margin.left - 8).attr("y", d => y(d.family) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "end").attr("font-size", "12px").attr("fill", "oklch(0.25 0.04 30)")
      .text(d => d.family.length > 22 ? d.family.slice(0, 22) + "…" : d.family);

    svg.append("g").selectAll("text.val").data(data).enter().append("text")
      .attr("x", d => x(d.avg) + 4).attr("y", d => y(d.family) + y.bandwidth() / 2 + 4)
      .attr("font-size", "11px").attr("fill", "oklch(0.50 0.04 30)")
      .text(d => d.avg.toFixed(1));
  }, [papers]);

  return <div ref={ref} className="w-full" />;
}

export default function App() {
  const { viewer, can } = useViewer();
  const { database, useLiveQuery } = useFireproof("method-spotter");
  const [passage, setPassage] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const { docs: papers } = useLiveQuery("createdAt", { descending: true });

  async function analyze() {
    setIsLoading(true);
    try {
      const prompt = `You are a methodological reasoning tutor for a doctoral student in education research. Analyze this passage from a research paper and identify the methodological structure. Be precise about why a particular model family fits given the data structure (nested data → multilevel/HLM, repeated observations of same units → fixed effects panel methods, cross-sectional independent observations → multiple regression, etc.). Explain trade-offs (fixed vs random effects) when relevant. Passage:\n\n${passage}`;
      const response = await callAI(prompt, {
        schema: {
          properties: {
            researchQuestion: { type: "string", description: "The core research question" },
            unitOfAnalysis: { type: "string", description: "What unit is being studied (student, classroom, district, etc.)" },
            dataStructure: { type: "string", description: "Cross-sectional, longitudinal panel, nested/hierarchical, etc." },
            modelFamily: { type: "string", description: "Multiple regression, multilevel model (HLM), fixed effects panel, random effects, mixed methods, etc." },
            reasoning: { type: "string", description: "Plain-language explanation of why this model family fits the data structure" },
            tags: { type: "array", items: { type: "string" }, description: "3-5 tags covering method, substantive topic, diagnostics" },
          },
        },
      });
      const parsed = JSON.parse(response);
      setResult(parsed);
      await database.put({
        type: "paper",
        passage,
        ...parsed,
        confidence: 3,
        createdAt: Date.now(),
        authorUserSlug: viewer?.userSlug,
        authorDisplayName: viewer?.displayName ?? viewer?.userSlug,
        authorAvatarUrl: viewer?.avatarUrl,
      });
      setPassage("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function suggestExample() {
    setIsLoading(true);
    try {
      const response = await callAI(
        "Generate one realistic short methods-section paragraph (3-5 sentences) from a hypothetical education research paper that uses one of: multilevel modeling, fixed effects panel, multiple regression, or mixed methods. Pick varied examples each time.",
        { schema: { properties: { passage: { type: "string" } } } }
      );
      const parsed = JSON.parse(response);
      setPassage(parsed.passage);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  function updateConfidence(doc, level) {
    database.put({ ...doc, confidence: level });
  }

  function deletePaper(doc) {
    database.del(doc._id);
  }

  const c = {
    page: "min-h-screen bg-[oklch(0.96_0.03_70)] text-[oklch(0.25_0.04_30)] font-serif",
    header: "bg-[oklch(0.25_0.04_30)] text-[oklch(0.95_0.03_70)] px-5 py-6 shadow-md",
    title: "text-3xl font-bold tracking-tight",
    tagline: "text-sm italic text-[oklch(0.72_0.15_80)] mt-1",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24",
    section: "bg-white/60 border border-[oklch(0.25_0.04_30/0.15)] rounded-lg p-5 shadow-sm",
    h2: "text-xl font-semibold mb-3 text-[oklch(0.25_0.04_30)]",
    textarea: "w-full border border-[oklch(0.25_0.04_30/0.2)] rounded-md p-3 bg-white text-[oklch(0.25_0.04_30)] min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[oklch(0.65_0.18_55)]",
    input: "w-full border border-[oklch(0.25_0.04_30/0.2)] rounded-md p-2 bg-white",
    btn: "bg-[oklch(0.65_0.18_55)] text-white px-5 py-3 rounded-md font-medium min-h-[44px] hover:bg-[oklch(0.60_0.15_40)] disabled:opacity-50 disabled:cursor-not-allowed transition",
    btnSm: "bg-[oklch(0.60_0.15_40)] text-white text-xs px-2 py-1 rounded hover:opacity-80",
    pill: "inline-block px-2 py-0.5 text-xs rounded-full bg-[oklch(0.72_0.15_80/0.3)] text-[oklch(0.25_0.04_30)] mr-1 mb-1",
    muted: "text-sm text-[oklch(0.50_0.04_30)]",
    paperCard: "border border-[oklch(0.25_0.04_30/0.15)] rounded-md p-3 bg-white/80 mb-2",
    avatar: "w-8 h-8 rounded-full border-2 border-[oklch(0.72_0.15_80)]",
  };

  return (
    <div className={c.page}>
      <header id="app-header" className={c.header}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className={c.title}>Method Spotter</h1>
            <p className={c.tagline}>A study companion for reading regression papers</p>
          </div>
          {viewer && (
            <img src={viewer.avatarUrl} alt={viewer.userSlug} className={c.avatar} />
          )}
        </div>
      </header>

      <main id="app" className={c.main}>
        <section id="paste-analyze" className={c.section}>
          <h2 className={c.h2}>Paste an abstract or methods paragraph</h2>
          {!can("write") ? (
            <p className={c.muted}>Read-only view — contact the owner for write access.</p>
          ) : (
            <>
              <textarea
                className={c.textarea}
                placeholder="Paste a methods section or abstract here..."
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  className={c.btn}
                  onClick={analyze}
                  disabled={isLoading || !passage.trim()}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="50" strokeDashoffset="20" />
                      </svg>
                      Analyzing...
                    </span>
                  ) : "Analyze"}
                </button>
                <button className={c.btnSm} onClick={suggestExample} disabled={isLoading}>
                  Suggest example
                </button>
              </div>
              {result && (
                <div className="mt-4 p-3 bg-[oklch(0.95_0.03_70)] rounded-md text-sm space-y-2">
                  <div><strong>Research question:</strong> {result.researchQuestion}</div>
                  <div><strong>Unit of analysis:</strong> {result.unitOfAnalysis}</div>
                  <div><strong>Data structure:</strong> {result.dataStructure}</div>
                  <div><strong>Model family:</strong> <span className="font-semibold text-[oklch(0.60_0.15_40)]">{result.modelFamily}</span></div>
                  <div><strong>Reasoning:</strong> {result.reasoning}</div>
                  <div className="flex flex-wrap mt-2">
                    {(result.tags || []).map((t, i) => <span key={i} className={c.pill}>{t}</span>)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section id="study-log" className={c.section}>
          <h2 className={c.h2}>Study log ({papers.length})</h2>
          {papers.length === 0 ? (
            <p className={c.muted}>No papers analyzed yet. Paste one above to start your log.</p>
          ) : (
            <ul>
              {papers.map((p) => (
                <li key={p._id} className={c.paperCard}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[oklch(0.60_0.15_40)]">{p.modelFamily}</div>
                      <div className="text-sm mt-1"><em>Question:</em> {p.researchQuestion}</div>
                      <div className="text-xs mt-1 text-[oklch(0.50_0.04_30)]">{p.unitOfAnalysis} · {p.dataStructure}</div>
                      <div className="flex flex-wrap mt-2">
                        {(p.tags || []).map((t, i) => <span key={i} className={c.pill}>{t}</span>)}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-sm">
                        <span className={c.muted}>Confidence:</span>
                        {[1,2,3,4,5].map((n) => (
                          can("write") ? (
                            <button
                              key={n}
                              onClick={() => updateConfidence(p, n)}
                              className={n <= (p.confidence || 0) ? "text-[oklch(0.72_0.15_80)]" : "text-[oklch(0.25_0.04_30/0.3)]"}
                              aria-label={`Set confidence ${n}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
                              </svg>
                            </button>
                          ) : (
                            <span key={n} className={n <= (p.confidence || 0) ? "text-[oklch(0.72_0.15_80)]" : "text-[oklch(0.25_0.04_30/0.3)]"}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
                              </svg>
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                    {can("write") && (
                      <button onClick={() => deletePaper(p)} className="text-[oklch(0.50_0.04_30)] hover:text-[oklch(0.60_0.15_40)]" aria-label="Delete paper">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {p.authorDisplayName && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-[oklch(0.50_0.04_30)]">
                      {p.authorAvatarUrl && <img src={p.authorAvatarUrl} alt={p.authorUserSlug} className="w-5 h-5 rounded-full" />}
                      <span>{p.authorDisplayName}</span>
                      <span>·</span>
                      <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="confidence-chart" className={c.section}>
          <h2 className={c.h2}>Method family confidence</h2>
          {papers.length === 0 ? (
            <p className={c.muted}>Analyze a few papers to see your confidence by method family.</p>
          ) : (
            <ConfidenceChart papers={papers} />
          )}
        </section>
      </main>
    </div>
  );
}