import type { Metadata } from "next";
import { AppHome } from "@/components/app/AppHome";

export const metadata: Metadata = {
  title: "Dashboard · Lokutara",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return <AppHome />;
}
