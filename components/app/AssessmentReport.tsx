"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AssessmentReport } from "@/lib/product/report";
import { jsonFetch } from "./AppShell";
import { showAppToast } from "./AppToast";
import { DownloadReportButton } from "./DownloadReportButton";

export function ScoreDial({
  score,
  size = 120,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className="score-dial" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${clamped} of 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="score-dial-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="score-dial-fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c.toFixed(1)}`}
          strokeDashoffset={(c - filled).toFixed(1)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="score-dial-text">
        <strong className="num">{clamped}</strong>
        {label ? <span className="meta">{label}</span> : null}
      </div>
    </div>
  );
}

const LEVEL_COPY: Record<string, { title: string; next: string }> = {
  higher: {
    title: "A relative strength in this sitting",
    next: "Use it deliberately this week — put this theme to work in one real situation and notice what happens.",
  },
  typical: {
    title: "Around the middle in this sitting",
    next: "Nothing urgent here. If you want movement, pick one small experiment and repeat it twice.",
  },
  lower: {
    title: "Lower in this sitting",
    next: "Treat this as information, not a verdict. One slower conversation — with a manager, coach, or counsellor — is the next step, not a fix.",
  },
};

export function ReportBands({ report }: { report: AssessmentReport }) {
  return (
    <article className="report-card">
      <p className="eyebrow">Report</p>
      <h1>{report.title}</h1>
      <div className="report-hero">
        <ScoreDial score={report.score} size={148} label="Overall" />
        <div className="report-hero-copy">
          <p className="lead">{report.headline}</p>
          <p>{report.summary}</p>
        </div>
      </div>
      <ul className="report-bands">
        {report.bands.map((band) => {
          const level = LEVEL_COPY[band.level] ?? LEVEL_COPY.typical;
          return (
            <li key={band.id} className="report-band">
              <div className="report-band-head">
                <div>
                  <strong>{band.label}</strong>
                  <p className="meta">{level.title}</p>
                </div>
                <ScoreDial score={band.score} size={84} />
              </div>
              <span className="dash-run-track report-band-track" aria-hidden="true">
                <span style={{ width: `${Math.max(8, band.score)}%` }} />
              </span>
              <p>{band.copy}</p>
              <p className="meta report-next">What to try: {level.next}</p>
            </li>
          );
        })}
      </ul>
      <p className="meta">{report.caveat}</p>
    </article>
  );
}

export function AssessmentReportView({ runId }: { runId: string }) {
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void (async () => {
      const { res, body } = await jsonFetch(`/api/workspace/assessments/runs/${runId}`);
      if (!res.ok) {
        showAppToast(body.message || "Could not open this report.");
        setMissing(true);
        return;
      }
      setReport(body.report as AssessmentReport);
      setCreatedAt(body.run?.createdAt ?? null);
    })();
  }, [runId]);

  if (missing) {
    return (
      <p className="lead">
        This report could not be opened. <Link href="/app/assessments">Back to assessments</Link>.
      </p>
    );
  }
  if (!report) {
    return <div className="app-skeleton app-skeleton-hero" aria-busy="true" data-testid="report-skeleton" />;
  }

  return (
    <div className="module-stack report-page">
      <ReportBands report={report} />
      {createdAt ? (
        <p className="meta">Taken {new Date(createdAt).toLocaleString("en-IN")}</p>
      ) : null}
      <div className="paywall-actions">
        <DownloadReportButton runId={runId} className="btn btn-primary">
          Export report (PDF)
        </DownloadReportButton>
        <Link className="btn btn-secondary" href="/app/assessments">
          All assessments
        </Link>
        <Link className="btn btn-ghost" href={`/app/assessments/${report.assessmentId}`}>
          Retake
        </Link>
      </div>
    </div>
  );
}
