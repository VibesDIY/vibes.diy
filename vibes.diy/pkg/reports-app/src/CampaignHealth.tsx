import React, { useEffect, useState } from "react";
import type { ResReportCampaignHealth, ResReportCampaignHealthCampaignRow } from "@vibes.diy/api-types";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import type { Loadable } from "./types.js";

function actionVal(row: ResReportCampaignHealthCampaignRow, type: string): number {
  return Number(row.actions?.find((a) => a.action_type === type)?.value ?? 0);
}

function lpv(row: ResReportCampaignHealthCampaignRow): number {
  return actionVal(row, "landing_page_view");
}

function contentViews(row: ResReportCampaignHealthCampaignRow): number {
  return actionVal(row, "view_content") + actionVal(row, "offsite_conversion.fb_pixel_view_content");
}

function registrations(row: ResReportCampaignHealthCampaignRow): number {
  return actionVal(row, "complete_registration") + actionVal(row, "offsite_conversion.fb_pixel_complete_registration");
}

function costPerLpv(row: ResReportCampaignHealthCampaignRow): number {
  const l = lpv(row);
  return l > 0 ? Number(row.spend) / l : Infinity;
}

function costPerReg(row: ResReportCampaignHealthCampaignRow): number {
  const r = registrations(row);
  return r > 0 ? Number(row.spend) / r : Infinity;
}

