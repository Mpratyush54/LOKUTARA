import { LandingExperience } from "@/components/landing/LandingExperience";
import { parseLandingQuery } from "@/lib/landing/urlState";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <LandingExperience initial={parseLandingQuery(params)} />;
}
