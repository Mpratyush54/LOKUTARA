"use client";

import { useParams } from "next/navigation";
import { ThreadDetail } from "@/components/app/CommunityModule";

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  return <ThreadDetail id={params.id} />;
}
