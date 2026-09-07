import { useEffect, useRef, useState } from "react";
import type { DayPoint } from "@/lib/charts/series";
import { formatInrFromPaise } from "@/lib/billing/invoices";

export type { DayPoint };

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const isTestEnv = typeof process !== "undefined" && process.env?.NODE_ENV === "test";
  const [display, setDisplay] = useState(isTestEnv ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (
      isTestEnv ||
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }
    const from = first.current ? 0 : display;
    first.current = false;
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    let live = true;
    function tick(now: number) {
      if (!live || typeof window === "undefined") return;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setDisplay(from + (value - from) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const text = format ? format(display) : Math.round(display).toLocaleString("en-IN");
  return <span className="num">{text}</span>;
}

export function TrendChart({
  points,
  valueKey,
  label,
}: {
  points: DayPoint[];
  valueKey: "views" | "leads" | "signups" | "revenue";
  label: string;
}) {
  const values = points.map((point) => point[valueKey] ?? 0);
  const max = Math.max(1, ...values);
  const width = 560;
  const height = 168;
  const pad = 12;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const coords = values.map((value, i) => {
    const x = pad + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = pad + innerH - (value / max) * innerH;
    return { x, y };
  });
  const line = coords
    .map((point, i) => `${i === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${(coords.at(-1)?.x ?? pad).toFixed(1)} ${(height - pad).toFixed(1)} L${pad} ${(height - pad).toFixed(1)} Z`;
  const last = values.at(-1) ?? 0;
  const lastLabel = valueKey === "revenue" ? formatInrFromPaise(last) : last;
  const gridYs = [pad, pad + innerH / 2, pad + innerH];

  return (
    <figure className="chart-card">
      <figcaption>
        <span>{label}</span>
        <strong className="num">{lastLabel}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} over ${points.length} days`} preserveAspectRatio="none" className="chart-svg chart-animated">
        {gridYs.map((gy) => (
          <line key={gy} x1={pad} x2={width - pad} y1={gy} y2={gy} className="chart-gridline" />
        ))}
        {coords.length > 1 ? (
          <>
            <path d={area} className="chart-fill chart-fill-animated" />
            <path d={line} className="chart-line chart-line-animated" pathLength={1} fill="none" />
            {coords.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={4}
                className="chart-dot"
                style={{ animationDelay: `${0.15 + (i / Math.max(1, coords.length - 1)) * 0.7}s` }}
              >
                <title>{`${points[i]?.date ?? ""}: ${values[i]?.toLocaleString("en-IN")}`}</title>
              </circle>
            ))}
          </>
        ) : (
          <path d={`M${pad} ${height - pad} H${width - pad}`} className="chart-line" />
        )}
      </svg>
    </figure>
  );
}

export function DonutChart({
  segments,
  label,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  label: string;
}) {
  const total = Math.max(1, segments.reduce((sum, seg) => sum + seg.value, 0));
  const size = 168;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <figure className="chart-card">
      <figcaption>
        <span>{label}</span>
        <strong className="num">{total.toLocaleString("en-IN")}</strong>
      </figcaption>
      <div className="donut-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label} className="donut-svg">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sand)" strokeWidth={stroke} />
          {segments.map((seg) => {
            const frac = seg.value / total;
            const dash = frac * c;
            const offset = acc * c;
            acc += frac;
            return (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash.toFixed(1)} ${(c - dash).toFixed(1)}`}
                strokeDashoffset={(-offset).toFixed(1)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="donut-seg"
              >
                <title>{`${seg.label}: ${seg.value.toLocaleString("en-IN")} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <ul className="donut-legend">
          {segments.map((seg) => (
            <li key={seg.label}>
              <span className="donut-swatch" style={{ background: seg.color }} aria-hidden="true" />
              <span>{seg.label}</span>
              <span className="num">{Math.round((seg.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function ChartSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true">
      <div className="admin-skeleton admin-skeleton-hero" />
      <div className="admin-stat-grid">
        <div className="admin-skeleton admin-skeleton-stat" />
        <div className="admin-skeleton admin-skeleton-stat" />
        <div className="admin-skeleton admin-skeleton-stat" />
      </div>
    </div>
  );
}

export function FunnelBars({
  steps,
}: {
  steps: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  const first = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="funnel-bars">
      {steps.map((step, i) => (
        <li key={step.label}>
          <div className="funnel-bars-meta">
            <span>{step.label}</span>
            <span className="num">
              <CountUp value={step.value} />{" "}
              <span className="meta">· {Math.round((step.value / first) * 100)}%</span>
            </span>
          </div>
          <div className="funnel-track" aria-hidden="true">
            <span
              className="funnel-fill-animated"
              style={{ width: `${Math.max(6, (step.value / max) * 100)}%`, animationDelay: `${i * 0.12}s` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
