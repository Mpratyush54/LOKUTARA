"use client";

import { useParams } from "next/navigation";
import { AssessmentReportView } from "@/components/app/AssessmentReport";

export default function AssessmentReportPage() {
  const params = useParams<{ runId: string }>();
  return <AssessmentReportView runId={params.runId} />;
}
