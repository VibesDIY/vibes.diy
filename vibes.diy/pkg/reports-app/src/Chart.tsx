import { useMemo, useState } from "react";
import type { ResReportGrowthMemberships, ResReportGrowthVibesWithData } from "@vibes.diy/api-types";

// Hand-rolled brand-matching chart: ink polyline, plate-filled circles,
// chunky tooltips with offset shadow. Matches the printed-paper look of
// the old inspect-db HTML report so the two share a visual language.

interface ChartPoint {
  readonly day: string;
  readonly value: number;
  readonly tooltipLines: readonly string[];
}

interface ChartProps {
  readonly points: readonly ChartPoint[];
  readonly current: number;
}

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = 18;

function LineChart({ points, current }: ChartProps) {
  const [hover, setHover] = useState<number | undefined>(undefined);

  const yMax = useMemo(() => {
    let max = 0;
    for (const p of points) if (p.value > max) max = p.value;
    return Math.max(max, 1);
  }, [points]);

  function xFor(i: number): number {
    if (points.length <= 1) return WIDTH / 2;
    return PADDING + (i * (WIDTH - PADDING * 2)) / (points.length - 1);
  }

  function yFor(v: number): number {
    return HEIGHT - PADDING - (v / yMax) * (HEIGHT - PADDING * 2);
  }

  const pointsStr = points.map((p, i) => `${xFor(i).toFixed(2)},${yFor(p.value).toFixed(2)}`).join(" ");

  const firstDay = points[0]?.day ?? "";
  const lastDay = points[points.length - 1]?.day ?? "";

  return (
    <div className="trend-card">
      <div className="trend-meta">
        <div>
          <div className="label">Current Total</div>
          <div className="trend-value">{current.toLocaleString()}</div>
        </div>
        <div className="trend-range">
          {firstDay} to {lastDay}
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="trend-chart"
          role="img"
          aria-label="30 day trend"
          onMouseLeave={() => setHover(undefined)}
        >
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="transparent" />
          <g stroke="rgba(15, 23, 42, 0.18)" strokeWidth={1}>
            <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} />
            <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} />
            <line x1={PADDING} y1={HEIGHT / 2} x2={WIDTH - PADDING} y2={HEIGHT / 2} />
          </g>
          <polyline fill="none" stroke="var(--ink)" strokeWidth={5} points={pointsStr} />
          {points.map((p, i) => {
            const cx = xFor(i);
            const cy = yFor(p.value);
            const colW = (WIDTH - PADDING * 2) / Math.max(1, points.length - 1);
            return (
              <g key={p.day}>
                <rect
                  x={cx - colW / 2}
                  y={PADDING}
                  width={colW}
                  height={HEIGHT - PADDING * 2}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={hover === i ? 8 : 6}
                  fill="var(--plate)"
                  stroke="var(--ink)"
                  strokeWidth={3}
                  className="trend-point"
                />
              </g>
            );
          })}
        </svg>
        {hover !== undefined ? (
          <Tooltip
            point={points[hover]}
            leftPct={(xFor(hover) / WIDTH) * 100}
            topPct={(yFor(points[hover].value) / HEIGHT) * 100}
          />
        ) : null}
      </div>
    </div>
  );
}

function Tooltip({ point, leftPct, topPct }: { point: ChartPoint; leftPct: number; topPct: number }) {
  return (
    <div
      className="trend-tooltip"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, calc(-100% - 14px))",
      }}
    >
      <div className="tt-day">{point.day}</div>
      <div className="tt-value">{point.value.toLocaleString()}</div>
      {point.tooltipLines.length > 0 ? <div className="tt-slugs">{point.tooltipLines.join(" · ")}</div> : null}
    </div>
  );
}

export function MembershipsChart({ data }: { data: ResReportGrowthMemberships }) {
  const points = useMemo<readonly ChartPoint[]>(
    () =>
      data.days.map((d) => ({
        day: d.day,
        value: d.memberships,
        tooltipLines: d.newMembers.length > 0 ? [`New: ${d.newMembers.join(", ")}`] : [],
      })),
    [data]
  );
  return <LineChart points={points} current={data.total} />;
}

export function VibesWithDataChart({ data }: { data: ResReportGrowthVibesWithData }) {
  const points = useMemo<readonly ChartPoint[]>(
    () => data.days.map((d) => ({ day: d.day, value: d.vibes, tooltipLines: [] })),
    [data]
  );
  return <LineChart points={points} current={data.total} />;
}
