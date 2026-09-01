"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AssessmentReport } from "@/lib/product/report";
import { jsonFetch } from "./AppShell";
import { showAppToast } from "./AppToast";
import { DownloadReportButton } from "./DownloadReportButton";

export function ReportBands({ report }: { report: AssessmentReport }) {
  return (
    <article className="report-card">
      <p className="eyebrow">Report</p>
      <h1>{report.title}</h1>
      <p className="result-score num">{report.score}</p>
      <p className="lead">{report.headline}</p>
      <p>{report.summary}</p>
      <ul className="report-bands">
        {report.bands.map((band) => (
          <li key={band.id}>
            <div className="report-band-head">
              <strong>{band.label}</strong>
              <span className="num">{band.score}</span>
            </div>
            <span className="dash-run-track" aria-hidden="true">
              <span style={{ width: `${Math.max(8, band.score)}%` }} />
            </span>
            <p className="meta">{band.copy}</p>
          </li>
        ))}
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
        <DownloadReportButton runId={runId} className="btn btn-primary" />
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
