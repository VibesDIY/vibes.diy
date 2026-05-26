import React, { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/react";
import { Result } from "@adviser/cement";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import type {
  ResReportGrowthMemberships,
  ResReportGrowthVibesWithData,
  ResReportActiveMembers,
  ResReportTopVibesByMembers,
  ResReportTopVibesByMembersRow,
  ResReportAttributionReferrers,
  ResReportAttributionReferrersLegacyRow,
} from "@vibes.diy/api-types";
import { MembershipsChart, ActiveMembersChart, VibesWithDataChart } from "./Chart.js";
import vibesDiyLogoUrl from "./vibes-diy-logo.png";

interface AppProps {
  readonly getClerkToken: () => Promise<string | null>;
}

// Same-origin WS — the reports SPA is served by the same worker that
// terminates /api/*, so we always derive the api URL from window.location
// rather than shipping it through config.json.
function deriveApiUrl(): string {
  const proto = window.location.protocol.startsWith("https") ? "wss" : "ws";
  return `${proto}://${window.location.host}/api`;
}

type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "err"; readonly msg: string };

export function App({ getClerkToken }: AppProps) {
  const clerk = useClerk();
  const apiRef = useRef<VibesDiyApi | undefined>(undefined);

  // VibesDiyApi instance is stable for the page lifetime — re-creating it
  // tears down the WS, so memoize via ref so the websocket survives
  // re-renders.
  if (apiRef.current === undefined) {
    apiRef.current = new VibesDiyApi({
      apiUrl: deriveApiUrl(),
      // Pin every reports session to the same DO shard so the colo's
      // CF Cache stays warm across reloads / users. Without this, each
      // page load mints a fresh shard UUID -> new DO -> potentially a
      // different colo -> cold cache, defeating the 10-min TTL.
      shardKey: "reports",
      getToken: async () => {
        const token = await getClerkToken();
        if (token === null) return Result.Err("no clerk token");
        return Result.Ok({ type: "clerk", token });
      },
    });
  }
  const api = apiRef.current;

  const [memberships, setMemberships] = useState<Loadable<ResReportGrowthMemberships>>({ kind: "loading" });
  const [activeMembers, setActiveMembers] = useState<Loadable<ResReportActiveMembers>>({ kind: "loading" });
  const [vibes, setVibes] = useState<Loadable<ResReportGrowthVibesWithData>>({ kind: "loading" });
  const [topVibes, setTopVibes] = useState<Loadable<ResReportTopVibesByMembers>>({ kind: "loading" });
  const [referrers, setReferrers] = useState<Loadable<ResReportAttributionReferrers>>({ kind: "loading" });
  const [referrerFilter, setReferrerFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const [m, a, v, tv] = await Promise.all([
        api.reportGrowthMemberships({}),
        api.reportActiveMembers({}),
        api.reportGrowthVibesWithData({}),
        api.reportTopVibesByMembers({}),
      ]);
      if (ac.signal.aborted) return;
      if (m.isOk()) setMemberships({ kind: "ok", data: m.Ok() });
      else setMemberships({ kind: "err", msg: m.Err().message });
      if (a.isOk()) setActiveMembers({ kind: "ok", data: a.Ok() });
      else setActiveMembers({ kind: "err", msg: a.Err().message });
      if (v.isOk()) setVibes({ kind: "ok", data: v.Ok() });
      else setVibes({ kind: "err", msg: v.Err().message });
      if (tv.isOk()) setTopVibes({ kind: "ok", data: tv.Ok() });
      else setTopVibes({ kind: "err", msg: tv.Err().message });
    })();
    return () => ac.abort();
  }, [api]);

  useEffect(() => {
    const ac = new AbortController();
    setReferrers({ kind: "loading" });
    void (async () => {
      const r = await api.reportAttributionReferrers(referrerFilter !== undefined ? { reqPath: referrerFilter } : {});
      if (ac.signal.aborted) return;
      if (r.isOk()) setReferrers({ kind: "ok", data: r.Ok() });
      else setReferrers({ kind: "err", msg: r.Err().message });
    })();
    return () => ac.abort();
  }, [api, referrerFilter]);

  return (
    <div className="page">
      <ColorStripe />

      <div className="grid-2-1">
        <div
          className="card card--hero hero"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            position: "relative",
            gap: "1rem",
          }}
        >
          <VibesDiyLogo />
          <span className="section-label" style={{ position: "absolute", left: "1.25rem", bottom: "1.25rem", marginBottom: 0 }}>
            Growth Report
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card card--red callout">
            <span className="section-label" style={{ borderColor: "var(--cream)", color: "var(--cream)" }}>
              Builders Joining
            </span>
            <Metric loadable={memberships} pick={(d) => d.total} accent="cream" />
            <p style={{ color: "rgba(255,255,255,0.85)" }}>Non-owner users with durable access to one specific vibe.</p>
          </div>
          <div className="card card--yellow callout">
            <span className="section-label" style={{ borderColor: "var(--black)", color: "var(--black)" }}>
              Vibes With Data
            </span>
            <Metric loadable={vibes} pick={(d) => d.total} accent="black" />
            <p style={{ color: "var(--near-black)" }}>Distinct userSlug/appSlug pairs in AppSlugBindings.</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
        <button className="btn" onClick={() => void clerk.signOut()}>
          Sign out
        </button>
      </div>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">30 Days</span>
          <h2 className="section-title">Memberships over time</h2>
          <p className="section-intro">
            Daily cumulative total of currently active memberships. One non-owner user with durable access to one specific vibe by
            approved request or accepted invite counts as one membership. Hover any point to see who joined that day.
          </p>
          {memberships.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : memberships.kind === "err" ? (
            <ErrorPanel msg={memberships.msg} />
          ) : (
            <MembershipsChart data={memberships.data} />
          )}
        </div>
      </section>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">30 Days</span>
          <h2 className="section-title">Active members per day</h2>
          <p className="section-intro">
            Distinct non-owner members who wrote data to any vibe each day. Non-cumulative — shows engagement, not acquisition. Peak
            value shown above the chart.
          </p>
          {activeMembers.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : activeMembers.kind === "err" ? (
            <ErrorPanel msg={activeMembers.msg} />
          ) : (
            <ActiveMembersChart data={activeMembers.data} />
          )}
        </div>
      </section>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">30 Days</span>
          <h2 className="section-title">Vibes with data over time</h2>
          <p className="section-intro">
            Daily cumulative total of vibes with Fireproof data written by their owner. Each distinct userSlug/appSlug pair in
            AppSlugBindings counts as one active vibe.
          </p>
          {vibes.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : vibes.kind === "err" ? (
            <ErrorPanel msg={vibes.msg} />
          ) : (
            <VibesWithDataChart data={vibes.data} />
          )}
        </div>
      </section>

      <section>
        <div className="card">
          <span className="section-label section-label--filled">All time</span>
          <h2 className="section-title">Referrer attribution</h2>
          <p className="section-intro">External pages ranked by traffic to vibes.diy. Click a landing-page path to drill down.</p>
          {referrerFilter !== undefined && (
            <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "var(--red)" }}>{referrerFilter}</span>
              <button
                className="btn"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                onClick={() => setReferrerFilter(undefined)}
              >
                ← All traffic
              </button>
            </div>
          )}
          {referrers.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : referrers.kind === "err" ? (
            <ErrorPanel msg={referrers.msg} />
          ) : referrers.data.rows.length === 0 ? (
            <div className="empty">No referrer data yet.</div>
          ) : (
            <ReferrersTable data={referrers.data} onDrillDown={setReferrerFilter} activeFilter={referrerFilter} />
          )}
        </div>
      </section>

      {referrers.kind === "ok" && referrers.data.legacyVibeRows.length > 0 && referrerFilter === undefined && (
        <section>
          <div className="card">
            <span className="section-label section-label--filled">Needs repair</span>
            <h2 className="section-title">Legacy vibes needing repair</h2>
            <p className="section-intro">
              Old <code style={{ fontFamily: "monospace" }}>/vibe/&lt;slug&gt;</code> paths with inbound traffic that are
              redirecting to dead paths. Sorted by traffic — fix the highest-traffic ones first.
            </p>
            <LegacyVibesTable rows={referrers.data.legacyVibeRows} />
          </div>
        </section>
      )}

      <section>
        <div className="card">
          <span className="section-label section-label--filled">All time</span>
          <h2 className="section-title">Top vibes by member count</h2>
          <p className="section-intro">Vibes ranked by number of distinct non-owner members with durable access.</p>
          {topVibes.kind === "loading" ? (
            <div className="empty">Loading…</div>
          ) : topVibes.kind === "err" ? (
            <ErrorPanel msg={topVibes.msg} />
          ) : topVibes.data.rows.length === 0 ? (
            <div className="empty">No membership data yet.</div>
          ) : (
            <TopVibesTable rows={topVibes.data.rows} />
          )}
        </div>
      </section>

      <ColorStripe />
    </div>
  );
}

