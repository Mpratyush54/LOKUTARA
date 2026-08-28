import type { Metadata } from "next";
import { AskThread } from "@/components/app/CommunityModule";

export const metadata: Metadata = {
  title: "Ask · Lokutara",
  robots: { index: false, follow: false },
};

export default function AskPage() {
  return <AskThread />;
}
