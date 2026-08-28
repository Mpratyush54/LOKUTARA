"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AssessmentResults } from "@/components/app/AssessmentsModule";

function ResultsBody() {
  const params = useParams<{ id: string }>();
  return <AssessmentResults assessmentId={params.id} />;
}

export default function AssessmentResultsPage() {
  return (
    <Suspense fallback={<div className="app-skeleton app-skeleton-hero" aria-busy="true" />}>
      <ResultsBody />
    </Suspense>
  );
}
