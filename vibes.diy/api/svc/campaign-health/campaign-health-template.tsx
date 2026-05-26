import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export interface CampaignRow {
  readonly campaign_name: string;
  readonly campaign_id: string;
  readonly impressions: string;
  readonly clicks: string;
  readonly spend: string;
  readonly ctr: string;
  readonly cpc: string;
  readonly reach: string;
  readonly actions?: readonly { readonly action_type: string; readonly value: string }[];
}

export interface PixelSummary {
  readonly lastFired?: string;
  readonly counts?: Record<string, number>;
  readonly error?: string;
}

export interface BudgetOutlier {
  readonly name: string;
  readonly spend: string;
  readonly medianSpend: string;
}

export interface LowLpvEntry {
  readonly name: string;
  readonly clicks: number;
  readonly lpvs: number;
  readonly ratio: number;
}

export interface CampaignAnomalies {
  readonly duplicateNames: readonly string[];
  readonly budgetOutliers: readonly BudgetOutlier[];
  readonly zeroSpend: readonly string[];
  readonly lowLpvRatio: readonly LowLpvEntry[];
  readonly pixel: PixelSummary | null;
}

export interface CampaignHealthData {
  readonly generatedAt: string;
  readonly dateLabel: string;
  readonly ranked: readonly CampaignRow[];
  readonly anomalies: CampaignAnomalies;
}

function lpv(row: CampaignRow): number {
  return Number(row.actions?.find((a) => a.action_type === "landing_page_view")?.value ?? 0);
}

function costPerLpv(row: CampaignRow): number {
  const l = lpv(row);
  return l > 0 ? Number(row.spend) / l : Infinity;
}

function costPerLpvStr(row: CampaignRow): string {
  const c = costPerLpv(row);
  return c === Infinity ? "—" : `$${c.toFixed(2)}`;
}

function lpvTier(row: CampaignRow): "green" | "yellow" | "red" {
  const c = costPerLpv(row);
  if (c < 0.3) return "green";
  if (c <= 0.5) return "yellow";
  return "red";
}

function shortName(name: string): string {
  return name.replace(/^vibes-diy-|-2026-\d\d-\d\d$/g, "");
}

const css = `
:root {
  color-scheme: light;
  --paper: #f1f5f9;
  --grid-soft: #cbd5e1;
  --slate: #64748b;
  --ink: #0f172a;
  --plate: #ffffff;
  --panel: #e2e8f0;
  --shadow: #242424;
  --green: #16a34a;
  --yellow: #ca8a04;
  --red: #dc2626;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html {
  background:
    repeating-linear-gradient(0deg, transparent 0 19px, var(--grid-soft) 19px 20px),
    repeating-linear-gradient(90deg, transparent 0 19px, var(--grid-soft) 19px 20px),
    linear-gradient(180deg, #f8fbff 0%, var(--paper) 100%);
  background-attachment: fixed;
}
body {
  font-family: "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--ink);
  min-height: 100vh;
}
main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 72px; }
h1 {
  font-size: clamp(36px, 6vw, 64px);
  line-height: 0.95;
  letter-spacing: -0.04em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
h2 {
  font-size: 22px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: inline-block;
  background: var(--panel);
  border: 4px solid var(--ink);
  padding: 8px 12px 6px;
  box-shadow: 5px 5px 0 var(--shadow);
  margin-bottom: 14px;
}
p { color: var(--slate); font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
.hero-panel {
  background: var(--plate);
  border: 6px solid var(--ink);
  box-shadow: 12px 12px 0 var(--shadow);
  padding: 20px 24px;
  margin-bottom: 28px;
}
.kicker {
  display: inline-block;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: #dbe4ef;
  border: 2px solid var(--ink);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.meta { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 13px; color: var(--slate); margin-top: 8px; }
section { margin-top: 28px; }
.table-wrap {
  overflow: auto;
  border: 4px solid var(--ink);
  background: var(--plate);
  box-shadow: 10px 10px 0 var(--shadow);
  margin-top: 14px;
}
table { width: 100%; border-collapse: collapse; }
th, td {
  text-align: left;
  vertical-align: top;
  padding: 10px 12px;
  border-bottom: 2px solid var(--ink);
  border-right: 2px solid var(--ink);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 13px;
}
th:last-child, td:last-child { border-right: 0; }
tbody tr:last-child td { border-bottom: 0; }
th {
  position: sticky;
  top: 0;
  background: var(--panel);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  z-index: 1;
}
.tier-green { color: var(--green); font-weight: 700; }
.tier-yellow { color: var(--yellow); font-weight: 700; }
.tier-red { color: var(--red); font-weight: 700; }
.dupe { color: var(--red); font-size: 11px; margin-left: 4px; }
.anomaly-list {
  background: var(--plate);
  border: 4px solid var(--ink);
  box-shadow: 8px 8px 0 var(--shadow);
  padding: 14px 18px;
  margin-top: 14px;
}
.anomaly-list li { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 13px; margin: 6px 0 6px 18px; }
.anomaly-list li strong { color: var(--ink); }
.ok-badge {
  display: inline-block;
  margin-top: 14px;
  padding: 8px 14px;
  background: #dcfce7;
  border: 3px solid var(--green);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: var(--green);
  font-weight: 700;
}
.pixel-card {
  background: var(--plate);
  border: 4px solid var(--ink);
  box-shadow: 8px 8px 0 var(--shadow);
  padding: 14px 18px;
  margin-top: 14px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 13px;
}
.pixel-card .label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--slate);
  margin-bottom: 6px;
  font-weight: 700;
}
.pixel-card ul { margin: 8px 0 0 18px; }
.pixel-card li { margin: 3px 0; }
.tier-key { display: flex; gap: 16px; margin-top: 8px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 12px; }
.tier-key span { display: flex; align-items: center; gap: 4px; }
`;

