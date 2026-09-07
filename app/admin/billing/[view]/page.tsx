"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminDashboard, type BillingView } from "@/components/admin/AdminDashboard";

const VIEWS: BillingView[] = ["bills", "new", "promos", "seller"];

export default function AdminBillingViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = use(params);
  if (!(VIEWS as string[]).includes(view)) notFound();
  return <AdminDashboard key={`billing-${view}`} initialTab="billing" initialBillingView={view as BillingView} />;
}
