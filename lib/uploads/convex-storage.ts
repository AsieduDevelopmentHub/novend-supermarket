import type { Id } from "@/convex/_generated/dataModel";

type BeginResult = {
  uploadUrl: string;
  sessionId: Id<"storageUploadSessions">;
};

export async function uploadAndClaimStorage(options: {
  begin: () => Promise<BeginResult>;
  claim: (args: {
    sessionId: Id<"storageUploadSessions">;
    storageId: Id<"_storage">;
  }) => Promise<unknown>;
  body: Blob;
  contentType: string;
}): Promise<Id<"_storage">> {
  const started = await options.begin();
  const response = await fetch(started.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": options.contentType },
    body: options.body,
  });
  if (!response.ok) throw new Error("Upload failed");
  const json = (await response.json()) as { storageId?: Id<"_storage"> };
  if (!json.storageId) throw new Error("Upload failed");
  await options.claim({ sessionId: started.sessionId, storageId: json.storageId });
  return json.storageId;
}
