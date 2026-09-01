"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function AssessmentResultsRedirectPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const runId = search.get("run");

  useEffect(() => {
    if (runId) {
      router.replace(`/app/assessments/runs/${runId}`);
      return;
    }
    router.replace(params.id ? `/app/assessments/${params.id}` : "/app/assessments");
  }, [params.id, runId, router]);

  return <div className="app-skeleton app-skeleton-hero" aria-busy="true" />;
}
