import type { Metadata } from "next";
import { AssessmentsCatalog } from "@/components/app/AssessmentsModule";

export const metadata: Metadata = {
  title: "Assessments · Lokutara",
  robots: { index: false, follow: false },
};

export default function AssessmentsPage() {
  return <AssessmentsCatalog />;
}
