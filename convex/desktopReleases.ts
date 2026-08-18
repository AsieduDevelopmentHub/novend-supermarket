import { v } from "convex/values";
import { query } from "./_generated/server";

/** Desktop installers are not published in this slice. */
export const getInstallOffer = query({
  args: {
    preferredArch: v.optional(v.string()),
    channel: v.optional(v.string()),
  },
  handler: async () => {
    return null as {
      version?: string;
      releasedAt?: number;
      downloads: Partial<Record<string, { url: string; size?: number }>>;
      installers: Array<{
        kind: string;
        platform?: "win32" | "darwin" | "linux";
        url: string;
        fileName: string;
        label?: string;
        description?: string;
        size?: number;
        arch?: string;
      }>;
    } | null;
  },
});
