import type { Metadata } from "next";
import { CommunityExplore } from "@/components/app/CommunityModule";

export const metadata: Metadata = {
  title: "Community · Lokutara",
  robots: { index: false, follow: false },
};

export default function CommunityPage() {
  return <CommunityExplore />;
}