// Brand-canonical logo from landing-pages/vibes-diy-logo.svg. Copied
// verbatim into src/ so the hero ships the same artwork as the marketing
// site — no React reimplementation, no drift if marketing tweaks the file.
function VibesDiyLogo() {
  return (
    <img src={vibesDiyLogoUrl} alt="Vibes DIY" style={{ height: "clamp(96px, 16vw, 180px)", width: "auto", display: "block" }} />
  );
}

function ColorStripe() {
  return (
    <div className="color-stripe">
      <div style={{ background: "var(--red)" }} />
      <div style={{ background: "var(--cyan)" }} />
      <div style={{ background: "var(--yellow)" }} />
      <div style={{ background: "var(--near-black)" }} />
      <div style={{ background: "var(--red)" }} />
      <div style={{ background: "var(--cyan)" }} />
    </div>
  );
}

function Metric<T>({
  loadable,
  pick,
  accent,
}: {
  readonly loadable: Loadable<T>;
  readonly pick: (data: T) => number;
  readonly accent: "cream" | "black";
}) {
  const text = loadable.kind === "ok" ? pick(loadable.data).toLocaleString() : loadable.kind === "err" ? "—" : "…";
  const color = accent === "cream" ? "var(--cream)" : "var(--black)";
  return (
    <div className="callout-stat" style={{ color }}>
      {text}
    </div>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <div className="err">
      <div className="err-label">Error</div>
      <div>{msg}</div>
    </div>
  );
}

