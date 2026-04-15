// Future live React app plan:
// 1. Keep the database access on the server side and expose a small read-only API instead of connecting React directly to Neon from the browser.
// 2. Split the current report into typed endpoints such as /api/db/info, /api/db/table-counts, /api/db/user-model-settings, and /api/db/app-model-settings.
// 3. Reuse the existing inspect-db query logic in a shared server module so both CLI/report generation and the future app use the same SQL and safety checks.
// 4. Render the report in React with route-level loaders or fetch calls, replacing CSV snapshots with live JSON responses.
// 5. Add pagination, filters, and auth/authorization before exposing broader table inspection to the team.
// 6. Keep the CSV/HTML export path as an offline snapshot feature triggered from the live UI when needed.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

interface ReportData {
  readonly generatedAt: string;
  readonly info: {
    readonly database: string;
    readonly current_schema: string;
    readonly current_user: string;
    readonly server_addr: string;
    readonly server_port: number;
    readonly schemas: readonly string[];
  };
  readonly tableCounts: readonly { readonly table: string; readonly rowCount: number }[];
  readonly membershipSummary: {
    readonly membership_count: number;
    readonly shared_app_count: number;
    readonly distinct_member_count: number;
  };
  readonly membershipTimeseries: readonly Record<string, unknown>[];
  readonly activeVibesTimeseries: readonly Record<string, unknown>[];
  readonly userSlugBindingsTimeseries: readonly Record<string, unknown>[];
  readonly membershipsByApp: readonly Record<string, unknown>[];
  readonly userModelRows: readonly Record<string, unknown>[];
  readonly appModelRows: readonly Record<string, unknown>[];
  readonly userSettingsSample: readonly Record<string, unknown>[];
  readonly appSettingsSample: readonly Record<string, unknown>[];
}

function flattenValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function collectKeys(rows: readonly Record<string, unknown>[]): string[] {
  return Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
}

