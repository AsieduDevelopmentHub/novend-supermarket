"use client";

import { use } from "react";
import { UserDetailView } from "@/features/users/components/user-detail-view";
import { Id } from "@/convex/_generated/dataModel";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserDetailView profileId={id as Id<"profiles">} />;
}