function rowBg(cplv: number): string {
  if (cplv === Infinity) return "transparent";
  if (cplv < 0.3) return "rgba(0,200,100,0.15)";
  if (cplv <= 0.5) return "rgba(254,221,0,0.25)";
  return "rgba(218,41,28,0.15)";
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtMoney(n: number): string {
  if (isFinite(n) === false) return "—";
  return `$${fmt(n)}`;
}

export function CampaignHealth({ api }: { readonly api: VibesDiyApi }) {
  const [data, setData] = useState<Loadable<ResReportCampaignHealth>>({ kind: "loading" });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (data.kind !== "loading") return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [data.kind]);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const r = await api.reportCampaignHealth({});
      if (ac.signal.aborted) return;
      if (r.isOk()) setData({ kind: "ok", data: r.Ok() });
      else setData({ kind: "err", msg: r.Err().message, code: r.Err().error?.code });
    })();
    return () => ac.abort();
  }, [api]);

  if (data.kind === "loading") {
    const stage =
      elapsed < 2 ? "Connecting…" : elapsed < 5 ? "Fetching from Meta Ads API…" : `Fetching from Meta Ads API… (${elapsed}s)`;
    return (
      <div className="page">
        <div className="empty">{stage}</div>
      </div>
    );
  }

  if (data.kind === "err") {
    const title =
      data.code === "report-not-authorized"
        ? "Not Authorized"
        : data.code === "meta-creds-missing"
          ? "Configuration Error"
          : data.code === "meta-api-error"
            ? "Meta API Error"
            : data.code === "request-timeout"
              ? "Request Timed Out"
              : data.code === "websocket-closed" || data.code === "websocket-error"
                ? "Connection Error"
                : "Error";
    return (
      <div className="page">
        <div className="err">
          <div className="err-label">{title}</div>
          <div>{data.msg}</div>
          {data.code && <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>code: {data.code}</div>}
        </div>
      </div>
    );
  }

  const d = data.data;
  const { anomalies } = d;

  const totalSpend = d.ranked.reduce((sum, r) => sum + Number(r.spend), 0);
  const totalClicks = d.ranked.reduce((sum, r) => sum + Number(r.clicks), 0);
  const totalImpressions = d.ranked.reduce((sum, r) => sum + Number(r.impressions), 0);
  const totalLpv = d.ranked.reduce((sum, r) => sum + lpv(r), 0);
  const totalReg = d.ranked.reduce((sum, r) => sum + registrations(r), 0);
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const hasAnomalies =
    anomalies.duplicateNames.length > 0 ||
    anomalies.zeroSpend.length > 0 ||
    anomalies.budgetOutliers.length > 0 ||
    anomalies.lowLpvRatio.length > 0 ||
    (anomalies.pixel !== null && anomalies.pixel.error !== undefined);

  return (
    <>
      {/* Hero card */}
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
          marginBottom: "1.5rem",
        }}
      >
        <span className="section-label" style={{ position: "absolute", left: "1.25rem", bottom: "1.25rem", marginBottom: 0 }}>
          Campaign Health
        </span>
        <h1>Campaign Health</h1>
        <p className="hero-sub">
          {d.dateLabel} &mdash; generated {d.generatedAt}
        </p>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total Spend", value: fmtMoney(totalSpend) },
          { label: "Ad Clicks", value: totalClicks.toLocaleString() },
          { label: "Click Rate", value: totalImpressions > 0 ? `${overallCtr.toFixed(2)}%` : "—" },
          { label: "Site Visits", value: totalLpv.toLocaleString() },
          { label: "Registrations", value: totalReg > 0 ? totalReg.toLocaleString() : "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--paper)",
              border: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
              borderRadius: "var(--radius)",
              padding: "0.875rem 1rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
            <div
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                opacity: 0.5,
                marginTop: "0.25rem",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
          padding: "0.75rem 1.25rem",
          background: "var(--paper)",
          border: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
          borderRadius: "var(--radius)",
          fontSize: "0.8rem",
        }}
      >
        <span style={{ fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.7rem", opacity: 0.5 }}>
          Cost / site visit
        </span>
        {[
          { bg: "rgba(0,200,100,0.25)", border: "rgba(0,200,100,0.6)", label: "< $0.30", desc: "efficient" },
          { bg: "rgba(254,221,0,0.35)", border: "rgba(200,170,0,0.5)", label: "$0.30 – $0.50", desc: "watch" },
          { bg: "rgba(218,41,28,0.18)", border: "rgba(218,41,28,0.4)", label: "> $0.50", desc: "expensive" },
          { bg: "transparent", border: "color-mix(in srgb, var(--near-black) 20%, transparent)", label: "—", desc: "no visits" },
        ].map(({ bg, border, label, desc }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "1.25rem",
                height: "1.25rem",
                borderRadius: "3px",
                background: bg,
                border: `1px solid ${border}`,
                flexShrink: 0,
              }}
            />
            <span>
              <strong>{label}</strong>
              <span style={{ opacity: 0.55, marginLeft: "0.3rem" }}>{desc}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <section>
        <div className="card">
          <span className="section-label">Campaigns</span>
          <h2 className="section-title">Campaigns by Efficiency</h2>
          <p className="section-intro">Ranked by cost per site visit (ascending).</p>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "max-content 1fr",
              gap: "0.25rem 1rem",
              fontSize: "0.8rem",
              opacity: 0.65,
              marginBottom: "1rem",
            }}
          >
            {[
              [
                "Click Rate",
                "Ad click-through rate (CTR) — clicks ÷ impressions. How effectively the ad creative attracts clicks. Meta returns this per campaign.",
              ],
              ["Cost/Click", "Spend ÷ clicks (CPC). Cost of getting someone to click the ad and land on good.vibes.diy."],
              [
                "Site Visits",
                "Meta landing_page_view action — fires when someone clicked the ad and successfully loaded the good.vibes.diy landing page. Step 2 of the funnel: Ad → good.vibes.diy (counted here).",
              ],
              [
                "Content Views",
                "CAPI ViewContent — fires server-side (relayed from vibes.diy client) after a user dwells 10 s or scrolls 25 % on vibes.diy. Step 3: good.vibes.diy → vibes.diy → engagement (counted here). See Pixel Health below for raw totals.",
              ],
              [
                "Registrations",
                "CAPI CompleteRegistration — fires when a new Clerk account is created within 2 min of the user's fbclid-attributed session. Requires the user to sign up on vibes.diy in the same session as the ad click.",
              ],
              ["Cost/Visit", "Spend ÷ site visits. Primary efficiency metric — drives row color coding."],
            ].map(([term, def]) => (
              <React.Fragment key={term}>
                <dt style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{term}</dt>
                <dd style={{ margin: 0 }}>{def}</dd>
              </React.Fragment>
            ))}
          </dl>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Campaign</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Click Rate</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Cost/Click</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Spend</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Reach</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Site Visits</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Cost/Visit</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Content Views</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Registrations</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Cost/Reg</th>
                </tr>
              </thead>
              <tbody>
                {d.ranked.map((row, i) => {
                  const cplv = costPerLpv(row);
                  const reg = registrations(row);
                  const cpr = costPerReg(row);
                  return (
                    <tr
                      key={row.campaign_id}
                      style={{
                        borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                        background: rowBg(cplv),
                      }}
                    >
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <span
                          style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--gray-mid)", marginRight: "0.5rem" }}
                        >
                          {i + 1}.
                        </span>
                        {row.campaign_name}
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                        {row.ctr !== undefined ? `${Number(row.ctr).toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{fmtMoney(Number(row.cpc))}</td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{fmtMoney(Number(row.spend))}</td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{Number(row.reach).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{lpv(row).toLocaleString() || "—"}</td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{fmtMoney(cplv)}</td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                        {contentViews(row) > 0 ? contentViews(row).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{reg > 0 ? reg.toLocaleString() : "—"}</td>
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{fmtMoney(cpr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pixel health */}
      <section>
        <div className="card">
          <span className="section-label">Pixel</span>
          <h2 className="section-title">Pixel Health</h2>
          <p className="section-intro" style={{ opacity: 0.7 }}>
            Direct pixel event counts from the Meta Conversions API — not filtered by campaign attribution. Shows every event
            received regardless of attribution window. <strong>Last fired</strong> = most recent pixel event of any type.
          </p>
          {anomalies.pixel === null ? (
            <div className="empty">No pixel data.</div>
          ) : anomalies.pixel.error !== undefined ? (
            <div className="err">
              <div className="err-label">Pixel Error</div>
              <div>{anomalies.pixel.error}</div>
            </div>
          ) : (
            <>
              {anomalies.pixel.lastFired !== undefined && <p className="section-intro">Last fired: {anomalies.pixel.lastFired}</p>}
              {anomalies.pixel.counts !== undefined && Object.keys(anomalies.pixel.counts).length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--near-black)" }}>
                        <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Event</th>
                        <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(anomalies.pixel.counts).map(([event, count], i) => (
                        <tr
                          key={event}
                          style={{
                            borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                            background: i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--near-black) 4%, transparent)",
                          }}
                        >
                          <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace" }}>{event}</td>
                          <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Anomalies */}
      <section>
        <div className="card">
          <span className="section-label">Anomalies</span>
          <h2 className="section-title">Anomalies</h2>
          <p className="section-intro" style={{ opacity: 0.7 }}>
            Automatically flagged issues across all campaigns. <strong>Duplicate names</strong> = same name on multiple campaigns
            (may split budget unintentionally). <strong>Zero spend</strong> = active campaign with no spend in period.{" "}
            <strong>Budget outliers</strong> = spend &gt;2× the median. <strong>Low LPV ratio</strong> = high clicks but few landing
            page views (possible landing page issue).
          </p>
          {hasAnomalies === false ? (
            <span
              className="section-label section-label--filled"
              style={{ background: "var(--cyan)", borderColor: "var(--cyan)", color: "var(--near-black)" }}
            >
              No anomalies
            </span>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {anomalies.duplicateNames.length > 0 && (
                <li>
                  <strong>Duplicate names:</strong>{" "}
                  {anomalies.duplicateNames.map((n) => (
                    <span key={n} style={{ fontFamily: "monospace", marginRight: "0.5rem" }}>
                      {n}
                    </span>
                  ))}
                </li>
              )}
              {anomalies.zeroSpend.length > 0 && (
                <li>
                  <strong>Zero spend:</strong>{" "}
                  {anomalies.zeroSpend.map((n) => (
                    <span key={n} style={{ fontFamily: "monospace", marginRight: "0.5rem" }}>
                      {n}
                    </span>
                  ))}
                </li>
              )}
              {anomalies.budgetOutliers.map((o) => (
                <li key={o.name}>
                  <span style={{ fontFamily: "monospace" }}>{o.name}</span> spends ${o.spend} vs median ${o.medianSpend}
                </li>
              ))}
              {anomalies.lowLpvRatio.map((e) => (
                <li key={e.name}>
                  <span style={{ fontFamily: "monospace" }}>{e.name}</span>: {e.clicks} clicks, {e.lpvs} LPVs ({e.ratio})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