function DataTable({ rows }: { readonly rows: readonly Record<string, unknown>[] }): React.ReactElement | null {
  if (rows.length === 0) {
    return <p className="empty">No rows</p>;
  }

  const keys = collectKeys(rows);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {keys.map((key) => (
                <td key={key}>
                  <pre>{flattenValue(row[key])}</pre>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendChart({
  rows,
  valueKey,
}: {
  readonly rows: readonly Record<string, unknown>[];
  readonly valueKey: string;
}): React.ReactElement | null {
  if (rows.length === 0) {
    return null;
  }

  const values = rows.map((row) => Number(row[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const width = 720;
  const height = 220;
  const padding = 18;
  const pointCoords = values.map((value, index) => {
    const x = rows.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (rows.length - 1);
    const y = height - padding - (value / max) * (height - padding * 2);
    return { x, y };
  });
  const pointsStr = pointCoords.map(({ x, y }) => `${x},${y}`).join(" ");

  const lastValue = values[values.length - 1] ?? 0;
  const firstDay = (rows[0]?.["day"] as string) ?? "";
  const lastDay = (rows[rows.length - 1]?.["day"] as string) ?? "";

  return (
    <div className="trend-card">
      <div className="trend-meta">
        <div>
          <div className="label">Current Total</div>
          <div className="trend-value">{lastValue}</div>
        </div>
        <div className="trend-range">
          {firstDay} to {lastDay}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="30 day trend">
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        <g stroke="rgba(15, 23, 42, 0.18)" strokeWidth="1">
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} />
        </g>
        <polyline fill="none" stroke="var(--ink)" strokeWidth="5" points={pointsStr} />
        {pointCoords.map(({ x, y }, i) => (
          <circle key={i} cx={x} cy={y} r="4" fill="var(--plate)" stroke="var(--ink)" strokeWidth="3" />
        ))}
      </svg>
    </div>
  );
}

function TrendSection({
  title,
  description,
  rows,
  valueKey,
}: {
  readonly title: string;
  readonly description: string;
  readonly rows: readonly Record<string, unknown>[];
  readonly valueKey: string;
}): React.ReactElement {
  return (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      <TrendChart rows={rows} valueKey={valueKey} />
    </section>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: unknown }): React.ReactElement {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{String(value)}</div>
    </div>
  );
}

const reportCss = `
:root {
  color-scheme: light;
  --paper: #f1f5f9;
  --grid-soft: #cbd5e1;
  --grid-strong: #94a3b8;
  --slate: #64748b;
  --ink: #0f172a;
  --plate: #ffffff;
  --panel: #e2e8f0;
  --shadow: #242424;
  --accent: #94a3b8;
  --accent-strong: #64748b;
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
}
* { box-sizing: border-box; }
html {
  background:
    repeating-linear-gradient(0deg, transparent 0 19px, var(--grid-soft) 19px 20px),
    repeating-linear-gradient(90deg, transparent 0 19px, var(--grid-soft) 19px 20px),
    linear-gradient(180deg, #f8fbff 0%, var(--paper) 100%);
  background-attachment: fixed;
}
body {
  margin: 0;
  font-family: "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif;
  background: transparent;
  color: var(--ink);
  min-height: 100vh;
  position: relative;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: var(--grain);
  opacity: 0.05;
  mix-blend-mode: multiply;
  pointer-events: none;
  filter: blur(0.6px) contrast(102%) brightness(101%);
}
main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px 72px;
  position: relative;
}
h1, h2, h3 { margin: 0; }
h1 {
  font-size: clamp(40px, 7vw, 72px);
  line-height: 0.95;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}
h2 {
  font-size: 28px;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
p {
  color: var(--slate);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
.hero {
  display: grid;
  gap: 20px;
  margin-bottom: 32px;
}
.meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.card {
  background: var(--plate);
  border: 4px solid var(--ink);
  border-radius: 0;
  padding: 16px;
  box-shadow: 8px 8px 0 var(--shadow);
}
.label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--slate);
  margin-bottom: 8px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 700;
}
.value {
  font-size: 30px;
  color: var(--ink);
}
section {
  margin-top: 32px;
}
section > h2,
section > p {
  position: relative;
  z-index: 1;
}
section > h2 {
  display: inline-block;
  background: var(--panel);
  border: 4px solid var(--ink);
  padding: 10px 14px 8px;
  box-shadow: 6px 6px 0 var(--shadow);
}
section > p {
  margin: 14px 0 0;
  max-width: 860px;
}
.table-wrap {
  overflow: auto;
  border: 4px solid var(--ink);
  border-radius: 0;
  background: var(--plate);
  box-shadow: 10px 10px 0 var(--shadow);
  margin-top: 16px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  text-align: left;
  vertical-align: top;
  padding: 12px 14px;
  border-bottom: 3px solid var(--ink);
  border-right: 3px solid var(--ink);
}
th:last-child,
td:last-child {
  border-right: 0;
}
tbody tr:last-child td {
  border-bottom: 0;
}
th {
  position: sticky;
  top: 0;
  background:
    radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.16) 1px, transparent 0) 0 0 / 12px 12px,
    linear-gradient(180deg, var(--panel) 0%, #dbe4ef 100%);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  z-index: 1;
}
td pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.empty {
  margin-top: 16px;
  padding: 18px;
  background: var(--plate);
  border: 4px dashed var(--ink);
  border-radius: 0;
  box-shadow: 8px 8px 0 var(--shadow);
}
.hero-panel {
  background: var(--plate);
  border: 6px solid var(--ink);
  box-shadow: 12px 12px 0 var(--shadow);
  padding: 20px;
}
.hero-kicker {
  display: inline-block;
  margin-bottom: 14px;
  padding: 8px 12px;
  background: linear-gradient(180deg, #dbe4ef 0%, var(--accent) 100%);
  color: var(--ink);
  border: 3px solid var(--ink);
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.hero-panel p {
  margin: 14px 0 0;
  max-width: 760px;
}
.trend-card {
  margin-top: 16px;
  background: var(--plate);
  border: 4px solid var(--ink);
  box-shadow: 10px 10px 0 var(--shadow);
  padding: 16px;
}
.trend-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: end;
  margin-bottom: 12px;
}
.trend-value {
  font-size: 40px;
  line-height: 1;
}
.trend-range {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--slate);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.trend-chart {
  width: 100%;
  height: auto;
  display: block;
  background:
    repeating-linear-gradient(0deg, transparent 0 19px, rgba(148, 163, 184, 0.2) 19px 20px);
}
@media (max-width: 640px) {
  main {
    padding: 20px 12px 56px;
  }
  .card,
  .empty,
  .hero-panel,
  .trend-card,
  .table-wrap,
  section > h2 {
    box-shadow: 6px 6px 0 var(--shadow);
  }
  th, td {
    padding: 10px;
  }
  .trend-meta {
    flex-direction: column;
    align-items: start;
  }
}
`;

function ReportPage(data: ReportData): React.ReactElement {
  const {
    generatedAt,
    info,
    tableCounts,
    membershipSummary,
    membershipTimeseries,
    activeVibesTimeseries,
    userSlugBindingsTimeseries,
    membershipsByApp,
    userModelRows,
    appModelRows,
    userSettingsSample,
    appSettingsSample,
  } = data;
  const totalRows = tableCounts.reduce((sum, row) => sum + Number(row.rowCount || 0), 0);
  const lastBindingsCount = userSlugBindingsTimeseries[userSlugBindingsTimeseries.length - 1]?.["user_slug_bindings_count"] ?? 0;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Inspect DB Report</title>
        <style dangerouslySetInnerHTML={{ __html: reportCss }} />
      </head>
      <body>
        <main>
          <div className="hero">
            <div className="hero-panel">
              <div className="hero-kicker">Team Snapshot</div>
              <h1>Inspect DB Report</h1>
              <p>
                Generated {generatedAt} for {info.database} / {info.current_schema}.
              </p>
            </div>
            <div className="meta">
              <MetricCard label="Memberships" value={membershipSummary.membership_count ?? 0} />
              <MetricCard label="User Slug Bindings" value={lastBindingsCount} />
              <MetricCard label="Shared Apps" value={membershipSummary.shared_app_count ?? 0} />
              <MetricCard label="Distinct Members" value={membershipSummary.distinct_member_count ?? 0} />
              <MetricCard label="Database" value={info.database} />
              <MetricCard label="Schema" value={info.current_schema} />
              <MetricCard label="User" value={info.current_user} />
              <MetricCard label="Tables" value={tableCounts.length} />
              <MetricCard label="Rows Counted" value={totalRows} />
              <MetricCard label="Model Rows" value={userModelRows.length + appModelRows.length} />
            </div>
          </div>

          <TrendSection
            title="Memberships Over 30 Days"
            description="Daily cumulative total of currently active memberships, where one membership is one non-owner user with durable access to one specific vibe by approved request or accepted invite."
            rows={membershipTimeseries}
            valueKey="membership_count"
          />

          <TrendSection
            title="Vibes With Data"
            description="Daily cumulative total of vibes with Fireproof data written by their owner. Each distinct userSlug/appSlug pair in AppSlugBindings counts as one active vibe."
            rows={activeVibesTimeseries}
            valueKey="active_vibes_count"
          />

          <TrendSection
            title="User Slug Bindings Over 30 Days"
            description="Daily cumulative total of rows in UserSlugBindings over the last 30 days."
            rows={userSlugBindingsTimeseries}
            valueKey="user_slug_bindings_count"
          />

          <section>
            <h2>Memberships By App</h2>
            <p>
              A membership is one non-owner user with durable access to one specific vibe, whether that access came from an accepted
              invite or an approved request including auto-approval.
            </p>
            <DataTable rows={membershipsByApp} />
          </section>

          <section>
            <h2>Table Counts</h2>
            <DataTable rows={tableCounts} />
          </section>

          <section>
            <h2>User Model Settings</h2>
            <DataTable rows={userModelRows} />
          </section>

          <section>
            <h2>App Model Settings</h2>
            <DataTable rows={appModelRows} />
          </section>

          <section>
            <h2>User Settings Sample</h2>
            <DataTable rows={userSettingsSample} />
          </section>

          <section>
            <h2>App Settings Sample</h2>
            <DataTable rows={appSettingsSample} />
          </section>
        </main>
      </body>
    </html>
  );
}

export function renderHtmlReport(data: ReportData): string {
  return "<!doctype html>" + renderToStaticMarkup(ReportPage(data));
}
