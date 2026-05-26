import React, { useMemo, useState } from "react";
import type { ResReportGrowthMemberships, ResReportGrowthVibesWithData, ResReportActiveMembers } from "@vibes.diy/api-types";

// Chart styled to match the builders editorial brand: red/cyan polyline,
// cream-filled circles with matching stroke, thin near-black axis lines.

interface ChartPoint {
  readonly day: string;
  readonly value: number;
  readonly tooltipLines: readonly string[];
}

interface ChartProps {
  readonly points: readonly ChartPoint[];
  readonly current: number;
  readonly stroke: string;
}

const WIDTH = 960;
const HEIGHT = 260;
const PADDING_L = 32;
const PADDING_R = 16;
const PADDING_T = 16;
const PADDING_B = 28;

function LineChart({ points, current, stroke }: ChartProps) {
  const [hover, setHover] = useState<number | undefined>(undefined);

  const innerW = WIDTH - PADDING_L - PADDING_R;
  const innerH = HEIGHT - PADDING_T - PADDING_B;

  const yMax = useMemo(() => {
    let max = 0;
    for (const p of points) if (p.value > max) max = p.value;
    return Math.max(max, 1);
  }, [points]);

  function xFor(i: number): number {
    if (points.length <= 1) return PADDING_L + innerW / 2;
    return PADDING_L + (i * innerW) / (points.length - 1);
  }

  function yFor(v: number): number {
    return PADDING_T + innerH - (innerH * v) / yMax;
  }

  const pointsStr = points.map((p, i) => `${xFor(i).toFixed(2)},${yFor(p.value).toFixed(2)}`).join(" ");

  const firstDay = points[0]?.day ?? "";
  const lastDay = points[points.length - 1]?.day ?? "";

  return (
    <div className="trend-card">
      <div className="trend-meta">
        <div>
          <div className="trend-current">{current.toLocaleString()}</div>
        </div>
        <div className="trend-range">
          {firstDay} → {lastDay}
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
          <g stroke="var(--near-black)" strokeWidth={1}>
            <line x1={PADDING_L} y1={PADDING_T} x2={PADDING_L} y2={HEIGHT - PADDING_B} />
            <line x1={PADDING_L} y1={HEIGHT - PADDING_B} x2={WIDTH - PADDING_R} y2={HEIGHT - PADDING_B} />
          </g>
          {/* x-axis date labels — first and last day only. The 30-day range
              is implied; intermediate ticks would just be visual noise. */}
          <text
            x={PADDING_L}
            y={HEIGHT - PADDING_B + 18}
            fill="var(--gray-mid)"
            fontSize={11}
            textAnchor="start"
            fontFamily="var(--font-main)"
          >
            {firstDay}
          </text>
          <text
            x={WIDTH - PADDING_R}
            y={HEIGHT - PADDING_B + 18}
            fill="var(--gray-mid)"
            fontSize={11}
            textAnchor="end"
            fontFamily="var(--font-main)"
          >
            {lastDay}
          </text>
          <line
            x1={PADDING_L}
            y1={PADDING_T + innerH / 2}
            x2={WIDTH - PADDING_R}
            y2={PADDING_T + innerH / 2}
            stroke="var(--gray-light)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <polyline fill="none" stroke={stroke} strokeWidth={3} points={pointsStr} />
          {points.map((p, i) => {
            const cx = xFor(i);
            const cy = yFor(p.value);
            const colW = innerW / Math.max(1, points.length - 1);
            return (
              <g key={p.day}>
                <rect
                  x={cx - colW / 2}
                  y={PADDING_T}
                  width={colW}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={hover === i ? 7 : 5}
                  fill="var(--cream)"
                  stroke={stroke}
                  strokeWidth={2.5}
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
        transform: "translate(-50%, calc(-100% - 12px))",
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
  return <LineChart points={points} current={data.total} stroke="var(--red)" />;
}

export function ActiveMembersChart({ data }: { data: ResReportActiveMembers }) {
  const points = useMemo<readonly ChartPoint[]>(
    () => data.days.map((d) => ({ day: d.day, value: d.count, tooltipLines: [] })),
    [data]
  );
  const peak = useMemo(() => Math.max(...data.days.map((d) => d.count), 0), [data]);
  return <LineChart points={points} current={peak} stroke="var(--cyan)" />;
}

export function VibesWithDataChart({ data }: { data: ResReportGrowthVibesWithData }) {
  const points = useMemo<readonly ChartPoint[]>(
    () => data.days.map((d) => ({ day: d.day, value: d.vibes, tooltipLines: [] })),
    [data]
  );
  return <LineChart points={points} current={data.total} stroke="var(--cyan)" />;
}
