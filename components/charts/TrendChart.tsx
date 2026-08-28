"use client";

export type DayPoint = { date: string; views: number; leads: number };

export function TrendChart({
  points,
  valueKey,
  label,
}: {
  points: DayPoint[];
  valueKey: "views" | "leads";
  label: string;
}) {
  const values = points.map((point) => point[valueKey]);
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

  return (
    <figure className="chart-card">
      <figcaption>
        <span>{label}</span>
        <strong className="num">{last}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} over ${points.length} days`}>
        <path d={area} className="chart-fill" />
        <path d={line} className="chart-line" />
      </svg>
    </figure>
  );
}

export function FunnelBars({
  steps,
}: {
  steps: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <ul className="funnel-bars">
      {steps.map((step) => (
        <li key={step.label}>
          <div className="funnel-bars-meta">
            <span>{step.label}</span>
            <span className="num">{step.value}</span>
          </div>
          <div className="funnel-track" aria-hidden="true">
            <span style={{ width: `${Math.max(6, (step.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
