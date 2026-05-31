import React, { useEffect, useRef, useState } from "react";
import type {
  ResReportCampaignHealth,
  ResReportCampaignHealthCampaignRow,
  ResReportCampaignAdPreviewsAd,
} from "@vibes.diy/api-types";
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

function costPerCtaClick(row: ResReportCampaignHealthCampaignRow): number {
  const c = row.ctaClicks;
  return c !== undefined && c > 0 ? Number(row.spend) / c : Infinity;
}

function ctaRate(row: ResReportCampaignHealthCampaignRow): number | null {
  if (row.ctaClicksIsShared) return null;
  const l = lpv(row);
  const c = row.ctaClicks;
  return l > 0 && c !== undefined ? c / l : null;
}

function rowBg(cplv: number): string {
  if (cplv === Infinity) return "transparent";
  if (cplv < 0.3) return "rgba(0,200,100,0.15)";
  if (cplv <= 0.5) return "rgba(254,221,0,0.25)";
  return "rgba(218,41,28,0.15)";
}

type SortCol =
  | "name"
  | "ctr"
  | "cpc"
  | "spend"
  | "reach"
  | "landings"
  | "costPerLanding"
  | "ctaClicks"
  | "costPerCtaClick"
  | "ctaRate"
  | "stayed"
  | "signups"
  | "costPerSignup";

const naturalDir: Record<SortCol, "asc" | "desc"> = {
  name: "asc",
  ctr: "desc",
  cpc: "asc",
  spend: "desc",
  reach: "desc",
  landings: "desc",
  costPerLanding: "asc",
  ctaClicks: "desc",
  costPerCtaClick: "asc",
  ctaRate: "desc",
  stayed: "desc",
  signups: "desc",
  costPerSignup: "asc",
};

function sortVal(row: ResReportCampaignHealthCampaignRow, col: SortCol): number | string | null {
  switch (col) {
    case "name":
      return row.campaign_name;
    case "ctr":
      return row.ctr !== undefined ? Number(row.ctr) : null;
    case "cpc":
      return row.cpc !== undefined ? Number(row.cpc) : null;
    case "spend":
      return Number(row.spend);
    case "reach":
      return row.reach !== undefined ? Number(row.reach) : null;
    case "landings": {
      const v = lpv(row);
      return v > 0 ? v : null;
    }
    case "costPerLanding": {
      const v = costPerLpv(row);
      return isFinite(v) ? v : null;
    }
    case "ctaClicks":
      return row.ctaClicks ?? null;
    case "costPerCtaClick": {
      const v = costPerCtaClick(row);
      return isFinite(v) ? v : null;
    }
    case "ctaRate":
      return ctaRate(row);
    case "stayed": {
      const v = contentViews(row);
      return v > 0 ? v : null;
    }
    case "signups": {
      const v = registrations(row);
      return v > 0 ? v : null;
    }
    case "costPerSignup": {
      const v = costPerReg(row);
      return isFinite(v) ? v : null;
    }
  }
}