function TopVibesTable({ rows }: { readonly rows: ResReportTopVibesByMembersRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", width: "3rem" }}>#</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Vibe</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Members</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.userSlug}/${row.appSlug}`}
              style={{
                borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                background: i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--near-black) 4%, transparent)",
              }}
            >
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", color: "var(--gray-mid)" }}>{i + 1}</td>
              <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace" }}>
                <a
                  href={`https://vibes.diy/vibe/${row.userSlug}/${row.appSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--cyan)", textDecoration: "underline", textDecorationStyle: "dotted" }}
                >
                  {row.userSlug}/{row.appSlug}
                </a>
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{row.memberCount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LegacyVibesTable({ rows }: { readonly rows: ResReportAttributionReferrersLegacyRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Legacy path</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Total hits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.reqPath}
              style={{
                borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                background: i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--near-black) 4%, transparent)",
              }}
            >
              <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace", color: "var(--cyan)" }}>
                <a
                  href={`https://vibes.diy${row.reqPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "underline", textDecorationStyle: "dotted" }}
                >
                  {row.reqPath}
                </a>
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{row.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferrersTable({
  data,
  onDrillDown,
  activeFilter,
}: {
  readonly data: ResReportAttributionReferrers;
  readonly onDrillDown: (reqPath: string) => void;
  readonly activeFilter: string | undefined;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Host</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Referrer path</th>
            <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Landing page</th>
            <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr
              key={`${row.refHost}${row.refPath}${row.reqPath}`}
              style={{
                borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                background: i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--near-black) 4%, transparent)",
              }}
            >
              <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace" }}>
                <a
                  href={`https://${row.refHost}${row.refPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "underline", textDecorationStyle: "dotted" }}
                >
                  {row.refHost}
                </a>
              </td>
              <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace", color: "var(--red)" }}>
                <a
                  href={`https://${row.refHost}${row.refPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "underline", textDecorationStyle: "dotted" }}
                >
                  {row.refPath}
                </a>
              </td>
              <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace" }}>
                {activeFilter === undefined ? (
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontFamily: "monospace",
                      fontSize: "inherit",
                      color: "var(--cyan)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textDecorationStyle: "dotted",
                    }}
                    onClick={() => onDrillDown(row.reqPath)}
                  >
                    {row.reqPath}
                  </button>
                ) : (
                  row.reqPath
                )}
              </td>
              <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{row.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
