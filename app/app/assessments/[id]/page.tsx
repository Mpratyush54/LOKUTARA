"use client";

import { useParams } from "next/navigation";
import { AssessmentRunner } from "@/components/app/AssessmentsModule";

export default function AssessmentRunPage() {
  const params = useParams<{ id: string }>();
  return <AssessmentRunner assessmentId={params.id} />;
}
