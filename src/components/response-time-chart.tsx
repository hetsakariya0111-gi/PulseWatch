"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatResponseTime, formatShortDate } from "@/lib/format";

/**
 * Response-time trend.
 *
 * A client component because Recharts measures the container in the browser.
 * Only the chart is client-side — the page that hosts it stays a server
 * component and streams the data in as props.
 */

export interface ResponseTimeChartPoint {
  bucket: Date;
  avgResponseTimeMs: number | null;
  totalChecks: number;
  failedChecks: number;
}

interface ChartDatum {
  label: string;
  avgResponseTimeMs: number | null;
  totalChecks: number;
  failedChecks: number;
}

function toDatum(point: ResponseTimeChartPoint, granularity: "hour" | "day"): ChartDatum {
  return {
    label:
      granularity === "hour"
        ? `${String(point.bucket.getUTCHours()).padStart(2, "0")}:00`
        : formatShortDate(point.bucket),
    avgResponseTimeMs: point.avgResponseTimeMs,
    totalChecks: point.totalChecks,
    failedChecks: point.failedChecks,
  };
}

export function ResponseTimeChart({
  points,
  granularity,
  height = 240,
}: {
  points: ResponseTimeChartPoint[];
  granularity: "hour" | "day";
  height?: number;
}) {
  const data = points.map((point) => toDatum(point, granularity));

  if (data.length === 0 || data.every((datum) => datum.totalChecks === 0)) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        No checks recorded in this window yet.
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="responseTimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            minTickGap={28}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={64}
            stroke="var(--muted-foreground)"
            tickFormatter={(value) => formatResponseTime(typeof value === "number" ? value : null)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--popover-foreground)",
            }}
            formatter={(value) => [
              formatResponseTime(typeof value === "number" ? value : null),
              "Avg response",
            ]}
          />
          <Area
            type="monotone"
            dataKey="avgResponseTimeMs"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#responseTimeFill)"
            // A bucket with no successful checks has a null average; joining
            // across it keeps the trend readable instead of breaking the line.
            connectNulls
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
