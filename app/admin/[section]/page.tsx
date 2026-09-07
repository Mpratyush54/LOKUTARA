"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminDashboard, type AdminTab } from "@/components/admin/AdminDashboard";

const SECTIONS: AdminTab[] = ["overview", "leads", "assessments", "community", "billing", "people", "experiments"];

export default function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  if (!(SECTIONS as string[]).includes(section)) notFound();
  return <AdminDashboard key={section} initialTab={section as AdminTab} />;
}
