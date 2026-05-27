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

      {/* Campaigns table */}
      <section>
        <div className="card">
          <span className="section-label">Campaigns</span>
          <h2 className="section-title">Campaigns by Efficiency</h2>
          <p className="section-intro">
            Ranked by cost per site visit (ascending). Color-coded: green &lt; $0.30, yellow $0.30–$0.50, red &gt; $0.50.
          </p>
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
                      <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{row.ctr}</td>
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
