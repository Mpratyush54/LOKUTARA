import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingPanel } from "@/components/app/BillingPanel";

export const metadata: Metadata = {
  title: "Billing · Lokutara",
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="app-skeleton app-skeleton-hero" aria-busy="true" />}>
      <BillingPanel />
    </Suspense>
  );
}
