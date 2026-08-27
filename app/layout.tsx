import type { Metadata } from "next";
import "./globals.css";
import { SiteProviders } from "@/components/tracking/SiteProviders";

export const metadata: Metadata = {
  title: "Lokutara · Capacity building for Bengaluru teams",
  description:
    "Psychology-led workshops, manager effectiveness, and counselling for Bengaluru startups and SMEs. Book a complimentary discovery call.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteProviders>{children}</SiteProviders>
      </body>
    </html>
  );
}
