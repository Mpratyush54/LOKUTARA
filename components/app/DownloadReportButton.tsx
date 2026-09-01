"use client";

import { useState } from "react";
import { showAppToast } from "./AppToast";

export function DownloadReportButton({
  runId,
  className = "btn btn-secondary",
}: {
  runId: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    const res = await fetch(`/api/workspace/assessments/runs/${runId}/pdf`, { credentials: "include" });
    if (!res.ok) {
      showAppToast("Could not download this report. Try again in a moment.");
      setBusy(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lokutara-report-${runId.slice(0, 12)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBusy(false);
  }

  return (
    <button type="button" className={className} disabled={busy} onClick={() => void download()}>
      {busy ? "Preparing PDF…" : "Download PDF"}
    </button>
  );
}