function sortRows(
  rows: ResReportCampaignHealthCampaignRow[],
  col: SortCol,
  dir: "asc" | "desc"
): ResReportCampaignHealthCampaignRow[] {
  return [...rows].sort((a, b) => {
    const va = sortVal(a, col);
    const vb = sortVal(b, col);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "string" && typeof vb === "string") {
      return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtMoney(n: number): string {
  if (isFinite(n) === false) return "—";
  return `$${fmt(n)}`;
}

type PreviewState = Loadable<ResReportCampaignAdPreviewsAd[]>;

function AdPreviewRow({
  campaignId,
  api,
  colSpan,
  cachedData,
  onLoaded,
}: {
  readonly campaignId: string;
  readonly api: VibesDiyApi;
  readonly colSpan: number;
  readonly cachedData: ResReportCampaignAdPreviewsAd[] | undefined;
  readonly onLoaded: (id: string, ads: ResReportCampaignAdPreviewsAd[]) => void;
}) {
  const [state, setState] = useState<PreviewState>(
    cachedData !== undefined ? { kind: "ok", data: cachedData } : { kind: "loading" }
  );

  useEffect(() => {
    if (cachedData !== undefined) return;
    const ac = new AbortController();
    void (async () => {
      const r = await api.reportCampaignAdPreviews({ campaign_id: campaignId });
      if (ac.signal.aborted) return;
      if (r.isOk()) {
        const ads = r.Ok().ads;
        onLoaded(campaignId, ads);
        setState({ kind: "ok", data: ads });
      } else {
        setState({ kind: "err", msg: r.Err().message });
      }
    })();
    return () => ac.abort();
  }, [api, campaignId, cachedData, onLoaded]);

  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{ padding: "1rem 0.75rem", background: "color-mix(in srgb, var(--near-black) 4%, transparent)" }}
      >
        {state.kind === "loading" && <div style={{ color: "var(--gray-mid)", fontSize: "0.8rem" }}>Loading ad previews…</div>}
        {state.kind === "err" && <div style={{ color: "var(--red)", fontSize: "0.8rem" }}>Error: {state.msg}</div>}
        {state.kind === "ok" && state.data.length === 0 && (
          <div style={{ color: "var(--gray-mid)", fontSize: "0.8rem" }}>No ads found for this campaign.</div>
        )}
        {state.kind === "ok" && state.data.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {state.data.map((ad) => (
              <div
                key={ad.id}
                style={{
                  background: "var(--white, #fff)",
                  borderRadius: "8px",
                  boxShadow: "0 1px 4px rgba(0,0,0,.12)",
                  overflow: "hidden",
                  display: "inline-block",
                  verticalAlign: "top",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#444",
                    borderBottom: "1px solid #f0f2f5",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span>
                    {ad.name}&nbsp;
                    <span style={{ color: ad.effective_status === "ACTIVE" ? "#2d9f3d" : "#888", fontWeight: 400 }}>
                      {ad.effective_status}
                    </span>
                  </span>
                </div>
                <div style={{ padding: "12px" }}>
                  {ad.error !== undefined ? (
                    <div style={{ color: "#c00", fontSize: "12px" }}>Error: {ad.error}</div>
                  ) : ad.previewSrc !== undefined ? (
                    <iframe
                      src={ad.previewSrc}
                      sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation allow-forms"
                      style={{ border: "none", display: "block" }}
                      width={320}
                      height={500}
                    />
                  ) : (
                    <div style={{ color: "#888", fontSize: "12px" }}>No preview available.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export function CampaignHealth({ api }: { readonly api: VibesDiyApi }) {
  const [data, setData] = useState<Loadable<ResReportCampaignHealth>>({ kind: "loading" });
  const [elapsed, setElapsed] = useState(0);
  const [sortCol, setSortCol] = useState<SortCol>("costPerLanding");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const previewCacheRef = useRef<Map<string, ResReportCampaignAdPreviewsAd[]>>(new Map());

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(naturalDir[col]);
    }
  }

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

  const displayRows = sortRows(d.ranked, sortCol, sortDir);

  function SortTh({ col, label, left }: { col: SortCol; label: string; left?: boolean }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => handleSort(col)}
        style={{
          textAlign: left ? "left" : "right",
          padding: "0.5rem 0.75rem",
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          color: active ? "var(--near-black)" : "var(--gray-mid)",
        }}
      >
        {label}
        {active && <span style={{ marginLeft: "0.3em", fontSize: "0.7em" }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </th>
    );
  }

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

  const COL_COUNT = 13;

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
          { label: "Landings", value: totalLpv.toLocaleString() },
          { label: "Signups", value: totalReg > 0 ? totalReg.toLocaleString() : "—" },
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
          Cost / landing
        </span>
        {[
          { bg: "rgba(0,200,100,0.25)", border: "rgba(0,200,100,0.6)", label: "< $0.30", desc: "efficient" },
          { bg: "rgba(254,221,0,0.35)", border: "rgba(200,170,0,0.5)", label: "$0.30 – $0.50", desc: "watch" },
          { bg: "rgba(218,41,28,0.18)", border: "rgba(218,41,28,0.4)", label: "> $0.50", desc: "expensive" },
          { bg: "transparent", border: "color-mix(in srgb, var(--near-black) 20%, transparent)", label: "—", desc: "no landings" },
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
          <p className="section-intro">
            Click any column header to sort. Default: cost per landing. Click a row to preview its ads.
          </p>
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
              ["Spend", "Total ad spend in the selected date range, as reported by Meta."],
              [
                "Ad Reach",
                "Unique people who saw the ad at least once in the period, deduplicated by Meta account. One person seeing the same ad 3 times = 3 impressions, 1 reach.",
              ],
              [
                "Landings",
                "Meta landing_page_view — browser pixel on good.vibes.diy confirming the ad destination page loaded. Step 1: Ad click → good.vibes.diy counted here.",
              ],
              ["Cost/Landing", "Spend ÷ landings. Primary efficiency metric — drives row color coding."],
              [
                "Unique CTA Visitors",
                "Distinct fbclid values from Meta-attributed sessions that clicked through from good.vibes.diy to vibes.diy (date-scoped to the report window). One user clicking multiple CTAs counts once. Organic visits without fbclid are excluded. — means no destination URL is set for the campaign. ~ prefix means multiple campaigns share this landing page and utm_campaign is not yet set — the count is a page-level total, not per-campaign; add utm_campaign to the ad URL to enable per-campaign attribution.",
              ],
              [
                "Cost/Visitor",
                "Spend ÷ unique CTA visitors. Cost of getting one Meta-attributed user from the landing page to vibes.diy.",
              ],
              [
                "Conversion Rate",
                "Unique CTA Visitors ÷ Landings. What fraction of Meta landing page views converted to a vibes.diy click-through. Key conversion metric for landing page effectiveness.",
              ],
              [
                "Stayed",
                "CAPI ViewContent — fires after 10 s dwell or 25 % scroll on the vibes.diy vibe page, only for fbclid-attributed sessions. Step 3: arrived on vibes.diy and didn't immediately leave. Shows — when Meta's attribution window has expired.",
              ],
              [
                "Signups",
                "CAPI CompleteRegistration — fires when a new Clerk account is created within 2 min of the fbclid session. Step 4: stayed → signed up. Undercounts vs Ads Manager (2-min window vs Meta's 1-day attribution; requires fbclid in session).",
              ],
              ["Cost/Signup", "Spend ÷ signups. End-to-end cost of acquiring one new registered user from this campaign."],
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
                  <SortTh col="name" label="Campaign" left />
                  <SortTh col="ctr" label="Click Rate" />
                  <SortTh col="cpc" label="Cost/Click" />
                  <SortTh col="spend" label="Spend" />
                  <SortTh col="reach" label="Ad Reach" />
                  <SortTh col="landings" label="Landings" />
                  <SortTh col="costPerLanding" label="Cost/Landing" />
                  <SortTh col="ctaClicks" label="CTA Visitors" />
                  <SortTh col="costPerCtaClick" label="Cost/Visitor" />
                  <SortTh col="ctaRate" label="Conv%" />
                  <SortTh col="stayed" label="Stayed" />
                  <SortTh col="signups" label="Signups" />
                  <SortTh col="costPerSignup" label="Cost/Signup" />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => {
                  const cplv = costPerLpv(row);
                  const reg = registrations(row);
                  const cpr = costPerReg(row);
                  const isPaused = row.effective_status !== undefined && row.effective_status !== "ACTIVE";
                  const isExpanded = expandedId === row.campaign_id;
                  return (
                    <React.Fragment key={row.campaign_id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : row.campaign_id)}
                        style={{
                          borderBottom: "1px solid color-mix(in srgb, var(--near-black) 15%, transparent)",
                          background: rowBg(cplv),
                          opacity: isPaused ? 0.45 : 1,
                          cursor: "pointer",
                        }}
                      >
                        <td style={{ padding: "0.4rem 0.75rem" }}>
                          <span
                            style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--gray-mid)", marginRight: "0.5rem" }}
                          >
                            {i + 1}.
                          </span>
                          {row.campaign_name}
                          {isPaused && (
                            <span
                              style={{
                                marginLeft: "0.5rem",
                                fontSize: "0.65rem",
                                fontWeight: "bold",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--gray-mid)",
                              }}
                            >
                              {row.effective_status}
                            </span>
                          )}
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "var(--gray-mid)" }}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                          {row.ctr !== undefined ? `${Number(row.ctr).toFixed(2)}%` : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                          {row.cpc !== undefined ? fmtMoney(Number(row.cpc)) : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{fmtMoney(Number(row.spend))}</td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                          {row.reach !== undefined ? Number(row.reach).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{lpv(row).toLocaleString() || "—"}</td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{fmtMoney(cplv)}</td>
                        <td
                          style={{
                            padding: "0.4rem 0.75rem",
                            textAlign: "right",
                            color: row.ctaClicksIsShared ? "var(--gray-mid)" : undefined,
                          }}
                        >
                          {row.ctaClicks !== undefined
                            ? row.ctaClicks > 0
                              ? `${row.ctaClicksIsShared ? "~" : ""}${row.ctaClicks.toLocaleString()}`
                              : "0"
                            : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                          {row.ctaClicksIsShared ? "—" : fmtMoney(costPerCtaClick(row))}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                          {(() => {
                            const r = ctaRate(row);
                            return r !== null ? `${(r * 100).toFixed(1)}%` : "—";
                          })()}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                          {contentViews(row) > 0 ? contentViews(row).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{reg > 0 ? reg.toLocaleString() : "—"}</td>
                        <td style={{ padding: "0.4rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{fmtMoney(cpr)}</td>
                      </tr>
                      {isExpanded && (
                        <AdPreviewRow
                          campaignId={row.campaign_id}
                          api={api}
                          colSpan={COL_COUNT}
                          cachedData={previewCacheRef.current.get(row.campaign_id)}
                          onLoaded={(id, ads) => {
                            previewCacheRef.current.set(id, ads);
                          }}
                        />
                      )}
                    </React.Fragment>
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
            <strong>Budget outliers</strong> = spend &gt;2× the median. <strong>Low landing ratio</strong> = high clicks but few
            landing page views (possible landing page issue).
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
                  <span style={{ fontFamily: "monospace" }}>{e.name}</span>: {e.clicks} clicks, {e.lpvs} landings ({e.ratio})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
