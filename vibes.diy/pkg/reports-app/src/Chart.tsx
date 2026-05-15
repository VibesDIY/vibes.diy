import * as React from "react";
import { useMemo, useState } from "react";
import type { ResReportGrowthMemberships, ResReportGrowthVibesWithData } from "@vibes.diy/api-types";

// Hand-rolled line + dots chart so we ship zero chart-lib bytes. SVG
// viewBox lets the chart scale crisply at any container width; the
// outer wrapper is flex/width:100%, the chart fills it.

interface ChartPoint {
  readonly day: string;
  readonly value: number;
  readonly tooltipLines: readonly string[];
}

interface ChartProps {
  readonly points: readonly ChartPoint[];
  readonly yLabel: string;
}

const WIDTH = 1000;
const HEIGHT = 280;
const PADDING_LEFT = 56;
const PADDING_RIGHT = 16;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 36;

function computeYMax(points: readonly ChartPoint[]): number {
  let max = 0;
  for (const p of points) if (p.value > max) max = p.value;
  if (max <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / mag) * mag;
}

function LineChart({ points, yLabel }: ChartProps) {
  const [hover, setHover] = useState<number | undefined>(undefined);

  const innerW = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerH = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const yMax = useMemo(() => computeYMax(points), [points]);

  function xFor(i: number): number {
    if (points.length <= 1) return PADDING_LEFT + innerW / 2;
    return PADDING_LEFT + (i * innerW) / (points.length - 1);
  }

  function yFor(v: number): number {
    return PADDING_TOP + innerH - (innerH * v) / Math.max(1, yMax);
  }

  function pathSegments(): string {
    if (points.length === 0) return "";
    const parts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const cmd = i === 0 ? "M" : "L";
      parts.push(`${cmd} ${xFor(i).toFixed(2)} ${yFor(points[i].value).toFixed(2)}`);
    }
    return parts.join(" ");
  }

  function areaSegments(): string {
    if (points.length === 0) return "";
    const top = pathSegments();
    const lastX = xFor(points.length - 1).toFixed(2);
    const firstX = xFor(0).toFixed(2);
    const baseY = (PADDING_TOP + innerH).toFixed(2);
    return `${top} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }

  const yTicks: number[] = [];
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) yTicks.push(Math.round((yMax * i) / ySteps));

  const xTicks: number[] = [];
  const xSteps = 5;
  for (let i = 0; i <= xSteps; i++) xTicks.push(Math.round((i * (points.length - 1)) / xSteps));

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHover(undefined)}
      >
        {yTicks.map((v) => {
          const y = yFor(v);
          return (
            <g key={v}>
              <line x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={y} y2={y} stroke="#1a2030" strokeWidth={1} />
              <text x={PADDING_LEFT - 8} y={y + 3.5} fill="#5b6678" fontSize={10} textAnchor="end">
                {v}
              </text>
            </g>
          );
        })}
        <text
          x={12}
          y={PADDING_TOP + innerH / 2}
          fill="#5b6678"
          fontSize={10}
          textAnchor="middle"
          transform={`rotate(-90 12 ${PADDING_TOP + innerH / 2})`}
        >
          {yLabel}
        </text>
        <path d={areaSegments()} fill="rgba(124, 183, 255, 0.08)" />
        <path d={pathSegments()} fill="none" stroke="#7cb7ff" strokeWidth={2} />
        {xTicks.map((i) => {
          const p = points[i];
          if (p === undefined) return null;
          return (
            <text key={i} x={xFor(i)} y={HEIGHT - 12} fill="#5b6678" fontSize={10} textAnchor="middle">
              {p.day.slice(5)}
            </text>
          );
        })}
        {points.map((p, i) => {
          const cx = xFor(i);
          const cy = yFor(p.value);
          const colW = innerW / Math.max(1, points.length - 1);
          return (
            <g key={p.day}>
              <rect
                x={cx - colW / 2}
                y={PADDING_TOP}
                width={colW}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <circle
                cx={cx}
                cy={cy}
                r={hover === i ? 4 : 2.5}
                fill={hover === i ? "#f4f6fa" : "#7cb7ff"}
                stroke="#0b0e13"
                strokeWidth={1}
              />
            </g>
          );
        })}
        {hover !== undefined ? (
          <line
            x1={xFor(hover)}
            x2={xFor(hover)}
            y1={PADDING_TOP}
            y2={PADDING_TOP + innerH}
            stroke="#2a3142"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
      </svg>
      {hover !== undefined ? (
        <Tooltip point={points[hover]} leftPct={(xFor(hover) / WIDTH) * 100} topPct={(yFor(points[hover].value) / HEIGHT) * 100} />
      ) : null}
    </div>
  );
}

function Tooltip({ point, leftPct, topPct }: { point: ChartPoint; leftPct: number; topPct: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, calc(-100% - 12px))",
        background: "#1a2030",
        border: "1px solid #2a3142",
        borderRadius: 6,
        padding: "8px 10px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        fontSize: 12,
        maxWidth: 280,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ color: "#8b95a5", marginBottom: 4 }}>{point.day}</div>
      <div style={{ color: "#f4f6fa", fontWeight: 600, marginBottom: point.tooltipLines.length > 0 ? 6 : 0 }}>
        {point.value.toLocaleString()}
      </div>
      {point.tooltipLines.length > 0 ? (
        <div style={{ color: "#d6dde6", fontSize: 11, whiteSpace: "normal" }}>{point.tooltipLines.join(", ")}</div>
      ) : null}
    </div>
  );
}

export function MembershipsChart({ data }: { data: ResReportGrowthMemberships }) {
  const points = useMemo<readonly ChartPoint[]>(
    () =>
      data.days.map((d) => ({
        day: d.day,
        value: d.memberships,
        tooltipLines: d.newMembers.length > 0 ? [`new: ${d.newMembers.join(", ")}`] : [],
      })),
    [data]
  );
  return <LineChart points={points} yLabel="memberships" />;
}

export function VibesWithDataChart({ data }: { data: ResReportGrowthVibesWithData }) {
  const points = useMemo<readonly ChartPoint[]>(
    () => data.days.map((d) => ({ day: d.day, value: d.vibes, tooltipLines: [] })),
    [data]
  );
  return <LineChart points={points} yLabel="vibes" />;
}
