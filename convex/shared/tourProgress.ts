import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type PublicTourProgress = {
  tourId: string;
  version: number;
  status: "in_progress" | "completed" | "skipped";
  lastStepId: string | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export function toPublicTourProgress(row: {
  tourId: string;
  version: number;
  status: PublicTourProgress["status"];
  lastStepId?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}): PublicTourProgress {
  return {
    tourId: row.tourId,
    version: row.version,
    status: row.status,
    lastStepId: row.lastStepId ?? null,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? null,
  };
}

export async function loadTourProgressForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  profile: Doc<"profiles"> | null,
): Promise<PublicTourProgress[]> {
  const rows = await ctx.db
    .query("userTourProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length > 0) return rows.map(toPublicTourProgress);
  return (profile?.tourProgress ?? []).map(toPublicTourProgress);
}

export async function syncProfileTourProgress(
  ctx: MutationCtx,
  profile: Doc<"profiles"> | null,
  entry: {
    tourId: string;
    version: number;
    status: PublicTourProgress["status"];
    lastStepId?: string;
    startedAt: number;
    updatedAt: number;
    completedAt?: number;
  },
) {
  if (!profile) return;
  const rows = [...(profile.tourProgress ?? [])];
  const next = {
    tourId: entry.tourId,
    version: entry.version,
    status: entry.status,
    startedAt: entry.startedAt,
    updatedAt: entry.updatedAt,
    ...(entry.lastStepId ? { lastStepId: entry.lastStepId } : {}),
    ...(entry.completedAt ? { completedAt: entry.completedAt } : {}),
  };
  const index = rows.findIndex((row) => row.tourId === entry.tourId);
  if (index >= 0) rows[index] = next;
  else rows.push(next);
  await ctx.db.patch(profile._id, { tourProgress: rows });
}
