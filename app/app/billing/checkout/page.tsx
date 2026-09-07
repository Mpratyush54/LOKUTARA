import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutReview } from "@/components/app/CheckoutReview";

export const metadata: Metadata = {
  title: "Checkout · Lokutara",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="app-skeleton app-skeleton-hero" aria-busy="true" />}>
      <CheckoutReview />
    </Suspense>
  );
}