function TierBadge({ row }: { readonly row: CampaignRow }): React.ReactElement {
  const tier = lpvTier(row);
  const cls = `tier-${tier}`;
  const str = costPerLpvStr(row);
  return <span className={cls}>{str}</span>;
}

function CampaignTable({
  ranked,
  dupes,
}: {
  readonly ranked: readonly CampaignRow[];
  readonly dupes: readonly string[];
}): React.ReactElement {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>CTR</th>
            <th>CPC</th>
            <th>LPVs</th>
            <th>Cost/LPV</th>
            <th>Spend</th>
            <th>Reach</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row) => (
            <tr key={row.campaign_id}>
              <td>
                {shortName(row.campaign_name)}
                {dupes.includes(row.campaign_name) && <span className="dupe">⚠ dupe</span>}
              </td>
              <td>{Number(row.ctr).toFixed(2)}%</td>
              <td>${Number(row.cpc).toFixed(2)}</td>
              <td>{lpv(row)}</td>
              <td>
                <TierBadge row={row} />
              </td>
              <td>${Number(row.spend).toFixed(2)}</td>
              <td>{Number(row.reach).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnomalySection({ anomalies }: { readonly anomalies: CampaignAnomalies }): React.ReactElement {
  const hasAny =
    anomalies.duplicateNames.length > 0 ||
    anomalies.zeroSpend.length > 0 ||
    anomalies.budgetOutliers.length > 0 ||
    anomalies.lowLpvRatio.length > 0;

  if (!hasAny) {
    return <div className="ok-badge">✓ No anomalies detected</div>;
  }

  return (
    <div className="anomaly-list">
      <ul>
        {anomalies.duplicateNames.map((name) => (
          <li key={`dupe-${name}`}>
            <strong>Duplicate name:</strong> {name}
          </li>
        ))}
        {anomalies.zeroSpend.map((name) => (
          <li key={`zero-${name}`}>
            <strong>Zero spend:</strong> {name}
          </li>
        ))}
        {anomalies.budgetOutliers.map((o) => (
          <li key={`outlier-${o.name}`}>
            <strong>Underspend:</strong> {o.name} (${o.spend} vs median ${o.medianSpend})
          </li>
        ))}
        {anomalies.lowLpvRatio.map((o) => (
          <li key={`lpv-${o.name}`}>
            <strong>Low LPV ratio:</strong> {o.name} ({o.lpvs}/{o.clicks} = {(o.ratio * 100).toFixed(0)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

function PixelSection({ pixel }: { readonly pixel: PixelSummary | null }): React.ReactElement {
  if (!pixel) return <div className="pixel-card">Pixel data unavailable.</div>;
  if (pixel.error) return <div className="pixel-card">Pixel error: {pixel.error}</div>;

  return (
    <div className="pixel-card">
      <div className="label">Pixel status</div>
      <div>Last fired: {pixel.lastFired ?? "unknown"}</div>
      {pixel.counts && Object.keys(pixel.counts).length > 0 && (
        <ul>
          {Object.entries(pixel.counts).map(([event, count]) => (
            <li key={event}>
              {event}: {count}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportPage({ data }: { readonly data: CampaignHealthData }): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Campaign Health — {data.dateLabel}</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <main>
          <div className="hero-panel">
            <div className="kicker">Vibes DIY Ads</div>
            <h1>Campaign Health</h1>
            <p className="meta">
              {data.dateLabel} · generated {data.generatedAt}
            </p>
          </div>

          <section>
            <h2>Campaigns</h2>
            <p>Ranked by cost-per-LPV. Healthy range: $0.20–$0.35 per landing-page view.</p>
            <div className="tier-key">
              <span>
                <span className="tier-green">■</span> &lt; $0.30 — green
              </span>
              <span>
                <span className="tier-yellow">■</span> $0.30–$0.50 — watch
              </span>
              <span>
                <span className="tier-red">■</span> &gt; $0.50 or — — review
              </span>
            </div>
            {data.ranked.length === 0 ? (
              <div className="ok-badge" style={{ background: "#fef9c3", borderColor: "#ca8a04", color: "#78350f" }}>
                No campaign data for this period.
              </div>
            ) : (
              <CampaignTable ranked={data.ranked} dupes={data.anomalies.duplicateNames} />
            )}
          </section>

          <section>
            <h2>Pixel health</h2>
            <PixelSection pixel={data.anomalies.pixel} />
          </section>

          <section>
            <h2>Anomalies</h2>
            <AnomalySection anomalies={data.anomalies} />
          </section>
        </main>
      </body>
    </html>
  );
}

export function renderCampaignHealthReport(data: CampaignHealthData): string {
  return "<!doctype html>" + renderToStaticMarkup(<ReportPage data={data} />);
}
